"""semantic field observations

Revision ID: a1c5e8b23f70
Revises: e1b2c3d4e5f6
Create Date: 2026-09-12

Three of the 23 canonical fields hold a value that is unambiguous and a meaning
that is not:

    Date   a date, but transaction / registration / handover / lease?
    Size   a number, but square feet or square metres?  (a 10.76x error)
    AREA   a place, but Community or Sub-Community?     (685 occurrences, the
           largest ambiguous label in the corpus)

The flat columns cannot carry that distinction. `records.record_date` is one
timestamp; asked which kind of date it holds, the row has no answer, and the
four source semantics were collapsed into one on write with no way back. The
same collapse is why a sq.m column read as sq.ft is unrecoverable after import.

field_observations records the value AND the reading, with the evidence behind
the reading and a confidence that is allowed to be low. The table is
append-only: a better reading is a new row, never an update, so what we
previously believed and why stays on the record.

`records` is deliberately left completely unchanged. Its flat columns remain the
canonical external contract -- the 23-field API, exports and search all keep
working exactly as before, and record_date is still written exactly as before.
This table sits alongside them rather than replacing them, so nothing that reads
the old shape has to change and the migration is additive in the strict sense.

Existing rows get no observations. They were produced by a pipeline that never
recorded a semantic reading, and back-filling one would be inventing evidence
that was never gathered -- the exact failure this table exists to prevent. They
are re-derivable from their stored source files by the normal reprocess path,
which is also what stamps engine_version on the observations it writes.

Creating a new table takes no lock on anything already in use, so this is safe
to run online.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1c5e8b23f70'
down_revision: Union[str, Sequence[str], None] = 'e1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "field_observations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("record_id", sa.Integer(), nullable=False),

        # Canonical field NAME ("Date", "Size"), not the database column: the
        # vocabulary in engine/resources/semantic_types.json is keyed by it, and
        # raw labels such as AREA that are not canonical fields live here too.
        sa.Column("canonical_field", sa.String(64), nullable=False),
        # 'unresolved' rather than NULL, because NULL cannot be told apart from
        # "this field has no semantic dimension", and the review queue's whole
        # job is finding the rows where we knew that we did not know.
        sa.Column("semantic_type", sa.String(48), nullable=False,
                  server_default="unresolved"),

        # The source string exactly as it arrived. Never normalised in place;
        # this is what makes a failed parse diagnosable instead of lost.
        sa.Column("raw_value", sa.Text(), nullable=True),
        sa.Column("parsed_value", sa.Text(), nullable=True),
        # Typed forms, populated only for the kind of field they suit, so dates
        # sort and sizes compare without re-parsing text on every query.
        sa.Column("parsed_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("parsed_number", sa.Float(), nullable=True),

        # Provenance is denormalised from records rather than joined: an
        # observation must stay interpretable after a reprocess replaces the
        # record it came from, and source_column does not exist on records.
        sa.Column("original_header", sa.String(512), nullable=True),
        sa.Column("source_file", sa.String(512), nullable=True),
        sa.Column("source_sheet", sa.String(255), nullable=True),
        sa.Column("source_row", sa.Integer(), nullable=True),
        sa.Column("source_column", sa.Integer(), nullable=True),
        sa.Column("job_id", sa.Integer(), nullable=True),

        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        # Which signals fired, so a wrong reading can be corrected at the rule
        # rather than argued about at the row.
        sa.Column("evidence", sa.JSON(), nullable=True),
        sa.Column("needs_review", sa.Boolean(), nullable=False,
                  server_default=sa.false()),

        # Same contract as records.engine_version: a rule change bumps
        # engine.ENGINE_VERSION and every row below it is stale and
        # re-derivable. See engine/__init__.py.
        sa.Column("engine_version", sa.Integer(), nullable=True),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),

        # CASCADE matches records' own behaviour: deleting a job deletes its
        # rows, and observations must not outlive the row they describe.
        sa.ForeignKeyConstraint(["record_id"], ["records.id"], ondelete="CASCADE"),
        # SET NULL, not CASCADE: an observation stays meaningful after its job
        # record is pruned, because its provenance is denormalised above.
        sa.ForeignKeyConstraint(["job_id"], ["processing_jobs.id"], ondelete="SET NULL"),
    )

    op.create_index("ix_field_observations_record_id", "field_observations", ["record_id"])
    op.create_index("ix_field_observations_canonical_field", "field_observations", ["canonical_field"])
    op.create_index("ix_field_observations_semantic_type", "field_observations", ["semantic_type"])
    op.create_index("ix_field_observations_source_file", "field_observations", ["source_file"])
    op.create_index("ix_field_observations_job_id", "field_observations", ["job_id"])
    op.create_index("ix_field_observations_engine_version", "field_observations", ["engine_version"])
    op.create_index("ix_field_observations_needs_review", "field_observations", ["needs_review"])

    # The three questions actually asked of this table: every observation for
    # one record (the inspector panel), what a field was read as across the
    # corpus (the per-file AREA decision), and what is waiting on a human.
    op.create_index("ix_fieldobs_record_field", "field_observations",
                    ["record_id", "canonical_field"])
    op.create_index("ix_fieldobs_field_type", "field_observations",
                    ["canonical_field", "semantic_type"])
    op.create_index("ix_fieldobs_review", "field_observations",
                    ["needs_review", "canonical_field"])


def downgrade() -> None:
    # Dropping the table discards every semantic reading and its evidence. The
    # readings are re-derivable from the stored source files by reprocessing,
    # so this loses no source data -- but it does lose any human review
    # decisions recorded against these rows.
    op.drop_index("ix_fieldobs_review", table_name="field_observations")
    op.drop_index("ix_fieldobs_field_type", table_name="field_observations")
    op.drop_index("ix_fieldobs_record_field", table_name="field_observations")
    op.drop_index("ix_field_observations_needs_review", table_name="field_observations")
    op.drop_index("ix_field_observations_engine_version", table_name="field_observations")
    op.drop_index("ix_field_observations_job_id", table_name="field_observations")
    op.drop_index("ix_field_observations_source_file", table_name="field_observations")
    op.drop_index("ix_field_observations_semantic_type", table_name="field_observations")
    op.drop_index("ix_field_observations_canonical_field", table_name="field_observations")
    op.drop_index("ix_field_observations_record_id", table_name="field_observations")
    op.drop_table("field_observations")
