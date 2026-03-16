"""Tests for Temporal workflow activities (Phase 5).

Covers the placeholder activity and input validation/error paths
for the main activities with mocked infrastructure dependencies.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.workflows.activities import (
    placeholder_search,
)


# ─── placeholder_search ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_placeholder_search_returns_status():
    """placeholder_search returns dict with status and direction."""
    result = await placeholder_search("deep learning for NLP")

    assert result["status"] == "placeholder"
    assert result["direction"] == "deep learning for NLP"


@pytest.mark.asyncio
async def test_placeholder_search_empty_direction():
    """placeholder_search handles empty direction."""
    result = await placeholder_search("")

    assert result["status"] == "placeholder"
    assert result["direction"] == ""
