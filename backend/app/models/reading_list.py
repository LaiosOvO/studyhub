"""ReadingList SQLAlchemy model for user-curated paper collections.

Stores named reading lists with paper IDs as a JSON array,
enabling users to save and organize papers from the paper map.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ReadingList(Base):
    """A named collection of papers curated by a user."""

    __tablename__ = "reading_lists"

    # --- Primary Key ---
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: uuid.uuid4().hex
    )

    # --- Ownership ---
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)

    # --- Content ---
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    paper_ids: Mapped[list] = mapped_column(JSON, default=list)

    # --- Timestamps ---
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
