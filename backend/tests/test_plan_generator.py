"""Tests for the experiment plan generator with reflection (Phase 7).

Covers formatting helpers, JSON parsing, plan generation,
and the AI-Scientist-style reflection loop.
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
from app.services.plan_generation.plan_generator import (
    _format_entry_context,
    _format_gaps_summary,
    _format_improvements_summary,
    _format_sota_summary,
    _parse_plan_json,
    generate_experiment_plans,
)


# ─── _parse_plan_json ──────────────────────────────────────────────────────


def test_parse_plan_json_plain():
    """Parses plain JSON string."""
    result = _parse_plan_json('{"title": "Test Plan"}')
    assert result == {"title": "Test Plan"}


def test_parse_plan_json_with_code_fence():
    """Strips markdown code fences before parsing."""
    text = '```json\n{"title": "Plan"}\n```'
    result = _parse_plan_json(text)
    assert result == {"title": "Plan"}


def test_parse_plan_json_with_surrounding_text():
    """Extracts JSON from text with surrounding content."""
    text = 'Here is the plan: {"title": "Plan"} end of response'
    result = _parse_plan_json(text)
    assert result == {"title": "Plan"}


def test_parse_plan_json_invalid():
    """Returns None for completely invalid input."""
    assert _parse_plan_json("no json here at all") is None


def test_parse_plan_json_empty_string():
    """Returns None for empty string."""
    assert _parse_plan_json("") is None


def test_parse_plan_json_nested_object():
    """Handles nested JSON objects."""
    nested = json.dumps({
        "title": "Plan",
        "baselines": [{"name": "BERT", "metrics": {"f1": 0.9}}],
    })
    result = _parse_plan_json(nested)
    assert result["baselines"][0]["name"] == "BERT"


# ─── Formatting Helpers ───────────────────────────────────────────────────


def test_format_sota_summary_none():
    """Returns fallback for None SOTA."""
    result = _format_sota_summary(None)
    assert result == "No SOTA data available"


def test_format_sota_summary_with_methods():
    """Formats SOTA methods into readable text."""
    sota = SOTAResult(
        sota_methods=[
            SOTAMethod(method="BERT", metric="f1", value="0.92", paper_title="BERT paper", confidence="high"),
        ],
        evaluation_metrics=["f1", "accuracy"],
    )
    result = _format_sota_summary(sota)
    assert "BERT" in result
    assert "f1" in result


def test_format_gaps_summary_empty():
    """Returns fallback for empty gaps list."""
    assert _format_gaps_summary([]) == "No gaps identified"


def test_format_gaps_summary_with_data():
    """Formats gaps with descriptions and impact."""
    gaps = [
        {"description": "Missing multimodal", "potential_impact": "high"},
        {"description": "No low-resource study", "potential_impact": "medium"},
    ]
    result = _format_gaps_summary(gaps)
    assert "Missing multimodal" in result
    assert "high" in result
    assert "No low-resource study" in result


def test_format_improvements_summary_empty():
    """Returns fallback for empty improvements."""
    result = _format_improvements_summary([])
    assert result == "No improvement opportunities identified"


def test_format_improvements_summary_with_data():
    """Formats improvement opportunities."""
    improvements = [
        ImprovementOpportunity(
            gap_description="Gap 1",
            improvement_type="methodological",
            suggested_approach="Add attention",
            estimated_difficulty=3,
        ),
    ]
    result = _format_improvements_summary(improvements)
    assert "methodological" in result
    assert "Add attention" in result
    assert "3" in result


# ─── _format_entry_context ────────────────────────────────────────────────


def test_format_entry_context_focus_paper():
    """Entry context for paper focus includes paper details."""
    context = PlanGenerationContext(
        direction="NLP",
        focus_paper={
            "tldr_en": "A novel method",
            "methods": ["BERT", "attention"],
            "limitations": ["Slow training"],
        },
    )
    result = _format_entry_context(context)
    assert "A novel method" in result
    assert "BERT" in result


def test_format_entry_context_focus_gap():
    """Entry context for gap focus includes gap details."""
    context = PlanGenerationContext(
        direction="NLP",
        focus_gap={
            "description": "No multimodal",
            "evidence": "Only 2 papers",
            "potential_impact": "high",
        },
    )
    result = _format_entry_context(context)
    assert "No multimodal" in result


def test_format_entry_context_direction():
    """Entry context defaults to direction exploration."""
    context = PlanGenerationContext(direction="deep learning for CV")
    result = _format_entry_context(context)
    assert "deep learning for CV" in result


# ─── generate_experiment_plans ─────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.services.plan_generation.plan_generator.llm_completion")
async def test_generate_plans_single_no_reflection(mock_llm):
    """Generates a single plan with no additional reflection rounds."""
    plan_json = json.dumps({
        "title": "Novel Approach",
        "hypothesis": "Our method improves accuracy",
        "method_description": "We propose...",
        "baselines": [{"name": "BERT"}],
        "metrics": ["accuracy"],
        "datasets": [{"name": "GLUE"}],
        "technical_roadmap": [{"step": 1, "description": "Implement model"}],
    })
    mock_llm.return_value = SimpleNamespace(content=plan_json)

    context = PlanGenerationContext(direction="NLP")
    session = AsyncMock()

    results = await generate_experiment_plans(
        context, session, "user-1", num_plans=1, num_reflections=1
    )

    assert len(results) == 1
    assert results[0]["title"] == "Novel Approach"


@pytest.mark.asyncio
@patch("app.services.plan_generation.plan_generator.llm_completion")
async def test_generate_plans_with_reflection(mock_llm):
    """Generates plan with reflection rounds, detecting 'I am done'."""
    initial = json.dumps({"title": "Draft", "hypothesis": "H1"})
    reflected = 'I am done\n' + json.dumps({"title": "Final", "hypothesis": "H1 improved"})

    mock_llm.side_effect = [
        SimpleNamespace(content=initial),  # Initial generation
        SimpleNamespace(content=reflected),  # Reflection with "I am done"
    ]

    context = PlanGenerationContext(direction="NLP")
    session = AsyncMock()

    results = await generate_experiment_plans(
        context, session, "user-1", num_plans=1, num_reflections=3
    )

    assert len(results) == 1
    assert results[0]["title"] == "Final"
    # Should call LLM twice: initial + 1 reflection (stopped at "I am done")
    assert mock_llm.call_count == 2


@pytest.mark.asyncio
@patch("app.services.plan_generation.plan_generator.llm_completion")
async def test_generate_plans_reflection_parse_failure(mock_llm):
    """Keeps previous draft when reflection response is unparseable."""
    initial = json.dumps({"title": "Good Draft"})

    mock_llm.side_effect = [
        SimpleNamespace(content=initial),  # Initial
        SimpleNamespace(content="I think the plan is okay"),  # Unparseable reflection
        SimpleNamespace(content="Still no JSON here"),  # Another unparseable
    ]

    context = PlanGenerationContext(direction="NLP")
    session = AsyncMock()

    results = await generate_experiment_plans(
        context, session, "user-1", num_plans=1, num_reflections=3
    )

    assert len(results) == 1
    assert results[0]["title"] == "Good Draft"


@pytest.mark.asyncio
@patch("app.services.plan_generation.plan_generator.llm_completion")
async def test_generate_plans_initial_failure_skips(mock_llm):
    """Plans that fail to generate are skipped."""
    mock_llm.side_effect = Exception("LLM error")

    context = PlanGenerationContext(direction="NLP")
    session = AsyncMock()

    results = await generate_experiment_plans(
        context, session, "user-1", num_plans=2, num_reflections=1
    )

    assert results == []


@pytest.mark.asyncio
@patch("app.services.plan_generation.plan_generator.llm_completion")
async def test_generate_plans_multiple(mock_llm):
    """Generates multiple plans sequentially."""
    mock_llm.return_value = SimpleNamespace(
        content=json.dumps({"title": "Plan", "hypothesis": "H"})
    )

    context = PlanGenerationContext(direction="NLP")
    session = AsyncMock()

    results = await generate_experiment_plans(
        context, session, "user-1", num_plans=3, num_reflections=1
    )

    assert len(results) == 3
    # 3 plans x 1 LLM call each (no reflection rounds beyond initial)
    assert mock_llm.call_count == 3


@pytest.mark.asyncio
@patch("app.services.plan_generation.plan_generator.llm_completion")
async def test_generate_plans_immutability(mock_llm):
    """Results list is built immutably."""
    mock_llm.return_value = SimpleNamespace(
        content=json.dumps({"title": "Plan"})
    )

    context = PlanGenerationContext(direction="NLP")
    session = AsyncMock()

    results1 = await generate_experiment_plans(
        context, session, "user-1", num_plans=1, num_reflections=1
    )
    results2 = await generate_experiment_plans(
        context, session, "user-1", num_plans=1, num_reflections=1
    )

    assert results1 is not results2
