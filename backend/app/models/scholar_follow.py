"""ScholarFollow model for user-scholar follow relationships."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ScholarFollow(Base):
    """A user following a scholar."""

    __tablename__ = "scholar_follows"
    __table_args__ = (
        UniqueConstraint("user_id", "scholar_id", name="uq_scholar_follow"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: uuid.uuid4().hex
    )
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    scholar_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
