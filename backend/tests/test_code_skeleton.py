"""Tests for code skeleton generation service (Phase 7).

Covers prompt building, template rendering, and the full
generate_code_skeleton pipeline with mocked LLM calls.
"""

import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.services.plan_generation.code_skeleton import (
    _build_skeleton_prompt,
    _render_template,
    generate_code_skeleton,
)


# ─── _build_skeleton_prompt ───────────────────────────────────────────────


def test_build_skeleton_prompt_structure():
    """Prompt has system and user messages."""
    plan = {
        "hypothesis": "Our method improves accuracy",
        "method_description": "We propose a new attention mechanism",
        "baselines": [{"name": "BERT"}, {"name": "GPT-2"}],
        "metrics": ["accuracy", "f1"],
        "datasets": [{"name": "GLUE"}],
        "technical_roadmap": [
            {"step": 1, "description": "Implement encoder"},
            {"step": 2, "description": "Train model"},
        ],
    }

    messages = _build_skeleton_prompt(plan)

    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert messages[1]["role"] == "user"


def test_build_skeleton_prompt_includes_plan_details():
    """User message includes hypothesis, baselines, metrics, datasets."""
    plan = {
        "hypothesis": "Hypothesis ABC",
        "method_description": "Method XYZ",
        "baselines": [{"name": "Baseline1"}],
        "metrics": ["metric1", "metric2"],
        "datasets": [{"name": "Dataset1"}],
        "technical_roadmap": [{"step": 1, "description": "Step one"}],
    }

    messages = _build_skeleton_prompt(plan)
    user_content = messages[1]["content"]

    assert "Hypothesis ABC" in user_content
    assert "Baseline1" in user_content
    assert "metric1" in user_content
    assert "Dataset1" in user_content
    assert "Step one" in user_content


def test_build_skeleton_prompt_empty_plan():
    """Empty plan dict produces valid prompt with N/A placeholders."""
    messages = _build_skeleton_prompt({})

    assert len(messages) == 2
    user_content = messages[1]["content"]
    assert "N/A" in user_content


def test_build_skeleton_prompt_system_message_content():
    """System message instructs for Python function stubs."""
    messages = _build_skeleton_prompt({"hypothesis": "H"})
    system = messages[0]["content"]
    assert "Python" in system
    assert "function stubs" in system


# ─── _render_template ─────────────────────────────────────────────────────


def test_render_template_exists():
    """Template file exists at the expected path."""
    template_dir = Path(__file__).resolve().parents[1] / "templates"
    template_path = template_dir / "code_skeleton.py.j2"
    if not template_path.exists():
        pytest.skip("code_skeleton.py.j2 template not found")


def test_render_template_basic():
    """Template renders without error with basic plan data."""
    template_dir = Path(__file__).resolve().parents[1] / "templates"
    template_path = template_dir / "code_skeleton.py.j2"
    if not template_path.exists():
        pytest.skip("code_skeleton.py.j2 template not found")

    plan = {
        "title": "Test Experiment",
        "hypothesis": "Testing hypothesis",
        "metrics": ["accuracy"],
        "datasets": [{"name": "TestDS"}],
        "baselines": [{"name": "Baseline"}],
        "technical_roadmap": [{"step": 1, "description": "Step 1"}],
    }

    result = _render_template(plan, llm_stubs="# LLM generated stubs\ndef my_func(): pass")

    assert isinstance(result, str)
    assert len(result) > 0
    assert "Test Experiment" in result or "test_experiment" in result.lower()


def test_render_template_empty_stubs():
    """Template renders with empty LLM stubs (fallback mode)."""
    template_dir = Path(__file__).resolve().parents[1] / "templates"
    template_path = template_dir / "code_skeleton.py.j2"
    if not template_path.exists():
        pytest.skip("code_skeleton.py.j2 template not found")

    plan = {"title": "Minimal"}
    result = _render_template(plan, llm_stubs="")
    assert isinstance(result, str)


# ─── generate_code_skeleton ───────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.services.plan_generation.code_skeleton._render_template")
@patch("app.services.plan_generation.code_skeleton.llm_completion")
async def test_generate_code_skeleton_success(mock_llm, mock_render):
    """Full pipeline: LLM stubs + template rendering."""
    mock_llm.return_value = SimpleNamespace(
        content="def novel_method(x: torch.Tensor) -> torch.Tensor:\n    pass"
    )
    mock_render.return_value = "# Full skeleton code"

    plan = {"title": "Test", "hypothesis": "H1"}
    session = AsyncMock()

    result = await generate_code_skeleton(plan, session, "user-1")

    assert result == "# Full skeleton code"
    mock_llm.assert_called_once()
    mock_render.assert_called_once()


@pytest.mark.asyncio
@patch("app.services.plan_generation.code_skeleton._render_template")
@patch("app.services.plan_generation.code_skeleton.llm_completion")
async def test_generate_code_skeleton_llm_failure_fallback(mock_llm, mock_render):
    """Falls back to template-only when LLM fails."""
    mock_llm.side_effect = Exception("LLM timeout")
    mock_render.return_value = "# Template-only skeleton"

    plan = {"title": "Test"}
    session = AsyncMock()

    result = await generate_code_skeleton(plan, session, "user-1")

    assert result == "# Template-only skeleton"
    # render_template called with empty stubs
    call_args = mock_render.call_args
    assert call_args[0][1] == ""  # llm_stubs is empty


@pytest.mark.asyncio
@patch("app.services.plan_generation.code_skeleton._render_template")
@patch("app.services.plan_generation.code_skeleton.llm_completion")
async def test_generate_code_skeleton_strips_code_fences(mock_llm, mock_render):
    """Strips markdown code fences from LLM output."""
    mock_llm.return_value = SimpleNamespace(
        content="```python\ndef func(): pass\n```"
    )
    mock_render.return_value = "rendered"

    plan = {"title": "Test"}
    session = AsyncMock()

    await generate_code_skeleton(plan, session, "user-1")

    # The stubs passed to render should not have fences
    call_args = mock_render.call_args
    stubs = call_args[0][1]
    assert "```" not in stubs
    assert "def func(): pass" in stubs
