# Review queue and the decision loop that feeds back into mapping
"""Tests for resolving what the engine declined to decide.

The semantic layer refuses to guess, and every refusal writes `needs_review`.
That refusal is only worth its cost if a person can resolve it and the
resolution sticks. These tests pin both halves:

  - the queue groups flagged observations by QUESTION, not by row, and explains
    each one well enough to answer;
  - a recorded decision is consulted on the next ingest, so the same question
    stops being asked -- while the engine's own reading is still computed and
    kept visible underneath it.
"""
import pytest
from openpyxl import Workbook
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker

from backend.app.core.decision_index import DecisionIndex
from backend.app.core.persistence import persist_batch
from backend.app.models.models import (
    Base, DecisionScope, FieldObservation, ProcessingJob, Record,
    ReviewDecision, SourceFile,
)
from engine import semantics
from engine.processor import Processor


@pytest.fixture
def db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path/'review.db'}")

    @event.listens_for(engine, "connect")
    def _fk(dbapi_connection, _record):
        cur = dbapi_connection.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


@pytest.fixture
def job(db):
    src = SourceFile(filename="ambiguous.xlsx", stored_path="/tmp/a.xlsx",
                     size_bytes=1, content_sha256="abc")
    db.add(src)
    db.flush()
    j = ProcessingJob(source_file_id=src.id, status="PROCESSING")
    db.add(j)
    db.commit()
    return j


# A bare "Date" column with nothing around it: the case the engine must not
# guess, and therefore the case a human has to answer.
AMBIGUOUS = [
    ["NAME", "COMMUNITY", "UNIT NO", "MOBILE", "Date"],
    ["Ali Hassan", "Business Bay", "101", "+971501111111", "2024-03-15"],
    ["Sara Khan", "Business Bay", "102", "+971502222222", "2024-04-20"],
    ["Omar Saleh", "Business Bay", "103", "+971503333333", "2024-05-11"],
]


def _write(tmp_path, rows, name="ambiguous.xlsx", sheet="Sheet1"):
    wb = Workbook()
    ws = wb.active
    ws.title = sheet
    for r in rows:
        ws.append(r)
    p = tmp_path / name
    wb.save(p)
    return p


def _ingest(db, job, path, decisions=None):
    def on_batch(rows):
        n = persist_batch(db, rows, job.id)
        db.commit()
        return n
    return Processor(batch_size=100, enable_enrichment=False,
                     decisions=decisions).process(
        path, source_name=path.name, on_batch=on_batch)


def _date_obs(db):
    return list(db.scalars(
        select(FieldObservation).where(FieldObservation.canonical_field == "Date")))


def _record_decision(db, **kw):
    kw.setdefault("scope", DecisionScope.WORKBOOK)
    kw.setdefault("scope_file", "ambiguous.xlsx")
    d = ReviewDecision(decided_by_email="reviewer@example.com", **kw)
    db.add(d)
    db.commit()
    return d


# --------------------------------------------------------------------------
# The queue
# --------------------------------------------------------------------------

def test_an_ambiguous_column_lands_in_the_queue(db, job, tmp_path):
    _ingest(db, job, _write(tmp_path, AMBIGUOUS))
    flagged = [o for o in _date_obs(db) if o.needs_review]
    assert flagged, "a bare Date column produced nothing to review"
    assert all(o.semantic_type == semantics.UNRESOLVED for o in flagged)


def test_the_queue_groups_by_question_not_by_row(db, job, tmp_path):
    """Three rows, one ambiguous column, ONE question.

    Listing per row would bury the decision in its own evidence: a 24,000-row
    file with one ambiguous column produces 24,000 flags and still asks exactly
    one thing.
    """
    _ingest(db, job, _write(tmp_path, AMBIGUOUS))
    obs = [o for o in _date_obs(db) if o.needs_review]
    assert len(obs) == 3, f"expected one flag per row, got {len(obs)}"
    questions = {(o.canonical_field, o.original_header, o.source_file,
                  o.source_sheet, o.semantic_type) for o in obs}
    assert len(questions) == 1, "one ambiguous column should be one question"


def test_a_queue_item_carries_enough_to_answer_it(db, job, tmp_path):
    _ingest(db, job, _write(tmp_path, AMBIGUOUS))
    o = [x for x in _date_obs(db) if x.needs_review][0]
    assert o.raw_value, "no raw value to judge against"
    assert o.original_header and o.source_file and o.source_sheet
    assert (o.evidence or {}).get("reason"), "no explanation of why it is flagged"
    assert semantics.type_names("Date"), "no options to choose between"


# --------------------------------------------------------------------------
# Decision lookup: scope precedence
# --------------------------------------------------------------------------

def test_a_decision_is_found_for_the_column_it_was_made_about(db):
    _record_decision(db, canonical_field="Date", original_header="Date",
                     semantic_type="handover_date")
    hit = DecisionIndex(db).lookup("Date", header="Date",
                                   source_file="ambiguous.xlsx", sheet_name="Sheet1")
    assert hit and hit["semantic_type"] == "handover_date"
    assert hit["needs_review"] is False
    assert hit["evidence"]["rule"] == "human_decision"


def test_a_workbook_decision_does_not_leak_into_another_workbook(db):
    """The failure mode the scoping exists to prevent."""
    _record_decision(db, canonical_field="Date", original_header="Date",
                     semantic_type="handover_date", scope_file="ambiguous.xlsx")
    idx = DecisionIndex(db)
    assert idx.lookup("Date", header="Date", source_file="ambiguous.xlsx",
                      sheet_name="Sheet1") is not None
    assert idx.lookup("Date", header="Date", source_file="somebody_elses.xlsx",
                      sheet_name="Sheet1") is None


def test_the_narrowest_scope_wins(db):
    _record_decision(db, canonical_field="Date", original_header="Date",
                     semantic_type="registration_date",
                     scope=DecisionScope.GLOBAL, scope_file=None)
    _record_decision(db, canonical_field="Date", original_header="Date",
                     semantic_type="handover_date",
                     scope=DecisionScope.WORKBOOK, scope_file="ambiguous.xlsx")
    _record_decision(db, canonical_field="Date", original_header="Date",
                     semantic_type="lease_start_date",
                     scope=DecisionScope.SHEET, scope_file="ambiguous.xlsx",
                     scope_sheet="Sheet1")
    idx = DecisionIndex(db)
    assert idx.lookup("Date", header="Date", source_file="ambiguous.xlsx",
                      sheet_name="Sheet1")["semantic_type"] == "lease_start_date"
    assert idx.lookup("Date", header="Date", source_file="ambiguous.xlsx",
                      sheet_name="Other")["semantic_type"] == "handover_date"
    assert idx.lookup("Date", header="Date", source_file="elsewhere.xlsx",
                      sheet_name="Any")["semantic_type"] == "registration_date"


def test_a_decision_about_one_header_does_not_answer_for_another(db):
    _record_decision(db, canonical_field="Date", original_header="Handover Date",
                     semantic_type="handover_date")
    idx = DecisionIndex(db)
    assert idx.lookup("Date", header="Handover Date",
                      source_file="ambiguous.xlsx") is not None
    assert idx.lookup("Date", header="Lease End Date",
                      source_file="ambiguous.xlsx") is None


def test_an_inactive_decision_is_not_applied(db):
    d = _record_decision(db, canonical_field="Date", original_header="Date",
                         semantic_type="handover_date")
    d.active = False
    db.commit()
    assert DecisionIndex(db).lookup("Date", header="Date",
                                    source_file="ambiguous.xlsx") is None


# --------------------------------------------------------------------------
# The loop: a decision changes what the next ingest concludes
# --------------------------------------------------------------------------

def test_a_decision_resolves_the_column_on_the_next_ingest(db, job, tmp_path):
    """The whole point of the review queue.

    First pass: unresolved, flagged. A human answers. Second pass: resolved,
    not flagged, and attributed to the decision rather than to inference.
    """
    path = _write(tmp_path, AMBIGUOUS)
    _ingest(db, job, path)
    assert all(o.semantic_type == semantics.UNRESOLVED for o in _date_obs(db))

    _record_decision(db, canonical_field="Date", original_header="Date",
                     semantic_type="transaction_date",
                     rationale="Confirmed against the DLD transfer register.")

    for o in _date_obs(db):
        db.delete(o)
    db.commit()

    _ingest(db, job, path, decisions=DecisionIndex(db))
    after = _date_obs(db)
    assert after, "second ingest produced no Date observations"
    assert all(o.semantic_type == "transaction_date" for o in after)
    assert not any(o.needs_review for o in after)
    assert all(o.evidence.get("rule") == "human_decision" for o in after)


def test_a_decision_does_not_silence_the_engines_own_reading(db, job, tmp_path):
    """A decision outranks inference; it must not hide it.

    If a human keeps overruling a confident inference, that disagreement has to
    be visible in the data rather than in somebody's memory.
    """
    rows = [["NAME", "UNIT NO", "MOBILE", "Handover Date", "Project"],
            ["Ali Hassan", "101", "+971501111111", "2023-11-01", "Dubai Hills"]]
    path = _write(tmp_path, rows, name="ambiguous.xlsx")
    _record_decision(db, canonical_field="Date", original_header="Handover Date",
                     semantic_type="lease_start_date",
                     rationale="Mislabelled by the source; it is a lease start.")
    _ingest(db, job, path, decisions=DecisionIndex(db))
    o = _date_obs(db)[0]
    assert o.semantic_type == "lease_start_date"
    ev = o.evidence
    assert ev["inferred_semantic_type"] == "handover_date", \
        "the engine's own reading was not preserved"
    assert ev["contradicts_inference"] is True


def test_without_decisions_the_engine_behaves_exactly_as_before(db, job, tmp_path):
    """Passing no decision index must change nothing."""
    _ingest(db, job, _write(tmp_path, AMBIGUOUS), decisions=None)
    assert all(o.semantic_type == semantics.UNRESOLVED and o.needs_review
               for o in _date_obs(db))


def test_a_broken_decision_lookup_cannot_stop_ingestion(db, job, tmp_path):
    """Availability of a convenience must not gate the pipeline."""
    class Exploding:
        def lookup(self, *a, **kw):
            raise RuntimeError("decision store unavailable")

    result = _ingest(db, job, _write(tmp_path, AMBIGUOUS), decisions=Exploding())
    assert result.total_rows == 3
    assert db.scalar(select(Record).limit(1)) is not None
    assert all(o.semantic_type == semantics.UNRESOLVED for o in _date_obs(db))


def test_decisions_survive_the_observations_that_prompted_them(db, job, tmp_path):
    """A reprocess replaces observations; the decision has to outlive them."""
    _ingest(db, job, _write(tmp_path, AMBIGUOUS))
    obs = _date_obs(db)[0]
    d = _record_decision(db, canonical_field="Date", original_header="Date",
                         semantic_type="transaction_date", observation_id=obs.id)
    for o in _date_obs(db):
        db.delete(o)
    db.commit()
    db.refresh(d)
    assert d.id is not None and d.active is True
    assert d.observation_id is None, "SET NULL did not fire"
    assert DecisionIndex(db).lookup("Date", header="Date",
                                    source_file="ambiguous.xlsx") is not None
