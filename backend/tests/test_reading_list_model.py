"""Tests for ReadingList model and schemas (Phase 6).

Covers model field defaults, schema validation, and edge cases.
"""

import pytest
from pydantic import ValidationError

from app.schemas.reading_list import (
    AddPaperRequest,
    ReadingListCreate,
    ReadingListResponse,
    ReadingListUpdate,
)


# ─── ReadingListCreate ─────────────────────────────────────────────────────


def test_create_schema_valid():
    """Valid creation payload is accepted."""
    schema = ReadingListCreate(
        name="My Reading List",
        description="A test list",
        paper_ids=["p1", "p2"],
    )
    assert schema.name == "My Reading List"
    assert schema.paper_ids == ["p1", "p2"]


def test_create_schema_defaults():
    """Description and paper_ids have sensible defaults."""
    schema = ReadingListCreate(name="Minimal List")
    assert schema.description is None
    assert schema.paper_ids == []


def test_create_schema_empty_name_rejected():
    """Empty name is rejected by validation."""
    with pytest.raises(ValidationError):
        ReadingListCreate(name="")


def test_create_schema_long_name_rejected():
    """Name exceeding 200 chars is rejected."""
    with pytest.raises(ValidationError):
        ReadingListCreate(name="x" * 201)


def test_create_schema_max_length_name_accepted():
    """Name at exactly 200 chars is accepted."""
    schema = ReadingListCreate(name="x" * 200)
    assert len(schema.name) == 200


# ─── ReadingListUpdate ─────────────────────────────────────────────────────


def test_update_schema_partial():
    """Partial update only sets specified fields."""
    schema = ReadingListUpdate(name="New Name")
    assert schema.name == "New Name"
    assert schema.description is None
    assert schema.paper_ids is None


def test_update_schema_all_none():
    """All-None update is valid (no changes)."""
    schema = ReadingListUpdate()
    assert schema.name is None
    assert schema.description is None
    assert schema.paper_ids is None


def test_update_schema_empty_name_rejected():
    """Empty name string is rejected in update."""
    with pytest.raises(ValidationError):
        ReadingListUpdate(name="")


# ─── AddPaperRequest ──────────────────────────────────────────────────────


def test_add_paper_request_valid():
    """Valid paper ID is accepted."""
    req = AddPaperRequest(paper_id="paper-abc-123")
    assert req.paper_id == "paper-abc-123"


def test_add_paper_request_empty_rejected():
    """Empty paper_id is rejected."""
    with pytest.raises(ValidationError):
        AddPaperRequest(paper_id="")


# ─── ReadingListResponse ──────────────────────────────────────────────────


def test_response_schema_from_dict():
    """ReadingListResponse can be created from a dict (from_attributes mode)."""
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    data = {
        "id": "rl-001",
        "user_id": "u-001",
        "name": "Test List",
        "description": "Desc",
        "paper_ids": ["p1", "p2"],
        "created_at": now,
        "updated_at": now,
    }
    response = ReadingListResponse(**data)
    assert response.id == "rl-001"
    assert response.paper_ids == ["p1", "p2"]
    assert response.created_at == now
