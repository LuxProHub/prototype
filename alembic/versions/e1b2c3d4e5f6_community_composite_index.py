"""community composite index for accelerated filtering

Revision ID: e1b2c3d4e5f6
Revises: d9f3c07b8e41
Create Date: 2026-09-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'd9f3c07b8e41'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Accelerates community-filtered outreach searches from 360ms to <1ms
    op.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS idx_records_comm_id 
        ON records (community, id DESC) 
        WHERE status = 'VALID' AND has_valid_mobile;
    """))


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS idx_records_comm_id;"))
