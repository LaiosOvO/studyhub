"""Create experiment_plans table for plan generation pipeline.

Revision ID: 007
Revises: 006
Create Date: 2026-03-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "experiment_plans",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("task_id", sa.String(36), nullable=False),
        sa.Column(
            "entry_type", sa.String(20), nullable=False, server_default="direction"
        ),
        sa.Column("source_paper_id", sa.String(36), nullable=True),
        sa.Column("source_gap_index", sa.Integer, nullable=True),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("hypothesis", sa.Text, nullable=False),
        sa.Column("method_description", sa.Text, nullable=False),
        sa.Column("baselines", JSON, server_default="[]"),
        sa.Column("metrics", JSON, server_default="[]"),
        sa.Column("datasets", JSON, server_default="[]"),
        sa.Column("technical_roadmap", JSON, server_default="[]"),
        sa.Column("code_skeleton", sa.Text, nullable=True),
        sa.Column("feasibility", JSON, nullable=True),
        sa.Column(
            "data_strategy",
            sa.String(20),
            nullable=False,
            server_default="open_source",
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_experiment_plans_user_id", "experiment_plans", ["user_id"])
    op.create_index("ix_experiment_plans_task_id", "experiment_plans", ["task_id"])


def downgrade() -> None:
    op.drop_index("ix_experiment_plans_task_id", table_name="experiment_plans")
    op.drop_index("ix_experiment_plans_user_id", table_name="experiment_plans")
    op.drop_table("experiment_plans")
