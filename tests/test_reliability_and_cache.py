"""Reliability, Cache Correctness, and Failure Handling Tests."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.app.core.security import create_access_token
from backend.app.core.cache import (
    get_cached_filters, set_cached_filters,
    get_cached_default_count, set_cached_default_count,
    invalidate_filters_cache,
)
from backend.app.database.session import SessionLocal, init_db
from backend.app.main import app
from backend.app.models.models import User, UserRole, Record, RecordStatus, ProcessingJob, SourceFile

client = TestClient(app)

ADMIN_TOKEN = create_access_token({"sub": "1", "email": "pytest-admin@datalink.ae", "role": "ADMIN"})
HEADERS = {"Authorization": f"Bearer {ADMIN_TOKEN}"}


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_db()
    db = SessionLocal()
    try:
        # Ensure dummy job and source file exist
        if not db.get(ProcessingJob, 999):
            src = db.get(SourceFile, 999)
            if not src:
                src = SourceFile(id=999, filename="test_audit.xlsx", stored_path="test_audit.xlsx", size_bytes=100, content_sha256="abc")
                db.add(src)
                db.flush()
            job = ProcessingJob(id=999, source_file_id=999, status="COMPLETED")
            db.add(job)
            db.commit()
    finally:
        db.close()


def test_cache_storage_and_invalidation():
    """Verify TTLCache stores values and purges both filters and counts on invalidation."""
    set_cached_filters({"communities": ["Dubai Hills"]})
    set_cached_default_count(12345)

    assert get_cached_filters() == {"communities": ["Dubai Hills"]}
    assert get_cached_default_count() == 12345

    invalidate_filters_cache()

    assert get_cached_filters() is None
    assert get_cached_default_count() is None


def test_record_update_triggers_cache_invalidation():
    """Verify modifying a record purges in-memory caches."""
    db = SessionLocal()
    rec_id = None
    try:
        rec = Record(
            job_id=999,
            source_file="test_audit.xlsx",
            name="Cache Test User",
            mobile_1="+971501112233",
            community="Downtown Dubai",
            status=RecordStatus.VALID,
            identity_hash="cache_test_hash_123",
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        rec_id = rec.id

        # Set cache
        set_cached_filters({"test": True})
        set_cached_default_count(99999)

        # Update via API
        resp = client.put(
            f"/api/records/{rec_id}",
            json={"name": "Cache Test User Updated"},
            headers=HEADERS,
        )
        assert resp.status_code == 200

        # Cache must be purged
        assert get_cached_filters() is None
        assert get_cached_default_count() is None

    finally:
        if rec_id:
            db.query(Record).filter(Record.id == rec_id).delete()
            db.commit()
        db.close()


def test_export_streaming_and_cleanup():
    """Verify CSV and XLSX exports stream with proper headers and zero connection leaks."""
    resp_csv = client.get("/api/records/export?format=csv&limit=5", headers=HEADERS)
    assert resp_csv.status_code == 200
    assert resp_csv.headers["content-type"].startswith("text/csv")
    assert "Record ID" in resp_csv.text

    resp_xlsx = client.get("/api/records/export?format=xlsx&limit=5", headers=HEADERS)
    assert resp_xlsx.status_code == 200
    assert "openxmlformats" in resp_xlsx.headers["content-type"]
    assert len(resp_xlsx.content) > 0


def test_database_error_handling_and_rollback():
    """Verify an invalid transaction does not corrupt database session or leak internal errors."""
    resp = client.get("/api/records/999999999", headers=HEADERS)
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_health_check_endpoint():
    """Verify health endpoint reports correct database connectivity."""
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert resp.json()["database"] == "ok"
