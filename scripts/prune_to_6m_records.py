"""
Script to prune spreadsheets down to ~6.37M records (leaving 25% of data, 75% data gone).
Ranks remaining sheets by valid_rows DESC, keeping the top files until reaching ~6.37M total records,
deleting the rest in safe batches of 50 and appending to deleted_sheets_audit.csv.
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
TARGET_MAX_RECORDS = 6_370_000
BATCH_SIZE = 50

def run():
    t0 = time.time()
    print("=" * 70)
    print("  DATALINK: PRUNING DATA TO ~6.37M RECORDS (75% OF DATA GONE)")
    print("=" * 70)

    # 1. Fetch currently remaining completed jobs
    with engine.connect() as conn:
        jobs = conn.execute(text('''
            SELECT sf.id as sf_id, sf.filename, 
                   COALESCE(SUM(pj.total_rows), 0) as total_r, 
                   COALESCE(SUM(pj.duplicate_rows), 0) as dup_r, 
                   COALESCE(SUM(pj.valid_rows), 0) as val_r
            FROM source_files sf
            LEFT JOIN processing_jobs pj ON pj.source_file_id = sf.id
            GROUP BY sf.id, sf.filename
            ORDER BY val_r DESC, total_r DESC;
        ''')).fetchall()

    cum_rows = 0
    cum_valid = 0
    keep_files = []
    del_files = []

    for f in jobs:
        # If adding this file keeps us within target
        if cum_rows + f[2] <= TARGET_MAX_RECORDS or len(keep_files) == 0:
            keep_files.append(f)
            cum_rows += f[2]
            cum_valid += f[4]
        else:
            del_files.append(f)

    print(f"Current Sheets in DB:           {len(jobs):,}")
    print(f"Sheets to KEEP (Top Quality):   {len(keep_files):,} sheets (~{cum_rows:,} records, {cum_valid:,} valid leads)")
    print(f"Sheets to DELETE:               {len(del_files):,} sheets (~{sum(f[2] for f in del_files):,} records)")
    print("=" * 70)

    if not del_files:
        print("Target already achieved! No more sheets to delete.")
    else:
        # 2. Append deleted sheets to audit log
        print(f"\nAppending deleted sheets to audit log: {AUDIT_CSV} ...", flush=True)
        with open(AUDIT_CSV, "a", newline="", encoding="utf-8") as f_out:
            writer = csv.writer(f_out)
            now_str = datetime.now(timezone.utc).isoformat()
            for f in del_files:
                writer.writerow([f[0], f[1], "MULTIPLE_OR_PRUNED", f[2], f[4], f[3], "DELETED_PHASE2", now_str])

        # 3. Delete in safe batches
        print(f"Deleting {len(del_files):,} sheets in batches of {BATCH_SIZE} ...", flush=True)
        num_batches = (len(del_files) + BATCH_SIZE - 1) // BATCH_SIZE
        deleted_records_count = 0

        for i in range(num_batches):
            batch = del_files[i * BATCH_SIZE : (i + 1) * BATCH_SIZE]
            sf_ids = [str(f[0]) for f in batch]
            sf_ids_str = ",".join(sf_ids)

            with engine.begin() as conn:
                # 1. Delete records for jobs belonging to these files
                res_rec = conn.execute(text(f"""
                    DELETE FROM records 
                    WHERE job_id IN (SELECT id FROM processing_jobs WHERE source_file_id IN ({sf_ids_str}));
                """))
                deleted_records_count += res_rec.rowcount

                # 2. Delete errors
                conn.execute(text(f"""
                    DELETE FROM processing_errors 
                    WHERE job_id IN (SELECT id FROM processing_jobs WHERE source_file_id IN ({sf_ids_str}));
                """))

                # 3. Delete jobs
                conn.execute(text(f"""
                    DELETE FROM processing_jobs 
                    WHERE source_file_id IN ({sf_ids_str});
                """))

                # 4. Delete source files
                conn.execute(text(f"""
                    DELETE FROM source_files 
                    WHERE id IN ({sf_ids_str});
                """))

            pct = min(100.0, (i + 1) / num_batches * 100)
            print(f"  [Batch {i+1:02d}/{num_batches:02d}] Deleted {len(batch)} sheets | Cumulative records deleted: {deleted_records_count:,} ({pct:.1f}%)", flush=True)

    # 4. Refresh Materialized Views separately
    print("\nRefreshing materialized views...", flush=True)
    with engine.begin() as conn:
        try:
            conn.execute(text("REFRESH MATERIALIZED VIEW mv_record_stats;"))
            print("  [mv_record_stats Refreshed]")
        except Exception as exc:
            print(f"  [Warning: mv_record_stats: {exc}]")

    with engine.begin() as conn:
        try:
            conn.execute(text("REFRESH MATERIALIZED VIEW mv_record_facets;"))
            print("  [mv_record_facets Refreshed]")
        except Exception as exc:
            print(f"  [Warning: mv_record_facets: {exc}]")

    # 5. Final Stats
    with engine.connect() as conn:
        final_recs = conn.execute(text("SELECT count(*) FROM records;")).scalar()
        final_files = conn.execute(text("SELECT count(*) FROM source_files;")).scalar()
        final_size = conn.execute(text("SELECT pg_size_pretty(pg_database_size(current_database()));")).scalar()

    elapsed = time.time() - t0
    print("\n" + "=" * 70)
    print("  PHASE 2 PRUNING COMPLETE (STRICT 75% OF DATA GONE)")
    print("=" * 70)
    print(f"  Final Records in DB:         {final_recs:,} (~25% of original 25.48M)")
    print(f"  Final Sheets in DB:          {final_files:,}")
    print(f"  Final Database Disk Size:    {final_size}")
    print(f"  Total Elapsed Time:          {elapsed:.1f}s")
    print(f"  Audit File:                  {AUDIT_CSV}")
    print("=" * 70)


if __name__ == "__main__":
    run()
