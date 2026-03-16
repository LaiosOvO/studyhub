"""Message persistence and delivery service.

Handles message creation, conversation queries, and Valkey pub/sub
for real-time delivery to WebSocket clients.
"""

import json
import logging
from datetime import datetime, timezone

from sqlalchemy import and_, case, func, literal, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message
from app.models.user import User

logger = logging.getLogger(__name__)


async def send_message(
    session: AsyncSession,
    valkey,
    sender_id: str,
    recipient_id: str,
    content: str,
) -> Message:
    """Send a message, persist to DB, and publish via Valkey.

    Valkey operations are non-fatal (try/except).
    """
    if not content.strip():
        raise ValueError("Message content cannot be empty")
    if sender_id == recipient_id:
        raise ValueError("Cannot send message to yourself")

    message = Message(
        sender_id=sender_id,
        recipient_id=recipient_id,
        content=content.strip(),
    )
    session.add(message)
    await session.commit()
    await session.refresh(message)

    # Publish to Valkey for real-time delivery
    if valkey is not None:
        try:
            payload = json.dumps({
                "id": message.id,
                "sender_id": message.sender_id,
                "content": message.content,
                "created_at": message.created_at.isoformat(),
            })
            await valkey.publish(f"user:{recipient_id}:messages", payload)
            await valkey.incr(f"unread:{recipient_id}")
        except Exception as exc:
            logger.warning("Valkey publish failed for message %s: %s", message.id, exc)

    return message


async def get_conversation(
    session: AsyncSession,
    user_id: str,
    other_user_id: str,
    skip: int = 0,
    limit: int = 50,
) -> list[Message]:
    """Get messages between two users, ordered by created_at descending."""
    query = (
        select(Message)
        .where(
            or_(
                and_(
                    Message.sender_id == user_id,
                    Message.recipient_id == other_user_id,
                ),
                and_(
                    Message.sender_id == other_user_id,
                    Message.recipient_id == user_id,
                ),
            )
        )
        .order_by(Message.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await session.execute(query)
    return list(result.scalars().all())


async def mark_conversation_read(
    session: AsyncSession,
    valkey,
    user_id: str,
    other_user_id: str,
) -> int:
    """Mark all unread messages in a conversation as read.

    Updates both DB and Valkey unread counter.
    Returns count of messages marked as read.
    """
    stmt = (
        update(Message)
        .where(
            and_(
                Message.recipient_id == user_id,
                Message.sender_id == other_user_id,
                Message.read_at.is_(None),
            )
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    result = await session.execute(stmt)
    await session.commit()
    marked_count = result.rowcount

    # Recalculate total unread and sync Valkey
    if valkey is not None and marked_count > 0:
        try:
            total_result = await session.execute(
                select(func.count())
                .select_from(Message)
                .where(
                    and_(
                        Message.recipient_id == user_id,
                        Message.read_at.is_(None),
                    )
                )
            )
            total_unread = total_result.scalar_one()
            await valkey.set(f"unread:{user_id}", str(total_unread))
        except Exception as exc:
            logger.warning("Valkey unread sync failed: %s", exc)

    return marked_count


async def get_conversations(
    session: AsyncSession, user_id: str
) -> list[dict]:
    """Get list of conversations with latest message and unread count.

    Returns dicts matching ConversationListItem schema.
    """
    # Compute the "other user" for each message
    partner_id = case(
        (Message.sender_id == user_id, Message.recipient_id),
        else_=Message.sender_id,
    )

    # Get all messages involving the user
    messages_query = (
        select(Message)
        .where(
            or_(
                Message.sender_id == user_id,
                Message.recipient_id == user_id,
            )
        )
        .order_by(Message.created_at.desc())
    )
    result = await session.execute(messages_query)
    messages = list(result.scalars().all())

    # Group by conversation partner
    conversations: dict[str, dict] = {}
    for msg in messages:
        other_id = msg.recipient_id if msg.sender_id == user_id else msg.sender_id

        if other_id not in conversations:
            conversations[other_id] = {
                "other_user_id": other_id,
                "last_message": msg.content[:100],
                "last_message_at": msg.created_at,
                "unread_count": 0,
            }

        # Count unread messages sent to us
        if msg.recipient_id == user_id and msg.read_at is None:
            conversations[other_id]["unread_count"] += 1

    # Fetch user names for all partners
    if conversations:
        user_result = await session.execute(
            select(User).where(User.id.in_(conversations.keys()))
        )
        users = {u.id: u.full_name for u in user_result.scalars().all()}

        for partner_id_val, conv in conversations.items():
            conv["other_user_name"] = users.get(partner_id_val, "Unknown")

    # Sort by latest message, return as list
    sorted_convos = sorted(
        conversations.values(),
        key=lambda c: c["last_message_at"],
        reverse=True,
    )
    return sorted_convos
