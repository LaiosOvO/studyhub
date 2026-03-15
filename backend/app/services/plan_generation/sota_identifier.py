"""SOTA identification from paper corpus and HuggingFace Hub.

Extracts state-of-the-art methods, benchmarks, and evaluation metrics
by combining corpus analysis with external dataset discovery.

Reference: AI-Scientist SOTA analysis, MLE-agent advisor patterns.
"""

import asyncio
import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deep_research import DeepResearchTask
from app.schemas.plan import SOTAMethod, SOTAResult
from app.services.llm_service import llm_completion
from app.services.plan_generation.prompts import build_sota_prompt

logger = logging.getLogger(__name__)


# ─── Pure Functions ────────────────────────────────────────────────────────


def aggregate_methods_by_metric(
    paper_analyses: dict[str, dict],
) -> dict[str, list[dict]]:
    """Group methods by their associated metrics from PaperAnalysis data.

    Pure function. Scans all paper analyses and builds a mapping from
    metric name to list of methods that report that metric.

    Args:
        paper_analyses: Dict of paper_id -> PaperAnalysis dict.

    Returns:
        Dict of metric_name -> [{method, value, paper_id}].
    """
    metric_groups: dict[str, list[dict]] = {}

    for paper_id, analysis in paper_analyses.items():
        methods = analysis.get("methods", [])
        key_metrics = analysis.get("key_metrics", {})

        for metric_name, metric_value in key_metrics.items():
            entries = metric_groups.get(metric_name, [])
            # Associate each method with this metric
            for method in methods:
                entries = [
                    *entries,
                    {
                        "method": method,
                        "value": str(metric_value),
                        "paper_id": paper_id,
                    },
                ]
            # If no methods listed, still record the metric
            if not methods:
                entries = [
                    *entries,
                    {
                        "method": "unknown",
                        "value": str(metric_value),
                        "paper_id": paper_id,
                    },
                ]
            metric_groups = {**metric_groups, metric_name: entries}

    return metric_groups


def _format_top_methods(metric_groups: dict[str, list[dict]]) -> str:
    """Format aggregated methods for prompt context."""
    lines = []
    for metric_name, entries in metric_groups.items():
        # Deduplicate methods, keep best value per method
        seen: dict[str, dict] = {}
        for entry in entries:
            method = entry["method"]
            if method not in seen:
                seen = {**seen, method: entry}
        method_strs = [
            f"  - {e['method']}: {e['value']} (paper: {e['paper_id'][:8]}...)"
            for e in seen.values()
        ]
        lines.append(f"{metric_name}:")
        lines.extend(method_strs[:10])  # Limit per metric
    return "\n".join(lines) if lines else "No methods with metrics found"


def _format_best_metrics(metric_groups: dict[str, list[dict]]) -> str:
    """Format best-performing metrics for prompt context."""
    lines = []
    for metric_name, entries in metric_groups.items():
        if entries:
            # Sort by value (string sort -- LLM will interpret)
            sorted_entries = sorted(entries, key=lambda e: e["value"], reverse=True)
            best = sorted_entries[0]
            lines.append(
                f"{metric_name}: best = {best['value']} "
                f"({best['method']}, paper: {best['paper_id'][:8]}...)"
            )
    return "\n".join(lines) if lines else "No metric values found"


# ─── External Data ─────────────────────────────────────────────────────────


async def search_hf_benchmarks(direction: str, limit: int = 5) -> str:
    """Search HuggingFace Hub for relevant benchmark datasets.

    Uses asyncio.to_thread since HfApi is synchronous.
    Non-fatal: returns fallback message on any failure.

    Args:
        direction: Research direction keyword(s).
        limit: Maximum datasets to return.

    Returns:
        Formatted string of dataset descriptions for prompt context.
    """
    try:
        from huggingface_hub import HfApi

        def _search() -> list[dict]:
            api = HfApi()
            # Extract first meaningful keyword for search
            keyword = direction.split()[0] if direction else "machine learning"
            datasets = list(
                api.list_datasets(
                    search=keyword,
                    sort="downloads",
                    direction=-1,
                    limit=limit,
                )
            )
            return [
                {
                    "id": ds.id,
                    "downloads": getattr(ds, "downloads", 0),
                    "tags": getattr(ds, "tags", [])[:5],
                    "license": next(
                        (
                            t.split(":")[-1]
                            for t in getattr(ds, "tags", [])
                            if t.startswith("license:")
                        ),
                        None,
                    ),
                }
                for ds in datasets
            ]

        results = await asyncio.to_thread(_search)

        if not results:
            return "No external benchmarks available"

        lines = []
        for ds in results:
            tags_str = ", ".join(ds["tags"]) if ds["tags"] else "no tags"
            lines.append(
                f"- {ds['id']} (downloads: {ds['downloads']}, "
                f"tags: {tags_str}, license: {ds['license'] or 'unknown'})"
            )
        return "\n".join(lines)

    except Exception as exc:
        logger.warning("HuggingFace Hub search failed: %s", exc)
        return "No external benchmarks available"


# ─── Main Entry Point ─────────────────────────────────────────────────────


async def identify_sota(
    task: DeepResearchTask,
    session: AsyncSession,
) -> SOTAResult:
    """Identify SOTA methods for a research task using corpus + HF Hub.

    Step 1: Extract paper_analyses from task.config.
    Step 2: Aggregate methods by metric (pure function).
    Step 3: Search HuggingFace Hub for benchmark datasets.
    Step 4: Call LLM with assembled context to produce SOTAResult.

    Returns empty SOTAResult on failure.
    """
    # Step 1: Extract paper analyses
    config = task.config or {}
    paper_analyses: dict[str, dict] = config.get("paper_analyses", {})
    paper_count = len(paper_analyses)

    # Step 2: Aggregate methods by metric
    metric_groups = aggregate_methods_by_metric(paper_analyses)
    top_methods_str = _format_top_methods(metric_groups)
    best_metrics_str = _format_best_metrics(metric_groups)

    # Step 3: Search HF Hub (concurrent with nothing -- just await)
    hf_benchmarks = await search_hf_benchmarks(task.research_direction)

    # Step 4: LLM call
    messages = build_sota_prompt(
        direction=task.research_direction,
        paper_count=paper_count,
        top_methods=top_methods_str,
        best_metrics=best_metrics_str,
        hf_benchmarks=hf_benchmarks,
    )

    try:
        response = await llm_completion(
            session=session,
            user_id=task.user_id,
            messages=messages,
            model=None,  # Sonnet for quality
            max_tokens=2048,
            request_type="plan_sota",
        )
        data = json.loads(response.content)

        return SOTAResult(
            sota_methods=[
                SOTAMethod(**m) for m in data.get("sota_methods", [])
            ],
            standard_baselines=data.get("standard_baselines", []),
            evaluation_metrics=data.get("evaluation_metrics", []),
            benchmark_datasets=data.get("benchmark_datasets", []),
        )
    except (json.JSONDecodeError, Exception) as exc:
        logger.warning("SOTA identification failed: %s", exc)
        return SOTAResult()
