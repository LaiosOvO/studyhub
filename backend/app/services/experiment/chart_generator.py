"""Generate matplotlib chart PNGs from experiment data.

Pure functions for training curve, metric comparison, and
improvement charts. All functions are side-effect-free except
for writing the PNG file.

Reference: AI-Scientist figure generation pattern.
"""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # Headless backend — MUST be before pyplot import

import matplotlib.pyplot as plt  # noqa: E402

# ─── Status Color Mapping ────────────────────────────────────────────────────

STATUS_COLORS: dict[str, str] = {
    "keep": "#22c55e",
    "baseline": "#3b82f6",
    "discard": "#f97316",
    "crash": "#ef4444",
}


def generate_training_curve_png(
    rounds: list[dict],
    metric_name: str,
    output_path: Path,
    baseline_value: float | None = None,
) -> Path:
    """Generate a training curve line chart from experiment rounds.

    Args:
        rounds: List of round dicts with round, status, metric_value fields.
        metric_name: Name of the metric being tracked.
        output_path: Path to write the PNG file.
        baseline_value: Optional baseline value for reference line.

    Returns:
        The output_path where the PNG was written.
    """
    valid_rounds = [
        r for r in rounds if r.get("metric_value") is not None
    ]

    if not valid_rounds:
        return _empty_chart(output_path, f"Training Curve: {metric_name}")

    x_vals = [r["round"] for r in valid_rounds]
    y_vals = [r["metric_value"] for r in valid_rounds]
    colors = [
        STATUS_COLORS.get(r.get("status", ""), "#6b7280")
        for r in valid_rounds
    ]

    fig, ax = plt.subplots(figsize=(10, 5))
    try:
        ax.plot(x_vals, y_vals, color="#4A90D9", linewidth=2, zorder=1)
        ax.scatter(x_vals, y_vals, c=colors, s=60, zorder=2, edgecolors="white")

        if baseline_value is not None:
            ax.axhline(
                y=baseline_value,
                color="#9ca3af",
                linestyle="--",
                linewidth=1,
                label="Baseline",
            )
            ax.legend()

        ax.set_title(f"Training Curve: {metric_name}")
        ax.set_xlabel("Round")
        ax.set_ylabel(metric_name)
        ax.grid(True, alpha=0.3)
        fig.tight_layout()
        fig.savefig(str(output_path), dpi=150)
    finally:
        plt.close(fig)

    return output_path


def generate_comparison_chart_png(
    rounds: list[dict],
    metric_name: str,
    output_path: Path,
) -> Path:
    """Generate a bar chart comparing metric values across rounds.

    Args:
        rounds: List of round dicts with round, status, metric_value fields.
        metric_name: Name of the metric being tracked.
        output_path: Path to write the PNG file.

    Returns:
        The output_path where the PNG was written.
    """
    valid_rounds = [
        r for r in rounds if r.get("metric_value") is not None
    ]

    if not valid_rounds:
        return _empty_chart(output_path, f"Metric Comparison: {metric_name}")

    x_vals = [str(r["round"]) for r in valid_rounds]
    y_vals = [r["metric_value"] for r in valid_rounds]
    colors = [
        STATUS_COLORS.get(r.get("status", ""), "#6b7280")
        for r in valid_rounds
    ]

    fig, ax = plt.subplots(figsize=(10, 5))
    try:
        ax.bar(x_vals, y_vals, color=colors, edgecolor="white", linewidth=0.5)
        ax.set_title(f"Metric Comparison Across Rounds: {metric_name}")
        ax.set_xlabel("Round")
        ax.set_ylabel(metric_name)
        ax.grid(True, axis="y", alpha=0.3)
        fig.tight_layout()
        fig.savefig(str(output_path), dpi=150)
    finally:
        plt.close(fig)

    return output_path


def generate_improvement_chart_png(
    rounds: list[dict],
    baseline_value: float | None,
    metric_name: str,
    output_path: Path,
) -> Path | None:
    """Generate a line chart showing percentage improvement over baseline.

    Args:
        rounds: List of round dicts with round, metric_value fields.
        baseline_value: Baseline metric value for comparison.
        metric_name: Name of the metric being tracked.
        output_path: Path to write the PNG file.

    Returns:
        The output_path, or None if baseline_value is None.
    """
    if baseline_value is None or baseline_value == 0:
        return None

    valid_rounds = [
        r for r in rounds if r.get("metric_value") is not None
    ]

    if not valid_rounds:
        return None

    x_vals = [r["round"] for r in valid_rounds]
    y_vals = [
        ((baseline_value - r["metric_value"]) / abs(baseline_value)) * 100
        for r in valid_rounds
    ]

    fig, ax = plt.subplots(figsize=(10, 5))
    try:
        ax.plot(x_vals, y_vals, color="#4A90D9", linewidth=2, marker="o")
        ax.axhline(y=0, color="#9ca3af", linestyle="--", linewidth=1)
        ax.fill_between(
            x_vals,
            y_vals,
            0,
            where=[y >= 0 for y in y_vals],
            alpha=0.15,
            color="#22c55e",
        )
        ax.fill_between(
            x_vals,
            y_vals,
            0,
            where=[y < 0 for y in y_vals],
            alpha=0.15,
            color="#ef4444",
        )
        ax.set_title(f"Improvement Over Baseline: {metric_name}")
        ax.set_xlabel("Round")
        ax.set_ylabel("Improvement (%)")
        ax.grid(True, alpha=0.3)
        fig.tight_layout()
        fig.savefig(str(output_path), dpi=150)
    finally:
        plt.close(fig)

    return output_path


def _empty_chart(output_path: Path, title: str) -> Path:
    """Generate an empty placeholder chart when no data available."""
    fig, ax = plt.subplots(figsize=(10, 5))
    try:
        ax.text(
            0.5, 0.5, "No data available",
            ha="center", va="center",
            fontsize=14, color="#9ca3af",
            transform=ax.transAxes,
        )
        ax.set_title(title)
        ax.set_xticks([])
        ax.set_yticks([])
        fig.tight_layout()
        fig.savefig(str(output_path), dpi=150)
    finally:
        plt.close(fig)
    return output_path
