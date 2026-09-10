"""
Bulk Ingestion Script for all pending files in uploads/ and Builders data/
Pushes all raw datasets into PostgreSQL backend database through the 7-stage engine.
"""
import os
import sys
import time
import hashlib
from pathlib import Path
from datetime import datetime, timezone

# Add workspace root to PYTHONPATH
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from sqlalchemy import select, text, func
from backend.app.database.session import SessionLocal, init_db
from backend.app.models.models import SourceFile, ProcessingJob, Record, ProcessingError, JobStatus
from backend.app.config import settings
from engine.processor import Processor


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def ingest_single_file(db, file_path: Path, processor: Processor) -> tuple[int, int, int]:
    """
    Ingests a single file into the database.
    Returns (status_code, total_rows, valid_rows)
    status_code: 1 = newly ingested, 0 = skipped (already exists), -1 = error
    """
    file_path = Path(file_path)
    file_hash = sha256_file(file_path)
    file_size = file_path.stat().st_size
    filename = file_path.name

    # Check if already successfully ingested
    src = db.scalar(select(SourceFile).where(SourceFile.content_sha256 == file_hash))
    if src:
        existing_job = db.scalar(
            select(ProcessingJob)
            .where(
                ProcessingJob.source_file_id == src.id,
                ProcessingJob.status.in_((JobStatus.COMPLETED, JobStatus.COMPLETED_WITH_ERRORS))
            )
            .order_by(ProcessingJob.id.desc()).limit(1)
        )
        if existing_job:
            return 0, existing_job.total_rows or 0, existing_job.valid_rows or 0

    if not src:
        src = SourceFile(
            filename=filename,
            stored_path=str(file_path.resolve()),
            size_bytes=file_size,
            content_sha256=file_hash,
            uploaded_at=datetime.now(timezone.utc),
        )
        db.add(src)
        db.commit()
        db.refresh(src)

    # Create ProcessingJob
    job = ProcessingJob(
        source_file_id=src.id,
        status=JobStatus.PROCESSING,
        batch_size=settings.BATCH_SIZE,
        started_at=datetime.now(timezone.utc),
        progress_percent=0.0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Batch callback
    def on_batch(rows: list[dict]) -> int:
        for r in rows:
            r["job_id"] = job.id
        db.bulk_insert_mappings(Record, rows)
        db.commit()
        return len(rows)

    def on_progress(res, sheet_name: str) -> None:
        job.current_sheet = sheet_name
        job.total_rows = res.total_rows
        job.processed_rows = res.processed_rows
        job.valid_rows = res.valid_rows
        job.invalid_rows = res.invalid_rows
        job.duplicate_rows = res.duplicate_rows
        job.skipped_rows = res.skipped_rows
        if res.total_rows and res.total_rows > 0:
            job.progress_percent = min(round(100.0 * res.processed_rows / res.total_rows, 1), 99.0)
        db.commit()

    try:
        result = processor.process(
            file_path,
            source_name=filename,
            on_batch=on_batch,
            on_progress=on_progress,
            seen_hashes=None,  # intra-file deduplication
        )

        src.detected_format = result.detected_format
        src.sheet_count = result.sheet_count

        job.total_rows = result.total_rows
        job.processed_rows = result.processed_rows
        job.valid_rows = result.valid_rows
        job.invalid_rows = result.invalid_rows
        job.duplicate_rows = result.duplicate_rows
        job.skipped_rows = result.skipped_rows
        job.mapping_report = result.mapping_report
        job.progress_percent = 100.0
        job.finished_at = datetime.now(timezone.utc)
        job.current_sheet = None

        hard_errors = sum(1 for e in result.errors if e.get("severity") == "ERROR")
        job.status = JobStatus.COMPLETED_WITH_ERRORS if (hard_errors or job.invalid_rows) else JobStatus.COMPLETED

        for e in result.errors[:200]:
            db.add(ProcessingError(job_id=job.id, **e))
        job.error_count = len(result.errors)

        db.commit()
        return 1, result.total_rows, result.valid_rows

    except Exception as exc:
        db.rollback()
        job.status = JobStatus.FAILED
        job.error_message = str(exc)
        job.finished_at = datetime.now(timezone.utc)
        db.commit()
        raise exc


def refresh_materialized_views(db):
    print("\nRefreshing PostgreSQL materialized views for instant analytics reflection...", flush=True)
    try:
        db.execute(text("REFRESH MATERIALIZED VIEW mv_record_stats;"))
        db.commit()
        print("  ✓ mv_record_stats refreshed successfully.", flush=True)
    except Exception as e:
        print(f"  Notice: mv_record_stats refresh note: {e}", flush=True)

    try:
        db.execute(text("REFRESH MATERIALIZED VIEW mv_record_facets;"))
        db.commit()
        print("  ✓ mv_record_facets refreshed successfully.", flush=True)
    except Exception as e:
        print(f"  Notice: mv_record_facets refresh note: {e}", flush=True)


def main():
    print("=" * 75, flush=True)
    print("  DATALINK DATA INGESTION ENGINE -> POSTGRESQL BACKEND", flush=True)
    print("=" * 75, flush=True)

    init_db()
    db = SessionLocal()

    # Find all data files in uploads/ and Builders data/
    search_dirs = [ROOT / "uploads", ROOT / "Builders data"]
    all_files = []
    for d in search_dirs:
        if d.exists():
            for f in d.glob("**/*"):
                if f.is_file() and f.suffix.lower() in (".xlsx", ".xls", ".csv") and not f.name.startswith(("~$", "._")):
                    all_files.append(f)

    all_files = sorted(all_files, key=lambda x: (x.stat().st_size, x.name))

    initial_records = db.scalar(select(func.count(Record.id))) or 0
    print(f"  Target Data Files:    {len(all_files)} files found", flush=True)
    print(f"  Current DB Records:   {initial_records:,}", flush=True)
    print(f"  Database Host:        {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else 'local'}", flush=True)
    print("-" * 75, flush=True)

    processor = Processor(
        batch_size=settings.BATCH_SIZE,
        enable_enrichment=settings.ENABLE_ENRICHMENT,
        reference_path=settings.REFERENCE_WORKBOOK,
        record_grain=settings.RECORD_GRAIN,
    )

    newly_ingested = 0
    skipped_count = 0
    failed_count = 0
    total_added_rows = 0
    total_valid_rows = 0
    t0 = time.time()

    for i, file_path in enumerate(all_files, 1):
        file_name = file_path.name
        file_size_kb = file_path.stat().st_size / 1024
        print(f"[{i:02d}/{len(all_files):02d}] {file_name:<50} ({file_size_kb:7.1f} KB)...", end=" ", flush=True)

        try:
            t_file = time.time()
            status, total_r, valid_r = ingest_single_file(db, file_path, processor)
            dur = time.time() - t_file

            if status == 1:
                newly_ingested += 1
                total_added_rows += total_r
                total_valid_rows += valid_r
                print(f"[OK] INGESTED: {total_r:6,d} rows ({valid_r:6,d} valid) in {dur:.2f}s", flush=True)
            elif status == 0:
                skipped_count += 1
                print(f"[SKIP] Already in DB ({total_r:,} rows)", flush=True)
            else:
                failed_count += 1
                print(f"[WARN] Error recorded", flush=True)
        except Exception as exc:
            failed_count += 1
            print(f"[FAIL] Error: {exc}", flush=True)

    # Refresh materialized views for instant analytics reflection
    refresh_materialized_views(db)

    final_records = db.scalar(select(func.count(Record.id))) or 0
    elapsed = time.time() - t0

    print("\n" + "=" * 75, flush=True)
    print("  INGESTION SUMMARY", flush=True)
    print("=" * 75, flush=True)
    print(f"  Total Files Checked:      {len(all_files):,}", flush=True)
    print(f"  Newly Ingested Files:     {newly_ingested:,}", flush=True)
    print(f"  Already Ingested Files:   {skipped_count:,}", flush=True)
    print(f"  Failed Files:             {failed_count:,}", flush=True)
    print(f"  Initial DB Records:       {initial_records:,}", flush=True)
    print(f"  Final DB Records:         {final_records:,} (+{final_records - initial_records:,})", flush=True)
    print(f"  Elapsed Processing Time:  {elapsed:.2f} seconds", flush=True)
    print("=" * 75, flush=True)

    db.close()


if __name__ == "__main__":
    main()
