"""
MAX TURBO Batch Ingestion Engine
Unleashes multi-core parallelism across 6 worker processes, saturating
CPU and disk I/O to ingest all remaining spreadsheets from
C:\\Users\\USER\\Music\\All excel directly into PostgreSQL.

Features:
- Multi-process worker pool (6 concurrent workers)
- Zero throttling / No artificial pauses
- Automatic skip of already ingested files (resumes from where it left off)
- Scoped DedupIndex per worker for high-speed indexed duplicate checks
- Small-to-large scheduling for maximum file completion velocity
"""
import argparse
import gc
import hashlib
import json
import logging
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

# Add project root to path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from sqlalchemy import select
from backend.app.config import settings
from backend.app.core.dedup_index import DedupIndex
from backend.app.core.persistence import persist_batch
from backend.app.database.session import SessionLocal, init_db
from backend.app.models.models import (
    JobStatus, ProcessingError, ProcessingJob, Record, SourceFile
)
from engine.inspection import inspect_source
from engine.processor import Processor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)
log = logging.getLogger("turbo_ingest")

DEFAULT_TARGET_DIR = Path(r"C:\Users\USER\Music\All excel")
MANIFEST_FILE = ROOT / "logs" / "music_excel_manifest.json"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _worker_process_file(file_path_str: str) -> dict:
    """Worker task executed in a parallel process."""
    file_path = Path(file_path_str)
    filename = file_path.name
    t0 = time.time()

    try:
        file_hash = sha256_file(file_path)
    except Exception as e:
        return {"filename": filename, "status": "ERROR", "error": f"Hashing failed: {e}"}

    # Structure inspection
    try:
        info = inspect_source(file_path)
    except Exception as e:
        return {"filename": filename, "status": "ERROR", "error": f"Inspect failed: {e}"}

    db = SessionLocal()
    try:
        # Check SourceFile & existing completed job
        src = db.scalar(select(SourceFile).where(SourceFile.content_sha256 == file_hash))
        if not src:
            src = SourceFile(
                filename=filename,
                stored_path=str(file_path.resolve()),
                size_bytes=file_path.stat().st_size,
                content_sha256=file_hash,
                detected_format=info.detected_format,
                sheet_count=len(info.sheets),
                uploaded_at=datetime.now(timezone.utc),
            )
            db.add(src)
            db.commit()
            db.refresh(src)
        else:
            completed_job = db.scalar(
                select(ProcessingJob)
                .where(
                    ProcessingJob.source_file_id == src.id,
                    ProcessingJob.status.in_([JobStatus.COMPLETED, JobStatus.COMPLETED_WITH_ERRORS])
                )
            )
            if completed_job:
                return {"filename": filename, "status": "SKIPPED", "valid_rows": completed_job.valid_rows}

        # Create ProcessingJob
        job = ProcessingJob(
            source_file_id=src.id,
            status=JobStatus.READING,
            batch_size=settings.BATCH_SIZE,
            started_at=datetime.now(timezone.utc),
            progress_percent=0.0,
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        # Scoped Processor & DedupIndex
        dedup_idx = DedupIndex(db, exclude_job_id=job.id)
        processor = Processor(
            batch_size=settings.BATCH_SIZE,
            enable_enrichment=settings.ENABLE_ENRICHMENT,
            reference_path=settings.REFERENCE_WORKBOOK,
            record_grain=settings.RECORD_GRAIN,
            property_reference_path=settings.PROPERTY_REFERENCE,
            dedup_index=dedup_idx,
        )

        def on_batch(rows: list[dict]) -> int:
            if not rows:
                return 0
            n = persist_batch(db, rows, job.id)
            db.commit()
            return n

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

        job.status = JobStatus.PROCESSING
        db.commit()

        result = processor.process(
            file_path,
            source_name=filename,
            on_batch=on_batch,
            on_progress=on_progress,
        )

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

        hard_errs = sum(1 for e in result.errors if e.get("severity") == "ERROR")
        job.status = JobStatus.COMPLETED_WITH_ERRORS if (hard_errs or job.invalid_rows) else JobStatus.COMPLETED

        for e in result.errors[:300]:
            db.add(ProcessingError(job_id=job.id, **e))
        job.error_count = len(result.errors)

        db.commit()
        dur = time.time() - t0
        return {
            "filename": filename,
            "status": "COMPLETED",
            "job_id": job.id,
            "total_rows": result.total_rows,
            "valid_rows": result.valid_rows,
            "duplicate_rows": result.duplicate_rows,
            "duration": dur,
        }
    except Exception as exc:
        db.rollback()
        return {"filename": filename, "status": "ERROR", "error": str(exc)}
    finally:
        db.close()
        gc.collect()


def main():
    parser = argparse.ArgumentParser(description="MAX TURBO batch ingestion into PostgreSQL")
    parser.add_argument("--dir", type=str, default=str(DEFAULT_TARGET_DIR), help="Source directory")
    parser.add_argument("--workers", type=int, default=6, help="Number of parallel workers")
    parser.add_argument("--limit", type=int, default=None, help="Limit files")
    args = parser.parse_args()

    target_dir = Path(args.dir)
    if not target_dir.exists():
        log.error(f"Directory {target_dir} not found!")
        sys.exit(1)

    init_db()

    # Query already completed hashes
    db = SessionLocal()
    existing_hashes = set(db.scalars(
        select(SourceFile.content_sha256)
        .join(ProcessingJob, ProcessingJob.source_file_id == SourceFile.id)
        .where(
            SourceFile.content_sha256.is_not(None),
            ProcessingJob.status.in_([JobStatus.COMPLETED, JobStatus.COMPLETED_WITH_ERRORS])
        )
    ).all())
    db.close()
    log.info(f"[DB] Found {len(existing_hashes)} completed files in PostgreSQL.")

    all_files = [
        p for p in target_dir.glob("*")
        if p.is_file() and p.suffix.lower() in (".xlsx", ".xls", ".csv")
        and not p.name.startswith("~$") and not p.name.startswith("._")
        and p.stat().st_size >= 512
    ]
    all_files.sort(key=lambda p: p.stat().st_size)

    log.info(f"[DISCOVERY] Found {len(all_files):,} candidate files. Pre-filtering...")
    pending = []
    for f in all_files:
        try:
            h = sha256_file(f)
            if h not in existing_hashes:
                pending.append(str(f.resolve()))
        except Exception:
            pending.append(str(f.resolve()))

    log.info(f"[TURBO QUEUE] {len(pending):,} pending files to process with {args.workers} workers.")
    if args.limit:
        pending = pending[:args.limit]
        log.info(f"[LIMIT] First {len(pending)} files selected.")

    if not pending:
        log.info("[DONE] All files are already ingested!")
        return

    MANIFEST_FILE.parent.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    total_valid = 0
    total_processed_files = 0
    results = []

    log.info(f"[LAUNCH] Spawning {args.workers} parallel workers. Full laptop saturation engaged.")

    with ProcessPoolExecutor(max_workers=args.workers) as executor:
        future_map = {executor.submit(_worker_process_file, f_str): f_str for f_str in pending}

        for future in as_completed(future_map):
            total_processed_files += 1
            res = future.result()
            results.append(res)
            st = res.get("status")
            fn = res.get("filename")

            if st == "COMPLETED":
                vr = res.get("valid_rows", 0)
                total_valid += vr
                dur = res.get("duration", 0.0)
                log.info(f"[{total_processed_files}/{len(pending)}] [DONE] {fn}: {vr:,} valid in {dur:.1f}s")
            elif st == "SKIPPED":
                log.info(f"[{total_processed_files}/{len(pending)}] [SKIP] {fn} (already done)")
            else:
                log.warning(f"[{total_processed_files}/{len(pending)}] [FAIL] {fn}: {res.get('error')}")

            # Manifest checkpoint every 10 files
            if total_processed_files % 10 == 0 or total_processed_files == len(pending):
                with open(MANIFEST_FILE, "w", encoding="utf-8") as mf:
                    json.dump({
                        "last_updated": datetime.now(timezone.utc).isoformat(),
                        "completed_count": sum(1 for r in results if r.get("status") == "COMPLETED"),
                        "total_valid_records": total_valid,
                        "processed": total_processed_files,
                        "total": len(pending),
                    }, mf, indent=2)

    elapsed = time.time() - t0
    log.info("=" * 70)
    log.info(f"[FINISHED] Ingested {total_valid:,} records across {total_processed_files} files in {elapsed/60:.1f} minutes.")
    log.info("=" * 70)


if __name__ == "__main__":
    main()
