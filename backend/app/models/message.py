"""Message SQLAlchemy model for direct researcher messaging.

Stores direct messages between researchers with read tracking.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Message(Base):
    """Direct message between two researchers."""

    __tablename__ = "messages"
    __table_args__ = (
        Index(
            "ix_messages_conversation",
            "sender_id",
            "recipient_id",
            "created_at",
        ),
    )

    # ─── Primary Key ───────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # ─── Participants ──────────────────────────────────────────────────
    sender_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    recipient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )

    # ─── Content ───────────────────────────────────────────────────────
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # ─── Read Tracking ─────────────────────────────────────────────────
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ─── Timestamps ────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<Message(id={self.id!r}, from={self.sender_id!r}, to={self.recipient_id!r})>"
