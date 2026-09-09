"""Outreach: what the sales desk did, and what it does next.

The platform could find a contactable owner and had nowhere to record that
anyone called them. This is the missing half: lead state, activity history, and
the queue that answers "who do I call today".

Two rules shape the design.

A lead is created on first contact, not at ingest. At 20M records where a small
fraction is ever worked, materialising a lead per record would double the
corpus to store mostly NULLs.

A lead is keyed by identity_hash, not record_id. Records are derived data,
deleted and rewritten whenever a job is reprocessed; call history is not
derivable from anything and must outlive that. relink_leads() reattaches the
convenience pointer afterwards.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from ..core.security import get_current_user
from ..database.session import get_db
from ..models.models import (
    ActivityKind, ContactVerdict, Lead, LeadActivity, LeadStage, Record,
    RecordEditAudit, User,
)

log = logging.getLogger(__name__)

router = APIRouter(tags=["leads"])


# --------------------------------------------------------------------------
# schemas
# --------------------------------------------------------------------------
class ActivityIn(BaseModel):
    kind: str = Field(..., description=f"One of {', '.join(ActivityKind.ALL)}")
    outcome: str | None = None
    note: str | None = None
    # Logging a call also moves the lead on, in one request. Two round trips to
    # record one phone call is how outreach data stops getting entered.
    stage: str | None = None
    next_action_at: datetime | None = None
    # What the call proved about the data, not about the sale. See
    # ContactVerdict: this is the feedback loop that lets outreach correct the
    # database instead of only consuming it.
    verdict: str | None = None


class ActivityOut(BaseModel):
    id: int
    kind: str
    outcome: str | None
    note: str | None
    user_email: str
    occurred_at: datetime

    model_config = {"from_attributes": True}


class LeadOut(BaseModel):
    id: int
    record_id: int | None
    identity_hash: str
    stage: str
    owner_user_id: int | None
    next_action_at: datetime | None
    last_activity_at: datetime | None
    contact_verdict: str | None = None
    contact_verdict_at: datetime | None = None
    contact_verdict_by: str | None = None

    model_config = {"from_attributes": True}


class LeadPatch(BaseModel):
    stage: str | None = None
    owner_user_id: int | None = None
    next_action_at: datetime | None = None


# Bulk add is a deliberate operator action over a page of selected rows, not a
# hot path, and the whole batch is held in one transaction. The cap keeps that
# transaction bounded; the UI pages at 100, so it is well clear of normal use.
BULK_MAX = 500


class BulkQueueIn(BaseModel):
    record_ids: list[int] = Field(..., min_length=1, max_length=BULK_MAX)
    owner_user_id: int | None = None
    next_action_at: datetime | None = None


class BulkFailure(BaseModel):
    record_id: int
    reason: str


class BulkQueueOut(BaseModel):
    """Deliberately four buckets, not a single count.

    `already_queued` and `opted_out` are both "no lead was created", but they
    mean opposite things to a desk: one is a person someone is already working,
    the other is a person nobody may call. Collapsing them would let an
    operator believe an opt-out is on their call list.
    """
    requested: int
    added: int
    already_queued: int
    opted_out: int
    failed: list[BulkFailure]
    lead_ids: list[int]


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def _get_or_create_lead(db: Session, record: Record) -> Lead:
    """The lead for a record, created on first touch."""
    lead = db.scalar(select(Lead).where(Lead.identity_hash == record.identity_hash))
    if lead is None:
        lead = Lead(identity_hash=record.identity_hash, record_id=record.id,
                    stage=LeadStage.NEW)
        db.add(lead)
        db.flush()
    elif lead.record_id != record.id:
        # A reprocess renumbered the row; point at the current one.
        lead.record_id = record.id
    return lead


def relink_leads(db: Session, job_id: int) -> int:
    """Reattach leads to the rows a reprocess just rewrote.

    record_id is ON DELETE SET NULL, so reprocessing a job leaves its leads
    intact but detached. Matching on identity_hash puts them back. A lead whose
    hash changed (a cleaning fix altered the community, say) stays detached and
    is reported by GET /leads/orphans rather than silently disappearing.
    """
    rows = db.execute(
        select(Record.id, Record.identity_hash).where(Record.job_id == job_id)
    ).all()
    by_hash = {h: rid for rid, h in rows}
    if not by_hash:
        return 0

    relinked = 0
    for lead in db.scalars(
        select(Lead).where(Lead.record_id.is_(None),
                           Lead.identity_hash.in_(by_hash.keys()))
    ):
        lead.record_id = by_hash[lead.identity_hash]
        relinked += 1

    # Hand-corrections are no more derivable from a source file than phone
    # calls are, and they detach the same way.
    for audit in db.scalars(
        select(RecordEditAudit).where(RecordEditAudit.record_id.is_(None),
                                      RecordEditAudit.identity_hash.in_(by_hash.keys()))
    ):
        audit.record_id = by_hash[audit.identity_hash]
        relinked += 1

    if relinked:
        db.commit()
        log.info("relinked %d lead(s) after reprocessing job %d", relinked, job_id)
    return relinked


# --------------------------------------------------------------------------
# endpoints
# --------------------------------------------------------------------------
@router.post("/records/{record_id}/activity", response_model=LeadOut, status_code=201)
def log_activity(
    record_id: int,
    payload: ActivityIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Log what happened, and optionally move the lead in the same call."""
    if payload.kind not in ActivityKind.ALL:
        raise HTTPException(422, f"kind must be one of {', '.join(ActivityKind.ALL)}")
    if payload.stage is not None and payload.stage not in LeadStage.ALL:
        raise HTTPException(422, f"stage must be one of {', '.join(LeadStage.ALL)}")
    if payload.verdict is not None and payload.verdict not in ContactVerdict.ALL:
        raise HTTPException(
            422, f"verdict must be one of {', '.join(ContactVerdict.ALL)}")

    record = db.get(Record, record_id)
    if record is None:
        raise HTTPException(404, f"Record {record_id} not found.")

    lead = _get_or_create_lead(db, record)
    now = datetime.now(timezone.utc)

    db.add(LeadActivity(lead_id=lead.id, user_id=user.id, user_email=user.email,
                        kind=payload.kind, outcome=payload.outcome,
                        note=payload.note, occurred_at=now))
    lead.last_activity_at = now
    # First contact moves NEW along on its own; leaving every worked lead at
    # NEW makes the queue meaningless within a week.
    if payload.stage:
        if payload.stage != lead.stage:
            db.add(LeadActivity(
                lead_id=lead.id, user_id=user.id, user_email=user.email,
                kind=ActivityKind.STAGE_CHANGE,
                outcome=f"{lead.stage} -> {payload.stage}", occurred_at=now))
        lead.stage = payload.stage
    elif lead.stage == LeadStage.NEW and payload.kind != ActivityKind.NOTE:
        lead.stage = LeadStage.CONTACTED
    if payload.next_action_at is not None:
        lead.next_action_at = payload.next_action_at
    if lead.owner_user_id is None:
        lead.owner_user_id = user.id

    if payload.verdict:
        lead.contact_verdict = payload.verdict
        lead.contact_verdict_at = now
        lead.contact_verdict_by = user.email
        # A number proved wrong should stop being scheduled. Leaving a callback
        # on a record nobody can reach just recycles the same dead end.
        if payload.verdict in ContactVerdict.SUPPRESSING:
            lead.next_action_at = None

    db.commit()
    db.refresh(lead)
    return lead


@router.get("/records/{record_id}/activity", response_model=list[ActivityOut])
def record_activity(
    record_id: int,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Full history for a record, newest first. Empty if never contacted."""
    record = db.get(Record, record_id)
    if record is None:
        raise HTTPException(404, f"Record {record_id} not found.")
    lead = db.scalar(select(Lead).where(Lead.identity_hash == record.identity_hash))
    if lead is None:
        return []
    return db.scalars(
        select(LeadActivity).where(LeadActivity.lead_id == lead.id)
        .order_by(LeadActivity.occurred_at.desc(), LeadActivity.id.desc())
    ).all()


@router.patch("/leads/{lead_id}", response_model=LeadOut)
def update_lead(
    lead_id: int,
    payload: LeadPatch,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reassign, restage, or reschedule. Stage changes are logged."""
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(404, f"Lead {lead_id} not found.")
    if payload.stage is not None and payload.stage not in LeadStage.ALL:
        raise HTTPException(422, f"stage must be one of {', '.join(LeadStage.ALL)}")

    if payload.stage and payload.stage != lead.stage:
        db.add(LeadActivity(
            lead_id=lead.id, user_id=user.id, user_email=user.email,
            kind=ActivityKind.STAGE_CHANGE,
            outcome=f"{lead.stage} -> {payload.stage}"))
        lead.stage = payload.stage
    if payload.owner_user_id is not None:
        lead.owner_user_id = payload.owner_user_id
    if payload.next_action_at is not None:
        lead.next_action_at = payload.next_action_at

    db.commit()
    db.refresh(lead)
    return lead


@router.post("/leads/bulk", response_model=BulkQueueOut, status_code=201)
def bulk_queue(
    payload: BulkQueueIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Put a selection of records on the call queue.

    This exists because the only other way to create a lead is to log an
    activity against a record, and putting someone on a list is not a phone
    call. Reusing that path would write call history that never happened, into
    the one table whose whole design rationale is that call history cannot be
    re-derived from a source file.

    Deduplication is by identity_hash, not record_id, because that is how a
    lead is keyed. One owner holding four units is one person to call, so
    selecting all four rows yields one lead -- which is why the response
    reports what happened rather than just a count of what was sent.

    Existing leads are left completely untouched. Re-adding a record someone
    else is already working must not silently reassign it or reschedule their
    callback.
    """
    ids = list(dict.fromkeys(payload.record_ids))  # de-dup, keep order

    # Never trust a client-supplied owner. An unchecked id here would let the
    # caller park work on an account that does not exist.
    if payload.owner_user_id is not None and db.get(User, payload.owner_user_id) is None:
        raise HTTPException(422, f"User {payload.owner_user_id} not found.")

    # Two queries, not two per record: the records, then the leads that already
    # exist for their identities. Everything after this is in memory.
    records = db.scalars(select(Record).where(Record.id.in_(ids))).all()
    by_id = {r.id: r for r in records}

    existing = {
        lead.identity_hash: lead
        for lead in db.scalars(
            select(Lead).where(Lead.identity_hash.in_({r.identity_hash for r in records}))
        )
    } if records else {}

    added, already, opted_out = 0, 0, 0
    failed: list[BulkFailure] = []
    lead_ids: list[int] = []
    seen: set[str] = set()

    for rid in ids:
        record = by_id.get(rid)
        if record is None:
            failed.append(BulkFailure(record_id=rid, reason="Record not found."))
            continue

        prior = existing.get(record.identity_hash)
        if prior is not None:
            # Counted once per identity, not once per row, so the numbers add
            # up to the selection the operator actually made.
            if record.identity_hash not in seen:
                seen.add(record.identity_hash)
                if prior.stage == LeadStage.DO_NOT_CONTACT:
                    opted_out += 1
                else:
                    already += 1
                    lead_ids.append(prior.id)
            continue

        if record.identity_hash in seen:
            continue  # a second row for an owner already handled in this batch

        # _get_or_create_lead flushes, so a later row sharing this identity
        # finds the lead instead of racing a second insert against the unique
        # constraint on identity_hash.
        lead = _get_or_create_lead(db, record)
        seen.add(record.identity_hash)
        if payload.owner_user_id is not None:
            lead.owner_user_id = payload.owner_user_id
        if payload.next_action_at is not None:
            lead.next_action_at = payload.next_action_at
        added += 1
        lead_ids.append(lead.id)

    db.commit()
    log.info("%s queued %d record(s): %d added, %d already queued, %d opted out",
             user.email, len(ids), added, already, opted_out)
    return BulkQueueOut(requested=len(ids), added=added, already_queued=already,
                        opted_out=opted_out, failed=failed, lead_ids=lead_ids)


@router.get("/leads", response_model=list[LeadOut])
def list_leads(
    stage: str | None = None,
    owner_user_id: int | None = None,
    record_id: int | None = Query(None, description="Only the lead for this record."),
    mine: bool = Query(False, description="Only leads assigned to the caller."),
    due: bool = Query(False, description="Only leads whose next action is due."),
    open_only: bool = Query(False, description="Exclude WON, LOST, DO_NOT_CONTACT."),
    limit: int = Query(100, ge=1, le=1000),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The work queue. `?mine=true&due=true` is the morning call list.

    Served by ix_leads_queue (owner, stage, next_action_at). Leads are a small
    table -- only records anyone actually worked -- so this stays fast without
    the machinery the 20M-row records table needs.
    """
    stmt = select(Lead)
    if record_id is not None:
        stmt = stmt.where(Lead.record_id == record_id)
    if mine:
        stmt = stmt.where(Lead.owner_user_id == user.id)
    elif owner_user_id is not None:
        stmt = stmt.where(Lead.owner_user_id == owner_user_id)
    if stage:
        stmt = stmt.where(Lead.stage == stage)
    if open_only:
        stmt = stmt.where(Lead.stage.in_(LeadStage.OPEN))
    if due:
        stmt = stmt.where(Lead.next_action_at.is_not(None),
                          Lead.next_action_at <= datetime.now(timezone.utc))
    # Nulls last: a lead with no scheduled action is not overdue, it is unplanned.
    return db.scalars(
        stmt.order_by(Lead.next_action_at.asc().nullslast(), Lead.id.desc())
        .limit(limit)
    ).all()


@router.delete("/leads/{lead_id}/verdict", response_model=LeadOut)
def clear_verdict(
    lead_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reverse a verdict, putting the record back in front of the desk.

    A verdict hides a record from everyone, and people mis-click. Without this
    a single wrong tap buries a valuable property permanently, which makes the
    whole feedback loop something nobody dares use. The reversal is logged, so
    "who hid this and who brought it back" both stay answerable.
    """
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(404, f"Lead {lead_id} not found.")
    if lead.contact_verdict is None:
        return lead

    db.add(LeadActivity(
        lead_id=lead.id, user_id=user.id, user_email=user.email,
        kind=ActivityKind.STAGE_CHANGE,
        outcome=f"verdict cleared ({lead.contact_verdict})",
        note=f"Originally judged by {lead.contact_verdict_by or 'unknown'}."))
    lead.contact_verdict = None
    lead.contact_verdict_at = None
    lead.contact_verdict_by = None
    db.commit()
    db.refresh(lead)
    return lead


@router.get("/leads/verdicts")
def verdict_summary(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """What outreach has proved about the data, in aggregate.

    The counts are a data-quality report the pipeline cannot produce on its
    own: only a human on a phone can tell you a well-formed number belongs to
    the wrong person. A rising WRONG_NUMBER count against one source file is a
    signal about that register, not about the sales team.
    """
    counts = dict(db.execute(
        select(Lead.contact_verdict, func.count(Lead.id))
        .where(Lead.contact_verdict.is_not(None))
        .group_by(Lead.contact_verdict)
    ).all())
    return {
        "verdicts": {v: counts.get(v, 0) for v in ContactVerdict.ALL},
        "suppressed_records": sum(counts.get(v, 0)
                                  for v in ContactVerdict.SUPPRESSING),
        "note": "suppressed records are hidden from the record list and exports",
    }


@router.get("/leads/needs-new-number", response_model=list[LeadOut])
def needs_new_number(
    limit: int = Query(200, ge=1, le=1000),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Leads whose number was disproved -- the re-sourcing work list.

    These are known-valuable properties with a known-bad contact, which makes
    them the highest-yield rows to re-source rather than dead weight.
    """
    return db.scalars(
        select(Lead)
        .where(Lead.contact_verdict.in_((ContactVerdict.WRONG_NUMBER,
                                         ContactVerdict.NOT_OWNER)))
        .order_by(Lead.contact_verdict_at.desc())
        .limit(limit)
    ).all()


@router.get("/leads/orphans", response_model=list[LeadOut])
def orphan_leads(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Leads no longer attached to a record.

    Happens when a cleaning fix changes a record's identity_hash, so the
    reprocessed row no longer matches. The outreach history is intact and this
    is where it surfaces, rather than becoming invisible.
    """
    return db.scalars(select(Lead).where(Lead.record_id.is_(None))).all()
