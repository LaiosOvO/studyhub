"""LLM usage tracking model for cost monitoring.

Records token usage and estimated cost for every LLM API call,
enabling per-user and per-model cost reporting.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LLMUsage(Base):
    """Tracks token usage and cost for each LLM API request."""

    __tablename__ = "llm_usage"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
    )
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_tokens: Mapped[int] = mapped_column(nullable=False)
    completion_tokens: Mapped[int] = mapped_column(nullable=False)
    total_cost: Mapped[float] = mapped_column(nullable=False)
    request_type: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_llm_usage_user_id", "user_id"),
        Index("ix_llm_usage_created_at", "created_at"),
    )
