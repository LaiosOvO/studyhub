"""Add quality_score column to papers table.

Revision ID: 004
Revises: 003
Create Date: 2026-03-15
"""

from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("papers", sa.Column("quality_score", sa.Float, nullable=True))
    op.create_index("ix_papers_quality_score", "papers", ["quality_score"])


def downgrade() -> None:
    op.drop_index("ix_papers_quality_score", table_name="papers")
    op.drop_column("papers", "quality_score")
