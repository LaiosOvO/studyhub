"""Direct messaging REST and WebSocket endpoints.

Provides message send, conversation listing, read marking,
unread count, and WebSocket real-time delivery via Valkey pub/sub.
"""

import json
import logging

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import get_current_user, get_db, get_valkey
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.message import ConversationListItem, MessageCreate, MessageResponse
from app.services.community.message_service import (
    get_conversation,
    get_conversations,
    mark_conversation_read,
    send_message,
)
from app.services.community.notification_service import get_unread_count

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/", response_model=ApiResponse[MessageResponse], status_code=201)
async def create_message(
    data: MessageCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Send a direct message to another researcher."""
    try:
        valkey = await get_valkey()
    except Exception:
        valkey = None

    try:
        message = await send_message(
            db, valkey, user.id, data.recipient_id, data.content
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return ApiResponse(
        success=True,
        data=MessageResponse.model_validate(message),
        message="Message sent.",
    )


@router.get("/conversations", response_model=ApiResponse[list[ConversationListItem]])
async def list_conversations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """List all conversations for the current user."""
    convos = await get_conversations(db, user.id)
    items = [ConversationListItem(**c) for c in convos]
    return ApiResponse(success=True, data=items)


@router.get(
    "/conversations/{other_user_id}",
    response_model=ApiResponse[list[MessageResponse]],
)
async def get_conversation_messages(
    other_user_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Get messages in a conversation with a specific user."""
    messages = await get_conversation(db, user.id, other_user_id, skip, limit)
    return ApiResponse(
        success=True,
        data=[MessageResponse.model_validate(m) for m in messages],
    )


@router.post(
    "/conversations/{other_user_id}/read",
    response_model=ApiResponse[dict],
)
async def mark_read(
    other_user_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Mark all messages in a conversation as read."""
    try:
        valkey = await get_valkey()
    except Exception:
        valkey = None

    count = await mark_conversation_read(db, valkey, user.id, other_user_id)
    return ApiResponse(success=True, data={"marked_read": count})


@router.get("/unread", response_model=ApiResponse[dict])
async def unread_count(
    user: User = Depends(get_current_user),
) -> ApiResponse:
    """Get unread message count for the current user."""
    try:
        valkey = await get_valkey()
    except Exception:
        valkey = None

    count = await get_unread_count(valkey, user.id)
    return ApiResponse(success=True, data={"unread_count": count})


@router.websocket("/ws")
async def message_websocket(
    websocket: WebSocket,
    token: str = Query(default=""),
) -> None:
    """Real-time message delivery via WebSocket.

    Authenticates via JWT token query parameter.
    Subscribes to Valkey pub/sub channel for the user's messages.
    Falls back to 5s polling if Valkey unavailable.
    """
    if not token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return

    settings = get_settings()
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        if payload.get("type") != "access":
            await websocket.close(code=4001, reason="Invalid token type")
            return
        user_id = payload["sub"]
    except jwt.PyJWTError:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    await websocket.accept()

    try:
        # Try Valkey pub/sub for instant push
        try:
            valkey = await get_valkey()
        except Exception:
            valkey = None

        if valkey is not None:
            await _ws_valkey_loop(websocket, valkey, user_id)
        else:
            await _ws_polling_loop(websocket, user_id)

    except WebSocketDisconnect:
        logger.info("Message WebSocket disconnected for user %s", user_id)
    except Exception as exc:
        logger.error("Message WebSocket error for user %s: %s", user_id, exc)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


async def _ws_valkey_loop(
    websocket: WebSocket, valkey, user_id: str
) -> None:
    """Listen for Valkey pub/sub messages and forward to WebSocket."""
    channel = f"user:{user_id}:messages"
    pubsub = valkey.pubsub()
    try:
        await pubsub.subscribe(channel)
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            data = message["data"]
            if isinstance(data, bytes):
                data = data.decode("utf-8")
            parsed = json.loads(data)
            await websocket.send_json(parsed)
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()


async def _ws_polling_loop(
    websocket: WebSocket, user_id: str
) -> None:
    """Fallback 5s polling when Valkey is unavailable."""
    import asyncio

    last_count = 0
    while True:
        try:
            valkey = await get_valkey()
            count = await get_unread_count(valkey, user_id)
        except Exception:
            count = 0

        if count != last_count:
            await websocket.send_json({"unread_count": count})
            last_count = count

        await asyncio.sleep(5)
