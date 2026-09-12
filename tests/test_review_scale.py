# Review queue at scale: questions grow with ambiguity, not with rows
"""The review queue's promise is that a 100,000-row file with one ambiguous
column asks ONE question. This holds it to that at 10k and 100k observations,
and at 1M when ATLAS_SCALE_1M=1 is set (too slow for every run).

Timing bounds are generous on purpose: the point is catching O(n^2) or a
per-row query, not benchmarking SQLite.
"""
import os
import time
from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker

from backend.app.api.review import queue_questions
from backend.app.models.models import (
    Base, FieldObservation, ProcessingJob, Record, SourceFile,
)


@pytest.fixture
def db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path/'scale.db'}")
    Base.metadata.create_all(engine)
    s = sessionmaker(bind=engine)()
    yield s
    s.close()


def _seed(db, n_rows: int, n_ambiguous_columns: int = 1, n_files: int = 1):
    """n_rows observations spread over n_files, each with n_ambiguous_columns
    flagged columns. Expected questions = n_files * n_ambiguous_columns."""
    src = SourceFile(filename="s.xlsx", stored_path="/t", size_bytes=1, content_sha256="a")
    db.add(src); db.flush()
    job = ProcessingJob(source_file_id=src.id, status="P"); db.add(job); db.flush()
    # one record per row is faithful but slow; the queue never joins records,
    # so a single parent record is enough to satisfy the foreign key.
    db.bulk_insert_mappings(Record, [{"name": "x", "source_file": "s.xlsx",
                                      "identity_hash": "h", "status": "VALID",
                                      "job_id": job.id}], return_defaults=True)
    rid = db.scalar(select(func.min(Record.id)))
    now = datetime.now(timezone.utc)
    batch, CH = [], 5000
    for i in range(n_rows):
        f = i % n_files
        c = i % n_ambiguous_columns
        batch.append({
            "record_id": rid, "canonical_field": "Date",
            "semantic_type": "unresolved", "raw_value": f"2024-01-{(i % 28) + 1:02d}",
            "original_header": f"Date{c}", "source_file": f"file{f}.xlsx",
            "source_sheet": "Sheet1", "source_row": i + 2, "source_column": c,
            "confidence": 0.0, "needs_review": True, "engine_version": 3,
            "observed_at": now, "job_id": job.id,
        })
        if len(batch) >= CH:
            db.bulk_insert_mappings(FieldObservation, batch); batch = []
    if batch:
        db.bulk_insert_mappings(FieldObservation, batch)
    db.commit()


def _timed_questions(db, **kw):
    t0 = time.perf_counter()
    groups, total = queue_questions(db, **kw)
    return groups, total, time.perf_counter() - t0


@pytest.mark.parametrize("n", [10_000, 100_000])
def test_one_ambiguous_column_is_one_question_regardless_of_rows(db, n):
    _seed(db, n)
    groups, total, secs = _timed_questions(db)
    assert total == 1, f"{n} rows produced {total} questions"
    assert groups[0].affected_rows == n
    assert secs < 10, f"queue query took {secs:.1f}s at {n} rows"


def test_questions_scale_with_ambiguity_not_rows(db):
    _seed(db, 20_000, n_ambiguous_columns=3, n_files=4)
    _, total, _ = _timed_questions(db)
    assert total == 12   # 3 columns x 4 files


def test_query_time_grows_roughly_linearly_not_quadratically(db, tmp_path):
    """Two sizes, one decade apart. Quadratic would be ~100x; allow 25x for
    noise on a cold SQLite file."""
    _seed(db, 10_000)
    _, _, t10k = _timed_questions(db)
    # fresh db for the larger run
    engine = create_engine(f"sqlite:///{tmp_path/'scale2.db'}")
    Base.metadata.create_all(engine)
    db2 = sessionmaker(bind=engine)()
    try:
        _seed(db2, 100_000)
        _, _, t100k = _timed_questions(db2)
    finally:
        db2.close()
    ratio = t100k / max(t10k, 1e-4)
    assert ratio < 25, f"10x rows -> {ratio:.0f}x time; looks super-linear"


@pytest.mark.skipif(os.getenv("ATLAS_SCALE_1M") != "1",
                    reason="set ATLAS_SCALE_1M=1 to run the 1M-row benchmark")
def test_one_million_rows_is_still_one_question(db):
    _seed(db, 1_000_000)
    groups, total, secs = _timed_questions(db)
    assert total == 1 and groups[0].affected_rows == 1_000_000
    print(f"\n1M observations -> 1 question in {secs:.2f}s")
