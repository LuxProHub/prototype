"""
Data Ingestion CLI for Y:\\1-Data_Organized
Ingests multi-builder spreadsheets (.xlsx, .xls, .csv) into Local PostgreSQL.
Enforces multi-threaded high-throughput parallel execution, safety limits,
and atomic restore-point checkpointing to disk.
"""
import os
import sys
import time
import json
import shutil
import hashlib
import argparse
import threading
from pathlib import Path
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

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

# Safety thresholds
TARGET_MAX_RECORDS = 0
MIN_FREE_DISK_GB = 15.0
CHECKPOINT_FILE = ROOT / "scripts" / "ingestion_checkpoint.json"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def check_disk_safety() -> tuple[bool, float]:
    """Ensure PostgreSQL data drive (D: or C:) has ample free space."""
    target_drive = "D:\\" if Path("D:\\").exists() else "C:\\"
    try:
        _, _, free_bytes = shutil.disk_usage(target_drive)
        free_gb = free_bytes / (1024 ** 3)
        return free_gb >= MIN_FREE_DISK_GB, free_gb
    except Exception:
        return True, 999.0


def save_checkpoint(data: dict):
    """Write an atomic restore-point checkpoint file to disk."""
    try:
        tmp_file = CHECKPOINT_FILE.with_suffix(".tmp")
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        tmp_file.replace(CHECKPOINT_FILE)
    except Exception:
        pass


def ingest_file(db, file_path: Path, processor: Processor) -> tuple[int, int, int]:
    file_path = Path(file_path)
    file_hash = sha256_file(file_path)
    file_size = file_path.stat().st_size
    filename = file_path.name

    # Check if already ingested via content SHA-256
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
            return -1, existing_job.total_rows or 0, existing_job.valid_rows or 0

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

    # Batch insert callback
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

    # Process file through engine (seen_hashes=None uses intra-file dedup to conserve RAM)
    result = processor.process(
        file_path,
        source_name=filename,
        on_batch=on_batch,
        on_progress=on_progress,
        seen_hashes=None,
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

    hard = sum(1 for e in result.errors if e.get("severity") == "ERROR")
    job.status = JobStatus.COMPLETED_WITH_ERRORS if (hard or job.invalid_rows) else JobStatus.COMPLETED

    for e in result.errors[:200]:
        db.add(ProcessingError(job_id=job.id, **e))
    job.error_count = len(result.errors)

    db.commit()
    return 1, result.total_rows, result.valid_rows


def refresh_materialized_views(db):
    try:
        db.execute(text("REFRESH MATERIALIZED VIEW mv_record_stats;"))
        db.execute(text("REFRESH MATERIALIZED VIEW mv_record_facets;"))
        db.commit()
        print("  [Analytics Views Refreshed]", flush=True)
    except Exception as e:
        print(f"  [Notice: view refresh skipped: {e}]", flush=True)


def main():
    parser = argparse.ArgumentParser(description="High-Throughput Parallel Ingest into PostgreSQL")
    parser.add_argument("--dir", default=r"Y:\1-Data_Organized", help="Source folder path")
    parser.add_argument("--subfolder", default="", help="Specific subfolder to process")
    parser.add_argument("--max-records", type=int, default=TARGET_MAX_RECORDS, help="Target record ceiling")
    parser.add_argument("--workers", type=int, default=6, help="Parallel worker threads (default 6)")
    args = parser.parse_args()

    max_target = args.max_records
    workers = max(1, args.workers)
    target_dir = Path(args.dir)
    if args.subfolder:
        target_dir = target_dir / args.subfolder

    if not target_dir.exists():
        print(f"Directory not found: {target_dir}")
        sys.exit(1)

    init_db()
    db = SessionLocal()

    # Initial checks
    current_count = db.scalar(select(func.count(Record.id))) or 0
    safe, free_gb = check_disk_safety()

    target_display = f"{max_target:,}" if max_target > 0 else "Unlimited (All files)"
    print("=" * 70)
    print("  DATALINK HIGH-THROUGHPUT BULK INGESTION (PARALLEL)")
    print(f"  Source Directory:    {target_dir}")
    print(f"  Parallel Workers:    {workers} threads (utilizing CPU cores)")
    print(f"  Current DB Records:  {current_count:,}")
    print(f"  Target Max Records:  {target_display}")
    print(f"  Disk Free Space:     {free_gb:.1f} GB (Safe threshold: {MIN_FREE_DISK_GB} GB)")
    print(f"  Restore Point File:  {CHECKPOINT_FILE}")
    print("=" * 70)

    if max_target > 0 and current_count >= max_target:
        print(f"\nTarget cap of {max_target:,} records is ALREADY reached ({current_count:,} records).")
        print("No further ingestion required. Database is fully populated and safe.")
        refresh_materialized_views(db)
        db.close()
        return

    # Collect files
    print("\nScanning for spreadsheets...", flush=True)
    files = sorted([
        f for f in target_dir.glob("**/*")
        if f.is_file() 
        and f.suffix.lower() in (".xlsx", ".xls", ".csv")
        and not f.name.startswith("~$")
        and not f.name.startswith("._")
    ])

    print(f"Found {len(files):,} spreadsheet files to process.\n", flush=True)
    db.close()

    processor = Processor(
        batch_size=settings.BATCH_SIZE,
        enable_enrichment=settings.ENABLE_ENRICHMENT,
        reference_path=settings.REFERENCE_WORKBOOK,
        record_grain=settings.RECORD_GRAIN,
    )

    # Thread-safe tracking state
    print_lock = threading.Lock()
    state_lock = threading.Lock()
    stats = {
        "processed": 0,
        "skipped": 0,
        "failed": 0,
        "total_rows": 0,
        "valid_rows": 0,
        "stop_requested": False,
    }
    t0 = time.time()

    def process_single_file(item):
        idx, total_count, file_path = item
        if stats["stop_requested"]:
            return

        # Check disk safety
        is_safe, free_space = check_disk_safety()
        if not is_safe:
            with state_lock:
                stats["stop_requested"] = True
            with print_lock:
                print(f"\n[SAFETY STOP]: Free space dropped to {free_space:.1f} GB. Halting.", flush=True)
            return

        file_size_kb = file_path.stat().st_size / 1024
        thread_db = SessionLocal()
        try:
            t_start = time.time()
            status_code, total_r, valid_r = ingest_file(thread_db, file_path, processor)
            duration = time.time() - t_start

            with state_lock:
                if status_code == -1:
                    stats["skipped"] += 1
                    status_text = f"SKIPPED (already in DB with {total_r:,} rows)"
                else:
                    stats["processed"] += 1
                    stats["total_rows"] += total_r
                    stats["valid_rows"] += valid_r
                    status_text = f"DONE: +{total_r:,} rows ({valid_r:,} valid) [{duration:.1f}s]"

                # Update disk checkpoint restore point
                save_checkpoint({
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "last_processed_file": file_path.name,
                    "completed_files": stats["processed"],
                    "skipped_files": stats["skipped"],
                    "failed_files": stats["failed"],
                    "total_files": total_count,
                    "new_rows_inserted": stats["total_rows"],
                    "free_disk_gb": round(free_space, 2),
                    "status": "RUNNING",
                })

            with print_lock:
                print(f"[{idx:04d}/{total_count:04d}] {file_path.name[:42]:<42} ({file_size_kb:7.1f} KB)... {status_text}", flush=True)

        except Exception as exc:
            with state_lock:
                stats["failed"] += 1
            with print_lock:
                print(f"[{idx:04d}/{total_count:04d}] {file_path.name[:42]:<42}... FAILED: {exc}", flush=True)
            thread_db.rollback()
        finally:
            thread_db.close()

    items = [(i, len(files), f) for i, f in enumerate(files, 1)]

    print(f"Starting execution with {workers} parallel workers...\n", flush=True)
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(process_single_file, item) for item in items]
        for f in as_completed(futures):
            if stats["stop_requested"]:
                executor.shutdown(wait=False, cancel_futures=True)
                break

    # Final wrap-up
    final_db = SessionLocal()
    refresh_materialized_views(final_db)
    final_count = final_db.scalar(select(func.count(Record.id))) or 0
    final_db.close()
    elapsed = time.time() - t0

    save_checkpoint({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "completed_files": stats["processed"],
        "skipped_files": stats["skipped"],
        "failed_files": stats["failed"],
        "total_files": len(files),
        "new_rows_inserted": stats["total_rows"],
        "final_db_records": final_count,
        "elapsed_seconds": round(elapsed, 1),
        "status": "STOPPED_SAFELY" if stats["stop_requested"] else "COMPLETED",
    })

    print("\n" + "=" * 70)
    print("  INGESTION SUMMARY")
    print("=" * 70)
    print(f"  Final Record Count in DB: {final_count:,}")
    print(f"  Files Newly Ingested:     {stats['processed']:,}")
    print(f"  Files Skipped (in DB):    {stats['skipped']:,}")
    print(f"  Files Failed:             {stats['failed']:,}")
    print(f"  Total Time Elapsed:       {elapsed:.1f}s")
    print(f"  Restore Point Checkpoint: {CHECKPOINT_FILE}")
    print("=" * 70)


if __name__ == "__main__":
    main()
