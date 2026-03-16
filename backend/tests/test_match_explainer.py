"""Tests for LLM-powered match explanation generator.

All LLM calls are mocked.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.community.match_explainer import generate_explanation


def _make_profile(name: str, institution: str, directions: list[str], expertise: list[str]):
    p = MagicMock()
    p.display_name = name
    p.institution = institution
    p.research_directions = directions
    p.expertise_tags = expertise
    return p


def _make_breakdown(comp=0.8, co_cit=0.2, adj=0.5, inst=0.3):
    b = MagicMock()
    b.complementarity = comp
    b.co_citation = co_cit
    b.adjacency = adj
    b.institutional = inst
    return b


@pytest.mark.asyncio
async def test_generate_explanation_success():
    """Returns LLM-generated explanation on success."""
    profile_a = _make_profile("Alice", "MIT", ["NLP"], ["transformers"])
    profile_b = _make_profile("Bob", "Stanford", ["CV"], ["CNNs"])
    breakdown = _make_breakdown()
    mock_session = MagicMock()

    mock_response = MagicMock()
    mock_response.content = "Alice and Bob have complementary expertise."

    with patch(
        "app.services.community.match_explainer.llm_completion",
        new_callable=AsyncMock,
        return_value=mock_response,
    ):
        result = await generate_explanation(
            mock_session, "user-1", profile_a, profile_b, breakdown
        )

    assert result == "Alice and Bob have complementary expertise."


@pytest.mark.asyncio
async def test_generate_explanation_fallback_on_error():
    """Returns generic fallback on LLM failure."""
    profile_a = _make_profile("Alice", "MIT", ["NLP"], ["transformers"])
    profile_b = _make_profile("Bob", "Stanford", ["CV"], ["CNNs"])
    breakdown = _make_breakdown()
    mock_session = MagicMock()

    with patch(
        "app.services.community.match_explainer.llm_completion",
        new_callable=AsyncMock,
        side_effect=Exception("API timeout"),
    ):
        result = await generate_explanation(
            mock_session, "user-1", profile_a, profile_b, breakdown
        )

    assert "complementary" in result.lower()


@pytest.mark.asyncio
async def test_generate_explanation_uses_haiku_model():
    """Uses the Haiku model for cost efficiency."""
    profile_a = _make_profile("Alice", "MIT", ["NLP"], ["transformers"])
    profile_b = _make_profile("Bob", "Stanford", ["CV"], ["CNNs"])
    breakdown = _make_breakdown()
    mock_session = MagicMock()

    mock_response = MagicMock()
    mock_response.content = "Explanation"

    with patch(
        "app.services.community.match_explainer.llm_completion",
        new_callable=AsyncMock,
        return_value=mock_response,
    ) as mock_llm:
        await generate_explanation(
            mock_session, "user-1", profile_a, profile_b, breakdown
        )

    call_kwargs = mock_llm.call_args
    assert call_kwargs.kwargs.get("model") == "claude-haiku-4-20250514"


@pytest.mark.asyncio
async def test_generate_explanation_prompt_contains_profiles():
    """The prompt includes both researcher profiles."""
    profile_a = _make_profile("Alice Zhang", "MIT", ["NLP"], ["transformers"])
    profile_b = _make_profile("Bob Li", "Stanford", ["CV"], ["CNNs"])
    breakdown = _make_breakdown()
    mock_session = MagicMock()

    mock_response = MagicMock()
    mock_response.content = "Explanation"

    with patch(
        "app.services.community.match_explainer.llm_completion",
        new_callable=AsyncMock,
        return_value=mock_response,
    ) as mock_llm:
        await generate_explanation(
            mock_session, "user-1", profile_a, profile_b, breakdown
        )

    call_kwargs = mock_llm.call_args
    messages = call_kwargs.kwargs.get("messages", [])
    prompt_text = messages[0]["content"] if messages else ""
    assert "Alice Zhang" in prompt_text
    assert "Bob Li" in prompt_text
