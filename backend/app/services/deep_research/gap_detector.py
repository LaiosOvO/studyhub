"""Research gap identification and method trend detection.

Analyzes the paper corpus at aggregate level to find gaps,
underexplored method combinations, and temporal trends.
All pure functions for corpus summarization; async functions for LLM calls.

Reference: AI-Scientist idea generation, deep-research gap analysis.
"""

import json
import logging
from collections import Counter

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.paper import Paper
from app.services.deep_research.analyzer import PaperAnalysis
from app.services.deep_research.prompts import (
    build_gap_detection_prompt,
    build_trend_interpretation_prompt,
)
from app.services.llm_service import llm_completion

logger = logging.getLogger(__name__)


# ─── Result Models ────────────────────────────────────────────────────────


class GapItem(BaseModel):
    """A single identified research gap."""
    description: str = ""
    evidence: str = ""
    potential_impact: str = "medium"


class UnexploredItem(BaseModel):
    """An underexplored method combination."""
    combination: str = ""
    why_promising: str = ""


class MissingEvalItem(BaseModel):
    """A missing evaluation (dataset/metric not yet applied)."""
    method: str = ""
    missing: str = ""


class GapResult(BaseModel):
    """Aggregated gap detection results."""
    gaps: list[GapItem] = []
    underexplored: list[UnexploredItem] = []
    missing_evaluations: list[MissingEvalItem] = []


class TrendItem(BaseModel):
    """A single method trend observation."""
    method: str = ""
    evidence: str = ""


class TopicItem(BaseModel):
    """An emerging topic observation."""
    topic: str = ""
    evidence: str = ""


class TrendResult(BaseModel):
    """Aggregated trend detection results."""
    ascending_methods: list[TrendItem] = []
    declining_methods: list[TrendItem] = []
    emerging_topics: list[TopicItem] = []
    stable_methods: list[TrendItem] = []


# ─── Corpus Summarization (Pure Functions) ─────────────────────────────────


def build_corpus_summary(analyses: list[PaperAnalysis]) -> str:
    """Aggregate methods, datasets, paper types into a readable summary.

    Pure function. Truncates to 3000 chars to fit LLM context.
    """
    method_counter: Counter = Counter()
    dataset_counter: Counter = Counter()
    type_counter: Counter = Counter()

    for analysis in analyses:
        for method in analysis.methods:
            method_counter[method] += 1
        for dataset in analysis.datasets:
            dataset_counter[dataset] += 1
        type_counter[analysis.paper_type] += 1

    lines = []
    lines.append(f"Total papers analyzed: {len(analyses)}")

    if method_counter:
        top_methods = method_counter.most_common(20)
        methods_str = ", ".join(f"{m} ({c} papers)" for m, c in top_methods)
        lines.append(f"Methods used: {methods_str}")

    if dataset_counter:
        top_datasets = dataset_counter.most_common(15)
        datasets_str = ", ".join(f"{d} ({c} papers)" for d, c in top_datasets)
        lines.append(f"Datasets used: {datasets_str}")

    if type_counter:
        types_str = ", ".join(f"{t}: {c}" for t, c in type_counter.most_common())
        lines.append(f"Paper types: {types_str}")

    summary = "\n".join(lines)
    return summary[:3000]


def build_method_frequencies(
    analyses: list[PaperAnalysis],
    papers: list[Paper],
) -> str:
    """Group methods by paper year for trend analysis.

    Pure function. Returns formatted string of year -> method counts.
    """
    # Build paper_id -> year map
    year_map = {p.id: p.year for p in papers if p.year}

    # Group methods by year
    year_methods: dict[int, Counter] = {}
    for analysis in analyses:
        year = year_map.get(analysis.paper_id)
        if year and analysis.methods:
            if year not in year_methods:
                year_methods[year] = Counter()
            for method in analysis.methods:
                year_methods[year][method] += 1

    # Format as readable text
    lines = []
    for year in sorted(year_methods.keys()):
        counts = year_methods[year]
        top = counts.most_common(10)
        methods_str = ", ".join(f"{m} ({c})" for m, c in top)
        lines.append(f"{year}: {methods_str}")

    return "\n".join(lines) if lines else "No temporal data available"


# ─── LLM-Powered Detection ────────────────────────────────────────────────


async def detect_gaps(
    analyses: list[PaperAnalysis],
    papers: list[Paper],
    direction: str,
    session: AsyncSession,
    user_id: str,
) -> GapResult:
    """Identify research gaps and underexplored areas in the corpus.

    Uses Sonnet for quality gap analysis (corpus-level reasoning).
    Returns empty GapResult on failure.
    """
    corpus_summary = build_corpus_summary(analyses)
    method_frequencies = build_method_frequencies(analyses, papers)

    messages = build_gap_detection_prompt(
        direction=direction,
        paper_count=len(analyses),
        corpus_summary=corpus_summary,
        method_frequencies=method_frequencies,
    )

    try:
        response = await llm_completion(
            session=session,
            user_id=user_id,
            messages=messages,
            model=None,  # Sonnet for quality
            max_tokens=2048,
            request_type="deep_research_gaps",
        )
        data = json.loads(response.content)

        return GapResult(
            gaps=[GapItem(**g) for g in data.get("gaps", [])],
            underexplored=[UnexploredItem(**u) for u in data.get("underexplored", [])],
            missing_evaluations=[MissingEvalItem(**m) for m in data.get("missing_evaluations", [])],
        )
    except (json.JSONDecodeError, Exception) as exc:
        logger.warning("Gap detection failed: %s", exc)
        return GapResult()


async def detect_trends(
    analyses: list[PaperAnalysis],
    papers: list[Paper],
    direction: str,
    session: AsyncSession,
    user_id: str,
) -> TrendResult:
    """Detect ascending/declining method trends over time.

    Uses Haiku (trends are simpler pattern matching).
    Returns empty TrendResult on failure.
    """
    method_year_counts = build_method_frequencies(analyses, papers)

    if method_year_counts == "No temporal data available":
        return TrendResult()

    messages = build_trend_interpretation_prompt(
        direction=direction,
        method_year_counts=method_year_counts,
    )

    try:
        response = await llm_completion(
            session=session,
            user_id=user_id,
            messages=messages,
            model="claude-haiku-4-20250514",
            max_tokens=1024,
            request_type="deep_research_trends",
        )
        data = json.loads(response.content)

        return TrendResult(
            ascending_methods=[TrendItem(**t) for t in data.get("ascending_methods", [])],
            declining_methods=[TrendItem(**t) for t in data.get("declining_methods", [])],
            emerging_topics=[TopicItem(**t) for t in data.get("emerging_topics", [])],
            stable_methods=[TrendItem(**t) for t in data.get("stable_methods", [])],
        )
    except (json.JSONDecodeError, Exception) as exc:
        logger.warning("Trend detection failed: %s", exc)
        return TrendResult()
