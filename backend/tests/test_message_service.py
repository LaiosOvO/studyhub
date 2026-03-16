"""Tests for message service.

Covers send_message validation and Valkey pub/sub integration.
All DB and Valkey operations are mocked.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.community.message_service import (
    send_message,
    mark_conversation_read,
)


# ─── send_message ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_send_message_empty_content():
    """Raises ValueError for empty message content."""
    mock_session = AsyncMock()
    with pytest.raises(ValueError, match="empty"):
        await send_message(mock_session, None, "user-1", "user-2", "")


@pytest.mark.asyncio
async def test_send_message_whitespace_content():
    """Raises ValueError for whitespace-only content."""
    mock_session = AsyncMock()
    with pytest.raises(ValueError, match="empty"):
        await send_message(mock_session, None, "user-1", "user-2", "   ")


@pytest.mark.asyncio
async def test_send_message_self_message():
    """Raises ValueError when sending to yourself."""
    mock_session = AsyncMock()
    with pytest.raises(ValueError, match="yourself"):
        await send_message(mock_session, None, "user-1", "user-1", "hello")


@pytest.mark.asyncio
async def test_send_message_success_no_valkey():
    """Creates message in DB without Valkey."""
    mock_session = AsyncMock()
    mock_message = MagicMock()
    mock_message.id = "msg-001"
    mock_message.sender_id = "user-1"
    mock_message.content = "hello"
    mock_message.created_at = MagicMock()
    mock_message.created_at.isoformat.return_value = "2024-01-01T00:00:00"

    with patch("app.services.community.message_service.Message", return_value=mock_message):
        result = await send_message(mock_session, None, "user-1", "user-2", "hello")

    mock_session.add.assert_called_once()
    mock_session.commit.assert_called_once()
    assert result.content == "hello"


@pytest.mark.asyncio
async def test_send_message_publishes_to_valkey():
    """Publishes message to Valkey channel on success."""
    mock_session = AsyncMock()
    mock_valkey = AsyncMock()
    mock_message = MagicMock()
    mock_message.id = "msg-001"
    mock_message.sender_id = "user-1"
    mock_message.content = "hello"
    mock_message.created_at = MagicMock()
    mock_message.created_at.isoformat.return_value = "2024-01-01T00:00:00"

    with patch("app.services.community.message_service.Message", return_value=mock_message):
        await send_message(mock_session, mock_valkey, "user-1", "user-2", "hello")

    mock_valkey.publish.assert_called_once()
    channel = mock_valkey.publish.call_args[0][0]
    assert "user-2" in channel


@pytest.mark.asyncio
async def test_send_message_valkey_failure_nonfatal():
    """Valkey failure does not prevent message creation."""
    mock_session = AsyncMock()
    mock_valkey = AsyncMock()
    mock_valkey.publish.side_effect = Exception("Valkey down")

    mock_message = MagicMock()
    mock_message.id = "msg-001"
    mock_message.sender_id = "user-1"
    mock_message.content = "hello"
    mock_message.created_at = MagicMock()
    mock_message.created_at.isoformat.return_value = "2024-01-01T00:00:00"

    with patch("app.services.community.message_service.Message", return_value=mock_message):
        result = await send_message(mock_session, mock_valkey, "user-1", "user-2", "hello")

    # Message should still be returned despite Valkey failure
    assert result.content == "hello"


@pytest.mark.asyncio
async def test_send_message_strips_content():
    """Content is stripped of leading/trailing whitespace."""
    mock_session = AsyncMock()
    mock_message = MagicMock()
    mock_message.content = "hello"

    with patch("app.services.community.message_service.Message") as MockMessage:
        MockMessage.return_value = mock_message
        await send_message(mock_session, None, "user-1", "user-2", "  hello  ")

    # Verify the Message was created with stripped content
    call_kwargs = MockMessage.call_args
    assert call_kwargs.kwargs.get("content") == "hello"


# ─── mark_conversation_read ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_mark_conversation_read_returns_count():
    """Returns count of messages marked as read."""
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.rowcount = 5
    mock_session.execute.return_value = mock_result

    count = await mark_conversation_read(mock_session, None, "user-1", "user-2")
    assert count == 5


@pytest.mark.asyncio
async def test_mark_conversation_read_syncs_valkey():
    """Updates Valkey unread counter after marking read."""
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.rowcount = 3
    mock_session.execute.return_value = mock_result

    # Second execute call returns total unread count
    mock_count_result = MagicMock()
    mock_count_result.scalar_one.return_value = 7
    mock_session.execute.side_effect = [mock_result, mock_count_result]

    mock_valkey = AsyncMock()

    count = await mark_conversation_read(mock_session, mock_valkey, "user-1", "user-2")
    assert count == 3
    mock_valkey.set.assert_called_once()
