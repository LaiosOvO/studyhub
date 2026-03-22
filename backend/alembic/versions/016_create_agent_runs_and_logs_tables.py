"""016: Create agent_runs and agent_logs tables.

Revision ID: 016
Create Date: 2026-03-20
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("skill_name", sa.String(128), nullable=False),
        sa.Column("task_id", sa.String(36), nullable=True),
        sa.Column("status", sa.String(24), nullable=False, server_default="pending"),
        sa.Column("plan", JSONB, nullable=True),
        sa.Column("input_context", JSONB, nullable=True),
        sa.Column("output_artifact", sa.Text, nullable=True),
        sa.Column("output_format", sa.String(16), nullable=True),
        sa.Column("total_cost", sa.Float, nullable=False, server_default="0"),
        sa.Column("total_steps", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime, nullable=True),
        sa.Column("completed_at", sa.DateTime, nullable=True),
        sa.Column("error", sa.Text, nullable=True),
    )
    op.create_index("ix_agent_runs_user_id", "agent_runs", ["user_id"])
    op.create_index("ix_agent_runs_task_id", "agent_runs", ["task_id"])
    op.create_index("ix_agent_runs_user_status", "agent_runs", ["user_id", "status"])

    op.create_table(
        "agent_logs",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("run_id", sa.String(36), sa.ForeignKey("agent_runs.id"), nullable=False),
        sa.Column("event_type", sa.String(32), nullable=False),
        sa.Column("step_number", sa.Integer, nullable=True),
        sa.Column("data", JSONB, nullable=True),
        sa.Column("message", sa.Text, nullable=True),
        sa.Column("timestamp", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_agent_logs_run_id", "agent_logs", ["run_id"])
    op.create_index("ix_agent_logs_run_ts", "agent_logs", ["run_id", "timestamp"])


def downgrade() -> None:
    op.drop_table("agent_logs")
    op.drop_table("agent_runs")
