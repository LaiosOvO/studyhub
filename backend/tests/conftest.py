"""Shared test fixtures for the backend test suite."""

import pytest


@pytest.fixture
def sample_user_id() -> str:
    """Return a consistent test user ID."""
    return "test-user-001"


@pytest.fixture
def sample_messages() -> list[dict]:
    """Return sample chat messages for LLM tests."""
    return [{"role": "user", "content": "Say hello"}]
