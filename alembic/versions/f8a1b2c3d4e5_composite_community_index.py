"""Add composite community index for fast filtering

Revision ID: f8a1b2c3d4e5
Revises: d9f3c07b8e41
Create Date: 2026-09-08 12:11:00.000000

"""
from alembic import op

revision = 'f8a1b2c3d4e5'
down_revision = 'd9f3c07b8e41'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_records_comm_valid_id 
        ON records (community, id DESC) 
        WHERE status = 'VALID' AND has_valid_mobile;
    """)


def downgrade():
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_records_comm_valid_id;")
