"""create invite_codes table with seed data

Revision ID: 017
Revises: 016
"""

from alembic import op
import sqlalchemy as sa


revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "invite_codes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("code", sa.String(50), unique=True, nullable=False, index=True),
        sa.Column("max_uses", sa.Integer, server_default="0"),
        sa.Column("current_uses", sa.Integer, server_default="0"),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("note", sa.String(500), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )

    # Seed the permanent beta code "6666"
    op.execute(
        sa.text(
            "INSERT INTO invite_codes (id, code, max_uses, current_uses, is_active, note) "
            "VALUES (:id, :code, :max_uses, :current_uses, :is_active, :note)"
        ).bindparams(
            id="00000000-0000-0000-0000-000000006666",
            code="6666",
            max_uses=0,  # unlimited
            current_uses=0,
            is_active=True,
            note="永久内测码",
        )
    )


def downgrade() -> None:
    op.drop_table("invite_codes")
