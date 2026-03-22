"""InviteCode model for beta registration gating."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class InviteCode(Base):
    """Invite code for controlled registration access."""

    __tablename__ = "invite_codes"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    max_uses: Mapped[int] = mapped_column(Integer, default=0)  # 0 = unlimited
    current_uses: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def is_valid(self) -> bool:
        """Check if this code can still be used."""
        if not self.is_active:
            return False
        if self.max_uses > 0 and self.current_uses >= self.max_uses:
            return False
        if self.expires_at and datetime.now(timezone.utc) > self.expires_at:
            return False
        return True

    def __repr__(self) -> str:
        return f"<InviteCode(code={self.code!r}, uses={self.current_uses}/{self.max_uses})>"
