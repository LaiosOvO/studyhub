"""Create papers table.

Revision ID: 003
Revises: 002
Create Date: 2026-03-15
"""

from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "papers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("doi", sa.String(255), unique=True, nullable=True),
        sa.Column("openalex_id", sa.String(255), nullable=True),
        sa.Column("s2_id", sa.String(255), nullable=True),
        sa.Column("pmid", sa.String(50), nullable=True),
        sa.Column("arxiv_id", sa.String(50), nullable=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("abstract", sa.Text(), nullable=True),
        sa.Column("authors", sa.JSON(), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("venue", sa.String(500), nullable=True),
        sa.Column("language", sa.String(10), nullable=True),
        sa.Column("citation_count", sa.Integer(), default=0),
        sa.Column("pdf_url", sa.Text(), nullable=True),
        sa.Column("is_open_access", sa.Boolean(), default=False),
        sa.Column("parsed_content", sa.JSON(), nullable=True),
        sa.Column("pdf_storage_key", sa.String(500), nullable=True),
        sa.Column("sources", sa.JSON(), nullable=True),
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
    op.create_index("ix_papers_doi", "papers", ["doi"])
    op.create_index("ix_papers_openalex_id", "papers", ["openalex_id"])
    op.create_index("ix_papers_s2_id", "papers", ["s2_id"])
    op.create_index("ix_papers_pmid", "papers", ["pmid"])
    op.create_index("ix_papers_arxiv_id", "papers", ["arxiv_id"])


def downgrade() -> None:
    op.drop_index("ix_papers_arxiv_id", table_name="papers")
    op.drop_index("ix_papers_pmid", table_name="papers")
    op.drop_index("ix_papers_s2_id", table_name="papers")
    op.drop_index("ix_papers_openalex_id", table_name="papers")
    op.drop_index("ix_papers_doi", table_name="papers")
    op.drop_table("papers")
