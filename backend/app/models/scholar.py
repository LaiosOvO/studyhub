"""Scholar SQLAlchemy model for PostgreSQL persistence.

Stores researcher profiles harvested from Baidu Baike, Google Scholar,
and other academic sources. Linked to papers via author name matching.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Scholar(Base):
    """Academic scholar/researcher profile with metadata from multiple sources."""

    __tablename__ = "scholars"
    __table_args__ = (
        UniqueConstraint("name", "institution", name="uq_scholar_name_institution"),
    )

    # ─── Primary Key ───────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # ─── Identity ──────────────────────────────────────────────────────
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name_en: Mapped[str | None] = mapped_column(String(200), nullable=True)
    institution: Mapped[str] = mapped_column(String(300), nullable=False)

    # ─── Academic Profile ──────────────────────────────────────────────
    title: Mapped[list] = mapped_column(JSON, default=list)
    rank: Mapped[str | None] = mapped_column(String(50), nullable=True)
    birth_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    research_fields: Mapped[list] = mapped_column(JSON, default=list)
    honors: Mapped[list] = mapped_column(JSON, default=list)
    education: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # ─── Bibliometric Data ─────────────────────────────────────────────
    h_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_citations: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ─── Linked Papers ─────────────────────────────────────────────────
    linked_paper_ids: Mapped[list] = mapped_column(JSON, default=list)

    # ─── Source References ─────────────────────────────────────────────
    source_urls: Mapped[list] = mapped_column(JSON, default=list)
    google_scholar_id: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )

    # ─── Notes ─────────────────────────────────────────────────────────
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ─── Timestamps ────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
