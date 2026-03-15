"""Create scholars table for researcher profiles.

Revision ID: 005
Revises: 004
Create Date: 2026-03-15
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scholars",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("name_en", sa.String(200), nullable=True),
        sa.Column("institution", sa.String(300), nullable=False),
        sa.Column("title", JSON, server_default="[]"),
        sa.Column("rank", sa.String(50), nullable=True),
        sa.Column("birth_year", sa.Integer, nullable=True),
        sa.Column("research_fields", JSON, server_default="[]"),
        sa.Column("honors", JSON, server_default="[]"),
        sa.Column("education", JSON, nullable=True),
        sa.Column("h_index", sa.Integer, nullable=True),
        sa.Column("total_citations", sa.Integer, nullable=True),
        sa.Column("linked_paper_ids", JSON, server_default="[]"),
        sa.Column("source_urls", JSON, server_default="[]"),
        sa.Column("google_scholar_id", sa.String(50), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
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
        sa.UniqueConstraint("name", "institution", name="uq_scholar_name_institution"),
    )
    op.create_index("ix_scholars_name", "scholars", ["name"])
    op.create_index("ix_scholars_google_scholar_id", "scholars", ["google_scholar_id"])


def downgrade() -> None:
    op.drop_index("ix_scholars_google_scholar_id", table_name="scholars")
    op.drop_index("ix_scholars_name", table_name="scholars")
    op.drop_table("scholars")
