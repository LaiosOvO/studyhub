"""Multi-dimensional feasibility scoring for experiment plans.

Uses Haiku for cost-efficient scoring across compute, data availability,
expected improvement, and difficulty dimensions.

Reference: AI-Scientist feasibility assessment pattern.
"""

import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.plan import FeasibilityScore
from app.services.llm_service import llm_completion
from app.services.plan_generation.prompts import build_feasibility_prompt

logger = logging.getLogger(__name__)

# Haiku model for cost-efficient scoring
_HAIKU_MODEL = "claude-haiku-4-20250514"

# Default score returned when scoring fails
_DEFAULT_SCORE = FeasibilityScore(
    compute_requirements=3,
    data_availability=3,
    expected_improvement=3,
    difficulty=3,
    overall=3.0,
    explanation="Scoring unavailable",
)


def _compute_overall(
    compute_requirements: int,
    data_availability: int,
    expected_improvement: int,
    difficulty: int,
) -> float:
    """Compute weighted overall feasibility score.

    Higher = more feasible. Compute and difficulty are inverted
    (lower compute/difficulty = more feasible = higher score).

    Formula: ((6-compute) + data + expected_improvement + (6-difficulty)) / 4
    """
    return (
        (6 - compute_requirements)
        + data_availability
        + expected_improvement
        + (6 - difficulty)
    ) / 4


def _format_plan_summary(plan_draft: dict) -> str:
    """Format a plan draft dict into a readable summary for the LLM."""
    lines = [
        f"Title: {plan_draft.get('title', 'N/A')}",
        f"Hypothesis: {plan_draft.get('hypothesis', 'N/A')}",
        f"Method: {plan_draft.get('method_description', 'N/A')[:500]}",
    ]

    baselines = plan_draft.get("baselines", [])
    if baselines:
        baseline_names = [b.get("name", "?") for b in baselines[:5]]
        lines.append(f"Baselines: {', '.join(baseline_names)}")

    metrics = plan_draft.get("metrics", [])
    if metrics:
        lines.append(f"Metrics: {', '.join(metrics[:10])}")

    datasets = plan_draft.get("datasets", [])
    if datasets:
        ds_names = [d.get("name", "?") for d in datasets[:5]]
        lines.append(f"Datasets: {', '.join(ds_names)}")

    roadmap = plan_draft.get("technical_roadmap", [])
    if roadmap:
        lines.append(f"Roadmap steps: {len(roadmap)}")

    return "\n".join(lines)


async def score_feasibility(
    plan_draft: dict,
    direction: str,
    session: AsyncSession,
    user_id: str,
) -> FeasibilityScore:
    """Score a single plan's feasibility using Haiku.

    Calls LLM with plan summary and direction context to get
    four-dimensional scoring. Computes overall as weighted average.

    Returns default FeasibilityScore on any failure.

    Args:
        plan_draft: Plan dict with title, hypothesis, method, etc.
        direction: Research direction for context.
        session: DB session for LLM cost tracking.
        user_id: User ID for cost tracking.

    Returns:
        FeasibilityScore with all dimensions and overall score.
    """
    plan_summary = _format_plan_summary(plan_draft)
    messages = build_feasibility_prompt(
        plan_summary=plan_summary,
        direction=direction,
    )

    try:
        response = await llm_completion(
            session=session,
            user_id=user_id,
            messages=messages,
            model=_HAIKU_MODEL,
            max_tokens=1024,
            request_type="plan_feasibility",
        )

        data = json.loads(response.content)

        compute = int(data.get("compute_requirements", 3))
        data_avail = int(data.get("data_availability", 3))
        expected = int(data.get("expected_improvement", 3))
        difficulty = int(data.get("difficulty", 3))

        # Clamp values to 1-5
        compute = max(1, min(5, compute))
        data_avail = max(1, min(5, data_avail))
        expected = max(1, min(5, expected))
        difficulty = max(1, min(5, difficulty))

        overall = _compute_overall(compute, data_avail, expected, difficulty)
        explanation = data.get("explanation", "No explanation provided")

        return FeasibilityScore(
            compute_requirements=compute,
            data_availability=data_avail,
            expected_improvement=expected,
            difficulty=difficulty,
            overall=overall,
            explanation=explanation,
        )

    except (json.JSONDecodeError, KeyError, ValueError, TypeError) as exc:
        logger.warning("Feasibility scoring parse error: %s", exc)
        return FeasibilityScore(
            compute_requirements=_DEFAULT_SCORE.compute_requirements,
            data_availability=_DEFAULT_SCORE.data_availability,
            expected_improvement=_DEFAULT_SCORE.expected_improvement,
            difficulty=_DEFAULT_SCORE.difficulty,
            overall=_DEFAULT_SCORE.overall,
            explanation=_DEFAULT_SCORE.explanation,
        )
    except Exception as exc:
        logger.warning("Feasibility scoring failed: %s", exc)
        return FeasibilityScore(
            compute_requirements=_DEFAULT_SCORE.compute_requirements,
            data_availability=_DEFAULT_SCORE.data_availability,
            expected_improvement=_DEFAULT_SCORE.expected_improvement,
            difficulty=_DEFAULT_SCORE.difficulty,
            overall=_DEFAULT_SCORE.overall,
            explanation=_DEFAULT_SCORE.explanation,
        )


async def score_plans_batch(
    plan_drafts: list[dict],
    direction: str,
    session: AsyncSession,
    user_id: str,
) -> list[FeasibilityScore]:
    """Score all plans sequentially (Haiku is cheap).

    Returns list of FeasibilityScore aligned with input plan_drafts.

    Args:
        plan_drafts: List of plan dicts to score.
        direction: Research direction for context.
        session: DB session for LLM cost tracking.
        user_id: User ID for cost tracking.

    Returns:
        List of FeasibilityScore, one per input plan.
    """
    scores: list[FeasibilityScore] = []
    for draft in plan_drafts:
        score = await score_feasibility(draft, direction, session, user_id)
        scores = [*scores, score]
    return scores
