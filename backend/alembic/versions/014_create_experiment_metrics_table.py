"""Create experiment_metrics table for normalized time-series storage.

Revision ID: 014
Revises: 013
Create Date: 2026-03-19

Reference: MLflow metric storage, Aim context namespacing.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "experiment_metrics",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("run_id", sa.String(36), nullable=False),
        sa.Column("key", sa.String(255), nullable=False),
        sa.Column("value", sa.Float, nullable=False),
        sa.Column("step", sa.Integer, nullable=False),
        sa.Column("context", JSONB, server_default="{}"),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("run_id", "key", "step", "context", name="uq_metric_run_key_step_ctx"),
    )
    # Primary query pattern: get all values for a metric key within a run
    op.create_index("ix_metrics_run_key", "experiment_metrics", ["run_id", "key"])
    # Range queries on step within a run+key
    op.create_index("ix_metrics_run_key_step", "experiment_metrics", ["run_id", "key", "step"])


def downgrade() -> None:
    op.drop_index("ix_metrics_run_key_step", table_name="experiment_metrics")
    op.drop_index("ix_metrics_run_key", table_name="experiment_metrics")
    op.drop_table("experiment_metrics")
