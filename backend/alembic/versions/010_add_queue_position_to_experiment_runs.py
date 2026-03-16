"""Add queue_position column to experiment_runs table.

Revision ID: 010
Revises: 009
Create Date: 2026-03-16
"""

from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "experiment_runs",
        sa.Column("queue_position", sa.Float, server_default="0.0"),
    )
    op.create_index(
        "ix_experiment_runs_queue_position",
        "experiment_runs",
        ["queue_position"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_experiment_runs_queue_position", table_name="experiment_runs"
    )
    op.drop_column("experiment_runs", "queue_position")
