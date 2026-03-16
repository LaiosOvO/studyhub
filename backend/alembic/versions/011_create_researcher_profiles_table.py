"""Create researcher_profiles table.

Revision ID: 011
Revises: 010
Create Date: 2026-03-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "researcher_profiles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id"),
            unique=True,
            nullable=False,
        ),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("institution", sa.String(300), nullable=True),
        sa.Column("title", sa.String(100), nullable=True),
        sa.Column("research_directions", JSON, server_default="[]"),
        sa.Column("expertise_tags", JSON, server_default="[]"),
        sa.Column("h_index", sa.Integer, nullable=True),
        sa.Column("total_citations", sa.Integer, nullable=True),
        sa.Column("publication_count", sa.Integer, nullable=True),
        sa.Column("publications", JSON, server_default="[]"),
        sa.Column("co_authors", JSON, server_default="[]"),
        sa.Column("research_keywords", JSON, server_default="[]"),
        sa.Column("openalex_author_id", sa.String(255), nullable=True),
        sa.Column("scholar_id", sa.String(36), nullable=True),
        sa.Column("enrichment_status", sa.String(20), server_default="pending"),
        sa.Column("enriched_at", sa.DateTime(timezone=True), nullable=True),
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
        "ix_researcher_profiles_user_id",
        "researcher_profiles",
        ["user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_researcher_profiles_user_id", table_name="researcher_profiles")
    op.drop_table("researcher_profiles")
