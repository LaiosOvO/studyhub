"""Tests for feasibility scoring service (Phase 7).

Covers the weighted overall formula, plan summary formatting,
single scoring, batch scoring, and error handling.
"""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.schemas.plan import FeasibilityScore
from app.services.plan_generation.feasibility_scorer import (
    _compute_overall,
    _format_plan_summary,
    score_feasibility,
    score_plans_batch,
)


# ─── _compute_overall ─────────────────────────────────────────────────────


def test_compute_overall_balanced():
    """Balanced scores (all 3s) produce 3.0 overall."""
    result = _compute_overall(3, 3, 3, 3)
    assert result == 3.0


def test_compute_overall_best_case():
    """Best feasibility: low compute, high data, high improvement, low difficulty."""
    result = _compute_overall(1, 5, 5, 1)
    # (6-1 + 5 + 5 + 6-1) / 4 = (5 + 5 + 5 + 5) / 4 = 5.0
    assert result == 5.0


def test_compute_overall_worst_case():
    """Worst feasibility: high compute, low data, low improvement, high difficulty."""
    result = _compute_overall(5, 1, 1, 5)
    # (6-5 + 1 + 1 + 6-5) / 4 = (1 + 1 + 1 + 1) / 4 = 1.0
    assert result == 1.0


def test_compute_overall_asymmetric():
    """Asymmetric scores produce correct weighted average."""
    result = _compute_overall(2, 4, 3, 1)
    # (6-2 + 4 + 3 + 6-1) / 4 = (4 + 4 + 3 + 5) / 4 = 4.0
    assert result == 4.0


# ─── _format_plan_summary ─────────────────────────────────────────────────


def test_format_plan_summary_full():
    """Full plan dict produces readable summary."""
    plan = {
        "title": "Novel Transformer",
        "hypothesis": "Attention improves accuracy",
        "method_description": "We propose a new attention mechanism",
        "baselines": [{"name": "BERT"}, {"name": "GPT-2"}],
        "metrics": ["accuracy", "f1", "bleu"],
        "datasets": [{"name": "GLUE"}, {"name": "SQuAD"}],
        "technical_roadmap": [{"step": 1}, {"step": 2}, {"step": 3}],
    }

    result = _format_plan_summary(plan)

    assert "Novel Transformer" in result
    assert "Attention improves accuracy" in result
    assert "BERT" in result
    assert "accuracy" in result
    assert "GLUE" in result
    assert "3" in result  # roadmap steps count


def test_format_plan_summary_minimal():
    """Minimal plan dict still produces valid output."""
    plan = {"title": "Minimal"}
    result = _format_plan_summary(plan)
    assert "Minimal" in result


def test_format_plan_summary_truncates_method():
    """Method description is truncated to 500 chars."""
    plan = {"method_description": "x" * 1000}
    result = _format_plan_summary(plan)
    # The full 1000-char method should not be present
    assert "x" * 501 not in result


# ─── score_feasibility ────────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.services.plan_generation.feasibility_scorer.llm_completion")
async def test_score_feasibility_success(mock_llm):
    """score_feasibility returns correct FeasibilityScore from LLM response."""
    mock_llm.return_value = SimpleNamespace(content=json.dumps({
        "compute_requirements": 2,
        "data_availability": 4,
        "expected_improvement": 3,
        "difficulty": 2,
        "explanation": "Moderate compute, good data availability",
    }))

    plan = {"title": "Test Plan", "hypothesis": "H1"}
    session = AsyncMock()

    result = await score_feasibility(plan, "NLP", session, "user-1")

    assert isinstance(result, FeasibilityScore)
    assert result.compute_requirements == 2
    assert result.data_availability == 4
    assert result.expected_improvement == 3
    assert result.difficulty == 2
    assert result.overall == _compute_overall(2, 4, 3, 2)
    assert "Moderate" in result.explanation


@pytest.mark.asyncio
@patch("app.services.plan_generation.feasibility_scorer.llm_completion")
async def test_score_feasibility_clamps_values(mock_llm):
    """Values outside 1-5 range are clamped."""
    mock_llm.return_value = SimpleNamespace(content=json.dumps({
        "compute_requirements": 0,
        "data_availability": 7,
        "expected_improvement": -1,
        "difficulty": 10,
        "explanation": "Extreme values",
    }))

    plan = {"title": "Test"}
    session = AsyncMock()

    result = await score_feasibility(plan, "test", session, "user-1")

    assert result.compute_requirements == 1
    assert result.data_availability == 5
    assert result.expected_improvement == 1
    assert result.difficulty == 5


@pytest.mark.asyncio
@patch("app.services.plan_generation.feasibility_scorer.llm_completion")
async def test_score_feasibility_json_error(mock_llm):
    """Returns default score on JSON parse failure."""
    mock_llm.return_value = SimpleNamespace(content="not json")

    plan = {"title": "Test"}
    session = AsyncMock()

    result = await score_feasibility(plan, "test", session, "user-1")

    assert result.compute_requirements == 3
    assert result.data_availability == 3
    assert result.overall == 3.0
    assert result.explanation == "Scoring unavailable"


@pytest.mark.asyncio
@patch("app.services.plan_generation.feasibility_scorer.llm_completion")
async def test_score_feasibility_llm_error(mock_llm):
    """Returns default score on LLM error."""
    mock_llm.side_effect = Exception("timeout")

    plan = {"title": "Test"}
    session = AsyncMock()

    result = await score_feasibility(plan, "test", session, "user-1")

    assert result.compute_requirements == 3
    assert result.explanation == "Scoring unavailable"


def test_feasibility_score_is_feasible():
    """is_feasible property returns True when overall >= 2.5."""
    feasible = FeasibilityScore(
        compute_requirements=2, data_availability=4,
        expected_improvement=3, difficulty=2,
        overall=3.5, explanation="Good"
    )
    assert feasible.is_feasible is True

    not_feasible = FeasibilityScore(
        compute_requirements=5, data_availability=1,
        expected_improvement=1, difficulty=5,
        overall=1.0, explanation="Bad"
    )
    assert not_feasible.is_feasible is False


# ─── score_plans_batch ────────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.services.plan_generation.feasibility_scorer.score_feasibility")
async def test_score_plans_batch(mock_score):
    """Batch scoring calls score_feasibility for each plan."""
    mock_score.return_value = FeasibilityScore(
        compute_requirements=2, data_availability=3,
        expected_improvement=3, difficulty=2,
        overall=3.5, explanation="OK"
    )

    plans = [{"title": f"Plan {i}"} for i in range(3)]
    session = AsyncMock()

    results = await score_plans_batch(plans, "NLP", session, "user-1")

    assert len(results) == 3
    assert mock_score.call_count == 3


@pytest.mark.asyncio
@patch("app.services.plan_generation.feasibility_scorer.score_feasibility")
async def test_score_plans_batch_empty(mock_score):
    """Empty plan list returns empty results."""
    session = AsyncMock()

    results = await score_plans_batch([], "NLP", session, "user-1")

    assert results == []
    mock_score.assert_not_called()
