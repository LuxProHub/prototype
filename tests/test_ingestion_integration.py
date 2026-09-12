# End-to-end ingestion: messy workbook -> mapped -> resolved -> persisted
"""Integration tests for the whole ingest path, including observations.

These drive real .xlsx files through the real Processor and the real
persistence function the API uses (backend.app.core.persistence.persist_batch),
then assert against the database. Nothing is reimplemented here -- a test that
reimplements the insert proves only that the reimplementation works.

The fixtures are deliberately ugly, in the shape the 100-file audit actually
found: alternate headers, abbreviations, typoed labels, duplicate rows,
contradictory values, mixed size units, unparseable dates, junk URLs and
headers that mean nothing to anybody.
"""
import pytest
from openpyxl import Workbook
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker

from backend.app.core.persistence import persist_batch
from backend.app.models.models import (
    Base, FieldObservation, ProcessingJob, Record, SourceFile,
)
from engine import ENGINE_VERSION
from engine.processor import Processor


@pytest.fixture
def db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path/'ingest.db'}")

    # SQLite ships with foreign keys switched OFF, so ON DELETE CASCADE is
    # silently inert unless asked for. PostgreSQL -- the production target --
    # enforces it always. Without this the cascade test passes vacuously here
    # and the schema's behaviour would only ever be exercised in production.
    @event.listens_for(engine, "connect")
    def _enforce_foreign_keys(dbapi_connection, _record):
        cur = dbapi_connection.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


@pytest.fixture
def job(db):
    src = SourceFile(filename="messy.xlsx", stored_path="/tmp/messy.xlsx",
                     size_bytes=1, content_sha256="deadbeef")
    db.add(src)
    db.flush()
    j = ProcessingJob(source_file_id=src.id, status="PROCESSING")
    db.add(j)
    db.commit()
    return j


def _write(tmp_path, rows, name="messy.xlsx", sheet_title="Sheet1"):
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_title
    for r in rows:
        ws.append(r)
    path = tmp_path / name
    wb.save(path)
    return path


def _ingest(db, job, path, sheet_hint=None):
    """Run the file through the engine and persist exactly as the API does."""
    def on_batch(rows):
        n = persist_batch(db, rows, job.id)
        db.commit()
        return n

    result = Processor(batch_size=100, enable_enrichment=False).process(
        path, source_name=path.name, on_batch=on_batch)
    return result


def _obs(db, field=None):
    q = select(FieldObservation)
    if field:
        q = q.where(FieldObservation.canonical_field == field)
    return list(db.scalars(q))


# --------------------------------------------------------------------------
# The headline claim: observations are written during real ingestion
# --------------------------------------------------------------------------

MESSY = [
    # alternate header, typo'd apostrophe, abbreviation, ambiguous AREA,
    # sqm-in-header size, bare Date, and a header nobody can identify
    ["OWNER`S NAME", "COMMUNITY", "AREA", "UNIT NO", "Total Size Sqm.",
     "MOB", "Date", "Zzz Internal Ref"],
    ["Mohammed Al Rashid", "Business Bay", "Executive Towers", "1204", "100",
     "+971501234567", "2024-03-15", "X-1"],
    ["Fatima Hassan", "Business Bay", "Executive Towers", "1205", "120",
     "0559876543", "15/04/2024", "X-2"],
]


def test_observations_are_written_during_a_real_ingestion(db, job, tmp_path):
    """The table must not stay a dead schema."""
    _ingest(db, job, _write(tmp_path, MESSY))
    assert db.scalar(select(Record).limit(1)) is not None, "no records ingested"
    assert _obs(db), "ingestion produced no field observations"


def test_every_observation_carries_its_full_provenance(db, job, tmp_path):
    """Zero data loss means the raw value and its origin both survive."""
    _ingest(db, job, _write(tmp_path, MESSY))
    for o in _obs(db):
        assert o.record_id, "observation not linked to a record"
        assert o.canonical_field
        assert o.raw_value is not None, "raw source value was not preserved"
        assert o.source_file == "messy.xlsx"
        assert o.source_sheet == "Sheet1"
        assert o.source_row is not None
        assert o.source_column is not None
        assert o.original_header
        assert o.engine_version == ENGINE_VERSION
        assert o.observed_at is not None
        assert o.job_id == job.id
        # both confidences, kept separate on purpose
        assert "mapping_confidence" in (o.evidence or {})
        assert "semantic_confidence" in (o.evidence or {})


def test_an_observation_explains_its_reading(db, job, tmp_path):
    _ingest(db, job, _write(tmp_path, MESSY))
    for o in _obs(db):
        ev = o.evidence or {}
        assert ev.get("reason"), f"{o.canonical_field} recorded no reason"
        assert "rule" in ev


# --------------------------------------------------------------------------
# Size: the 10.76x error, end to end
# --------------------------------------------------------------------------

def test_a_sqm_column_is_converted_and_says_so(db, job, tmp_path):
    _ingest(db, job, _write(tmp_path, MESSY))
    size_obs = _obs(db, "Size")
    assert size_obs, "no Size observation"
    o = size_obs[0]
    assert o.raw_value == "100", "raw source value not preserved"
    assert o.parsed_number == pytest.approx(1076.39, abs=0.01)
    ev = o.evidence
    assert ev["original_unit"] == "sqm"
    assert ev["normalized_unit"] == "sqft"
    assert ev["unit_source"] == "header"
    assert ev["converted"] is True
    assert ev["conversion_factor"] == pytest.approx(10.7639, abs=0.001)
    assert ev["conversion_rule_version"] >= 1


def test_a_size_with_no_stated_unit_is_flagged_not_assumed_silently(db, job, tmp_path):
    rows = [["NAME", "UNIT NO", "SIZE", "MOBILE"],
            ["Ali Hassan", "902", "1200", "+971501111111"]]
    _ingest(db, job, _write(tmp_path, rows))
    o = _obs(db, "Size")[0]
    assert o.evidence["unit_source"] == "assumed"
    assert o.needs_review is True, "an assumed unit must not pass as a measurement"


def test_mixed_units_in_one_corpus_stay_distinguishable(db, job, tmp_path):
    """Two files, two units. The stored numbers alone cannot tell them apart."""
    _ingest(db, job, _write(tmp_path, MESSY, name="sqm_file.xlsx"))
    rows = [["NAME", "UNIT NO", "Size (sq.ft)", "MOBILE"],
            ["Sara Khan", "301", "1076.39", "+971502222222"]]
    _ingest(db, job, _write(tmp_path, rows, name="sqft_file.xlsx"))
    units = {o.evidence.get("original_unit") for o in _obs(db, "Size")}
    assert units == {"sqm", "sqft"}


# --------------------------------------------------------------------------
# Date: a bare header must not become one specific event
# --------------------------------------------------------------------------

def test_a_bare_date_column_is_persisted_as_unresolved(db, job, tmp_path):
    _ingest(db, job, _write(tmp_path, MESSY))
    date_obs = _obs(db, "Date")
    assert date_obs, "no Date observation"
    assert all(o.semantic_type == "unresolved" for o in date_obs)
    assert all(o.needs_review for o in date_obs)


def test_a_named_date_column_resolves_to_its_event(db, job, tmp_path):
    rows = [["NAME", "UNIT NO", "MOBILE", "Handover Date", "Project"],
            ["Omar Saleh", "77", "+971503333333", "2023-11-01", "Dubai Hills"]]
    _ingest(db, job, _write(tmp_path, rows))
    o = _obs(db, "Date")[0]
    assert o.semantic_type == "handover_date"
    assert not o.needs_review
    assert o.parsed_date is not None


def test_a_malformed_date_keeps_its_raw_value_and_is_flagged(db, job, tmp_path):
    """The parse failing must not erase what the source actually said."""
    rows = [["NAME", "UNIT NO", "MOBILE", "Transaction Date"],
            ["Nadia Aziz", "15", "+971504444444", "not a date at all"]]
    _ingest(db, job, _write(tmp_path, rows))
    o = _obs(db, "Date")[0]
    assert o.raw_value == "not a date at all"
    assert o.parsed_date is None
    assert o.needs_review is True


# --------------------------------------------------------------------------
# AREA: the 685-occurrence ambiguity, end to end
# --------------------------------------------------------------------------

def test_area_beside_a_community_column_persists_as_sub_community(db, job, tmp_path):
    _ingest(db, job, _write(tmp_path, MESSY))
    area = [o for o in _obs(db) if o.canonical_field == "AREA"]
    assert area, "AREA produced no observation"
    assert area[0].semantic_type == "sub_community"
    assert area[0].evidence.get("resolved_target") == "Sub-Community"
    # and the value actually landed in the sub-community column
    rec = db.scalar(select(Record).where(Record.unit_number == "1204"))
    assert rec.sub_community == "Executive Towers"


def test_a_lone_area_column_is_persisted_as_unresolved(db, job, tmp_path):
    rows = [["NAME", "AREA", "UNIT NO", "MOBILE"],
            ["Yusuf Omar", "Business Bay", "88", "+971505555555"]]
    _ingest(db, job, _write(tmp_path, rows))
    area = [o for o in _obs(db) if o.canonical_field == "AREA"]
    assert area and area[0].needs_review is True


# --------------------------------------------------------------------------
# Two-party rows: nobody gets silently dropped
# --------------------------------------------------------------------------

TWO_PARTY = [
    ["Project Name", "Location", "New unit Number", "Seller Name", "Nationality",
     "Contact Number", "Email Address", "Buyers Name", "Nationality",
     "Contact Number", "Email Address"],
    ["JBR", "Sadaf 4", "C01-T03", "Allan Errington", "British",
     "+971501234567", "a@example.com", "Mohammed Alzain", "Saudi",
     "+966501234567", "b@example.com"],
]


def test_a_two_party_row_produces_a_named_record(db, job, tmp_path):
    """These sheets used to yield records with no Name at all."""
    _ingest(db, job, _write(tmp_path, TWO_PARTY, sheet_title="Seller to Buyer"))
    rec = db.scalar(select(Record).where(Record.unit_number.isnot(None)))
    assert rec is not None and rec.name, "two-party row produced a nameless record"


def test_both_parties_survive_the_single_name_slot(db, job, tmp_path):
    _ingest(db, job, _write(tmp_path, TWO_PARTY, sheet_title="Seller to Buyer"))
    rec = db.scalar(select(Record))
    kept = (rec.name or "")
    blob = str(rec.extras or {})
    assert "Errington" in kept or "Errington" in blob
    assert "Alzain" in kept or "Alzain" in blob, "the other party was lost"


def test_the_party_choice_is_flagged_rather_than_decided_silently(db, job, tmp_path):
    _ingest(db, job, _write(tmp_path, TWO_PARTY, sheet_title="Seller to Buyer"))
    parties = [o for o in _obs(db) if o.semantic_type in ("seller_party", "buyer_party")]
    assert len(parties) >= 2, "party roles were not recorded"
    assert all(o.needs_review for o in parties)
    assert {o.semantic_type for o in parties} == {"seller_party", "buyer_party"}


# --------------------------------------------------------------------------
# General messiness: nothing here may crash the pipeline
# --------------------------------------------------------------------------

UGLY = [
    ["NAME", "COMMUNITY", "UNIT NO", "MOBILE", "EMAIL", "Website", "Random Col"],
    ["Ali Hassan", "JLT", "101", "+971501111111", "ali@example.com", "http://ok.example.com", "x"],
    ["Ali Hassan", "JLT", "101", "+971501111111", "ali@example.com", "http://ok.example.com", "x"],  # exact duplicate
    ["Ali Hassan", "JLT", "101", "0501111111", "ALI@EXAMPLE.COM", "not-a-url", "y"],   # conflicting form
    ["", "", "", "", "", "", ""],                                                       # blank row
    ["Sara Khan", "JLT", "", "", "", "ht!tp://bad", ""],                                # missing everything useful
    ["محمد علي", "JLT", "202", "+971502222222", "m@example.com", "", ""],               # non-latin name
]


def test_a_thoroughly_messy_sheet_ingests_without_crashing(db, job, tmp_path):
    result = _ingest(db, job, _write(tmp_path, UGLY))
    assert result.total_rows > 0
    assert db.scalar(select(Record).limit(1)) is not None


def test_duplicates_are_detected_not_silently_merged(db, job, tmp_path):
    _ingest(db, job, _write(tmp_path, UGLY))
    statuses = [r.status for r in db.scalars(select(Record))]
    assert "DUPLICATE" in statuses, f"no duplicate detected in {statuses}"


def test_unknown_headers_are_preserved_not_discarded(db, job, tmp_path):
    _ingest(db, job, _write(tmp_path, UGLY))
    blob = " ".join(str(r.extras or {}) for r in db.scalars(select(Record)))
    assert "Random Col" in blob or "Website" in blob, "unmapped columns were dropped"


def test_a_malformed_url_does_not_break_the_row(db, job, tmp_path):
    _ingest(db, job, _write(tmp_path, UGLY))
    assert db.scalar(select(Record).where(Record.name.like("%Sara%"))) is not None


def test_observations_die_with_their_record(db, job, tmp_path):
    """CASCADE: an observation must never outlive the row it describes."""
    _ingest(db, job, _write(tmp_path, MESSY))
    assert _obs(db)
    for r in db.scalars(select(Record)):
        db.delete(r)
    db.commit()
    assert not _obs(db), "observations survived their records"
