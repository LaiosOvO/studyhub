"""Create deep_research_tasks table for research pipeline tracking.

Revision ID: 006
Revises: 005
Create Date: 2026-03-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "deep_research_tasks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("workflow_id", sa.String(100), nullable=False),
        sa.Column("research_direction", sa.Text, nullable=False),
        sa.Column("entry_type", sa.String(20), nullable=False, server_default="direction"),
        sa.Column("config", JSON, server_default="{}"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("papers_found", sa.Integer, server_default="0"),
        sa.Column("papers_analyzed", sa.Integer, server_default="0"),
        sa.Column("total_cost", sa.Float, server_default="0.0"),
        sa.Column("report_markdown", sa.Text, nullable=True),
        sa.Column("gaps", JSON, nullable=True),
        sa.Column("trends", JSON, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("workflow_id", name="uq_deep_research_workflow_id"),
    )
    op.create_index("ix_deep_research_tasks_user_id", "deep_research_tasks", ["user_id"])
    op.create_index("ix_deep_research_tasks_status", "deep_research_tasks", ["status"])


def downgrade() -> None:
    op.drop_index("ix_deep_research_tasks_status", table_name="deep_research_tasks")
    op.drop_index("ix_deep_research_tasks_user_id", table_name="deep_research_tasks")
    op.drop_table("deep_research_tasks")
