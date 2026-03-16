"""Training output parsing and results tracking.

Pure functions for extracting metrics from training script stdout
and maintaining results.tsv for experiment history.

Reference: autoresearch program.md output format.
"""

import csv
import io
import re
from datetime import datetime, timezone
from pathlib import Path

# Pattern for key: value lines in training output
_METRIC_PATTERN = re.compile(r"^([a-zA-Z_][a-zA-Z0-9_]*)\s*[:=]\s*([0-9.eE+-]+)\s*$")

# Known metric names that indicate valid training output
_KNOWN_METRICS = {
    "val_loss",
    "val_bpb",
    "accuracy",
    "val_accuracy",
    "f1_score",
    "val_f1",
    "auc",
    "mse",
    "rmse",
    "mae",
    "loss",
    "train_loss",
    "precision",
    "recall",
    "bleu",
    "rouge",
    "perplexity",
}

# TSV columns for results file
_TSV_COLUMNS = [
    "round",
    "status",
    "metric_name",
    "metric_value",
    "description",
    "git_sha",
    "duration_seconds",
    "timestamp",
]


def parse_training_output(log_text: str) -> dict | None:
    """Parse key-value pairs from training script stdout.

    Lines matching `^key: value$` or `^key = value$` are extracted.
    Returns None if no metrics found (indicates crash or no output).
    """
    metrics: dict[str, float] = {}

    for line in log_text.splitlines():
        line = line.strip()
        match = _METRIC_PATTERN.match(line)
        if match:
            key = match.group(1).lower()
            try:
                value = float(match.group(2))
                metrics[key] = value
            except ValueError:
                continue

    if not metrics:
        return None

    return dict(metrics)


def append_results_tsv(workspace: Path, round_result: dict) -> Path:
    """Append one row to results.tsv in workspace.

    Creates file with header if not exists. Returns path to results.tsv.
    IMMUTABLE: reads existing content, appends, writes new file.
    """
    results_path = workspace / "results.tsv"

    # Read existing content
    existing_lines: list[str] = []
    if results_path.exists():
        existing_lines = results_path.read_text(encoding="utf-8").splitlines()

    # Build new content
    output = io.StringIO()

    # Write header if file is new or empty
    if not existing_lines:
        writer = csv.writer(output, delimiter="\t")
        writer.writerow(_TSV_COLUMNS)
    else:
        # Preserve existing content
        output.write("\n".join(existing_lines))
        output.write("\n")

    # Append new row
    writer = csv.writer(output, delimiter="\t")
    row = [
        round_result.get("round", 0),
        round_result.get("status", "unknown"),
        round_result.get("metric_name", ""),
        round_result.get("metric_value", ""),
        round_result.get("description", ""),
        round_result.get("git_sha", ""),
        round_result.get("duration_seconds", ""),
        datetime.now(timezone.utc).isoformat(),
    ]
    writer.writerow(row)

    # Write atomically (new file content)
    results_path.write_text(output.getvalue(), encoding="utf-8")

    return results_path


def read_results_tsv(workspace: Path) -> list[dict]:
    """Read results.tsv and return as list of dicts.

    Returns empty list if file doesn't exist.
    Returns new list (immutable pattern).
    """
    results_path = workspace / "results.tsv"

    if not results_path.exists():
        return []

    rows: list[dict] = []
    content = results_path.read_text(encoding="utf-8")
    reader = csv.DictReader(io.StringIO(content), delimiter="\t")

    for row in reader:
        # Convert numeric fields
        parsed = dict(row)
        if parsed.get("round"):
            try:
                parsed["round"] = int(parsed["round"])
            except ValueError:
                pass
        if parsed.get("metric_value"):
            try:
                parsed["metric_value"] = float(parsed["metric_value"])
            except ValueError:
                pass
        if parsed.get("duration_seconds"):
            try:
                parsed["duration_seconds"] = float(parsed["duration_seconds"])
            except ValueError:
                pass
        rows.append(parsed)

    return rows


def summarize_results(results: list[dict]) -> dict:
    """Pure function returning experiment summary.

    Returns new dict with: total_rounds, best_metric, improvement_over_baseline,
    keep_rate, crash_rate.
    """
    if not results:
        return {
            "total_rounds": 0,
            "best_metric": None,
            "improvement_over_baseline": None,
            "keep_rate": 0.0,
            "crash_rate": 0.0,
        }

    total = len(results)
    keeps = sum(1 for r in results if r.get("status") == "keep")
    crashes = sum(1 for r in results if r.get("status") == "crash")

    # Find baseline and best metric values
    baseline_value = None
    best_value = None

    for r in results:
        metric_val = r.get("metric_value")
        if metric_val is None:
            continue

        if isinstance(metric_val, str):
            try:
                metric_val = float(metric_val)
            except ValueError:
                continue

        if r.get("status") == "baseline":
            baseline_value = metric_val

        if best_value is None or metric_val < best_value:
            best_value = metric_val

    improvement = None
    if baseline_value is not None and best_value is not None and baseline_value != 0:
        improvement = (baseline_value - best_value) / abs(baseline_value) * 100

    return {
        "total_rounds": total,
        "best_metric": best_value,
        "improvement_over_baseline": improvement,
        "keep_rate": keeps / total if total > 0 else 0.0,
        "crash_rate": crashes / total if total > 0 else 0.0,
    }
