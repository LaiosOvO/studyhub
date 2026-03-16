"""Create research_needs table.

Revision ID: 012
Revises: 011
Create Date: 2026-03-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "research_needs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("required_skills", JSON, server_default="[]"),
        sa.Column("research_direction", sa.String(255), nullable=True),
        sa.Column("tags", JSON, server_default="[]"),
        sa.Column("status", sa.String(20), server_default="open"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_research_needs_user_id",
        "research_needs",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_research_needs_user_id", table_name="research_needs")
    op.drop_table("research_needs")
