"""Tests for improvement analyzer (Phase 7).

Covers pure context-building functions, LLM-powered improvement analysis,
and three entry points for plan generation context assembly.
"""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.schemas.plan import (
    ImprovementOpportunity,
    PlanGenerationContext,
    SOTAMethod,
    SOTAResult,
)
from app.services.deep_research.gap_detector import GapResult
from app.services.plan_generation.improvement_analyzer import (
    _build_entry_context,
    _format_gaps_summary,
    _format_sota_summary,
    analyze_improvements,
    create_plan_context,
    get_top_papers,
)


def _make_task(**overrides):
    """Create a mock DeepResearchTask."""
    defaults = {
        "config": {
            "paper_analyses": {
                "p1": {
                    "tldr_en": "A novel approach",
                    "methods": ["CNN"],
                    "key_metrics": {"accuracy": "92%"},
                    "paper_type": "empirical",
                    "key_contributions": ["Better accuracy"],
                    "limitations": ["Slow training"],
                },
            },
        },
        "research_direction": "deep learning for NLP",
        "user_id": "user-1",
        "gaps": {
            "gaps": [
                {"description": "No multimodal work", "evidence": "Only 2 papers", "potential_impact": "high"},
            ],
            "underexplored": [],
            "missing_evaluations": [],
        },
        "trends": {"ascending_methods": [], "declining_methods": []},
    }
    merged = {**defaults, **overrides}
    return SimpleNamespace(**merged)


# ─── get_top_papers ────────────────────────────────────────────────────────


def test_get_top_papers_basic():
    """Extracts top papers sorted by metric richness."""
    task = _make_task(config={
        "paper_analyses": {
            "p1": {"tldr_en": "P1", "methods": ["A"], "key_metrics": {"acc": "90"}, "paper_type": "empirical"},
            "p2": {"tldr_en": "P2", "methods": ["B"], "key_metrics": {"acc": "91", "f1": "0.88"}, "paper_type": "survey"},
        },
    })

    result = get_top_papers(task, limit=2)

    assert len(result) == 2
    # p2 has more metrics, should be first
    assert result[0]["paper_id"] == "p2"


def test_get_top_papers_empty_config():
    """Returns empty list when no paper analyses exist."""
    task = _make_task(config={})
    result = get_top_papers(task)
    assert result == []


def test_get_top_papers_none_config():
    """Handles None config gracefully."""
    task = _make_task(config=None)
    result = get_top_papers(task)
    assert result == []


def test_get_top_papers_limit():
    """Respects the limit parameter."""
    task = _make_task(config={
        "paper_analyses": {
            f"p{i}": {"tldr_en": f"P{i}", "methods": [], "key_metrics": {}, "paper_type": "unknown"}
            for i in range(20)
        },
    })

    result = get_top_papers(task, limit=5)
    assert len(result) == 5


# ─── _format_sota_summary ─────────────────────────────────────────────────


def test_format_sota_summary_with_data():
    """Formats SOTA methods and metrics into readable text."""
    sota = SOTAResult(
        sota_methods=[
            SOTAMethod(method="GPT-4", metric="accuracy", value="97%", paper_title="GPT paper", confidence="high"),
        ],
        evaluation_metrics=["accuracy", "f1"],
        benchmark_datasets=[{"name": "GLUE"}],
    )

    result = _format_sota_summary(sota)

    assert "GPT-4" in result
    assert "accuracy" in result
    assert "GLUE" in result


def test_format_sota_summary_empty():
    """Returns fallback for empty SOTAResult."""
    sota = SOTAResult()
    result = _format_sota_summary(sota)
    assert result == "No SOTA data available"


# ─── _format_gaps_summary ─────────────────────────────────────────────────


def test_format_gaps_summary_with_data():
    """Formats gaps and underexplored items."""
    gaps_data = {
        "gaps": [{"description": "Missing multimodal", "potential_impact": "high"}],
        "underexplored": [{"combination": "CNN + GNN"}],
    }

    result = _format_gaps_summary(gaps_data)

    assert "Missing multimodal" in result
    assert "CNN + GNN" in result


def test_format_gaps_summary_none():
    """Returns fallback for None gaps."""
    assert _format_gaps_summary(None) == "No gaps identified"


def test_format_gaps_summary_empty_gaps():
    """Returns fallback when gaps list is empty."""
    assert _format_gaps_summary({"gaps": []}) == "No gaps identified"


# ─── _build_entry_context ─────────────────────────────────────────────────


def test_build_entry_context_paper():
    """Paper entry context includes focus paper details."""
    task = _make_task()
    focus_paper = {
        "tldr_en": "Novel CNN approach",
        "methods": ["CNN", "attention"],
        "limitations": ["Slow"],
    }

    result = _build_entry_context("paper", task, focus_paper=focus_paper)

    assert "Novel CNN approach" in result
    assert "CNN" in result
    assert "Slow" in result


def test_build_entry_context_gap():
    """Gap entry context includes gap details."""
    task = _make_task()
    focus_gap = {
        "description": "No multimodal work",
        "evidence": "Only 2 papers",
        "potential_impact": "high",
    }

    result = _build_entry_context("gap", task, focus_gap=focus_gap)

    assert "No multimodal work" in result
    assert "high" in result


def test_build_entry_context_direction():
    """Direction entry context uses research direction."""
    task = _make_task()
    result = _build_entry_context("direction", task)
    assert "deep learning for NLP" in result


# ─── analyze_improvements ─────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.services.plan_generation.improvement_analyzer.llm_completion")
async def test_analyze_improvements_success(mock_llm):
    """Returns list of ImprovementOpportunity from LLM response."""
    mock_llm.return_value = SimpleNamespace(content=json.dumps([
        {
            "gap_description": "No multimodal work",
            "improvement_type": "methodological",
            "suggested_approach": "Add vision encoder",
            "estimated_difficulty": 3,
            "related_gap_index": 0,
        },
    ]))

    sota = SOTAResult()
    gaps = GapResult()
    session = AsyncMock()

    result = await analyze_improvements(sota, gaps, "NLP", session, "user-1")

    assert len(result) == 1
    assert isinstance(result[0], ImprovementOpportunity)
    assert result[0].improvement_type == "methodological"


@pytest.mark.asyncio
@patch("app.services.plan_generation.improvement_analyzer.llm_completion")
async def test_analyze_improvements_object_response(mock_llm):
    """Handles LLM response as object with 'improvements' key."""
    mock_llm.return_value = SimpleNamespace(content=json.dumps({
        "improvements": [
            {
                "gap_description": "Gap 1",
                "improvement_type": "data_augmentation",
                "suggested_approach": "Use synthetic data",
                "estimated_difficulty": 2,
            },
        ],
    }))

    sota = SOTAResult()
    gaps = GapResult()
    session = AsyncMock()

    result = await analyze_improvements(sota, gaps, "NLP", session, "user-1")

    assert len(result) == 1


@pytest.mark.asyncio
@patch("app.services.plan_generation.improvement_analyzer.llm_completion")
async def test_analyze_improvements_failure(mock_llm):
    """Returns empty list on LLM failure."""
    mock_llm.side_effect = Exception("down")

    sota = SOTAResult()
    gaps = GapResult()
    session = AsyncMock()

    result = await analyze_improvements(sota, gaps, "NLP", session, "user-1")

    assert result == []


# ─── create_plan_context ───────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.services.plan_generation.improvement_analyzer.analyze_improvements")
@patch("app.services.plan_generation.improvement_analyzer.identify_sota")
async def test_create_plan_context_direction(mock_sota, mock_improve):
    """Direction entry creates broad context with SOTA and gaps."""
    mock_sota.return_value = SOTAResult()
    mock_improve.return_value = []

    task = _make_task()
    session = AsyncMock()

    result = await create_plan_context("direction", task, session)

    assert isinstance(result, PlanGenerationContext)
    assert result.direction == "deep learning for NLP"
    assert result.focus_paper is None
    assert result.focus_gap is None


@pytest.mark.asyncio
@patch("app.services.plan_generation.improvement_analyzer.analyze_improvements")
@patch("app.services.plan_generation.improvement_analyzer.identify_sota")
async def test_create_plan_context_paper(mock_sota, mock_improve):
    """Paper entry includes focus paper data."""
    mock_sota.return_value = SOTAResult()
    mock_improve.return_value = []

    task = _make_task()
    session = AsyncMock()

    result = await create_plan_context("paper", task, session, paper_id="p1")

    assert result.focus_paper is not None
    assert result.focus_paper["paper_id"] == "p1"


@pytest.mark.asyncio
@patch("app.services.plan_generation.improvement_analyzer.analyze_improvements")
@patch("app.services.plan_generation.improvement_analyzer.identify_sota")
async def test_create_plan_context_gap(mock_sota, mock_improve):
    """Gap entry includes focus gap data."""
    mock_sota.return_value = SOTAResult()
    mock_improve.return_value = []

    task = _make_task()
    session = AsyncMock()

    result = await create_plan_context("gap", task, session, gap_index=0)

    assert result.focus_gap is not None
    assert result.focus_gap["description"] == "No multimodal work"


@pytest.mark.asyncio
@patch("app.services.plan_generation.improvement_analyzer.analyze_improvements")
@patch("app.services.plan_generation.improvement_analyzer.identify_sota")
async def test_create_plan_context_invalid_gap_index(mock_sota, mock_improve):
    """Out-of-range gap index produces no focus_gap."""
    mock_sota.return_value = SOTAResult()
    mock_improve.return_value = []

    task = _make_task()
    session = AsyncMock()

    result = await create_plan_context("gap", task, session, gap_index=99)

    assert result.focus_gap is None
