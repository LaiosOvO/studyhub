"""Create experiment_runs table for experiment execution tracking.

Revision ID: 009
Revises: 008
Create Date: 2026-03-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "experiment_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("plan_id", sa.String(36), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("workspace_path", sa.Text, nullable=True),
        sa.Column("docker_image", sa.String(255), nullable=True),
        sa.Column("gpu_device", sa.Integer, server_default="0"),
        sa.Column("current_round", sa.Integer, server_default="0"),
        sa.Column("max_rounds", sa.Integer, server_default="20"),
        sa.Column("consecutive_no_improve_limit", sa.Integer, server_default="5"),
        sa.Column("time_budget_minutes", sa.Integer, nullable=True),
        sa.Column("best_metric_name", sa.String(100), nullable=True),
        sa.Column("best_metric_value", sa.Float, nullable=True),
        sa.Column("baseline_metric_value", sa.Float, nullable=True),
        sa.Column("rounds", JSON, server_default="[]"),
        sa.Column("config", JSON, server_default="{}"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_experiment_runs_user_id", "experiment_runs", ["user_id"])
    op.create_index("ix_experiment_runs_plan_id", "experiment_runs", ["plan_id"])


def downgrade() -> None:
    op.drop_index("ix_experiment_runs_plan_id", table_name="experiment_runs")
    op.drop_index("ix_experiment_runs_user_id", table_name="experiment_runs")
    op.drop_table("experiment_runs")
