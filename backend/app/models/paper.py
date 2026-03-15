"""Paper SQLAlchemy model for PostgreSQL persistence.

Stores unified paper metadata from all sources with support
for parsed PDF content and object storage references.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Paper(Base):
    """Academic paper with metadata from multiple sources."""

    __tablename__ = "papers"

    # ─── Primary Key ───────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # ─── Source Identifiers ────────────────────────────────────────────
    doi: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True, index=True
    )
    openalex_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    s2_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    pmid: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )
    arxiv_id: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )

    # ─── Metadata ──────────────────────────────────────────────────────
    title: Mapped[str] = mapped_column(Text, nullable=False)
    abstract: Mapped[str | None] = mapped_column(Text, nullable=True)
    authors: Mapped[list] = mapped_column(JSON, default=list)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    venue: Mapped[str | None] = mapped_column(String(500), nullable=True)
    language: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # ─── Metrics ───────────────────────────────────────────────────────
    citation_count: Mapped[int] = mapped_column(Integer, default=0)
    quality_score: Mapped[float | None] = mapped_column(
        Float, nullable=True, index=True
    )
    pdf_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_open_access: Mapped[bool] = mapped_column(Boolean, default=False)

    # ─── Parsed Content ───────────────────────────────────────────────
    parsed_content: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    pdf_storage_key: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )

    # ─── Provenance ────────────────────────────────────────────────────
    sources: Mapped[list] = mapped_column(JSON, default=list)

    # ─── Timestamps ────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
