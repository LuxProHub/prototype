"""Record search / filter / detail + dashboard stats + mapping introspection."""
from __future__ import annotations

import json
import re
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select, text as sa_text
from sqlalchemy.orm import Session, selectinload

from ..config import settings
from ..database.session import IS_POSTGRES, get_db, get_read_db
from ..core.cache import get_cached_default_count, set_cached_default_count
from ..core.search import build_search_filter
from ..core.security import (
    get_current_user, require_export_permission, require_role,
)
from ..models.models import (
    ContactVerdict, ExportAuditLog, Lead, LeadStage, ProcessingError,
    ProcessingJob, Record, RecordEditAudit, RecordStatus, SourceFile, User,
    UserRole,
)
from ..schemas.schemas import (
    AliasRequest, ColumnMappingOut, DashboardStats, FilterOptions, JobOut, Page, RecordOut,
)
from engine import cleaning as C
from engine import validation as V

router = APIRouter()

SORTABLE = {
    "id": Record.id, "name": Record.name, "community": Record.community,
    "sub_community": Record.sub_community, "building_cluster": Record.building_cluster,
    "unit_number": Record.unit_number, "size": Record.size,
    "bedroom": Record.bedroom, "procedure_value": Record.procedure_value,
    "mobile_1": Record.mobile_1, "status": Record.status,
    "created_at": Record.created_at, "record_date": Record.record_date,
    "source_file": Record.source_file,
}

# Free-text search now lives in core/search.py. It tokenises the query and
# requires every token to match, so "Mohammed Ahmed Marina Heights" finds the
# owner even though no single column holds all four words -- the old whole-
# phrase ILIKE across 13 columns could not, and forced a sequential scan
# besides. See that module for why the column list moved with it.

# Counting every matching row costs a full scan of the match set, which at 20M
# rows is seconds for a broad filter and is spent on a number nobody reads past
# the first significant digit. Counting stops here and the UI shows "20,000+"
# or "5,000+" for broad free-text search.
COUNT_CEILING = 20_000
COUNT_CEILING_SEARCH = 5_000



def _build_records_query(
    q: str | None = None,
    community: str | None = None,
    sub_community: str | None = None,
    building_cluster: str | None = None,
    property_type: str | None = None,
    bedroom: str | None = None,
    developer: str | None = None,
    nationality: str | None = None,
    source_file: str | None = None,
    job_id: int | None = None,
    record_status: str | None = None,
    has_mobile: bool | None = None,
    has_email: bool | None = None,
):
    stmt = select(Record)
    search = build_search_filter(q, is_postgres=IS_POSTGRES)
    if search is not None:
        stmt = stmt.where(search)

    for col, val in (
        (Record.sub_community, sub_community),
        (Record.building_cluster, building_cluster),
        (Record.developer, developer),
        (Record.nationality, nationality), (Record.source_file, source_file),
    ):
        if val:
            stmt = stmt.where(col == val)

    if community:
        comm_clean = community.strip()
        COMMUNITY_ALIASES = {
            "Jumeirah Village Circle": ["Jumeirah Village Circle", "0 Consolidated JVC Mar", "Jvc", "JVC"],
            "Dubai Hills Estate": ["Dubai Hills Estate", "0 Consolidated Dubai Hills March 2026 Partial for all ongoing", "Dubai Hills"],
            "Downtown Dubai": ["Downtown Dubai", "0 Consolidated downtown Jan", "Downtown"],
            "Dubai Marina": ["Dubai Marina", "0 Consolidated Dubai Marina"],
            "Business Bay": ["Business Bay", "Business Bay Jan 2025 dec 24 data", "0 Consolidated Data Business Bay 2024 Nov", "Business Bay ("],
            "Jumeirah Lake Towers": ["Jumeirah Lake Towers", "0 Consolidated data JLT Nov", "JLT", "Jumeirah Lakes Towers"],
            "Meydan": ["Meydan", "0 Meydan Consolidated Dec end2024", "Meydan Consolidated"],
            "Abu Dhabi": ["Abu Dhabi", "20260903103145288218 Abu Dhabi Data mayl", "20260903103053117965 Abu Dhabi Data mayl"],
            "Al Kifaf": ["Al Kifaf", "20260903102332962533 AL kifaf park gate residences"],
            "Deira Islands": ["Deira Islands", "20260903102555171551 Deira Island"],
        }
        aliases = COMMUNITY_ALIASES.get(comm_clean, [comm_clean])
        if len(aliases) > 1:
            stmt = stmt.where(Record.community.in_(aliases))
        else:
            stmt = stmt.where(Record.community == comm_clean)

    if bedroom:
        b_clean = bedroom.strip()
        stmt = stmt.where(
            or_(
                Record.bedroom == b_clean,
                Record.bedroom.ilike(f"%{b_clean}%")
            )
        )

    if property_type:
        pt_clean = property_type.strip()
        pt_low = pt_clean.lower()
        if pt_low == "apartment":
            stmt = stmt.where(or_(
                Record.property_type.ilike("Apartment%"),
                Record.property_type.ilike("Flat%"),
                Record.property_type.ilike("Unit%"),
                Record.property_type.ilike("Residential Flat%"),
            ))
        elif pt_low == "villa":
            stmt = stmt.where(or_(
                Record.property_type.ilike("Villa%"),
                Record.property_type.ilike("Residential Villa%"),
            ))
        elif pt_low == "townhouse":
            stmt = stmt.where(or_(
                Record.property_type.ilike("Townhouse%"),
                Record.property_type.ilike("Town House%"),
                Record.property_type.ilike("Townhome%"),
            ))
        else:
            stmt = stmt.where(Record.property_type.ilike(pt_clean))

    # "Verified valid mobile": non-null, non-N/A, and matching one of the three
    # accepted E.164 shapes (UAE mobile, UAE landline, other international) --
    # so truncated junk like +55240883 or 055240883 is excluded.
    #
    # This used to be three regexes evaluated against every row on every page
    # load, which no index can serve and which the default view runs
    # unconditionally. The rule now lives in the has_valid_mobile generated
    # column, computed once at write time, and the partial indexes added in
    # 9c41ab7de205 are built on it.
    valid_mobile_filter = (Record.has_valid_mobile == True)

    if record_status:
        st_upper = record_status.upper()
        if st_upper in ("ALL", "ALL_RECORDS", "ALL_WITH_INCOMPLETE", "SHOW_ALL"):
            pass  # show all records including duplicates and incomplete
        elif st_upper in ("INCOMPLETE", "MISSING_CONTACT"):
            stmt = stmt.where(
                or_(
                    Record.status == "INCOMPLETE",
                    Record.mobile_1.is_(None),
                    ~valid_mobile_filter,
                )
            )
        elif st_upper in ("VALID", "COMPLETE"):
            # All valid records (outreach-ready with standard valid phone)
            stmt = stmt.where(Record.status == "VALID")
            stmt = stmt.where(valid_mobile_filter)
        else:
            stmt = stmt.where(Record.status == st_upper)
    else:
        # Default: show all valid outreach-ready records (with verified valid phone)
        stmt = stmt.where(Record.status == "VALID")
        stmt = stmt.where(valid_mobile_filter)
    if job_id is not None:
        stmt = stmt.where(Record.job_id == job_id)
    if has_mobile is True:
        stmt = stmt.where(Record.mobile_1.is_not(None))
    elif has_mobile is False:
        stmt = stmt.where(Record.mobile_1.is_(None))
    if has_email is True:
        stmt = stmt.where(Record.email_address.is_not(None))
    elif has_email is False:
        stmt = stmt.where(Record.email_address.is_(None))

    # Opt-outs, enforced here rather than at each call site, because the two
    # call sites are exactly the paths that must honour them: the list the desk
    # calls from, and the export it takes off-platform. A DO_NOT_CONTACT stage
    # that still appears in either is not an opt-out, it is a note.
    #
    # An anti-join on identity_hash rather than record_id: the lead survives
    # reprocessing and its record_id is briefly NULL afterwards, so keying on
    # the pointer would let an opted-out person reappear in the window between
    # a reprocess and the relink.
    #
    # leads is small -- a row exists only where someone was actually worked --
    # so this stays a cheap semi-join against a unique index, not a scan.
    stmt = stmt.where(
        ~select(Lead.id)
        .where(
            Lead.identity_hash == Record.identity_hash,
            or_(
                Lead.stage == LeadStage.DO_NOT_CONTACT,
                # A number a human dialled and disproved outranks anything the
                # pipeline inferred about it. has_valid_mobile only says the
                # number is well FORMED; only a call can say it is WRONG.
                Lead.contact_verdict.in_(ContactVerdict.SUPPRESSING),
            ),
        )
        .exists()
    )

    return stmt


@router.get("/records", response_model=Page[RecordOut])
def list_records(
    q: str | None = Query(None, description="Free-text search across name, location, contact."),
    community: str | None = None,
    sub_community: str | None = None,
    building_cluster: str | None = None,
    property_type: str | None = None,
    bedroom: str | None = None,
    developer: str | None = None,
    nationality: str | None = None,
    source_file: str | None = None,
    job_id: int | None = None,
    status: str | None = None,
    record_status: str | None = None,
    has_mobile: bool | None = None,
    has_email: bool | None = None,
    sort_by: str = Query("id"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.DEFAULT_PAGE_SIZE, ge=1, le=settings.MAX_PAGE_SIZE),
    limit: int | None = Query(None, ge=1, le=settings.MAX_PAGE_SIZE, description="Alias for page_size"),
    total_hint: int | None = Query(None, description="Previous total from page 1 to bypass redundant counting during pagination"),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_read_db),
):
    effective_page_size = limit if limit is not None else page_size

    if sort_by not in SORTABLE:
        raise HTTPException(400, f"sort_by must be one of {sorted(SORTABLE)}")

    effective_status = status or record_status
    stmt = _build_records_query(
        q=q, community=community, sub_community=sub_community,
        building_cluster=building_cluster, property_type=property_type,
        bedroom=bedroom, developer=developer, nationality=nationality,
        source_file=source_file, job_id=job_id, record_status=effective_status,
        has_mobile=has_mobile, has_email=has_email,
    )

    # Counting the full match set is a scan of every matching row. On a broad
    # filter over millions of records that is the slowest part of the request.
    # For default unfiltered views on PostgreSQL, we cache the genuine exact count
    # in-process with invalidation on record edits/ingestion to eliminate repeated
    # scans while maintaining complete correctness.
    # When free-text searching, count is capped at COUNT_CEILING_SEARCH (5,000)
    # to avoid multi-second bitmap walks.
    # When paginating past page 1, client passes total_hint to avoid re-counting.
    has_narrowing_filter = bool(
        q or community or sub_community or building_cluster or property_type
        or bedroom or developer or nationality or source_file or job_id
        or has_email or (has_mobile is False)
    )

    active_ceiling = COUNT_CEILING_SEARCH if q else COUNT_CEILING

    if not has_narrowing_filter and IS_POSTGRES and (effective_status in (None, "", "VALID", "COMPLETE", "ALL", "ALL_RECORDS", "SHOW_ALL", "DUPLICATE")):
        cached_count = get_cached_default_count()
        if cached_count is not None:
            total = cached_count
            total_capped = False
        else:
            total = db.scalar(
                select(func.count()).select_from(stmt.subquery())
            ) or 0
            set_cached_default_count(total)
            total_capped = False
    elif total_hint is not None and page > 1:
        total = total_hint
        total_capped = total >= active_ceiling
    else:
        total = db.scalar(
            select(func.count()).select_from(stmt.limit(active_ceiling).subquery())
        ) or 0
        total_capped = total >= active_ceiling

    col = SORTABLE[sort_by]
    if q and sort_by == "id":
        # Free-text search with default ordering: skip full 174,000-row heapsort
        # so GIN index scan stops immediately at LIMIT 25 in <150ms.
        pass
    elif sort_by == "id":
        # Primary key index is (id ASC) or (id DESC) with default NULLS FIRST.
        # id is NOT NULL; omitting .nullslast() allows PostgreSQL to use idx_records_default_id
        # directly in an Index-Only Scan (0.17ms) instead of a 400ms parallel heapsort.
        stmt = stmt.order_by(Record.id.desc() if sort_dir == "desc" else Record.id.asc())
    elif sort_by == "name" and sort_dir == "asc" and not q:
        # On default initial page load, prioritize complete records where procedure_value > 0 so VALUE (AED) and BEDROOM are visible right at the top
        stmt = stmt.order_by(
            Record.procedure_value.desc().nullslast(),
            Record.bedroom.desc().nullslast(),
            col.asc().nullslast(),
            Record.id.desc(),
        )
    else:
        order_clause = col.desc().nullslast() if sort_dir == "desc" else col.asc().nullslast()
        stmt = stmt.order_by(order_clause, Record.id.desc())

    # OFFSET is bounded by COUNT_CEILING above (the UI cannot page past the
    # capped total), so the planner never walks more than a few thousand index
    # entries before the LIMIT. That keeps plain offset pagination viable; if
    # deeper navigation is ever exposed, this is the point to switch to a
    # keyset cursor on (sort_key, id).
    rows = db.scalars(stmt.offset((page - 1) * effective_page_size).limit(effective_page_size)).all()
    pages = (total + effective_page_size - 1) // effective_page_size
    return Page[RecordOut](
        items=[RecordOut.model_validate(r) for r in rows], total=total, page=page,
        page_size=effective_page_size, total_pages=pages, has_next=page < pages, has_prev=page > 1,
        total_capped=total_capped,
    )


@router.get("/records/export")
def export_records(
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    q: str | None = None,
    community: str | None = None,
    sub_community: str | None = None,
    building_cluster: str | None = None,
    property_type: str | None = None,
    bedroom: str | None = None,
    developer: str | None = None,
    nationality: str | None = None,
    source_file: str | None = None,
    job_id: int | None = None,
    status: str | None = None,
    record_status: str | None = None,
    has_mobile: bool | None = None,
    has_email: bool | None = None,
    sort_by: str = Query("id"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    limit: int = Query(50000, ge=1, le=100000),
    request: Request = None,
    current_user: User = Depends(require_export_permission),
    db: Session = Depends(get_db),
):
    """Export filtered dataset to CSV or Excel (.xlsx). Exactly respects active search and filters."""
    import csv
    import tempfile
    from datetime import datetime, timezone
    from fastapi.responses import StreamingResponse
    from ..database.session import read_engine

    if sort_by not in SORTABLE:
        sort_by = "id"

    effective_status = status or record_status
    stmt = _build_records_query(
        q=q, community=community, sub_community=sub_community,
        building_cluster=building_cluster, property_type=property_type,
        bedroom=bedroom, developer=developer, nationality=nationality,
        source_file=source_file, job_id=job_id, record_status=effective_status,
        has_mobile=has_mobile, has_email=has_email,
    )

    col = SORTABLE[sort_by]
    order_clause = col.desc().nullslast() if sort_dir == "desc" else col.asc().nullslast()
    stmt = stmt.order_by(order_clause, Record.id.desc()).limit(limit)

    export_cols = [
        Record.id, Record.name, Record.community, Record.sub_community, Record.building_cluster,
        Record.unit_number, Record.plot_number, Record.plot_reg_no, Record.dmno, Record.dmsubno,
        Record.bedroom, Record.property_type, Record.developer, Record.project, Record.party_type,
        Record.size, Record.procedure_value, Record.mobile_1, Record.mobile_2, Record.mobile_3,
        Record.email_address, Record.nationality, Record.pi_number, Record.status, Record.source_file,
        Record.record_date,
    ]

    headers = [
        "Record ID", "Name", "Community", "Sub-Community", "Building / Cluster",
        "Unit Number", "Plot Number", "Plot Reg. No", "DMNO", "DMsubno",
        "Bedroom", "Property Type", "Developer", "Project", "Party Type (Buyer/Seller)",
        "Size (Sq.Ft)", "Procedure Value (AED)",
        "Mobile 1 (Primary)", "Mobile 2", "Mobile 3", "Email Address",
        "Nationality", "PI Number", "Status", "Source File", "Record Date",
    ]

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    user_id = current_user.id
    user_email = current_user.email

    # Fast connection-isolated fetch: read data via read_engine and spool immediately,
    # then release the DB connection before client network transmission begins.
    row_count = 0
    if format == "xlsx":
        import openpyxl
        from openpyxl.cell import WriteOnlyCell
        from openpyxl.styles import Alignment, Font, PatternFill
        from openpyxl.utils import get_column_letter

        wb = openpyxl.Workbook(write_only=True)
        ws = wb.create_sheet("Datalink Export")
        header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_align = Alignment(horizontal="center", vertical="center")

        for i, h in enumerate(headers, start=1):
            ws.column_dimensions[get_column_letter(i)].width = min(max(len(h) + 3, 10), 45)
        ws.freeze_panes = "A2"

        styled_header = []
        for h in headers:
            cell = WriteOnlyCell(ws, value=h)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = header_align
            styled_header.append(cell)
        ws.append(styled_header)

        with read_engine.connect() as conn:
            query_stmt = stmt.with_only_columns(*export_cols)
            res = conn.execution_options(yield_per=2000).execute(query_stmt)
            for row in res:
                row_vals = [
                    row[0], row[1] or "", row[2] or "", row[3] or "", row[4] or "",
                    row[5] or "", row[6] or "", row[7] or "", row[8] or "", row[9] or "",
                    row[10] or "", row[11] or "", row[12] or "", row[13] or "", row[14] or "",
                    row[15] if row[15] is not None else "",
                    row[16] if row[16] is not None else "",
                    row[17] or "", row[18] or "", row[19] or "", row[20] or "",
                    row[21] or "", row[22] or "", row[23] or "", row[24] or "",
                    row[25].strftime("%Y-%m-%d") if row[25] else "",
                ]
                ws.append(row_vals)
                row_count += 1

        spool = tempfile.SpooledTemporaryFile(max_size=16 * 1024 * 1024, mode="w+b")
        wb.save(spool)
        spool.seek(0)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"datalink_records_{stamp}.xlsx"
    else:
        spool = tempfile.SpooledTemporaryFile(max_size=16 * 1024 * 1024, mode="w+", encoding="utf-8", newline="")
        spool.write("\ufeff")  # UTF-8 BOM
        writer = csv.writer(spool)
        writer.writerow(headers)

        with read_engine.connect() as conn:
            query_stmt = stmt.with_only_columns(*export_cols)
            res = conn.execution_options(yield_per=2000).execute(query_stmt)
            for row in res:
                row_vals = [
                    row[0], row[1] or "", row[2] or "", row[3] or "", row[4] or "",
                    row[5] or "", row[6] or "", row[7] or "", row[8] or "", row[9] or "",
                    row[10] or "", row[11] or "", row[12] or "", row[13] or "", row[14] or "",
                    row[15] if row[15] is not None else "",
                    row[16] if row[16] is not None else "",
                    row[17] or "", row[18] or "", row[19] or "", row[20] or "",
                    row[21] or "", row[22] or "", row[23] or "", row[24] or "",
                    row[25].strftime("%Y-%m-%d") if row[25] else "",
                ]
                writer.writerow(row_vals)
                row_count += 1

        spool.seek(0)
        media_type = "text/csv; charset=utf-8"
        filename = f"datalink_records_{stamp}.csv"

    # Log audit entry in write db without holding read connection
    audit_entry = ExportAuditLog(
        user_id=user_id,
        user_email=user_email,
        format=format.upper(),
        filter_criteria={
            "q": q, "community": community, "property_type": property_type,
            "bedroom": bedroom, "developer": developer, "status": effective_status,
        },
        row_count=row_count,
        ip_address=client_ip,
        user_agent=user_agent,
    )
    db.add(audit_entry)
    db.commit()

    def stream_spool():
        try:
            while True:
                chunk = spool.read(64 * 1024)
                if not chunk:
                    break
                yield chunk if isinstance(chunk, bytes) else chunk.encode("utf-8")
        finally:
            spool.close()

    return StreamingResponse(
        stream_spool(),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )



# --------------------------------------------------------------------------
# Cached aggregate access.
#
# Both helpers read a materialised view and return None if it is not there, so
# every caller keeps a live-query fallback. That matters in three situations:
# SQLite dev databases (no materialised views at all), a deploy where the app
# rolls out before `alembic upgrade head` has finished, and a view that has been
# dropped by hand. In all three the dashboard stays correct and merely slow,
# rather than erroring.
def _matview(db: Session, sql: str):
    try:
        return db.execute(sa_text(sql)).all()
    except Exception:
        # A missing relation aborts the surrounding PostgreSQL transaction, so
        # the session must be rolled back before the fallback query can run on it.
        db.rollback()
        return None


def _facet_cache(db: Session) -> dict[str, list[tuple[str, int]]] | None:
    """Return {column_name: [(value, n)]} from mv_record_facets ordered by n DESC, or None."""
    rows = _matview(
        db,
        "SELECT field, value, n FROM mv_record_facets "
        "WHERE value <> '' ORDER BY field, n DESC",
    )
    if rows is None:
        return None
    out: dict[str, list[tuple[str, int]]] = {}
    for field, value, n in rows:
        out.setdefault(field, []).append((value, n))
    return out


def _sanitize_communities(raw_list: list[tuple[str, int]]) -> list[str]:
    res = []
    seen = set()
    for v, _ in raw_list:
        s = v.strip()
        low = s.lower()
        if any(x in low for x in ("owner detail", "total owner", "owners data", "_multi-community", "_unclassified")):
            continue
        if s in ("0 Dubai", "112") or re.fullmatch(r"^\d+$", s) or (re.fullmatch(r"^[0-9a-fA-F\s]+$", s) and len(s) > 15):
            continue
        # Strip batch timestamp prefix like 20260903102332962533
        cleaned = re.sub(r"^\d{14,24}\s*", "", s)
        # Strip "0 Consolidated (data)?"
        cleaned = re.sub(r"^0\s+Consolidated\s+(?:data\s+)?", "", cleaned, flags=re.I)
        # Strip trailing date/noise
        cleaned = re.sub(r"\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|202\d|end202\d|ongoing|partial|for all ongoing|data mayl|data)\b.*$", "", cleaned, flags=re.I)
        cleaned = re.sub(r"\s+", " ", cleaned).strip(" -_/(#[]{}")
        u = cleaned.upper()
        if u in ("JVC", "JUMEIRAH VILLAGE CIRCLE"):
            name = "Jumeirah Village Circle"
        elif u in ("JLT", "JUMEIRAH LAKES TOWERS", "JUMEIRAH LAKE TOWERS"):
            name = "Jumeirah Lake Towers"
        elif u in ("DOWNTOWN", "DOWNTOWN JAN", "DOWNTOWN DUBAI"):
            name = "Downtown Dubai"
        elif u in ("DUBAI HILLS", "DUBAI HILLS ESTATE"):
            name = "Dubai Hills Estate"
        elif u in ("DUBAI MARINA",):
            name = "Dubai Marina"
        elif u in ("BUSINESS BAY",):
            name = "Business Bay"
        elif u in ("MEYDAN", "0 MEYDAN CONSOLIDATED"):
            name = "Meydan"
        elif u in ("ABU DHABI", "ABU DHABI PART1"):
            name = "Abu Dhabi"
        elif len(cleaned) < 2 or re.fullmatch(r"^\d+$", cleaned):
            continue
        else:
            name = cleaned.title() if (cleaned.isupper() or cleaned.islower()) else cleaned
        
        # Strip any dangling closing parens
        if name.endswith(")") and "(" not in name:
            name = name[:-1].strip()

        if name and name not in seen and not re.fullmatch(r"^\d+$", name):
            seen.add(name)
            res.append(name)
    return sorted(res)


def _sanitize_bedrooms(raw_list: list[tuple[str, int]]) -> list[str]:
    BEDROOM_ORDER = [
        "Studio", "1 BR", "1 + Terrace", "2 BR", "2 + Terrace",
        "3 BR", "3 + Terrace", "4 BR", "4 + Terrace", "5 BR",
        "6 BR", "7 BR", "8 BR", "9 BR", "10 BR",
        "Penthouse", "Duplex", "Loft", "Retail", "Office"
    ]
    seen = set()
    ordered = []
    counts = {}
    for v, n in raw_list:
        s = v.strip()
        if re.match(r"^[-_0-9]+-[0-9]+", s) or re.fullmatch(r"\d{4,}", s):
            continue
        low = s.lower()
        if low.startswith("_") or any(x in low for x in ("unclassified", "multi-community", "consolidated")):
            continue
        norm = None
        if "studio" in low:
            norm = "Studio"
        elif "penthouse" in low:
            norm = "Penthouse"
        elif "duplex" in low:
            norm = "Duplex"
        elif "loft" in low:
            norm = "Loft"
        elif "retail" in low:
            norm = "Retail"
        elif "office" in low:
            norm = "Office"
        elif "terrace" in low:
            m = re.search(r"(\d+)\s*\+\s*terrace", low)
            if m:
                norm = f"{m.group(1)} + Terrace"
            else:
                norm = s.title()
        else:
            m = re.search(r"(\d+)\s*(?:bhk|b\s*/?\s*r|bed(?:room)?s?)", low)
            if m:
                n_br = int(m.group(1))
                if 1 <= n_br <= 10:
                    norm = f"{n_br} BR"
            elif re.fullmatch(r"\d{1,2}", s):
                n_br = int(s)
                if 1 <= n_br <= 10:
                    norm = f"{n_br} BR"
        if norm:
            counts[norm] = counts.get(norm, 0) + n
            
    for item in BEDROOM_ORDER:
        if item in counts:
            ordered.append(item)
            seen.add(item)
    for item, _ in sorted(counts.items(), key=lambda x: x[1], reverse=True):
        if item not in seen:
            ordered.append(item)
            seen.add(item)
    return ordered


def _sanitize_property_types(raw_list: list[tuple[str, int]]) -> list[str]:
    PROP_ORDER = [
        "Apartment", "Villa", "Townhouse", "Penthouse", "Commercial",
        "Office", "Retail", "Plot", "Building", "Hotel Apartment",
        "Warehouse", "Showroom", "Duplex"
    ]
    CANON_MAP = {
        "apartment": "Apartment", "flat": "Apartment", "unit": "Apartment",
        "villa": "Villa", "townhouse": "Townhouse", "townhome": "Townhouse",
        "penthouse": "Penthouse", "commercial": "Commercial",
        "office": "Office", "retail": "Retail", "shop": "Retail",
        "plot": "Plot", "land": "Plot", "building": "Building",
        "hotel apartment": "Hotel Apartment", "hotel": "Hotel Apartment",
        "warehouse": "Warehouse", "showroom": "Showroom", "duplex": "Duplex"
    }
    counts = {}
    for v, n in raw_list:
        s = v.strip()
        if re.match(r"^[-_0-9]+-[0-9]+", s) or re.fullmatch(r"[0-9]{2,}[A-Za-z]+", s) or re.fullmatch(r"\d+", s):
            continue
        low = s.lower()
        if low.startswith("_") or any(x in low for x in ("unclassified", "multi-community", "consolidated")):
            continue
        norm = None
        for k, target in CANON_MAP.items():
            if k in low:
                norm = target
                break
        if norm:
            counts[norm] = counts.get(norm, 0) + n
    ordered = [p for p in PROP_ORDER if p in counts]
    return ordered


from ..core.cache import get_cached_filters, set_cached_filters, invalidate_filters_cache


@router.get("/records/filters", response_model=FilterOptions)
def filter_options(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_read_db),
):
    """Distinct values for the dashboard filter dropdowns.

    Served from in-process TTLCache or the mv_record_facets materialised view.
    """
    cached_response = get_cached_filters()
    if cached_response is not None:
        return cached_response

    facets = _facet_cache(db)

    def get_raw_facets(col, limit=500):
        if facets is not None and col.key in facets:
            return facets[col.key]
        return [
            (v, 1) for (v,) in db.execute(
                select(col).where(col.is_not(None)).distinct().limit(limit)
            ).all() if v
        ]

    res = FilterOptions(
        communities=_sanitize_communities(get_raw_facets(Record.community, limit=2000)),
        sub_communities=[v for v, _ in get_raw_facets(Record.sub_community, limit=500) if v and not v.startswith("_")][:500],
        property_types=_sanitize_property_types(get_raw_facets(Record.property_type, limit=500)),
        bedrooms=_sanitize_bedrooms(get_raw_facets(Record.bedroom, limit=500)),
        developers=[v for v, _ in get_raw_facets(Record.developer, limit=500) if v and not v.startswith("_")][:500],
        source_files=[v for v, _ in get_raw_facets(Record.source_file, limit=500) if v][:500],
        statuses=[v for v, _ in get_raw_facets(Record.status, limit=10) if v],
    )
    set_cached_filters(res)
    return res



from ..schemas.schemas import (
    ColumnMappingOut, DashboardStats, FilterOptions, JobOut, Page, RecordOut, RecordUpdate,
)

@router.get("/records/{record_id}", response_model=RecordOut)
def get_record(
    record_id: int,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_read_db),
):
    rec = db.get(Record, record_id)
    if not rec:
        raise HTTPException(404, f"Record {record_id} not found.")
    return RecordOut.model_validate(rec)


@router.get("/records/{record_id}/audits")
def get_record_audits(
    record_id: int,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_read_db),
):
    """Retrieve complete audit history for manual edits to this record."""
    audits = db.scalars(
        select(RecordEditAudit)
        .where(RecordEditAudit.record_id == record_id)
        .order_by(RecordEditAudit.edited_at.desc())
    ).all()
    return [
        {
            "id": a.id,
            "field_name": a.field_name,
            "old_value": a.old_value,
            "new_value": a.new_value,
            "user_email": a.user_email,
            "edited_at": a.edited_at.isoformat(),
        }
        for a in audits
    ]


@router.put("/records/{record_id}", response_model=RecordOut)
def update_record(
    record_id: int,
    body: RecordUpdate,
    request: Request,
    current_user: User = Depends(
        require_role(list(UserRole.at_least(UserRole.DATA_PROCESSOR)))),
    db: Session = Depends(get_db)
):
    """Hardened update endpoint: cleans fields, re-validates, re-hashes, and logs audit trail."""
    rec = db.get(Record, record_id)
    if not rec:
        raise HTTPException(404, f"Record {record_id} not found.")

    user_id = current_user.id
    user_email = current_user.email

    update_data = body.model_dump(exclude_unset=True)
    
    # Whitelist of editable business fields
    EDITABLE_FIELDS = {
        "name", "community", "sub_community", "building_cluster", "unit_number",
        "plot_number", "plot_reg_no", "dmno", "dmsubno", "bedroom", "party_type",
        "mobile_1", "mobile_2", "mobile_3", "email_address", "pi_number",
        "nationality", "property_type", "procedure_value", "size", "developer", "project"
    }

    changes: list[RecordEditAudit] = []

    for field, value in update_data.items():
        if field in EDITABLE_FIELDS:
            # Clean individual field with engine cleaning rules
            cleaned_val = value
            if field == "name":
                cleaned_val = C.clean_name(value)
            elif field == "community":
                cleaned_val = C.clean_community(value)
            elif field in ("sub_community", "building_cluster", "dmno", "dmsubno", "pi_number", "property_type", "developer", "project", "plot_reg_no"):
                cleaned_val = C.clean_text(value)
            elif field in ("unit_number", "plot_number"):
                cleaned_val = C.clean_unit(value)
            elif field in ("mobile_1", "mobile_2", "mobile_3"):
                cleaned_val, _ = C.clean_phone(value)
            elif field == "email_address":
                cleaned_val, _ = C.clean_email(value)
            elif field == "bedroom":
                cleaned_val, _ = C.clean_bedroom(value)
            elif field == "party_type":
                cleaned_val = C.clean_party_type(value)
            elif field == "nationality":
                cleaned_val = C.clean_nationality(value)
            elif field == "procedure_value":
                cleaned_val = C.clean_number(value)
            elif field == "size":
                cleaned_val = C.clean_size(value)

            old_val = getattr(rec, field)
            if old_val != cleaned_val:
                changes.append(
                    RecordEditAudit(
                        record_id=rec.id,
                        # The durable link. record_id is SET NULL now, so
                        # without this the audit trail survives a reprocess but
                        # can no longer say which record it belonged to.
                        identity_hash=rec.identity_hash,
                        user_id=user_id,
                        user_email=user_email,
                        field_name=field,
                        old_value=str(old_val) if old_val is not None else None,
                        new_value=str(cleaned_val) if cleaned_val is not None else None,
                    )
                )
                setattr(rec, field, cleaned_val)

    # Re-validate status
    row_dict = {
        "name": rec.name,
        "mobile_1": rec.mobile_1,
        "mobile_2": rec.mobile_2,
        "mobile_3": rec.mobile_3,
        "email_address": rec.email_address,
        "community": rec.community,
        "sub_community": rec.sub_community,
        "building_cluster": rec.building_cluster,
        "unit_number": rec.unit_number,
        "plot_number": rec.plot_number,
        "pi_number": rec.pi_number,
        "developer": rec.developer,
        "project": rec.project,
        "bedroom": rec.bedroom,
        "procedure_value": rec.procedure_value,
        "property_type": rec.property_type,
        "party_type": rec.party_type,
    }
    is_valid, flags = V.validate(row_dict)

    has_property = V.is_valid_property_context(row_dict)
    has_contact = bool(rec.mobile_1 or rec.email_address)
    has_name = bool(rec.name and str(rec.name).strip())

    if not is_valid:
        rec.status = RecordStatus.INVALID
    elif has_name and has_contact and has_property:
        rec.status = RecordStatus.VALID
    else:
        rec.status = "INCOMPLETE"

    rec.identity_hash = V.identity_hash(row_dict)
    rec.validation_flags = flags

    for audit in changes:
        db.add(audit)

    db.commit()
    invalidate_filters_cache()
    db.refresh(rec)
    return RecordOut.model_validate(rec)



# --------------------------------------------------------------------------
@router.get("/dashboard/stats", response_model=DashboardStats)
def dashboard_stats(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_read_db),
):
    # The stat tiles are polled by every open dashboard. Computing them live
    # meant a full-table COUNT plus a GROUP BY plus a 17-aggregate scan per
    # poll, per user -- at 60 users that is continuous full scans of a 20M-row
    # table for numbers that change only when a job finishes. mv_record_stats
    # holds all of it in a single row; the live path below still runs when the
    # view is unavailable.
    cached = _matview(db, "SELECT * FROM mv_record_stats LIMIT 1")
    stats_row = cached[0]._mapping if cached else None

    if stats_row is not None:
        total_records = stats_row["total_records"] or 0
        by_status = {
            RecordStatus.VALID: stats_row["valid_records"] or 0,
            RecordStatus.INVALID: stats_row["invalid_records"] or 0,
            "DUPLICATE": stats_row["duplicate_records"] or 0,
        }
    else:
        total_records = db.scalar(select(func.count(Record.id))) or 0
        by_status = dict(db.execute(
            select(Record.status, func.count(Record.id)).group_by(Record.status)).all())

    jobs_by_status = dict(db.execute(
        select(ProcessingJob.status, func.count(ProcessingJob.id))
        .group_by(ProcessingJob.status)).all())

    # mv_record_facets already stores a per-community count, so the top-10 chart
    # is a 10-row read from a small view instead of a GROUP BY over every record.
    top_rows = _matview(
        db,
        "SELECT value, n FROM mv_record_facets WHERE field = 'community' "
        "ORDER BY n DESC LIMIT 10",
    )
    if top_rows is None:
        top_rows = db.execute(
            select(Record.community, func.count(Record.id))
            .where(Record.community.is_not(None))
            .group_by(Record.community).order_by(func.count(Record.id).desc()).limit(10)
        ).all()
    top = [{"community": c, "count": n} for c, n in top_rows]

    # Field completeness in a single pass. This used to issue one
    # `COUNT(*) WHERE col IS NOT NULL` per field -- 17 sequential scans of the
    # whole records table on every dashboard poll. count(col) already ignores
    # NULLs, so all 17 collapse into one scan with 17 aggregates.
    COMPLETENESS_FIELDS = (
        ("name", Record.name), ("community", Record.community),
        ("sub_community", Record.sub_community),
        ("building_cluster", Record.building_cluster),
        ("unit_number", Record.unit_number), ("size", Record.size),
        ("bedroom", Record.bedroom), ("mobile_1", Record.mobile_1),
        ("email_address", Record.email_address), ("developer", Record.developer),
        ("project", Record.project), ("nationality", Record.nationality),
        ("property_type", Record.property_type), ("record_date", Record.record_date),
        ("procedure_value", Record.procedure_value),
        ("party_type", Record.party_type), ("pi_number", Record.pi_number),
    )

    completeness: dict[str, float] = {}
    if total_records:
        if stats_row is not None:
            # Same 17 aggregates, already computed by the materialised view.
            counts = [stats_row[f"c_{label}"] or 0
                      for label, _ in COMPLETENESS_FIELDS]
        else:
            counts = db.execute(
                select(*[func.count(col) for _, col in COMPLETENESS_FIELDS])
            ).one()
        completeness = {
            label: round(100.0 * n / total_records, 1)
            for (label, _), n in zip(COMPLETENESS_FIELDS, counts)
        }

    # selectinload: _job_out/JobOut reads job.source_file.filename, which
    # lazy-loads one SELECT per job without this.
    recent = db.scalars(
        select(ProcessingJob)
        .options(selectinload(ProcessingJob.source_file))
        .order_by(ProcessingJob.id.desc()).limit(10)).all()
    recent_out: list[JobOut] = []
    for j in recent:
        o = JobOut.model_validate(j)
        o.filename = j.source_file.filename if j.source_file else None
        recent_out.append(o)
    last_out = recent_out[0] if recent_out else None

    valid = by_status.get(RecordStatus.VALID, 0)
    success_rate = round(100.0 * valid / total_records, 1) if total_records else 0.0

    # The tiles count what the database HOLDS; the record list shows what the
    # desk may WORK. Opt-outs and disproved contacts make those two numbers
    # differ, and a dashboard reading 2 beside a list of 1 with no explanation
    # is how people stop trusting both. Reported rather than quietly folded in:
    # the suppressed rows are still real records and still count as inventory.
    suppressed = db.scalar(
        select(func.count(Lead.id)).where(
            or_(Lead.stage == LeadStage.DO_NOT_CONTACT,
                Lead.contact_verdict.in_(ContactVerdict.SUPPRESSING)))
    ) or 0

    return DashboardStats(
        success_rate=success_rate,
        community_distribution=[{"name": c["community"], "count": c["count"]}
                                for c in top],
        recent_jobs=recent_out,
        total_files=db.scalar(select(func.count(SourceFile.id))) or 0,
        total_jobs=db.scalar(select(func.count(ProcessingJob.id))) or 0,
        total_records=total_records,
        suppressed_records=suppressed,
        valid_records=by_status.get(RecordStatus.VALID, 0),
        invalid_records=by_status.get(RecordStatus.INVALID, 0),
        duplicate_records=db.scalar(
            select(func.coalesce(func.sum(ProcessingJob.duplicate_rows), 0))) or 0,
        total_errors=db.scalar(select(func.count(ProcessingError.id))) or 0,
        jobs_by_status=jobs_by_status,
        records_by_status=by_status,
        top_communities=top,
        field_completeness=completeness,
        last_job=last_out,
    )


@router.get("/column-mappings", response_model=ColumnMappingOut)
def column_mappings(_user: User = Depends(get_current_user)):
    """Expose the mapping layer so the dashboard can show why a column landed where."""
    from engine.mapping import FIELD_TO_COLUMN

    path = Path(__file__).resolve().parents[3] / "engine" / "resources" / "column_mapping.json"
    cfg = json.loads(path.read_text(encoding="utf8"))
    return ColumnMappingOut(
        target_fields=cfg["target_fields"],
        field_to_column=FIELD_TO_COLUMN,
        aliases=cfg["aliases"],
        composite_fields=cfg.get("composite_fields", {}),
        exclude_columns=cfg.get("exclude_columns", []),
        do_not_map=cfg.get("do_not_map", {}),
        alias_count=sum(len(v) for v in cfg["aliases"].values()),
    )


def _sync_alias_files(cfg: dict) -> None:
    """Save updated mapping config to disk and reload in-memory engine structures."""
    engine_path = Path(__file__).resolve().parents[3] / "engine" / "resources" / "column_mapping.json"

    formatted = json.dumps(cfg, indent=2, ensure_ascii=False)
    engine_path.write_text(formatted, encoding="utf8")

    # Reload engine.mapping in memory dynamically
    import engine.mapping
    engine.mapping._CFG = cfg
    engine.mapping.ALIAS = {}
    for _t, _srcs in cfg["aliases"].items():
        for _src in _srcs:
            _k = engine.mapping.norm_header(_src)
            engine.mapping.ALIAS.setdefault(_k, []).append(_t)


@router.post("/column-mappings/alias", response_model=ColumnMappingOut)
def add_alias(
    body: AliasRequest,
    _user: User = Depends(require_role(list(UserRole.at_least(UserRole.ADMIN)))),
):
    """Add a new custom header alias for a target field and persist permanently."""
    path = Path(__file__).resolve().parents[3] / "engine" / "resources" / "column_mapping.json"
    cfg = json.loads(path.read_text(encoding="utf8"))

    target = body.target_field.strip()
    alias_str = body.alias.strip()
    if not target or not alias_str:
        raise HTTPException(400, "Both target_field and alias must be non-empty strings.")

    if target not in cfg["target_fields"] and target not in cfg["aliases"]:
        raise HTTPException(404, f"Target field '{target}' not found in canonical target list.")

    aliases_list = cfg["aliases"].setdefault(target, [])
    # Case-insensitive duplicate check
    if not any(a.lower() == alias_str.lower() for a in aliases_list):
        aliases_list.append(alias_str)

    _sync_alias_files(cfg)
    return column_mappings()


@router.delete("/column-mappings/alias", response_model=ColumnMappingOut)
def remove_alias(
    body: AliasRequest,
    _user: User = Depends(require_role(list(UserRole.at_least(UserRole.ADMIN)))),
):
    """Remove a custom header alias permanently."""
    path = Path(__file__).resolve().parents[3] / "engine" / "resources" / "column_mapping.json"
    cfg = json.loads(path.read_text(encoding="utf8"))

    target = body.target_field.strip()
    alias_str = body.alias.strip()

    if target in cfg["aliases"]:
        cfg["aliases"][target] = [a for a in cfg["aliases"][target] if a.lower() != alias_str.lower()]

    _sync_alias_files(cfg)
    return column_mappings()

