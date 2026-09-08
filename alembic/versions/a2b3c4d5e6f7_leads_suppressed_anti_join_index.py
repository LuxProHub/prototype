"""Leads suppressed partial index for anti-join acceleration

Revision ID: a2b3c4d5e6f7
Revises: e1b2c3d4e5f6
Create Date: 2026-09-08 16:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'a2b3c4d5e6f7'
down_revision = 'e1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # Accelerate the NOT EXISTS anti-join in records listing and exports.
    # The partial filter matches the exact suppression condition:
    # (stage = 'DO_NOT_CONTACT' OR contact_verdict IN ('WRONG_NUMBER', 'NOT_OWNER', 'SOLD'))
    # Keeping it partial ensures 98%+ of unsuppressed leads never write to this index.
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_suppressed_identity
        ON leads (identity_hash)
        WHERE (stage = 'DO_NOT_CONTACT' OR contact_verdict IN ('WRONG_NUMBER', 'NOT_OWNER', 'SOLD'));
    """)


def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_leads_suppressed_identity;")
