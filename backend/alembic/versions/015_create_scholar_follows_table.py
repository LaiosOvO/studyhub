"""Create scholar_follows table for user-scholar follow relationships.

Revision ID: 015
Revises: 014
Create Date: 2026-03-19
"""

from alembic import op
import sqlalchemy as sa

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scholar_follows",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("scholar_id", sa.String(36), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", "scholar_id", name="uq_scholar_follow"),
    )
    op.create_index("ix_scholar_follows_user_id", "scholar_follows", ["user_id"])
    op.create_index("ix_scholar_follows_scholar_id", "scholar_follows", ["scholar_id"])


def downgrade() -> None:
    op.drop_index("ix_scholar_follows_scholar_id", table_name="scholar_follows")
    op.drop_index("ix_scholar_follows_user_id", table_name="scholar_follows")
    op.drop_table("scholar_follows")
