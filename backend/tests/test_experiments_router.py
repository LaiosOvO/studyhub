"""Tests for experiments router key functions.

Covers status transition validation. Full endpoint tests require
the ORM models which are integration-tested separately.
"""

import pytest

from fastapi import HTTPException

from app.routers.experiments import (
    VALID_TRANSITIONS,
    _validate_transition,
)


# ─── VALID_TRANSITIONS ─────────────────────────────────────────────────────


def test_valid_transitions_structure():
    """All expected statuses are defined."""
    expected = {"pending", "setting_up", "baseline", "running", "paused", "completed", "failed", "cancelled"}
    assert set(VALID_TRANSITIONS.keys()) == expected


def test_terminal_states_have_no_transitions():
    """completed, failed, cancelled cannot transition to anything."""
    assert VALID_TRANSITIONS["completed"] == set()
    assert VALID_TRANSITIONS["failed"] == set()
    assert VALID_TRANSITIONS["cancelled"] == set()


def test_pending_can_transition_to_setting_up():
    """pending -> setting_up is valid."""
    assert "setting_up" in VALID_TRANSITIONS["pending"]


def test_running_can_be_paused():
    """running -> paused is valid."""
    assert "paused" in VALID_TRANSITIONS["running"]


def test_running_can_complete():
    """running -> completed is valid."""
    assert "completed" in VALID_TRANSITIONS["running"]


def test_paused_can_resume():
    """paused -> running is valid."""
    assert "running" in VALID_TRANSITIONS["paused"]


# ─── _validate_transition ──────────────────────────────────────────────────


def test_validate_transition_valid():
    """Valid transition does not raise."""
    _validate_transition("pending", "setting_up")  # Should not raise


def test_validate_transition_invalid():
    """Invalid transition raises HTTPException with 409."""
    with pytest.raises(HTTPException) as exc_info:
        _validate_transition("completed", "running")
    assert exc_info.value.status_code == 409


def test_validate_transition_same_status():
    """Transitioning to same terminal status raises."""
    with pytest.raises(HTTPException):
        _validate_transition("completed", "completed")


def test_validate_transition_skip_states():
    """Cannot skip from pending directly to running."""
    with pytest.raises(HTTPException):
        _validate_transition("pending", "running")


def test_validate_transition_cancelled_from_running():
    """running -> cancelled is valid."""
    _validate_transition("running", "cancelled")  # Should not raise


def test_validate_transition_cancelled_from_paused():
    """paused -> cancelled is valid."""
    _validate_transition("paused", "cancelled")  # Should not raise
