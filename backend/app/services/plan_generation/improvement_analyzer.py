"""Gap-to-improvement mapping and plan generation context assembly.

Three entry points (direction, paper, gap) produce different
PlanGenerationContext objects for the plan generation pipeline.

Reference: AI-Scientist generate_ideas.py, MLE-agent advisor.py.
"""

import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deep_research import DeepResearchTask
from app.schemas.plan import (
    ImprovementOpportunity,
    PlanGenerationContext,
    SOTAResult,
)
from app.services.deep_research.gap_detector import GapResult
from app.services.llm_service import llm_completion
from app.services.plan_generation.prompts import build_improvement_prompt
from app.services.plan_generation.sota_identifier import identify_sota

logger = logging.getLogger(__name__)


# ─── Pure Functions ────────────────────────────────────────────────────────


def get_top_papers(task: DeepResearchTask, limit: int = 10) -> list[dict]:
    """Extract papers with highest quality metrics from paper_analyses.

    Pure function. Returns list of dicts with paper_id, title,
    methods, key_metrics sorted by number of metrics reported.
    """
    config = task.config or {}
    paper_analyses: dict[str, dict] = config.get("paper_analyses", {})

    papers = []
    for paper_id, analysis in paper_analyses.items():
        papers = [
            *papers,
            {
                "paper_id": paper_id,
                "tldr_en": analysis.get("tldr_en", ""),
                "methods": analysis.get("methods", []),
                "key_metrics": analysis.get("key_metrics", {}),
                "paper_type": analysis.get("paper_type", "unknown"),
                "key_contributions": analysis.get("key_contributions", []),
                "limitations": analysis.get("limitations", []),
            },
        ]

    # Sort by richness of metrics (more metrics = better analyzed)
    sorted_papers = sorted(
        papers,
        key=lambda p: len(p.get("key_metrics", {})),
        reverse=True,
    )
    return sorted_papers[:limit]


def _format_sota_summary(sota: SOTAResult) -> str:
    """Format SOTAResult into readable text for prompts."""
    lines = []
    if sota.sota_methods:
        lines.append("SOTA Methods:")
        for m in sota.sota_methods:
            lines.append(
                f"  - {m.method}: {m.metric}={m.value} "
                f"({m.paper_title}, confidence: {m.confidence})"
            )
    if sota.evaluation_metrics:
        lines.append(f"Evaluation metrics: {', '.join(sota.evaluation_metrics)}")
    if sota.benchmark_datasets:
        ds_names = [d.get("name", "?") for d in sota.benchmark_datasets]
        lines.append(f"Benchmark datasets: {', '.join(ds_names)}")
    return "\n".join(lines) if lines else "No SOTA data available"


def _format_gaps_summary(gaps_data: dict | None) -> str:
    """Format gaps dict into readable text for prompts."""
    if not gaps_data:
        return "No gaps identified"

    lines = []
    for i, gap in enumerate(gaps_data.get("gaps", [])):
        desc = gap.get("description", "")
        impact = gap.get("potential_impact", "unknown")
        lines.append(f"  {i}. {desc} (impact: {impact})")

    underexplored = gaps_data.get("underexplored", [])
    if underexplored:
        lines.append("Underexplored combinations:")
        for item in underexplored:
            lines.append(f"  - {item.get('combination', '')}")

    return "\n".join(lines) if lines else "No gaps identified"


def _build_entry_context(
    entry_type: str,
    task: DeepResearchTask,
    focus_paper: dict | None = None,
    focus_gap: dict | None = None,
) -> str:
    """Build entry-specific context string for prompts."""
    if entry_type == "paper" and focus_paper:
        return (
            f"Focus paper: {focus_paper.get('tldr_en', 'N/A')}\n"
            f"Methods: {', '.join(focus_paper.get('methods', []))}\n"
            f"Limitations: {', '.join(focus_paper.get('limitations', []))}"
        )
    if entry_type == "gap" and focus_gap:
        return (
            f"Focus gap: {focus_gap.get('description', 'N/A')}\n"
            f"Evidence: {focus_gap.get('evidence', 'N/A')}\n"
            f"Potential impact: {focus_gap.get('potential_impact', 'N/A')}"
        )
    return f"Broad direction exploration: {task.research_direction}"


# ─── LLM-Powered Analysis ─────────────────────────────────────────────────


async def analyze_improvements(
    sota: SOTAResult,
    gaps: GapResult,
    direction: str,
    session: AsyncSession,
    user_id: str,
) -> list[ImprovementOpportunity]:
    """Analyze gaps + SOTA to identify improvement opportunities.

    Uses Sonnet for quality analysis. Returns empty list on failure.
    """
    sota_summary = _format_sota_summary(sota)
    gaps_summary = _format_gaps_summary(gaps.model_dump())
    entry_context = f"Broad direction: {direction}"

    messages = build_improvement_prompt(
        direction=direction,
        sota_summary=sota_summary,
        gaps_summary=gaps_summary,
        entry_context=entry_context,
    )

    try:
        response = await llm_completion(
            session=session,
            user_id=user_id,
            messages=messages,
            model=None,  # Sonnet for quality
            max_tokens=2048,
            request_type="plan_improvements",
        )
        data = json.loads(response.content)

        # Handle both array and object with key
        items = data if isinstance(data, list) else data.get("improvements", [])
        return [ImprovementOpportunity(**item) for item in items]
    except (json.JSONDecodeError, Exception) as exc:
        logger.warning("Improvement analysis failed: %s", exc)
        return []


# ─── Context Assembly (Three Entry Points) ─────────────────────────────────


async def create_plan_context(
    entry_type: str,
    task: DeepResearchTask,
    session: AsyncSession,
    paper_id: str | None = None,
    gap_index: int | None = None,
) -> PlanGenerationContext:
    """Assemble plan generation context based on entry type.

    Three entry points per PLAN-08:
    - "direction": Full SOTA + all gaps + trends + top papers
    - "paper": Focus paper + SOTA + paper-specific improvements
    - "gap": Specific gap + SOTA + related papers

    All paths call identify_sota internally.
    """
    # Common: identify SOTA
    sota = await identify_sota(task, session)

    # Common: extract gaps and trends
    gaps_data = task.gaps or {}
    trends_data = task.trends

    # Common: get top papers
    top_papers = get_top_papers(task)

    # Entry-specific context
    focus_paper: dict | None = None
    focus_gap: dict | None = None

    if entry_type == "paper" and paper_id:
        # Find the focus paper in analyses
        config = task.config or {}
        paper_analyses = config.get("paper_analyses", {})
        analysis = paper_analyses.get(paper_id, {})
        if analysis:
            focus_paper = {
                "paper_id": paper_id,
                "tldr_en": analysis.get("tldr_en", ""),
                "methods": analysis.get("methods", []),
                "key_metrics": analysis.get("key_metrics", {}),
                "key_contributions": analysis.get("key_contributions", []),
                "limitations": analysis.get("limitations", []),
            }

    elif entry_type == "gap" and gap_index is not None:
        # Extract specific gap by index
        gap_items = gaps_data.get("gaps", [])
        if 0 <= gap_index < len(gap_items):
            focus_gap = gap_items[gap_index]

    # Analyze improvements with assembled context
    gap_result = GapResult(**gaps_data) if gaps_data else GapResult()
    improvements = await analyze_improvements(
        sota=sota,
        gaps=gap_result,
        direction=task.research_direction,
        session=session,
        user_id=task.user_id,
    )

    return PlanGenerationContext(
        direction=task.research_direction,
        sota=sota,
        gaps=gaps_data.get("gaps", []) if gaps_data else [],
        trends=trends_data,
        top_papers=top_papers,
        focus_paper=focus_paper,
        focus_gap=focus_gap,
        improvements=improvements,
    )
