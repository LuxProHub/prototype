"""
Script to safely prune ~75% of source spreadsheets from the local PostgreSQL database,
preserving the top 25% highest-quality/valid sheets, and generating a full audit CSV.
"""
import sys
import csv
import time
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from sqlalchemy import text
from backend.app.database.session import SessionLocal, engine

AUDIT_CSV = ROOT / "deleted_sheets_audit.csv"
BATCH_CHUNK_SIZE = 50


def run_pruning():
    db = SessionLocal()
    t0 = time.time()

    print("=" * 70)
    print("  DATALINK: 75% SOURCE SPREADSHEETS PRUNING & AUDIT")
    print("=" * 70)

    # 1. Fetch all completed jobs ranked by valid rows ascending
    with engine.connect() as conn:
        jobs = conn.execute(text('''
            SELECT sf.id as sf_id, sf.filename, pj.id as job_id, 
                   COALESCE(pj.total_rows, 0) as total_r, 
                   COALESCE(pj.duplicate_rows, 0) as dup_r, 
                   COALESCE(pj.valid_rows, 0) as val_r
            FROM source_files sf
            JOIN processing_jobs pj ON pj.source_file_id = sf.id
            WHERE pj.status IN ('COMPLETED', 'COMPLETED_WITH_ERRORS')
            ORDER BY COALESCE(pj.valid_rows, 0) ASC, COALESCE(pj.total_rows, 0) ASC;
        ''')).fetchall()

    total_jobs_count = len(jobs)
    target_delete_count = int(total_jobs_count * 0.75)
    
    del_jobs = jobs[:target_delete_count]
    keep_jobs = jobs[target_delete_count:]

    total_del_rows = sum(j[3] for j in del_jobs)
    total_del_val = sum(j[5] for j in del_jobs)
    total_keep_rows = sum(j[3] for j in keep_jobs)
    total_keep_val = sum(j[5] for j in keep_jobs)

    print(f"Total Source Sheets in DB:     {total_jobs_count:,}")
    print(f"Sheets to Delete (75%):        {len(del_jobs):,}")
    print(f"Sheets to Keep (Top 25%):      {len(keep_jobs):,}")
    print(f"Estimated Rows to Delete:      ~{total_del_rows:,} (only {total_del_val:,} valid)")
    print(f"Estimated Rows to Keep:        ~{total_keep_rows:,} ({total_keep_val:,} valid)")
    print("=" * 70)

    # 2. Write the audit CSV list
    print(f"\nWriting audit list to: {AUDIT_CSV} ...", flush=True)
    with open(AUDIT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["file_id", "filename", "job_id", "total_rows", "valid_rows", "duplicate_rows", "action", "timestamp"])
        now_str = datetime.now(timezone.utc).isoformat()
        for j in del_jobs:
            writer.writerow([j[0], j[1], j[2], j[3], j[5], j[4], "DELETED", now_str])

    print(f"Audit log written with {len(del_jobs):,} deleted sheet records.\n", flush=True)

    # 3. Delete in safe chunks
    print("Beginning database deletion in safe batches of 50 sheets...", flush=True)
    deleted_records_count = 0
    num_chunks = (len(del_jobs) + BATCH_CHUNK_SIZE - 1) // BATCH_CHUNK_SIZE

    for chunk_idx in range(num_chunks):
        chunk = del_jobs[chunk_idx * BATCH_CHUNK_SIZE : (chunk_idx + 1) * BATCH_CHUNK_SIZE]
        job_ids = [str(j[2]) for j in chunk]
        sf_ids = [str(j[0]) for j in chunk]

        job_ids_str = ",".join(job_ids)
        sf_ids_str = ",".join(sf_ids)

        with engine.begin() as conn:
            # Delete records
            res_rec = conn.execute(text(f"DELETE FROM records WHERE job_id IN ({job_ids_str});"))
            deleted_records_count += res_rec.rowcount

            # Delete errors
            conn.execute(text(f"DELETE FROM processing_errors WHERE job_id IN ({job_ids_str});"))

            # Delete jobs
            conn.execute(text(f"DELETE FROM processing_jobs WHERE id IN ({job_ids_str});"))

            # Delete source_files
            conn.execute(text(f"DELETE FROM source_files WHERE id IN ({sf_ids_str});"))

        pct = min(100.0, (chunk_idx + 1) / num_chunks * 100)
        print(f"  [Batch {chunk_idx + 1:02d}/{num_chunks:02d}] Deleted {len(chunk)} sheets | Cumulative records deleted: {deleted_records_count:,} ({pct:.1f}%)", flush=True)

    # 4. Refresh Materialized Views
    print("\nRefreshing materialized views...", flush=True)
    with engine.begin() as conn:
        try:
            conn.execute(text("REFRESH MATERIALIZED VIEW mv_record_stats;"))
            conn.execute(text("REFRESH MATERIALIZED VIEW mv_record_facets;"))
            print("  [Materialized Views Refreshed Successfully]")
        except Exception as exc:
            print(f"  [Warning: view refresh failed: {exc}]")

    # 5. Final Statistics
    with engine.connect() as conn:
        final_recs = conn.execute(text("SELECT count(*) FROM records;")).scalar()
        final_files = conn.execute(text("SELECT count(*) FROM source_files;")).scalar()
        final_size = conn.execute(text("SELECT pg_size_pretty(pg_database_size(current_database()));")).scalar()

    elapsed = time.time() - t0
    print("\n" + "=" * 70)
    print("  PRUNING COMPLETE")
    print("=" * 70)
    print(f"  Actual Records Deleted:      {deleted_records_count:,}")
    print(f"  Sheets Deleted:              {len(del_jobs):,} (75%)")
    print(f"  Remaining Records in DB:     {final_recs:,}")
    print(f"  Remaining Sheets in DB:      {final_files:,} (Top 25%)")
    print(f"  New Database Disk Size:      {final_size}")
    print(f"  Elapsed Time:                {elapsed:.1f}s")
    print(f"  Audit List File:             {AUDIT_CSV}")
    print("=" * 70)


if __name__ == "__main__":
    run_pruning()
