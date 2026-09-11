import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from backend.app.database.session import SessionLocal, engine
from sqlalchemy import text, select, func
from backend.app.models.models import Record, SourceFile, ProcessingJob
import shutil

db = SessionLocal()

total_records = db.scalar(select(func.count(Record.id)))
total_files = db.scalar(select(func.count(SourceFile.id)))
total_jobs = db.scalar(select(func.count(ProcessingJob.id)))

with engine.connect() as conn:
    db_size = conn.execute(text("SELECT pg_size_pretty(pg_database_size(current_database()));")).scalar()
    raw_db_size_bytes = conn.execute(text("SELECT pg_database_size(current_database());")).scalar()
    
    table_sizes = conn.execute(text("""
        SELECT relname AS table_name,
               pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
               pg_size_pretty(pg_relation_size(relid)) AS data_size,
               pg_size_pretty(pg_indexes_size(relid)) AS index_size
        FROM pg_catalog.pg_statio_user_tables
        ORDER BY pg_total_relation_size(relid) DESC;
    """)).fetchall()

    status_breakdown = conn.execute(text("SELECT status, count(*) FROM records GROUP BY status ORDER BY count(*) DESC;")).fetchall()

    top_communities = conn.execute(text("SELECT community, count(*) FROM records WHERE community IS NOT NULL AND community != '' GROUP BY community ORDER BY count(*) DESC LIMIT 8;")).fetchall()

    top_developers = conn.execute(text("SELECT developer, count(*) FROM records WHERE developer IS NOT NULL AND developer != '' GROUP BY developer ORDER BY count(*) DESC LIMIT 8;")).fetchall()

    contacts = conn.execute(text("""
        SELECT 
            COUNT(*) FILTER (WHERE mobile_1 IS NOT NULL AND mobile_1 != '') as with_mobile,
            COUNT(*) FILTER (WHERE email_address IS NOT NULL AND email_address != '') as with_email,
            COUNT(*) FILTER (WHERE name IS NOT NULL AND name != '') as with_name
        FROM records;
    """)).fetchone()

    # Materialized view sizes
    mat_sizes = conn.execute(text("""
        SELECT matviewname, pg_size_pretty(pg_total_relation_size(matviewname::regclass)) AS total_size
        FROM pg_matviews;
    """)).fetchall()

print(f"TOTAL_RECORDS: {total_records:,}")
print(f"TOTAL_FILES: {total_files:,}")
print(f"TOTAL_JOBS: {total_jobs:,}")
print(f"DB_DISK_SIZE: {db_size} ({raw_db_size_bytes / (1024**3):.2f} GB)")

print("\n--- TABLE SIZES ---")
for row in table_sizes:
    print(f"  {row.table_name:<25} Total: {row.total_size:<10} Data: {row.data_size:<10} Index: {row.index_size}")

print("\n--- MATERIALIZED VIEWS ---")
for row in mat_sizes:
    print(f"  {row.matviewname:<25} Total: {row.total_size}")

print("\n--- RECORD STATUSES ---")
for row in status_breakdown:
    print(f"  {row.status:<20}: {row.count:,} ({row.count / total_records * 100:.1f}%)")

print("\n--- TOP COMMUNITIES ---")
for row in top_communities:
    print(f"  {row.community:<35}: {row.count:,}")

print("\n--- TOP DEVELOPERS ---")
for row in top_developers:
    print(f"  {row.developer:<35}: {row.count:,}")

print("\n--- CONTACT ATTRIBUTES ---")
m = contacts.with_mobile
e = contacts.with_email
n = contacts.with_name
print(f"  With Valid Mobile: {m:,} ({m/total_records*100:.1f}%)")
print(f"  With Email:        {e:,} ({e/total_records*100:.1f}%)")
print(f"  With Owner Name:   {n:,} ({n/total_records*100:.1f}%)")

print("\n--- DISK USAGE ---")
for d in ['C:\\', 'D:\\', 'Y:\\']:
    try:
        if Path(d).exists():
            total, used, free = shutil.disk_usage(d)
            print(f"  {d} Free: {free/(1024**3):.1f} GB / Total: {total/(1024**3):.1f} GB")
    except OSError:
        continue

db.close()
