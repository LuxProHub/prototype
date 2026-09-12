"""review decisions: human answers that feed back into mapping

Revision ID: b7d4f1a9e206
Revises: a1c5e8b23f70
Create Date: 2026-09-12

The semantic layer's most defensible behaviour is declining to guess: a bare
`Date` column is recorded as unresolved, an unsignalled size unit is flagged
rather than asserted, an AREA with no sibling geography keeps its historical
reading under review. Every one of those writes `needs_review` on an
observation.

Nothing read them. The engine raised flags into a void, which made the refusal
pure cost -- the data stayed correct and nobody could act on it.

review_decisions is the other half: what a person answered, on what evidence,
and how widely that answer applies. At the next ingest the resolver consults
these first, so a question answered once stops being asked.

Scope is deliberately narrow. A reviewer looking at one sheet has seen one
sheet, and the same header genuinely means different things in different files.
'workbook' is the default, 'global' has to be chosen explicitly, and the lookup
prefers the most specific match. That is what stops one wrong call propagating
across the corpus.

APPEND-ONLY, like field_observations: changing an answer writes a new row and
stamps superseded_by on the old one, so the reasoning behind a decision that
later proved wrong is still readable.

Creating a new table takes no lock on anything already in use, so this is safe
to run online.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b7d4f1a9e206'
down_revision: Union[str, Sequence[str], None] = 'a1c5e8b23f70'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "review_decisions",
        sa.Column("id", sa.Integer(), primary_key=True),

        # Same vocabulary as field_observations.canonical_field so the two join:
        # a canonical field name ("Date"), or a raw label ("AREA").
        sa.Column("canonical_field", sa.String(64), nullable=False),
        sa.Column("original_header", sa.String(512), nullable=True),

        sa.Column("scope", sa.String(16), nullable=False,
                  server_default="workbook"),
        sa.Column("scope_file", sa.String(512), nullable=True),
        sa.Column("scope_sheet", sa.String(255), nullable=True),

        sa.Column("semantic_type", sa.String(48), nullable=False),
        # Not decoration: the next person to disagree needs to know what this
        # reviewer was looking at.
        sa.Column("rationale", sa.Text(), nullable=True),

        # Where the decision came from: api / import / migration.
        sa.Column("source", sa.String(32), nullable=False, server_default="api"),
        sa.Column("decided_by", sa.Integer(), nullable=True),
        # Denormalised so the trail survives the account being deleted.
        sa.Column("decided_by_email", sa.String(320), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("observation_id", sa.Integer(), nullable=True),

        # What the engine had inferred when a human overrode it, so a pattern of
        # disagreement shows up in the data instead of in anecdote.
        sa.Column("engine_semantic_type", sa.String(48), nullable=True),
        sa.Column("engine_confidence", sa.Float(), nullable=True),
        sa.Column("engine_version", sa.Integer(), nullable=True),

        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("superseded_by", sa.Integer(), nullable=True),

        # Structural, not advisory: a narrow scope that does not say what it
        # is narrow TO would behave as global at lookup time. The API rejects
        # it too, but the API is not the only writer this table will ever have.
        sa.CheckConstraint("scope IN ('sheet','workbook','global')",
                           name="ck_decisions_scope_known"),
        sa.CheckConstraint("scope = 'global' OR scope_file IS NOT NULL",
                           name="ck_decisions_narrow_scope_has_file"),
        sa.CheckConstraint("scope <> 'sheet' OR scope_sheet IS NOT NULL",
                           name="ck_decisions_sheet_scope_has_sheet"),

        sa.ForeignKeyConstraint(["decided_by"], ["users.id"], ondelete="SET NULL"),
        # SET NULL rather than CASCADE: a reprocess replaces observations, and
        # the decision has to outlive the row that raised the question.
        sa.ForeignKeyConstraint(["observation_id"], ["field_observations.id"],
                                ondelete="SET NULL"),
    )

    op.create_index("ix_review_decisions_canonical_field", "review_decisions",
                    ["canonical_field"])
    op.create_index("ix_review_decisions_original_header", "review_decisions",
                    ["original_header"])
    op.create_index("ix_review_decisions_scope", "review_decisions", ["scope"])
    op.create_index("ix_review_decisions_scope_file", "review_decisions", ["scope_file"])
    op.create_index("ix_review_decisions_decided_by", "review_decisions", ["decided_by"])
    op.create_index("ix_review_decisions_decided_at", "review_decisions", ["decided_at"])
    op.create_index("ix_review_decisions_active", "review_decisions", ["active"])

    # The lookup the engine runs for every ambiguous column: what has a human
    # already said about this field and header, at any scope.
    op.create_index("ix_decisions_lookup", "review_decisions",
                    ["canonical_field", "original_header", "active"])
    op.create_index("ix_decisions_scope", "review_decisions", ["scope", "scope_file"])


def downgrade() -> None:
    # Dropping this discards human review decisions, which -- unlike
    # observations -- are NOT re-derivable from the source files. They are the
    # one thing in this schema that cannot be recomputed.
    op.drop_index("ix_decisions_scope", table_name="review_decisions")
    op.drop_index("ix_decisions_lookup", table_name="review_decisions")
    op.drop_index("ix_review_decisions_active", table_name="review_decisions")
    op.drop_index("ix_review_decisions_decided_at", table_name="review_decisions")
    op.drop_index("ix_review_decisions_decided_by", table_name="review_decisions")
    op.drop_index("ix_review_decisions_scope_file", table_name="review_decisions")
    op.drop_index("ix_review_decisions_scope", table_name="review_decisions")
    op.drop_index("ix_review_decisions_original_header", table_name="review_decisions")
    op.drop_index("ix_review_decisions_canonical_field", table_name="review_decisions")
    op.drop_table("review_decisions")
