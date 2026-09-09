"""Outreach state and history.

The property these tests exist for: call history must survive reprocessing.
Records are derived data and are deleted and rewritten whenever a job is
re-run; what a salesperson did on the phone exists nowhere else.
"""
import pytest
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, delete, event, func, select
from sqlalchemy.orm import sessionmaker

from backend.app.api.leads import _get_or_create_lead, relink_leads
from backend.app.models.models import (
    ActivityKind, Base, Lead, LeadActivity, LeadStage, ProcessingJob, Record,
    SourceFile, User, UserRole,
)


@pytest.fixture
def db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path/'leads.db'}")

    # Match production: SQLite ignores ON DELETE clauses without this, so a
    # test running without it would prove nothing about cascade behaviour.
    @event.listens_for(engine, "connect")
    def _fk_on(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


@pytest.fixture
def user(db):
    u = User(email="agent@example.com", full_name="Agent", hashed_password="x",
             role=UserRole.DATA_PROCESSOR, is_active=True)
    db.add(u)
    db.commit()
    return u


def _job(db, job_id=1):
    """Records reference a job, and foreign keys are enforced."""
    if db.get(ProcessingJob, job_id):
        return job_id
    src = SourceFile(filename="reg.csv", stored_path="/tmp/reg.csv",
                     size_bytes=1, content_sha256="d" * 64)
    db.add(src)
    db.flush()
    db.add(ProcessingJob(id=job_id, source_file_id=src.id, status="COMPLETED"))
    db.commit()
    return job_id


def _record(db, *, job_id=1, identity_hash="hash-1", name="Mohammed Al Rashid"):
    _job(db, job_id)
    r = Record(job_id=job_id, source_file="reg.csv", identity_hash=identity_hash,
               status="VALID", name=name, community="Dubai Marina",
               mobile_1="+971501234567")
    db.add(r)
    db.commit()
    return r


def _log(db, user, lead, kind=ActivityKind.CALL, **kw):
    a = LeadActivity(lead_id=lead.id, user_id=user.id, user_email=user.email,
                     kind=kind, **kw)
    db.add(a)
    db.commit()
    return a


# --- creation ---------------------------------------------------------------

def test_a_lead_is_created_on_first_contact(db, user):
    record = _record(db)
    assert db.scalar(select(Lead)) is None      # nothing at ingest
    lead = _get_or_create_lead(db, record)
    db.commit()
    assert lead.identity_hash == record.identity_hash
    assert lead.stage == LeadStage.NEW


def test_contacting_the_same_record_twice_reuses_one_lead(db, user):
    record = _record(db)
    first = _get_or_create_lead(db, record)
    db.commit()
    second = _get_or_create_lead(db, record)
    db.commit()
    assert first.id == second.id
    assert db.scalar(select(Lead).where(Lead.identity_hash == record.identity_hash))


def test_sales_stage_is_separate_from_record_status(db, user):
    # Record.status describes the row's data quality; Lead.stage describes the
    # conversation. Overloading one field with both makes neither answerable.
    record = _record(db)
    lead = _get_or_create_lead(db, record)
    lead.stage = LeadStage.WON
    db.commit()
    assert record.status == "VALID"
    assert lead.stage == LeadStage.WON


# --- surviving reprocessing -------------------------------------------------

def test_call_history_survives_a_reprocess(db, user):
    """The property the whole design exists for.

    Reprocessing deletes a job's records and writes new ones. A lead that
    cascaded from records would take its call history with it, and unlike the
    records themselves that history cannot be rebuilt from the source file.
    """
    record = _record(db)
    lead = _get_or_create_lead(db, record)
    db.commit()
    _log(db, user, lead, note="Spoke to owner, wants a callback Tuesday.")

    # What reprocess does.
    db.execute(delete(Record).where(Record.job_id == 1))
    db.commit()

    lead = db.scalar(select(Lead))
    assert lead is not None, "lead was deleted with the record"
    assert lead.record_id is None, "pointer should be cleared, not dangling"
    assert len(db.scalars(select(LeadActivity)).all()) == 1


def test_relink_reattaches_leads_after_a_reprocess(db, user):
    record = _record(db)
    lead = _get_or_create_lead(db, record)
    db.commit()
    _log(db, user, lead)

    db.execute(delete(Record).where(Record.job_id == 1))
    db.commit()
    rewritten = _record(db, identity_hash="hash-1")   # same identity, new row id

    assert relink_leads(db, job_id=1) == 1
    db.refresh(lead)
    assert lead.record_id == rewritten.id


def test_a_lead_whose_identity_changed_stays_detached(db, user):
    # A cleaning fix can alter identity_hash (the community fix did exactly
    # that). The lead must not silently vanish; it surfaces via /leads/orphans.
    record = _record(db, identity_hash="old-hash")
    lead = _get_or_create_lead(db, record)
    db.commit()
    db.execute(delete(Record).where(Record.job_id == 1))
    db.commit()
    _record(db, identity_hash="new-hash-after-cleaning-fix")

    assert relink_leads(db, job_id=1) == 0
    db.refresh(lead)
    assert lead.record_id is None
    assert db.scalars(select(Lead).where(Lead.record_id.is_(None))).all() == [lead]


def test_relink_only_touches_detached_leads(db, user):
    record = _record(db)
    lead = _get_or_create_lead(db, record)
    db.commit()
    assert relink_leads(db, job_id=1) == 0      # already attached


# --- the work queue ---------------------------------------------------------

def test_open_stages_exclude_closed_and_opted_out():
    assert LeadStage.WON not in LeadStage.OPEN
    assert LeadStage.LOST not in LeadStage.OPEN
    # An opt-out that does not remove someone from the call list is not an
    # opt-out.
    assert LeadStage.DO_NOT_CONTACT not in LeadStage.OPEN


def test_due_leads_are_the_ones_with_a_past_next_action(db, user):
    now = datetime.now(timezone.utc)
    for i, when in enumerate([now - timedelta(days=1), now + timedelta(days=1), None]):
        r = _record(db, identity_hash=f"h{i}")
        lead = _get_or_create_lead(db, r)
        lead.owner_user_id = user.id
        lead.next_action_at = when
    db.commit()

    due = db.scalars(
        select(Lead).where(Lead.owner_user_id == user.id,
                           Lead.next_action_at.is_not(None),
                           Lead.next_action_at <= datetime.now(timezone.utc))
    ).all()
    assert len(due) == 1


def test_activity_history_is_append_only_and_ordered(db, user):
    record = _record(db)
    lead = _get_or_create_lead(db, record)
    db.commit()
    _log(db, user, lead, kind=ActivityKind.CALL, outcome="no answer")
    _log(db, user, lead, kind=ActivityKind.WHATSAPP, outcome="replied")

    history = db.scalars(
        select(LeadActivity).where(LeadActivity.lead_id == lead.id)
        .order_by(LeadActivity.id.desc())).all()
    assert [a.kind for a in history] == [ActivityKind.WHATSAPP, ActivityKind.CALL]


def test_who_did_it_survives_the_user_being_deleted(db, user):
    # user_id is SET NULL, but the email is denormalised so the history stays
    # readable rather than becoming "someone, once".
    record = _record(db)
    lead = _get_or_create_lead(db, record)
    db.commit()
    activity = _log(db, user, lead)
    assert activity.user_email == "agent@example.com"


# --- the opt-out actually opts out ------------------------------------------

def test_an_opted_out_person_disappears_from_the_record_list(db, user):
    """DO_NOT_CONTACT has to bite on the paths the desk actually uses.

    A stage that still shows up in the call list and the export is a note, not
    an opt-out. Enforced in _build_records_query, which both paths share.
    """
    from backend.app.api.records import _build_records_query

    kept = _record(db, identity_hash="keep-me", name="Sara Haddad")
    opted_out = _record(db, identity_hash="opt-out", name="Mohammed Al Rashid")
    lead = _get_or_create_lead(db, opted_out)
    lead.stage = LeadStage.DO_NOT_CONTACT
    db.commit()

    visible = db.scalars(_build_records_query()).all()
    assert [r.id for r in visible] == [kept.id]


def test_other_stages_stay_visible(db, user):
    from backend.app.api.records import _build_records_query

    record = _record(db)
    lead = _get_or_create_lead(db, record)
    lead.stage = LeadStage.WON       # closed, but not opted out
    db.commit()
    assert [r.id for r in db.scalars(_build_records_query()).all()] == [record.id]


def test_the_opt_out_holds_while_a_lead_is_detached(db, user):
    # Between a reprocess and the relink, record_id is NULL. Keying the
    # exclusion on the pointer instead of identity_hash would let an opted-out
    # person reappear in exactly that window.
    from backend.app.api.records import _build_records_query

    record = _record(db, identity_hash="opt-out")
    lead = _get_or_create_lead(db, record)
    lead.stage = LeadStage.DO_NOT_CONTACT
    db.commit()

    db.execute(delete(Record).where(Record.job_id == 1))
    db.commit()
    _record(db, identity_hash="opt-out")      # rewritten, lead not yet relinked

    db.refresh(lead)
    assert lead.record_id is None
    assert db.scalars(_build_records_query()).all() == []


# ---------------------------------------------------------------------------
# POST /leads/bulk -- putting a selection of records on the queue
#
# The property these tests exist for: bulk add is keyed by identity_hash, so
# the number of leads created is the number of *people* selected, not the
# number of rows. An operator selecting four units owned by one person must
# end up calling them once.
# ---------------------------------------------------------------------------
def _bulk(db, user, ids, **kw):
    from backend.app.api.leads import BulkQueueIn, bulk_queue
    return bulk_queue(BulkQueueIn(record_ids=ids, **kw), user, db)


def test_one_record_becomes_one_lead(db, user):
    record = _record(db, identity_hash="bulk-1")
    out = _bulk(db, user, [record.id])

    assert (out.added, out.already_queued, out.opted_out) == (1, 0, 0)
    assert out.failed == []
    lead = db.scalar(select(Lead).where(Lead.identity_hash == "bulk-1"))
    assert lead is not None and lead.stage == LeadStage.NEW


def test_several_records_become_several_leads(db, user):
    ids = [_record(db, identity_hash=f"bulk-{i}", name=f"Owner {i}").id
           for i in range(3)]
    out = _bulk(db, user, ids)

    assert out.added == 3
    assert db.scalar(select(func.count()).select_from(Lead)) == 3


def test_adding_a_record_twice_is_idempotent(db, user):
    record = _record(db, identity_hash="bulk-dup")
    first = _bulk(db, user, [record.id])
    second = _bulk(db, user, [record.id])

    assert first.added == 1
    assert (second.added, second.already_queued) == (0, 1)
    assert db.scalar(select(func.count()).select_from(Lead)) == 1
    # The second call must point at the same lead, not report a phantom one.
    assert second.lead_ids == first.lead_ids


def test_two_records_for_one_owner_make_one_lead(db, user):
    # The case the whole identity_hash design exists for: one person, two
    # units. Selecting both rows is selecting one person to call.
    a = _record(db, identity_hash="same-owner", name="Owner A")
    b = _record(db, identity_hash="same-owner", name="Owner A")
    out = _bulk(db, user, [a.id, b.id])

    assert out.requested == 2
    assert out.added == 1
    assert out.already_queued == 0
    assert db.scalar(select(func.count()).select_from(Lead)) == 1


def test_unknown_record_is_reported_not_swallowed(db, user):
    record = _record(db, identity_hash="bulk-ok")
    out = _bulk(db, user, [record.id, 999999])

    assert out.added == 1
    assert [f.record_id for f in out.failed] == [999999]
    assert "not found" in out.failed[0].reason.lower()


def test_mixed_new_and_existing(db, user):
    old = _record(db, identity_hash="existing")
    _get_or_create_lead(db, old)
    db.commit()
    fresh = _record(db, identity_hash="fresh", name="New Owner")

    out = _bulk(db, user, [old.id, fresh.id])
    assert (out.added, out.already_queued) == (1, 1)
    assert len(out.lead_ids) == 2


def test_assignment_and_scheduling_apply_to_new_leads(db, user):
    record = _record(db, identity_hash="assign-me")
    due = datetime.now(timezone.utc) + timedelta(days=1)
    _bulk(db, user, [record.id], owner_user_id=user.id, next_action_at=due)

    lead = db.scalar(select(Lead).where(Lead.identity_hash == "assign-me"))
    assert lead.owner_user_id == user.id
    assert lead.next_action_at is not None


def test_existing_lead_is_never_reassigned(db, user):
    # Re-adding a record somebody else is working must not quietly take it off
    # them, nor move the callback they already scheduled.
    other = User(email="other@example.com", full_name="Other", hashed_password="x",
                 role=UserRole.DATA_PROCESSOR, is_active=True)
    db.add(other)
    db.commit()

    record = _record(db, identity_hash="owned")
    lead = _get_or_create_lead(db, record)
    lead.owner_user_id = other.id
    original_due = datetime.now(timezone.utc) + timedelta(days=7)
    lead.next_action_at = original_due
    db.commit()

    out = _bulk(db, user, [record.id], owner_user_id=user.id,
                next_action_at=datetime.now(timezone.utc))
    db.refresh(lead)

    assert out.already_queued == 1
    assert lead.owner_user_id == other.id


def test_an_opt_out_is_reported_separately_and_not_revived(db, user):
    # DO_NOT_CONTACT folded into "already queued" would tell the desk an
    # opted-out person is on their call list.
    record = _record(db, identity_hash="do-not-call")
    lead = _get_or_create_lead(db, record)
    lead.stage = LeadStage.DO_NOT_CONTACT
    db.commit()

    out = _bulk(db, user, [record.id])
    db.refresh(lead)

    assert (out.added, out.already_queued, out.opted_out) == (0, 0, 1)
    assert lead.stage == LeadStage.DO_NOT_CONTACT
    assert out.lead_ids == []


def test_an_unknown_owner_is_rejected_before_anything_is_written(db, user):
    from fastapi import HTTPException

    record = _record(db, identity_hash="no-owner")
    with pytest.raises(HTTPException) as excinfo:
        _bulk(db, user, [record.id], owner_user_id=999999)

    assert excinfo.value.status_code == 422
    # The rejection must happen before the insert, not leave a half-done batch.
    assert db.scalar(select(func.count()).select_from(Lead)) == 0


def test_batch_size_is_capped(db, user):
    from backend.app.api.leads import BULK_MAX, BulkQueueIn
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        BulkQueueIn(record_ids=list(range(BULK_MAX + 1)))
