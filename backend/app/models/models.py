# SQLModel schemas representing canonical real estate records and job states
"""SQLAlchemy models. Target: PostgreSQL. Compatible with SQLite for local dev."""
import os
from datetime import datetime, timezone

from sqlalchemy import (
    JSON, Boolean, CheckConstraint, Computed, DateTime, Float, ForeignKey,
    Index, Integer, String, Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# Search acceleration columns are computed by the database, not the application,
# so they can never drift out of sync with the fields they summarise. PostgreSQL
# is the production target and gets the exact expressions; SQLite (local dev
# only) gets simplified equivalents because it has no regexp_replace and no `~`
# operator. The dev approximations are good enough to keep `create_all` working
# and are never relied on for correctness -- the SQLite search path in
# core/search.py queries the underlying columns directly instead.
_IS_SQLITE = "sqlite" in os.getenv("DATABASE_URL", "sqlite").lower()

# Every field the free-text search needs to reach, concatenated and lowercased.
_SEARCH_SOURCE_FIELDS = (
    "name", "community", "sub_community", "building_cluster", "unit_number",
    "mobile_1", "mobile_2", "mobile_3", "email_address", "plot_number",
    "pi_number", "project", "developer", "property_type", "nationality",
)
SEARCH_TEXT_EXPR = "lower(" + " || ' ' || ".join(
    f"coalesce({f}, '')" for f in _SEARCH_SOURCE_FIELDS
) + ")"

_MOBILE_BLOB = " || ' ' || ".join(
    f"coalesce({f}, '')" for f in ("mobile_1", "mobile_2", "mobile_3"))

if _IS_SQLITE:
    # SQLite has no regexp_replace; strip the punctuation that actually occurs
    # in the cleaned E.164 output.
    MOBILE_DIGITS_EXPR = _MOBILE_BLOB
    for _ch in ("+", "-", " ", "(", ")"):
        MOBILE_DIGITS_EXPR = f"replace({MOBILE_DIGITS_EXPR}, '{_ch}', '')"
    # No regex: approximate "looks like a real international number".
    HAS_VALID_MOBILE_EXPR = (
        "(mobile_1 IS NOT NULL AND mobile_1 <> '' "
        "AND lower(mobile_1) <> 'n/a' AND length(mobile_1) >= 11 "
        "AND substr(mobile_1, 1, 1) = '+')"
    )
else:
    MOBILE_DIGITS_EXPR = f"regexp_replace({_MOBILE_BLOB}, '[^0-9]', '', 'g')"
    # Mirrors the three accepted shapes the API previously evaluated per row at
    # query time: UAE mobile, UAE landline, and any other E.164 number.
    HAS_VALID_MOBILE_EXPR = (
        "(mobile_1 IS NOT NULL AND mobile_1 <> '' "
        "AND lower(mobile_1) <> 'n/a' AND ("
        r"mobile_1 ~ '^\+9715[024568][0-9]{7}$' OR "
        r"mobile_1 ~ '^\+971[234679][0-9]{7}$' OR "
        r"mobile_1 ~ '^\+[1-9][0-9]{9,14}$'))"
    )


# community|building|unit blocking key. Deliberately expressed with only
# CASE/upper/trim/coalesce/nullif so one definition serves PostgreSQL and the
# SQLite dev database alike.
_PROPERTY_UNIT_EXPR = (
    "coalesce(nullif(trim(unit_number), ''), nullif(trim(plot_number), ''))"
)
PROPERTY_KEY_EXPR = (
    "CASE WHEN trim(coalesce(community, '')) <> '' "
    f"AND {_PROPERTY_UNIT_EXPR} IS NOT NULL "
    "THEN upper(trim(community)) || '|' || "
    "upper(trim(coalesce(building_cluster, ''))) || '|' || "
    f"upper({_PROPERTY_UNIT_EXPR}) END"
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class UserRole:
    """Who can do what, ordered.

    RANK exists so authority is compared rather than enumerated. An ADMIN may
    create and reset the people below them and nobody else: without an ordering,
    "admin manages users" quietly means an admin can promote themselves to CEO
    or reset the chief executive's password, which is the most common way a
    role system fails.
    """
    DEVELOPER = "DEVELOPER"          # platform owner; see GHOST below
    CEO = "CEO"
    CCO = "CCO"
    ADMIN = "ADMIN"
    DATA_PROCESSOR = "DATA_PROCESSOR"
    VIEWER = "VIEWER"

    ALL = (DEVELOPER, CEO, CCO, ADMIN, DATA_PROCESSOR, VIEWER)

    RANK = {
        VIEWER: 1,
        DATA_PROCESSOR: 2,
        ADMIN: 3,
        CCO: 4,
        CEO: 5,
        DEVELOPER: 6,
    }

    # Full sight of the business: every record, and the team analytics that say
    # who called whom and who holds which leads.
    EXECUTIVE = (DEVELOPER, CEO, CCO)

    # May create, reset and deactivate accounts -- always only those ranked
    # strictly below themselves.
    MANAGES_USERS = (DEVELOPER, CEO, CCO, ADMIN)

    # Hidden from every listing except another DEVELOPER's. Deliberately paired
    # with PrivilegedActionAudit: an account nobody can see must be an account
    # whose every action is written down, or a breach involving it can never be
    # reconstructed.
    GHOST = (DEVELOPER,)

    @staticmethod
    def rank(role: str | None) -> int:
        return UserRole.RANK.get(role or "", 0)

    @staticmethod
    def at_least(role: str) -> tuple:
        """Every role ranked at or above `role`.

        Call sites say what authority they need, not who happens to have it
        today. Listing roles by hand is how adding CEO above ADMIN silently
        locks the CEO out of everything an admin could do.
        """
        floor = UserRole.rank(role)
        return tuple(r for r in UserRole.ALL if UserRole.rank(r) >= floor)

    @staticmethod
    def outranks(actor_role: str | None, target_role: str | None) -> bool:
        """True when actor may act on target. Strict: equals cannot touch equals."""
        return UserRole.rank(actor_role) > UserRole.rank(target_role)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default=UserRole.VIEWER, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    can_export: Mapped[bool] = mapped_column(Boolean, default=False)
    # Set when an account is created or its password reset by someone else.
    # Enforced in get_current_user, not merely surfaced in the UI: a flag the
    # frontend is trusted to honour is not a control.
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ExportAuditLog(Base):
    __tablename__ = "export_audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    user_email: Mapped[str] = mapped_column(String(320), index=True)
    format: Mapped[str] = mapped_column(String(16))
    filter_criteria: Mapped[dict | None] = mapped_column(JSON)
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    ip_address: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(512))
    exported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class RecordEditAudit(Base):
    __tablename__ = "record_edits_audit"

    id: Mapped[int] = mapped_column(primary_key=True)
    # SET NULL, not CASCADE. A hand-correction is no more derivable from the
    # source file than a phone call is: reprocessing a job used to delete both
    # the correction and the record of who made it. identity_hash is the
    # durable link, the same way it is for leads.
    record_id: Mapped[int | None] = mapped_column(
        ForeignKey("records.id", ondelete="SET NULL"), index=True)
    identity_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    user_email: Mapped[str] = mapped_column(String(320), index=True)
    field_name: Mapped[str] = mapped_column(String(64), index=True)
    old_value: Mapped[str | None] = mapped_column(Text)
    new_value: Mapped[str | None] = mapped_column(Text)
    edited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class JobStatus:
    UPLOADED = "UPLOADED"
    READING = "READING"
    PROCESSING = "PROCESSING"
    VALIDATING = "VALIDATING"
    SAVING = "SAVING"
    PAUSED = "PAUSED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"
    COMPLETED_WITH_ERRORS = "COMPLETED_WITH_ERRORS"
    FAILED = "FAILED"
    ALL = (UPLOADED, READING, PROCESSING, VALIDATING, SAVING, PAUSED, CANCELLED,
           COMPLETED, COMPLETED_WITH_ERRORS, FAILED)

    # States that imply a worker should be actively advancing the job. A row
    # sitting in one of these with a stale heartbeat means its worker died.
    ACTIVE = (READING, PROCESSING, VALIDATING, SAVING, PAUSED)

    # Terminal states: no worker will touch these again.
    TERMINAL = (CANCELLED, COMPLETED, COMPLETED_WITH_ERRORS, FAILED)


class JobSignal:
    """Out-of-band control requests, stored on the job row.

    Previously these lived in a module-level dict, which only worked when the
    request that set the signal happened to land on the same process running
    the job. Persisting them means pause/cancel behave identically with any
    number of workers, and survive a restart.
    """
    PAUSE = "PAUSE"
    RESUME = "RESUME"
    CANCEL = "CANCEL"


class RecordStatus:
    VALID = "VALID"
    INVALID = "INVALID"
    DUPLICATE = "DUPLICATE"
    INCOMPLETE = "INCOMPLETE"
    QUARANTINED = "QUARANTINED"   # parsed but failed a hard business rule


class SourceFile(Base):
    __tablename__ = "source_files"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(512), index=True)
    stored_path: Mapped[str] = mapped_column(String(1024))
    size_bytes: Mapped[int] = mapped_column(Integer)
    content_sha256: Mapped[str] = mapped_column(String(64), index=True)
    detected_format: Mapped[str | None] = mapped_column(String(32))
    sheet_count: Mapped[int | None] = mapped_column(Integer)
    is_encrypted: Mapped[bool] = mapped_column(Boolean, default=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    jobs: Mapped[list["ProcessingJob"]] = relationship(back_populates="source_file")


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_file_id: Mapped[int] = mapped_column(ForeignKey("source_files.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default=JobStatus.UPLOADED, index=True)

    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    processed_rows: Mapped[int] = mapped_column(Integer, default=0)
    valid_rows: Mapped[int] = mapped_column(Integer, default=0)
    invalid_rows: Mapped[int] = mapped_column(Integer, default=0)
    duplicate_rows: Mapped[int] = mapped_column(Integer, default=0)
    skipped_rows: Mapped[int] = mapped_column(Integer, default=0)
    error_count: Mapped[int] = mapped_column(Integer, default=0)

    progress_percent: Mapped[float] = mapped_column(Float, default=0.0)
    current_sheet: Mapped[str | None] = mapped_column(String(255))
    batch_size: Mapped[int] = mapped_column(Integer, default=1000)

    # what the mapper decided, surfaced so the UI can show provenance
    mapping_report: Mapped[dict | None] = mapped_column(JSON)

    # Pause/resume/cancel requested by an operator; read by the worker between
    # batches. NULL means "no pending request".
    control_signal: Mapped[str | None] = mapped_column(String(16))

    # Touched by the worker on every progress tick. The startup reaper uses it
    # to tell a genuinely running job from one whose process is gone.
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    message: Mapped[str | None] = mapped_column(Text)

    source_file: Mapped[SourceFile] = relationship(back_populates="jobs")
    errors: Mapped[list["ProcessingError"]] = relationship(
        back_populates="job", cascade="all, delete-orphan")


class ProcessingError(Base):
    __tablename__ = "processing_errors"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("processing_jobs.id"), index=True)
    sheet_name: Mapped[str | None] = mapped_column(String(255))
    batch_number: Mapped[int | None] = mapped_column(Integer)
    source_row: Mapped[int | None] = mapped_column(Integer)
    severity: Mapped[str] = mapped_column(String(16), default="ERROR")  # ERROR | WARNING
    code: Mapped[str] = mapped_column(String(64), index=True)
    message: Mapped[str] = mapped_column(Text)
    payload: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    job: Mapped[ProcessingJob] = relationship(back_populates="errors")


class Record(Base):
    """The 23 standard fields + provenance + quality metadata.

    Every business field is nullable: the audit showed only Name, Unit Number
    and Mobile 1 are near-universal across the 100 source files. Absent data is
    stored as NULL, never as an invented value.
    """
    __tablename__ = "records"

    id: Mapped[int] = mapped_column(primary_key=True)

    # --- the 23 target fields ------------------------------------------
    name: Mapped[str | None] = mapped_column(String(512), index=True)
    community: Mapped[str | None] = mapped_column(String(255), index=True)
    sub_community: Mapped[str | None] = mapped_column(String(255), index=True)
    building_cluster: Mapped[str | None] = mapped_column(String(255), index=True)
    unit_number: Mapped[str | None] = mapped_column(String(128), index=True)
    size: Mapped[float | None] = mapped_column(Float)
    plot_reg_no: Mapped[str | None] = mapped_column(String(128))
    plot_number: Mapped[str | None] = mapped_column(String(128), index=True)
    dmno: Mapped[str | None] = mapped_column(String(64))
    dmsubno: Mapped[str | None] = mapped_column(String(64))
    bedroom: Mapped[str | None] = mapped_column(String(64), index=True)
    party_type: Mapped[str | None] = mapped_column(String(32), index=True)   # Buyer/Seller
    mobile_1: Mapped[str | None] = mapped_column(String(32), index=True)
    mobile_2: Mapped[str | None] = mapped_column(String(32))
    mobile_3: Mapped[str | None] = mapped_column(String(32))
    email_address: Mapped[str | None] = mapped_column(String(320), index=True)
    pi_number: Mapped[str | None] = mapped_column(String(64), index=True)
    nationality: Mapped[str | None] = mapped_column(String(128))
    property_type: Mapped[str | None] = mapped_column(String(128), index=True)
    record_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    procedure_value: Mapped[float | None] = mapped_column(Float)
    developer: Mapped[str | None] = mapped_column(String(255), index=True)
    project: Mapped[str | None] = mapped_column(String(255), index=True)

    # --- provenance ------------------------------------------------------
    # ON DELETE CASCADE: ProcessingError already cascaded, Record did not, so
    # deleting a job left its rows behind pointing at a job id that no longer
    # exists.
    job_id: Mapped[int] = mapped_column(
        ForeignKey("processing_jobs.id", ondelete="CASCADE"), index=True)
    source_file: Mapped[str] = mapped_column(String(512), index=True)
    source_sheet: Mapped[str | None] = mapped_column(String(255))
    source_row: Mapped[int | None] = mapped_column(Integer)

    # --- quality & dedup -------------------------------------------------
    status: Mapped[str] = mapped_column(String(24), default=RecordStatus.VALID, index=True)
    identity_hash: Mapped[str] = mapped_column(String(64), index=True)
    fuzzy_match_score: Mapped[float | None] = mapped_column(Float)
    fuzzy_matched_id: Mapped[int | None] = mapped_column(Integer)
    validation_flags: Mapped[list | None] = mapped_column(JSON)
    enriched_fields: Mapped[list | None] = mapped_column(JSON)
    owner_count: Mapped[int | None] = mapped_column(Integer)   # joint ownership size
    # Which set of engine rules produced this row. See engine/__init__.py.
    # NULL means it predates versioning, which is equivalent to "stale".
    # Indexed because the reprocess planner's only question is "which rows are
    # not at the current version", asked over the whole table.
    engine_version: Mapped[int | None] = mapped_column(Integer, index=True)
    extras: Mapped[dict | None] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # --- search acceleration (database-generated, never written by the app) --
    # These exist so the dashboard's two hottest predicates stop being computed
    # per row at query time:
    #
    #   search_text       one lowercased blob of every searchable field, with a
    #                     single GIN trigram index over it. Replaces an OR of
    #                     ILIKE across 13 separately-indexed columns, which the
    #                     planner could only answer with a full sequential scan.
    #   mobile_digits     digits-only form of all three mobile columns, so a
    #                     number can be found however it was typed.
    #   has_valid_mobile  the default view's "verified valid mobile" rule,
    #                     evaluated once at write time instead of running three
    #                     regexes against every row on every page load.
    #
    # Computed(persisted=True) emits GENERATED ALWAYS AS ... STORED, so
    # SQLAlchemy omits them from INSERT/UPDATE automatically and no ingest or
    # edit path can leave them stale.
    # Blocking key for Tier-2 fuzzy dedup: community|building|unit, uppercased,
    # falling back to plot number when there is no unit. NULL when the row has
    # no locatable property, so the partial index below stays small.
    #
    # This exists as a generated column for the same reason search_text does --
    # dedup has to probe it for a whole batch of incoming rows at once, and an
    # expression the planner cannot index turns every batch into a table scan.
    # engine/dedup.py:extract_property_key() produces the identical string in
    # Python; test_dedup_key_matches_sql_expression guards the pair.
    property_key: Mapped[str | None] = mapped_column(
        Text, Computed(PROPERTY_KEY_EXPR, persisted=True), nullable=True)

    search_text: Mapped[str | None] = mapped_column(
        Text, Computed(SEARCH_TEXT_EXPR, persisted=True), nullable=True)
    mobile_digits: Mapped[str | None] = mapped_column(
        Text, Computed(MOBILE_DIGITS_EXPR, persisted=True), nullable=True)
    has_valid_mobile: Mapped[bool | None] = mapped_column(
        Boolean, Computed(HAS_VALID_MOBILE_EXPR, persisted=True), nullable=True)

    __table_args__ = (
        Index("ix_records_location", "community", "building_cluster", "unit_number"),
        # Tier-2 dedup probes this for every incoming batch.
        Index("ix_records_property_key", "property_key"),
        Index("ix_records_job_status", "job_id", "status"),
        # run_job preloads every identity_hash already stored for the file it is
        # about to ingest; without this the lookup scans the whole table.
        # Deliberately NOT unique: the pipeline records DUPLICATE-status rows on
        # purpose, and a unique constraint would reject them at insert.
        Index("ix_records_sourcefile_identity", "source_file", "identity_hash"),
    )


class LeadStage:
    """Where a lead sits in the sales conversation, not its data quality.

    Deliberately separate from Record.status (VALID / INVALID / DUPLICATE /
    INCOMPLETE), which describes the row, not the person. Overloading one field
    with both meanings is how "is this record clean?" and "did we sell to them?"
    become the same question, and neither can be answered afterwards.
    """
    NEW = "NEW"
    CONTACTED = "CONTACTED"
    INTERESTED = "INTERESTED"
    NEGOTIATING = "NEGOTIATING"
    WON = "WON"
    LOST = "LOST"
    # Honoured by list and export paths. An opt-out that only lives in a note
    # field is not an opt-out.
    DO_NOT_CONTACT = "DO_NOT_CONTACT"

    ALL = (NEW, CONTACTED, INTERESTED, NEGOTIATING, WON, LOST, DO_NOT_CONTACT)
    OPEN = (NEW, CONTACTED, INTERESTED, NEGOTIATING)


class ContactVerdict:
    """What the phone call proved about the data.

    A salesperson who dials and hears "wrong number" has produced the single
    best available verdict on that number -- better than any regex, better than
    has_valid_mobile, better than a portal. Until now it landed in a free-text
    outcome field and died there.

    Stored on the Lead, so it is keyed by identity_hash and survives the
    reprocessing that deletes and rewrites records. That is what stops the
    engine resurrecting a number a human already disproved.
    """
    REACHED = "REACHED"                # the number is good, person confirmed
    WRONG_NUMBER = "WRONG_NUMBER"      # number belongs to someone else
    NOT_OWNER = "NOT_OWNER"            # reached someone, not this property's owner
    SOLD = "SOLD"                      # they no longer own it; record is stale
    UNREACHABLE = "UNREACHABLE"        # rang out repeatedly, no verdict either way

    ALL = (REACHED, WRONG_NUMBER, NOT_OWNER, SOLD, UNREACHABLE)

    # Verdicts that mean "do not put this in front of the desk again".
    # UNREACHABLE is deliberately absent: nobody answering is not evidence the
    # number is wrong, and dropping those would quietly delete the hard half of
    # the list.
    SUPPRESSING = (WRONG_NUMBER, NOT_OWNER, SOLD)


class ActivityKind:
    CALL = "CALL"
    WHATSAPP = "WHATSAPP"
    EMAIL = "EMAIL"
    MEETING = "MEETING"
    NOTE = "NOTE"
    STAGE_CHANGE = "STAGE_CHANGE"

    ALL = (CALL, WHATSAPP, EMAIL, MEETING, NOTE, STAGE_CHANGE)


class Lead(Base):
    """Outreach state for one owner. Created on first contact, not at ingest.

    Not columns on Record, for two reasons. At 20M rows, where a small fraction
    is ever worked, per-lead columns would be mostly NULL and every schema
    change would rewrite the whole table. And Record is derived data: it is
    deleted and rewritten wholesale whenever a job is reprocessed.

    That second point drives the keying. `identity_hash` is the durable link,
    because it survives a reprocess that renumbers every row. `record_id` is a
    convenience pointer for joins and is deliberately ON DELETE SET NULL: when
    reprocessing deletes the record, the lead must NOT go with it. Call history
    is not derivable from a source file -- lose it and it is gone.
    """
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    # The durable identity. Survives reprocessing; relink_leads() re-attaches
    # record_id afterwards by matching on it.
    identity_hash: Mapped[str] = mapped_column(String(64), index=True, unique=True)
    record_id: Mapped[int | None] = mapped_column(
        ForeignKey("records.id", ondelete="SET NULL"), index=True)

    stage: Mapped[str] = mapped_column(String(24), default=LeadStage.NEW, index=True)
    owner_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True)
    # The one question a sales desk asks every morning: what is due today.
    next_action_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), index=True)
    last_activity_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # What outreach proved about the underlying data. See ContactVerdict.
    contact_verdict: Mapped[str | None] = mapped_column(String(24), index=True)
    contact_verdict_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Who judged it. A verdict hides a record from the whole desk, so an
    # unattributed one is a claim nobody can check and nobody can appeal.
    # Denormalised email so it survives the user being deleted.
    contact_verdict_by: Mapped[str | None] = mapped_column(String(320))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    activities: Mapped[list["LeadActivity"]] = relationship(
        back_populates="lead", cascade="all, delete-orphan")

    __table_args__ = (
        # The work queue: "my open leads, soonest first".
        Index("ix_leads_queue", "owner_user_id", "stage", "next_action_at"),
    )


class LeadActivity(Base):
    """Append-only record of what was actually done. Never edited, never derived."""
    __tablename__ = "lead_activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Hangs off the lead, never off the record, so a reprocess cannot cascade
    # it away.
    lead_id: Mapped[int] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True)
    # Denormalised so history stays readable after a user is deleted.
    user_email: Mapped[str] = mapped_column(String(320))

    kind: Mapped[str] = mapped_column(String(24), index=True)
    outcome: Mapped[str | None] = mapped_column(String(64))
    note: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True)

    lead: Mapped["Lead"] = relationship(back_populates="activities")


class ErasureRequest(Base):
    """A person asked to be removed. Durable, because records are not.

    Redacting the rows is not enough on its own: records are derived data,
    rebuilt from the stored source file whenever a job is reprocessed, and that
    file still contains the person. Without a standing record of the request,
    the next reprocess quietly restores what was erased.

    Keyed by identity_hash for the same reason leads are -- it is the only
    identifier that survives rows being deleted and rewritten. apply_erasures()
    re-applies redaction after every ingest.

    Kept separate from Lead: someone can ask to be erased without ever having
    been contacted, and an auditor asks for this register on its own.
    """
    __tablename__ = "erasure_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    identity_hash: Mapped[str] = mapped_column(String(64), index=True, unique=True)

    requested_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True)
    # Denormalised so the register stays complete after a user is deleted.
    requested_by_email: Mapped[str] = mapped_column(String(320))
    reason: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    records_redacted: Mapped[int] = mapped_column(Integer, default=0)


class PrivilegedActionAudit(Base):
    """Every account action, and everything a hidden account does.

    The DEVELOPER role is invisible to all other users. That is a reasonable
    thing to want and an unreasonable thing to leave untraced: an unlogged
    superuser makes any future breach impossible to investigate, and an
    invisible one makes it impossible to even notice. So the account is hidden
    from listings, never from this table.

    Covers ordinary account administration too, because "who reset whose
    password" is exactly the question asked after an incident.
    """
    __tablename__ = "privileged_action_audit"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True)
    # Denormalised so the trail survives the actor being deleted -- including
    # by themselves.
    actor_email: Mapped[str] = mapped_column(String(320), index=True)
    actor_role: Mapped[str] = mapped_column(String(32))

    action: Mapped[str] = mapped_column(String(64), index=True)
    target_user_id: Mapped[int | None] = mapped_column(Integer, index=True)
    target_email: Mapped[str | None] = mapped_column(String(320))
    detail: Mapped[str | None] = mapped_column(Text)

    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True)


class SemanticType:
    """Sentinel for an observation whose meaning could not be determined.

    Stored rather than left NULL: NULL would be indistinguishable from "this
    field has no semantic dimension", and the review queue's whole job is to
    find the rows where we knew we did not know.
    """
    UNRESOLVED = "unresolved"


class FieldObservation(Base):
    """One observed value of one canonical field, with the meaning we read into it.

    Exists because three of the 23 fields carry a value that is unambiguous and
    a MEANING that is not:

        Date   a date, but transaction / registration / handover / lease?
        Size   a number, but square feet or square metres? (a 10.76x error)
        AREA   a place, but Community or Sub-Community? (685 occurrences)

    The flat columns on Record cannot hold that distinction. record_date is one
    timestamp; asked which kind of date it is, the row has no answer, and the
    four source semantics were collapsed into one on write -- unrecoverably.

    This table is APPEND-ONLY. A row is never updated to a better reading; a
    better reading is a new row with a higher confidence, and the old one stays
    as the record of what we previously believed and why. Record's flat columns
    remain the canonical external contract and are still written exactly as
    before -- this sits alongside them, so the 23-field API is unchanged.

    Zero data loss is structural here, not conventional: raw_value is the
    untouched source string, so even a parse that fails outright leaves the
    original recoverable.
    """
    __tablename__ = "field_observations"

    id: Mapped[int] = mapped_column(primary_key=True)
    record_id: Mapped[int] = mapped_column(
        ForeignKey("records.id", ondelete="CASCADE"), index=True)

    # --- what was observed ------------------------------------------------
    # The canonical field name as it appears in the 23 ("Date", "Size"), NOT the
    # database column. The vocabulary in engine/resources/semantic_types.json is
    # keyed by this, and raw labels like "AREA" that are not canonical fields
    # are carried here too -- which is why it is a string and not an enum.
    canonical_field: Mapped[str] = mapped_column(String(64), index=True)
    semantic_type: Mapped[str] = mapped_column(
        String(48), default=SemanticType.UNRESOLVED, index=True)

    # raw_value is the source string as it arrived, before any cleaning. Never
    # overwritten, never normalised in place.
    raw_value: Mapped[str | None] = mapped_column(Text)
    # The canonical text form after normalisation. NULL when parsing failed,
    # which raw_value surviving makes diagnosable.
    parsed_value: Mapped[str | None] = mapped_column(Text)
    # Typed forms, populated only for the kind of field they suit, so dates can
    # be ordered and sizes compared without re-parsing text on every query.
    parsed_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    parsed_number: Mapped[float | None] = mapped_column(Float)

    # --- provenance -------------------------------------------------------
    # Denormalised from Record rather than joined: an observation has to stay
    # interpretable after a reprocess replaces the record it came from, and
    # source_column is not on Record at all.
    original_header: Mapped[str | None] = mapped_column(String(512))
    source_file: Mapped[str | None] = mapped_column(String(512), index=True)
    source_sheet: Mapped[str | None] = mapped_column(String(255))
    source_row: Mapped[int | None] = mapped_column(Integer)
    source_column: Mapped[int | None] = mapped_column(Integer)
    job_id: Mapped[int | None] = mapped_column(
        ForeignKey("processing_jobs.id", ondelete="SET NULL"), index=True)

    # --- how much we believe it -------------------------------------------
    # 0.0-1.0. Below the field's min_confidence in semantic_types.json the row
    # is written with needs_review set; it is never upgraded to a guess.
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    # Which signals fired, so a wrong reading can be explained and the rule
    # corrected rather than argued about. Shape:
    #   {"reason": str, "signals": [...], "scores": {type: score}, "rule": str}
    evidence: Mapped[dict | None] = mapped_column(JSON)
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    # Which set of rules read this value. Same contract as Record.engine_version:
    # a rule change bumps engine.ENGINE_VERSION and every row below it is stale
    # and re-derivable. See engine/__init__.py.
    engine_version: Mapped[int | None] = mapped_column(Integer, index=True)
    observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        # The two questions actually asked of this table: "every observation for
        # this record" (the inspector panel) and "what did we read this field as
        # across the corpus" (the review queue and the per-file AREA decision).
        Index("ix_fieldobs_record_field", "record_id", "canonical_field"),
        Index("ix_fieldobs_field_type", "canonical_field", "semantic_type"),
        # Partial-index shape: the review queue reads only the flagged rows and
        # they are the minority.
        Index("ix_fieldobs_review", "needs_review", "canonical_field"),
    )


class DecisionScope:
    """How widely a human decision is allowed to apply.

    Narrow by default. A reviewer looking at one sheet has seen one sheet, and
    the same header genuinely means different things in different files -- AREA
    is the worked example. Letting one screenful of evidence rewrite the rule
    for the whole corpus is how a single wrong call poisons everything
    downstream, so GLOBAL is never the default and has to be chosen.
    """
    SHEET = "sheet"        # this workbook + worksheet only
    WORKBOOK = "workbook"  # every sheet in this file
    GLOBAL = "global"      # this header, everywhere

    ORDER = (SHEET, WORKBOOK, GLOBAL)   # most specific first


class ReviewDecision(Base):
    """A human answer to something the engine declined to decide.

    The semantic layer's most defensible behaviour is refusing to guess, but a
    refusal is only useful if somebody can resolve it and the resolution sticks.
    This is that record: what was asked, what a person answered, on what
    evidence, and how widely it applies.

    APPEND-ONLY, like field_observations. Changing an answer writes a new row
    and stamps `superseded_by` on the old one, so the reasoning behind a
    decision that later proved wrong is still readable. `active` is what the
    lookup filters on.

    Decisions outrank inference at resolve time -- a person who has looked at
    the source knows more than a phrase-match score -- but they never silence
    it: the inferred reading is still computed and recorded in the evidence, so
    a decision that contradicts the data stays visible instead of hiding it.
    """
    __tablename__ = "review_decisions"

    id: Mapped[int] = mapped_column(primary_key=True)

    # --- what this decision answers --------------------------------------
    # Canonical field name, or the raw label for column-level cases ("AREA").
    # Same vocabulary as FieldObservation.canonical_field so the two join.
    canonical_field: Mapped[str] = mapped_column(String(64), index=True)
    # The source header this was decided about, normalised. NULL means the
    # decision is about the field regardless of which header fed it.
    original_header: Mapped[str | None] = mapped_column(String(512), index=True)

    scope: Mapped[str] = mapped_column(String(16), default=DecisionScope.WORKBOOK,
                                       index=True)
    # Which workbook/sheet the scope refers to. NULL for GLOBAL. The check
    # constraints in __table_args__ make the pairing structural: a narrow scope
    # that does not say what it is narrow TO would silently behave as global at
    # lookup, and that must be impossible to store, not merely rejected by one
    # API endpoint.
    scope_file: Mapped[str | None] = mapped_column(String(512), index=True)
    scope_sheet: Mapped[str | None] = mapped_column(String(255))

    # --- the answer -------------------------------------------------------
    semantic_type: Mapped[str] = mapped_column(String(48))
    # Free text from the reviewer. Not decoration: the next person to disagree
    # needs to know what this one was looking at.
    rationale: Mapped[str | None] = mapped_column(Text)

    # --- who, when, and against what ------------------------------------
    # Where the decision came from: 'api' (a person in the review queue),
    # 'import' (bulk-loaded from curated rules), 'migration' (seeded). A
    # decision's provenance is as much a part of it as its answer.
    source: Mapped[str] = mapped_column(String(32), default="api")
    decided_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True)
    # Denormalised so the trail survives the account being deleted.
    decided_by_email: Mapped[str | None] = mapped_column(String(320))
    decided_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True)
    # The observation that prompted this, when there was one. SET NULL rather
    # than CASCADE: a reprocess replaces observations, and the decision must
    # outlive the row that raised the question.
    observation_id: Mapped[int | None] = mapped_column(
        ForeignKey("field_observations.id", ondelete="SET NULL"))
    # What the engine had inferred when the human overrode it. Kept so a
    # pattern of disagreement is visible in the data rather than anecdotal.
    engine_semantic_type: Mapped[str | None] = mapped_column(String(48))
    engine_confidence: Mapped[float | None] = mapped_column(Float)
    engine_version: Mapped[int | None] = mapped_column(Integer)

    # --- append-only lifecycle -------------------------------------------
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    superseded_by: Mapped[int | None] = mapped_column(Integer)

    __table_args__ = (
        # The lookup the engine performs for every ambiguous column: what has a
        # human already said about this field and header, at any scope.
        Index("ix_decisions_lookup", "canonical_field", "original_header", "active"),
        Index("ix_decisions_scope", "scope", "scope_file"),
        CheckConstraint("scope IN ('sheet','workbook','global')",
                        name="ck_decisions_scope_known"),
        CheckConstraint("scope = 'global' OR scope_file IS NOT NULL",
                        name="ck_decisions_narrow_scope_has_file"),
        CheckConstraint("scope <> 'sheet' OR scope_sheet IS NOT NULL",
                        name="ck_decisions_sheet_scope_has_sheet"),
    )
