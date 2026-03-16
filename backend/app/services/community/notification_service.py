"""Valkey-based notification service for unread message counts.

Provides fast unread count lookups via Valkey atomic counters
with DB sync for consistency.
"""

import logging

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message

logger = logging.getLogger(__name__)


async def get_unread_count(valkey, user_id: str) -> int:
    """Get unread message count from Valkey.

    Returns 0 if Valkey unavailable or no count stored.
    """
    if valkey is None:
        return 0

    try:
        count = await valkey.get(f"unread:{user_id}")
        return int(count) if count else 0
    except Exception as exc:
        logger.warning("Valkey unread count read failed: %s", exc)
        return 0


async def mark_all_read(valkey, user_id: str) -> None:
    """Reset unread count to zero in Valkey."""
    if valkey is None:
        return

    try:
        await valkey.set(f"unread:{user_id}", "0")
    except Exception as exc:
        logger.warning("Valkey mark_all_read failed: %s", exc)


async def sync_unread_count(
    session: AsyncSession, valkey, user_id: str
) -> int:
    """Sync Valkey unread counter with DB truth.

    Counts unread messages in DB and updates Valkey to match.
    Returns the count.
    """
    count_result = await session.execute(
        select(func.count())
        .select_from(Message)
        .where(
            and_(
                Message.recipient_id == user_id,
                Message.read_at.is_(None),
            )
        )
    )
    count = count_result.scalar_one()

    if valkey is not None:
        try:
            await valkey.set(f"unread:{user_id}", str(count))
        except Exception as exc:
            logger.warning("Valkey unread sync failed: %s", exc)

    return count
