"""Tests for notification service (Valkey-based unread counters).

All Valkey operations are mocked.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.community.notification_service import (
    get_unread_count,
    mark_all_read,
    sync_unread_count,
)


# ─── get_unread_count ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_unread_count_with_value():
    """Returns integer count from Valkey."""
    mock_valkey = AsyncMock()
    mock_valkey.get.return_value = b"5"
    count = await get_unread_count(mock_valkey, "user-1")
    assert count == 5


@pytest.mark.asyncio
async def test_get_unread_count_no_value():
    """Returns 0 when no count stored in Valkey."""
    mock_valkey = AsyncMock()
    mock_valkey.get.return_value = None
    count = await get_unread_count(mock_valkey, "user-1")
    assert count == 0


@pytest.mark.asyncio
async def test_get_unread_count_no_valkey():
    """Returns 0 when Valkey client is None."""
    count = await get_unread_count(None, "user-1")
    assert count == 0


@pytest.mark.asyncio
async def test_get_unread_count_valkey_error():
    """Returns 0 on Valkey exception."""
    mock_valkey = AsyncMock()
    mock_valkey.get.side_effect = Exception("Connection refused")
    count = await get_unread_count(mock_valkey, "user-1")
    assert count == 0


# ─── mark_all_read ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_mark_all_read_sets_zero():
    """Sets unread count to 0 in Valkey."""
    mock_valkey = AsyncMock()
    await mark_all_read(mock_valkey, "user-1")
    mock_valkey.set.assert_called_once_with("unread:user-1", "0")


@pytest.mark.asyncio
async def test_mark_all_read_no_valkey():
    """Does nothing when Valkey is None."""
    await mark_all_read(None, "user-1")  # Should not raise


@pytest.mark.asyncio
async def test_mark_all_read_valkey_error():
    """Swallows Valkey errors gracefully."""
    mock_valkey = AsyncMock()
    mock_valkey.set.side_effect = Exception("Connection refused")
    await mark_all_read(mock_valkey, "user-1")  # Should not raise


# ─── sync_unread_count ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_sync_unread_count_updates_valkey():
    """Syncs DB count to Valkey."""
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one.return_value = 12
    mock_session.execute.return_value = mock_result

    mock_valkey = AsyncMock()

    count = await sync_unread_count(mock_session, mock_valkey, "user-1")
    assert count == 12
    mock_valkey.set.assert_called_once_with("unread:user-1", "12")


@pytest.mark.asyncio
async def test_sync_unread_count_no_valkey():
    """Returns DB count even without Valkey."""
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one.return_value = 3
    mock_session.execute.return_value = mock_result

    count = await sync_unread_count(mock_session, None, "user-1")
    assert count == 3


@pytest.mark.asyncio
async def test_sync_unread_count_valkey_error():
    """Returns DB count even when Valkey write fails."""
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one.return_value = 7
    mock_session.execute.return_value = mock_result

    mock_valkey = AsyncMock()
    mock_valkey.set.side_effect = Exception("Valkey error")

    count = await sync_unread_count(mock_session, mock_valkey, "user-1")
    assert count == 7


@pytest.mark.asyncio
async def test_sync_unread_count_zero():
    """Correctly syncs zero unread count."""
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one.return_value = 0
    mock_session.execute.return_value = mock_result

    mock_valkey = AsyncMock()

    count = await sync_unread_count(mock_session, mock_valkey, "user-1")
    assert count == 0
    mock_valkey.set.assert_called_once_with("unread:user-1", "0")
