"""DeepResearchTask SQLAlchemy model for PostgreSQL persistence.

Stores deep research task metadata including workflow tracking,
configuration, analysis results (gaps/trends), and the final
literature review report.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DeepResearchTask(Base):
    """A user-initiated deep research task tracked via Temporal workflow."""

    __tablename__ = "deep_research_tasks"

    # ─── Primary Key ───────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: uuid.uuid4().hex
    )

    # ─── Ownership ─────────────────────────────────────────────────────
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    workflow_id: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False
    )

    # ─── Research Parameters ───────────────────────────────────────────
    research_direction: Mapped[str] = mapped_column(Text, nullable=False)
    entry_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="direction"
    )
    config: Mapped[dict] = mapped_column(JSON, default=dict)

    # ─── Status & Progress ─────────────────────────────────────────────
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )
    papers_found: Mapped[int] = mapped_column(Integer, default=0)
    papers_analyzed: Mapped[int] = mapped_column(Integer, default=0)
    total_cost: Mapped[float] = mapped_column(Float, default=0.0)

    # ─── Results ───────────────────────────────────────────────────────
    report_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    gaps: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    trends: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # ─── Timestamps ────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
