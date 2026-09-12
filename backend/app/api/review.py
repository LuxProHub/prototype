"""The review queue: resolving what the engine declined to decide.

The semantic layer's most defensible behaviour is refusing to guess. A bare
`Date` column is recorded as unresolved rather than assigned one of four
meanings; a size with no stated unit is flagged rather than asserted; an `AREA`
with no sibling geography keeps its historical reading under review. Each of
those writes `needs_review` on a field observation.

Until now nothing read them, which made the refusal pure cost: the data stayed
honest and nobody could act on it.

    GET  /api/review/queue      what needs a human, grouped and explained
    GET  /api/review/queue/{id} one observation in full, with its evidence
    POST /api/review/decide     record an answer
    GET  /api/review/decisions  what has been decided so far
    POST /api/review/decisions/{id}/revoke   withdraw a decision

Answers are consulted on the next ingest (see core/decision_index.py), so a
question answered once stops being asked. They are scoped -- sheet, workbook or
global -- because the same header genuinely means different things in different
files, and a reviewer who looked at one sheet has seen one sheet.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from engine import ENGINE_VERSION, semantics

from ..core.security import get_current_user, require_role
from ..database.session import get_db
from ..models.models import (
    DecisionScope, FieldObservation, ReviewDecision, User, UserRole,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/review", tags=["review"])

# Reading the queue is part of understanding the data, so any authenticated
# user may look. Recording a decision changes how every future ingest reads that
# column, which is an operator action.
_OPERATOR = require_role(list(UserRole.at_least(UserRole.DATA_PROCESSOR)))

MAX_PAGE = 200

# Canonical fields whose raw values are a person's data. The grouped queue never
# needs them -- a reviewer deciding whether "Seller Name" is a seller or a buyer
# is reading the HEADER, not the name -- so the list view masks them. The
# single-item endpoint returns the full value, because deterministic review
# sometimes does need it, and a deliberate per-item fetch by an authenticated
# user is a narrower exposure than a page of them. Documented in
# docs/SEMANTIC_RESOLUTION.md under "Privacy in review".
_PERSONAL_FIELDS = {"Name", "Mobile 1", "Mobile 2", "Mobile 3", "Email Address",
                    "Nationality"}


def _mask(value: str | None) -> str | None:
    """'Allan Howard Errington' -> 'A***n H***d E***n'; '+971501234567' -> '+9715*****67'."""
    if value is None:
        return None
    s = str(value)
    if "@" in s:
        local, _, dom = s.partition("@")
        return (local[:1] + "***@" + dom) if dom else "***"
    digits = sum(ch.isdigit() for ch in s)
    if digits >= 7:
        return s[:5] + "*" * max(0, len(s) - 7) + s[-2:]
    return " ".join((w[:1] + "***" + w[-1:]) if len(w) > 2 else "***" for w in s.split())


def _display_value(canonical_field: str, raw: str | None) -> str | None:
    return _mask(raw) if canonical_field in _PERSONAL_FIELDS else raw


# --------------------------------------------------------------------------
# schemas
# --------------------------------------------------------------------------
class DecisionIn(BaseModel):
    canonical_field: str = Field(..., max_length=64)
    semantic_type: str = Field(..., max_length=48)
    original_header: str | None = Field(None, max_length=512)
    scope: str = DecisionScope.WORKBOOK
    scope_file: str | None = Field(None, max_length=512)
    scope_sheet: str | None = Field(None, max_length=255)
    rationale: str | None = None
    observation_id: int | None = None


# --------------------------------------------------------------------------
# queue
# --------------------------------------------------------------------------
def queue_questions(db: Session, *, canonical_field: str | None = None,
                    source_file: str | None = None, limit: int = 50, offset: int = 0):
    """The grouped queue query, shared with the scale tests.

    Groups on (field, header, file, sheet, reading) so N flagged rows from one
    ambiguous column are ONE question. The number of questions scales with
    ambiguity, not with row count -- test_review_scale.py holds it to that.
    """
    grouping = (
        FieldObservation.canonical_field,
        FieldObservation.original_header,
        FieldObservation.source_file,
        FieldObservation.source_sheet,
        FieldObservation.semantic_type,
    )
    q = (select(*grouping,
                func.count(FieldObservation.id).label("affected_rows"),
                func.min(FieldObservation.id).label("example_id"),
                func.avg(FieldObservation.confidence).label("avg_confidence"))
         .where(FieldObservation.needs_review.is_(True))
         .group_by(*grouping))
    if canonical_field:
        q = q.where(FieldObservation.canonical_field == canonical_field)
    if source_file:
        q = q.where(FieldObservation.source_file == source_file)
    q = q.order_by(func.count(FieldObservation.id).desc()).limit(limit).offset(offset)
    groups = db.execute(q).all()
    total = db.scalar(
        select(func.count()).select_from(
            select(*grouping).where(FieldObservation.needs_review.is_(True))
            .group_by(*grouping).subquery()))
    return groups, (total or 0)


@router.get("/queue")
def review_queue(
    canonical_field: str | None = Query(None, description="Filter to one field."),
    source_file: str | None = Query(None),
    limit: int = Query(50, ge=1, le=MAX_PAGE),
    offset: int = Query(0, ge=0),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """What needs a human, grouped by the question rather than by the row.

    Grouped deliberately. A 24,000-row file with one ambiguous `Date` column
    produces 24,000 flagged observations and exactly ONE question. Listing them
    row by row would bury the decision in its own evidence, and answering it
    once has to be enough.
    """
    groups, total = queue_questions(db, canonical_field=canonical_field,
                                    source_file=source_file, limit=limit, offset=offset)

    items = []
    for r in groups:
        example = db.get(FieldObservation, r.example_id)
        items.append({
            "canonical_field": r.canonical_field,
            "original_header": r.original_header,
            "source_file": r.source_file,
            "source_sheet": r.source_sheet,
            "current_reading": r.semantic_type,
            "affected_rows": r.affected_rows,
            "avg_confidence": round(float(r.avg_confidence or 0), 4),
            "example_observation_id": r.example_id,
            # Masked for personal fields: the grouped view is for deciding
            # what a COLUMN means, and never needs to show a person to do it.
            "example_raw_value": (_display_value(r.canonical_field, example.raw_value)
                                  if example else None),
            "example_value_masked": r.canonical_field in _PERSONAL_FIELDS,
            # Every review item has to answer four questions for the person
            # looking at it, or it is not reviewable.
            "what": _what(r),
            "why": _why(example),
            "evidence": (example.evidence if example else None),
            "options": semantics.type_names(r.canonical_field) or None,
        })

    return {"total_questions": total, "limit": limit, "offset": offset,
            "items": items}


def _what(row) -> str:
    where = " / ".join(x for x in (row.source_file, row.source_sheet) if x)
    return (f"How should {row.canonical_field!r}"
            + (f" (column {row.original_header!r})" if row.original_header else "")
            + f" be read in {where or 'this source'}?")


def _why(example) -> str | None:
    if example is None:
        return None
    ev = example.evidence or {}
    return ev.get("reason") or "flagged for review"


@router.get("/queue/{observation_id}")
def review_item(
    observation_id: int,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """One observation in full, including the raw value and the full evidence."""
    o = db.get(FieldObservation, observation_id)
    if o is None:
        raise HTTPException(404, "No such observation.")
    if o.canonical_field in _PERSONAL_FIELDS:
        # The full value of a personal field is being shown to a person. Not
        # blocked -- sometimes review genuinely needs it -- but never silent.
        log.info("review item %d (%s) opened in full by %s",
                 o.id, o.canonical_field, _user.email)
    return {
        "personal_data": o.canonical_field in _PERSONAL_FIELDS,
        "id": o.id, "record_id": o.record_id,
        "canonical_field": o.canonical_field, "semantic_type": o.semantic_type,
        "raw_value": o.raw_value, "parsed_value": o.parsed_value,
        "original_header": o.original_header,
        "source_file": o.source_file, "source_sheet": o.source_sheet,
        "source_row": o.source_row, "source_column": o.source_column,
        "confidence": o.confidence, "needs_review": o.needs_review,
        "evidence": o.evidence, "engine_version": o.engine_version,
        "observed_at": o.observed_at,
        "options": semantics.type_names(o.canonical_field) or None,
    }


# --------------------------------------------------------------------------
# decisions
# --------------------------------------------------------------------------
@router.post("/decide", status_code=201)
def decide(
    body: DecisionIn,
    user: User = Depends(_OPERATOR),
    db: Session = Depends(get_db),
):
    """Record a human answer, to be applied from the next ingest onward.

    This does NOT rewrite existing rows. The decision changes how the column is
    read next time; re-deriving what is already stored is what
    POST /api/maintenance/reprocess is for. Silently rewriting historical rows
    from a review click would be a bulk data change disguised as an annotation.
    """
    if body.scope not in DecisionScope.ORDER:
        raise HTTPException(422, f"scope must be one of {list(DecisionScope.ORDER)}")

    known = semantics.type_names(body.canonical_field)
    if known and body.semantic_type not in known and body.semantic_type != semantics.UNRESOLVED:
        raise HTTPException(
            422, f"{body.semantic_type!r} is not a known reading of "
                 f"{body.canonical_field!r}. Known: {known}")

    # A scope narrower than global has to say what it is narrow TO, or it
    # silently becomes global on lookup -- the one failure mode this design
    # exists to prevent.
    if body.scope in (DecisionScope.SHEET, DecisionScope.WORKBOOK) and not body.scope_file:
        raise HTTPException(422, f"scope {body.scope!r} requires scope_file.")
    if body.scope == DecisionScope.SHEET and not body.scope_sheet:
        raise HTTPException(422, "scope 'sheet' requires scope_sheet.")

    observation = db.get(FieldObservation, body.observation_id) if body.observation_id else None
    if body.observation_id and observation is None:
        raise HTTPException(404, "No such observation.")

    d = ReviewDecision(
        canonical_field=body.canonical_field,
        original_header=body.original_header,
        scope=body.scope, scope_file=body.scope_file, scope_sheet=body.scope_sheet,
        semantic_type=body.semantic_type, rationale=body.rationale,
        source="api",
        decided_by=user.id, decided_by_email=user.email,
        observation_id=observation.id if observation else None,
        # What the engine thought, kept so a pattern of human/engine
        # disagreement is visible in the data rather than in anecdote.
        engine_semantic_type=observation.semantic_type if observation else None,
        engine_confidence=observation.confidence if observation else None,
        engine_version=ENGINE_VERSION,
    )
    db.add(d)
    db.flush()

    # Append-only: an equivalent earlier decision is superseded, not edited, so
    # the reasoning behind a call that later proved wrong stays readable.
    superseded = db.scalars(
        select(ReviewDecision).where(
            ReviewDecision.id != d.id,
            ReviewDecision.active.is_(True),
            ReviewDecision.canonical_field == d.canonical_field,
            ReviewDecision.original_header.is_(None) if d.original_header is None
            else ReviewDecision.original_header == d.original_header,
            ReviewDecision.scope == d.scope,
            ReviewDecision.scope_file.is_(None) if d.scope_file is None
            else ReviewDecision.scope_file == d.scope_file,
        )).all()
    for old in superseded:
        old.active = False
        old.superseded_by = d.id

    db.commit()
    log.info("review decision %d: %s/%s -> %s at %s scope by %s",
             d.id, d.canonical_field, d.original_header, d.semantic_type,
             d.scope, d.decided_by_email)
    return {"id": d.id, "superseded": [o.id for o in superseded],
            "applies_from": "next ingest",
            "note": ("Existing rows are unchanged. Use POST /api/maintenance/"
                     "reprocess to re-derive them under this decision.")}


@router.get("/decisions")
def list_decisions(
    canonical_field: str | None = Query(None),
    include_inactive: bool = Query(False),
    stale: bool | None = Query(None, description=(
        "true: only decisions made under an older engine version; "
        "false: only current ones.")),
    limit: int = Query(100, ge=1, le=MAX_PAGE),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = select(ReviewDecision)
    if not include_inactive:
        q = q.where(ReviewDecision.active.is_(True))
    if canonical_field:
        q = q.where(ReviewDecision.canonical_field == canonical_field)
    if stale is True:
        q = q.where(ReviewDecision.engine_version < ENGINE_VERSION)
    elif stale is False:
        q = q.where(ReviewDecision.engine_version >= ENGINE_VERSION)
    rows = db.scalars(q.order_by(ReviewDecision.decided_at.desc()).limit(limit)).all()
    return {"engine_version": ENGINE_VERSION, "items": [{
        "id": d.id, "canonical_field": d.canonical_field,
        "original_header": d.original_header, "semantic_type": d.semantic_type,
        "scope": d.scope, "scope_file": d.scope_file, "scope_sheet": d.scope_sheet,
        "rationale": d.rationale, "decided_by": d.decided_by_email,
        "decided_at": d.decided_at, "active": d.active,
        "superseded_by": d.superseded_by,
        "source": d.source,
        "engine_version": d.engine_version,
        "stale": d.engine_version is not None and d.engine_version < ENGINE_VERSION,
        "engine_semantic_type": d.engine_semantic_type,
        "engine_confidence": d.engine_confidence,
        "contradicted_engine": (
            d.engine_semantic_type is not None
            and d.engine_semantic_type != semantics.UNRESOLVED
            and d.engine_semantic_type != d.semantic_type),
    } for d in rows]}


@router.post("/decisions/{decision_id}/revoke")
def revoke(
    decision_id: int,
    user: User = Depends(_OPERATOR),
    db: Session = Depends(get_db),
):
    """Withdraw a decision without deleting it.

    Deactivating rather than deleting: a decision that turned out to be wrong is
    part of how the data got the way it is, and removing the record would make
    the rows it produced inexplicable.
    """
    d = db.get(ReviewDecision, decision_id)
    if d is None:
        raise HTTPException(404, "No such decision.")
    if not d.active:
        return {"id": d.id, "active": False, "note": "Already inactive."}
    d.active = False
    db.commit()
    log.info("review decision %d revoked by %s", d.id, user.email)
    return {"id": d.id, "active": False, "applies_from": "next ingest"}
