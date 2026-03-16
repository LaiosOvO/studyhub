"""Tests for experiment loop agent helper functions.

Tests the pure/testable parts of loop_agent: _extract_code_from_response,
_is_improvement, _build_result, and ExperimentConfig immutability.
"""

import pytest
from pathlib import Path

from app.services.experiment.loop_agent import (
    ControlSignal,
    ExperimentConfig,
    _extract_code_from_response,
    _is_improvement,
    _build_result,
)


# ─── ExperimentConfig ───────────────────────────────────────────────────────


def test_experiment_config_frozen():
    """ExperimentConfig is immutable (frozen dataclass)."""
    config = ExperimentConfig(
        plan_id="plan-001",
        run_id="run-001",
        workspace=Path("/tmp/test"),
    )
    with pytest.raises(AttributeError):
        config.plan_id = "changed"


def test_experiment_config_defaults():
    """Default values are set correctly."""
    config = ExperimentConfig(
        plan_id="p", run_id="r", workspace=Path("/tmp")
    )
    assert config.gpu_device == 0
    assert config.max_rounds == 20
    assert config.consecutive_no_improve_limit == 5
    assert config.primary_metric == "val_loss"
    assert config.lower_is_better is True
    assert config.max_fix_attempts == 3
    assert config.time_budget_minutes is None


# ─── ControlSignal ──────────────────────────────────────────────────────────


def test_control_signal_values():
    """All control signal values are correct."""
    assert ControlSignal.CONTINUE.value == "continue"
    assert ControlSignal.PAUSE.value == "pause"
    assert ControlSignal.RESUME.value == "resume"
    assert ControlSignal.SKIP.value == "skip"
    assert ControlSignal.CANCEL.value == "cancel"
    assert ControlSignal.GUIDE.value == "guide"


# ─── _extract_code_from_response ────────────────────────────────────────────


def test_extract_code_from_markdown_block():
    """Extracts code from ```python code blocks."""
    response = "Here is the code:\n```python\nx = 42\nprint(x)\n```\nDone."
    code = _extract_code_from_response(response)
    assert code == "x = 42\nprint(x)"


def test_extract_code_from_generic_block():
    """Extracts code from ``` blocks without language tag."""
    response = "```\nimport os\n```"
    code = _extract_code_from_response(response)
    assert code == "import os"


def test_extract_code_raw_response():
    """Returns raw response when no code block found."""
    response = "x = 42\nprint(x)"
    code = _extract_code_from_response(response)
    assert code == "x = 42\nprint(x)"


def test_extract_code_strips_whitespace():
    """Strips leading/trailing whitespace from extracted code."""
    response = "  \nx = 1\n  "
    code = _extract_code_from_response(response)
    assert code == "x = 1"


# ─── _is_improvement ────────────────────────────────────────────────────────


def test_is_improvement_lower_is_better_improved():
    """Lower current is improvement when lower_is_better=True."""
    assert _is_improvement(0.4, 0.5, lower_is_better=True) is True


def test_is_improvement_lower_is_better_no_change():
    """Same value is not improvement."""
    assert _is_improvement(0.5, 0.5, lower_is_better=True) is False


def test_is_improvement_lower_is_better_worse():
    """Higher current is not improvement when lower_is_better=True."""
    assert _is_improvement(0.6, 0.5, lower_is_better=True) is False


def test_is_improvement_higher_is_better_improved():
    """Higher current is improvement when lower_is_better=False."""
    assert _is_improvement(0.9, 0.8, lower_is_better=False) is True


def test_is_improvement_higher_is_better_worse():
    """Lower current is not improvement when lower_is_better=False."""
    assert _is_improvement(0.7, 0.8, lower_is_better=False) is False


# ─── _build_result ──────────────────────────────────────────────────────────


def test_build_result_structure(tmp_path: Path):
    """Returns dict with all expected fields."""
    config = ExperimentConfig(
        plan_id="p", run_id="r", workspace=tmp_path
    )
    result = _build_result("completed", 10, 0.45, config)
    assert result["status"] == "completed"
    assert result["total_rounds"] == 10
    assert result["best_metric"] == 0.45
    assert "rounds" in result
    assert "baseline_metric" in result
    assert "improvement_over_baseline" in result


def test_build_result_no_baseline(tmp_path: Path):
    """Improvement is None when no baseline."""
    config = ExperimentConfig(plan_id="p", run_id="r", workspace=tmp_path)
    result = _build_result("completed", 5, 0.5, config)
    assert result["improvement_over_baseline"] is None


def test_build_result_cancelled(tmp_path: Path):
    """Status correctly set to 'cancelled'."""
    config = ExperimentConfig(plan_id="p", run_id="r", workspace=tmp_path)
    result = _build_result("cancelled", 3, None, config)
    assert result["status"] == "cancelled"
    assert result["best_metric"] is None
