"""Tests for experiment metrics parsing and results tracking.

Covers parse_training_output, append_results_tsv, read_results_tsv,
and summarize_results. Pure functions -- no external deps needed.
"""

import pytest
from pathlib import Path

from app.services.experiment.metrics import (
    append_results_tsv,
    parse_training_output,
    read_results_tsv,
    summarize_results,
)


# ─── parse_training_output ──────────────────────────────────────────────────


def test_parse_training_output_colon_format():
    """Extracts key: value metrics from training output."""
    log = "val_loss: 0.523\naccuracy: 0.89\n"
    result = parse_training_output(log)
    assert result is not None
    assert result["val_loss"] == pytest.approx(0.523)
    assert result["accuracy"] == pytest.approx(0.89)


def test_parse_training_output_equals_format():
    """Extracts key = value metrics."""
    log = "val_loss = 1.234\ntrain_loss = 2.345\n"
    result = parse_training_output(log)
    assert result is not None
    assert result["val_loss"] == pytest.approx(1.234)
    assert result["train_loss"] == pytest.approx(2.345)


def test_parse_training_output_scientific_notation():
    """Handles scientific notation values."""
    log = "loss: 3.5e-04\n"
    result = parse_training_output(log)
    assert result is not None
    assert result["loss"] == pytest.approx(3.5e-04)


def test_parse_training_output_mixed_with_noise():
    """Ignores non-metric lines mixed in output."""
    log = (
        "Epoch 1/10\n"
        "Loading data...\n"
        "val_loss: 0.5\n"
        "some random text\n"
        "accuracy: 0.9\n"
    )
    result = parse_training_output(log)
    assert result is not None
    assert len(result) == 2
    assert "val_loss" in result
    assert "accuracy" in result


def test_parse_training_output_empty_string():
    """Returns None for empty output (crash indicator)."""
    assert parse_training_output("") is None


def test_parse_training_output_no_metrics():
    """Returns None when no valid metric lines found."""
    log = "Traceback (most recent call last):\n  File 'train.py'\nRuntimeError: CUDA OOM\n"
    assert parse_training_output(log) is None


def test_parse_training_output_case_insensitive_keys():
    """Metric keys are lowercased."""
    log = "Val_Loss: 0.5\n"
    result = parse_training_output(log)
    assert result is not None
    assert "val_loss" in result


# ─── append_results_tsv / read_results_tsv ──────────────────────────────────


def test_append_and_read_results_tsv(tmp_path: Path):
    """Appending then reading round-trips correctly."""
    round_result = {
        "round": 1,
        "status": "keep",
        "metric_name": "val_loss",
        "metric_value": 0.45,
        "description": "Increased lr",
        "git_sha": "abc123",
        "duration_seconds": 12.5,
    }
    append_results_tsv(tmp_path, round_result)
    rows = read_results_tsv(tmp_path)
    assert len(rows) == 1
    assert rows[0]["round"] == 1
    assert rows[0]["metric_value"] == pytest.approx(0.45)
    assert rows[0]["status"] == "keep"


def test_append_multiple_rows(tmp_path: Path):
    """Multiple appends create multiple rows."""
    for i in range(3):
        append_results_tsv(tmp_path, {
            "round": i,
            "status": "keep",
            "metric_name": "val_loss",
            "metric_value": 1.0 - i * 0.1,
        })
    rows = read_results_tsv(tmp_path)
    assert len(rows) == 3


def test_read_results_tsv_no_file(tmp_path: Path):
    """Returns empty list when results.tsv doesn't exist."""
    assert read_results_tsv(tmp_path) == []


def test_append_results_tsv_creates_header(tmp_path: Path):
    """First append creates file with TSV header."""
    append_results_tsv(tmp_path, {"round": 0, "status": "baseline"})
    content = (tmp_path / "results.tsv").read_text()
    header = content.splitlines()[0]
    assert "round" in header
    assert "status" in header
    assert "metric_name" in header


# ─── summarize_results ──────────────────────────────────────────────────────


def test_summarize_results_empty():
    """Empty results produce zero summary."""
    summary = summarize_results([])
    assert summary["total_rounds"] == 0
    assert summary["best_metric"] is None
    assert summary["keep_rate"] == 0.0


def test_summarize_results_with_data():
    """Computes correct keep rate, crash rate, and best metric."""
    results = [
        {"status": "baseline", "metric_value": 1.0},
        {"status": "keep", "metric_value": 0.8},
        {"status": "discard", "metric_value": 0.9},
        {"status": "crash", "metric_value": None},
        {"status": "keep", "metric_value": 0.7},
    ]
    summary = summarize_results(results)
    assert summary["total_rounds"] == 5
    assert summary["best_metric"] == pytest.approx(0.7)
    assert summary["keep_rate"] == pytest.approx(2 / 5)
    assert summary["crash_rate"] == pytest.approx(1 / 5)


def test_summarize_results_improvement_over_baseline():
    """Computes improvement percentage correctly."""
    results = [
        {"status": "baseline", "metric_value": 1.0},
        {"status": "keep", "metric_value": 0.5},
    ]
    summary = summarize_results(results)
    # improvement = (1.0 - 0.5) / |1.0| * 100 = 50%
    assert summary["improvement_over_baseline"] == pytest.approx(50.0)


def test_summarize_results_string_metric_values():
    """Handles string metric values from TSV parsing."""
    results = [
        {"status": "baseline", "metric_value": "1.0"},
        {"status": "keep", "metric_value": "0.8"},
    ]
    summary = summarize_results(results)
    assert summary["best_metric"] == pytest.approx(0.8)
