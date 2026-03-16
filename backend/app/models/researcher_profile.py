"""ResearcherProfile SQLAlchemy model for community collaboration.

Extends the User model with academic profile data including
enriched bibliometric data from OpenAlex.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ResearcherProfile(Base):
    """Researcher profile as a 1:1 extension of User."""

    __tablename__ = "researcher_profiles"

    # ─── Primary Key ───────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # ─── User Link (1:1) ──────────────────────────────────────────────
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), unique=True, nullable=False, index=True
    )

    # ─── Identity ──────────────────────────────────────────────────────
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    institution: Mapped[str | None] = mapped_column(String(300), nullable=True)
    title: Mapped[str | None] = mapped_column(String(100), nullable=True)
    research_directions: Mapped[list] = mapped_column(JSON, default=list)
    expertise_tags: Mapped[list] = mapped_column(JSON, default=list)

    # ─── Enriched Data (from OpenAlex) ─────────────────────────────────
    h_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_citations: Mapped[int | None] = mapped_column(Integer, nullable=True)
    publication_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    publications: Mapped[list] = mapped_column(JSON, default=list)
    co_authors: Mapped[list] = mapped_column(JSON, default=list)
    research_keywords: Mapped[list] = mapped_column(JSON, default=list)
    openalex_author_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ─── Scholar Link (optional match to Phase 3.1 Scholar) ────────────
    scholar_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    # ─── Enrichment Tracking ───────────────────────────────────────────
    enrichment_status: Mapped[str] = mapped_column(String(20), default="pending")
    enriched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ─── Timestamps ────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<ResearcherProfile(id={self.id!r}, user_id={self.user_id!r}, name={self.display_name!r})>"
