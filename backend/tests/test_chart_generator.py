"""Tests for experiment chart generator.

Covers training curve, comparison, and improvement chart generation.
Charts are written to temp directories -- no external services needed.
"""

import pytest
from pathlib import Path

from app.services.experiment.chart_generator import (
    STATUS_COLORS,
    generate_comparison_chart_png,
    generate_improvement_chart_png,
    generate_training_curve_png,
)


@pytest.fixture
def sample_rounds() -> list[dict]:
    return [
        {"round": 0, "status": "baseline", "metric_value": 1.0},
        {"round": 1, "status": "keep", "metric_value": 0.8},
        {"round": 2, "status": "discard", "metric_value": 0.9},
        {"round": 3, "status": "keep", "metric_value": 0.6},
        {"round": 4, "status": "crash", "metric_value": None},
    ]


# ─── generate_training_curve_png ────────────────────────────────────────────


def test_training_curve_creates_file(tmp_path: Path, sample_rounds: list[dict]):
    """Creates a PNG file at the specified path."""
    output = tmp_path / "curve.png"
    result = generate_training_curve_png(sample_rounds, "val_loss", output)
    assert result == output
    assert output.exists()
    assert output.stat().st_size > 0


def test_training_curve_with_baseline(tmp_path: Path, sample_rounds: list[dict]):
    """Creates chart with baseline reference line."""
    output = tmp_path / "curve_bl.png"
    result = generate_training_curve_png(
        sample_rounds, "val_loss", output, baseline_value=1.0
    )
    assert output.exists()


def test_training_curve_empty_rounds(tmp_path: Path):
    """Creates empty placeholder chart when no valid rounds."""
    output = tmp_path / "empty.png"
    result = generate_training_curve_png([], "val_loss", output)
    assert result == output
    assert output.exists()


def test_training_curve_all_none_metrics(tmp_path: Path):
    """Creates empty chart when all metric_values are None."""
    rounds = [{"round": 1, "metric_value": None}]
    output = tmp_path / "none.png"
    result = generate_training_curve_png(rounds, "val_loss", output)
    assert output.exists()


# ─── generate_comparison_chart_png ──────────────────────────────────────────


def test_comparison_chart_creates_file(tmp_path: Path, sample_rounds: list[dict]):
    """Creates a bar chart PNG."""
    output = tmp_path / "comparison.png"
    result = generate_comparison_chart_png(sample_rounds, "val_loss", output)
    assert result == output
    assert output.exists()
    assert output.stat().st_size > 0


def test_comparison_chart_empty(tmp_path: Path):
    """Creates placeholder for empty rounds."""
    output = tmp_path / "empty_comp.png"
    result = generate_comparison_chart_png([], "val_loss", output)
    assert output.exists()


# ─── generate_improvement_chart_png ─────────────────────────────────────────


def test_improvement_chart_creates_file(tmp_path: Path, sample_rounds: list[dict]):
    """Creates improvement chart PNG."""
    output = tmp_path / "improvement.png"
    result = generate_improvement_chart_png(
        sample_rounds, baseline_value=1.0, metric_name="val_loss", output_path=output
    )
    assert result == output
    assert output.exists()


def test_improvement_chart_none_baseline(tmp_path: Path, sample_rounds: list[dict]):
    """Returns None when baseline_value is None."""
    output = tmp_path / "imp_none.png"
    result = generate_improvement_chart_png(
        sample_rounds, baseline_value=None, metric_name="val_loss", output_path=output
    )
    assert result is None


def test_improvement_chart_zero_baseline(tmp_path: Path, sample_rounds: list[dict]):
    """Returns None when baseline_value is zero (avoid division by zero)."""
    output = tmp_path / "imp_zero.png"
    result = generate_improvement_chart_png(
        sample_rounds, baseline_value=0, metric_name="val_loss", output_path=output
    )
    assert result is None


def test_improvement_chart_no_valid_rounds(tmp_path: Path):
    """Returns None when no valid rounds have metric values."""
    rounds = [{"round": 1, "metric_value": None}]
    output = tmp_path / "imp_empty.png"
    result = generate_improvement_chart_png(
        rounds, baseline_value=1.0, metric_name="val_loss", output_path=output
    )
    assert result is None


# ─── STATUS_COLORS ──────────────────────────────────────────────────────────


def test_status_colors_defined():
    """All expected statuses have color mappings."""
    assert "keep" in STATUS_COLORS
    assert "baseline" in STATUS_COLORS
    assert "discard" in STATUS_COLORS
    assert "crash" in STATUS_COLORS
