"""LLM-powered experiment plan generator with AI-Scientist reflection pattern.

Generates experiment plans through multi-round generate-reflect-refine cycles.
Each plan is produced independently and refined through N reflection rounds
until the reviewer signals "I am done" or rounds are exhausted.

Reference: AI-Scientist generate_ideas.py reflection loop.
"""

import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.plan import (
    ImprovementOpportunity,
    PlanGenerationContext,
    SOTAResult,
)
from app.services.llm_service import llm_completion
from app.services.plan_generation.prompts import (
    build_plan_generation_prompt,
    build_reflection_prompt,
)

logger = logging.getLogger(__name__)


# ─── Formatting Helpers (Pure Functions) ─────────────────────────────────


def _format_sota_summary(sota: SOTAResult | None) -> str:
    """Format SOTAResult into readable text for prompts."""
    if sota is None:
        return "No SOTA data available"

    lines: list[str] = []
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


def _format_gaps_summary(gaps: list[dict]) -> str:
    """Format gap list into readable text for prompts."""
    if not gaps:
        return "No gaps identified"

    lines: list[str] = []
    for i, gap in enumerate(gaps):
        desc = gap.get("description", "")
        impact = gap.get("potential_impact", "unknown")
        lines.append(f"  {i}. {desc} (impact: {impact})")
    return "\n".join(lines)


def _format_improvements_summary(
    improvements: list[ImprovementOpportunity],
) -> str:
    """Format improvement opportunities into readable text for prompts."""
    if not improvements:
        return "No improvement opportunities identified"

    lines: list[str] = []
    for i, imp in enumerate(improvements):
        lines.append(
            f"  {i}. [{imp.improvement_type}] {imp.gap_description}\n"
            f"     Approach: {imp.suggested_approach}\n"
            f"     Difficulty: {imp.estimated_difficulty}/5"
        )
    return "\n".join(lines)


def _format_entry_context(context: PlanGenerationContext) -> str:
    """Return extra context based on focus_paper or focus_gap if present."""
    if context.focus_paper:
        paper = context.focus_paper
        return (
            f"Focus paper: {paper.get('tldr_en', 'N/A')}\n"
            f"Methods: {', '.join(paper.get('methods', []))}\n"
            f"Limitations: {', '.join(paper.get('limitations', []))}"
        )
    if context.focus_gap:
        gap = context.focus_gap
        return (
            f"Focus gap: {gap.get('description', 'N/A')}\n"
            f"Evidence: {gap.get('evidence', 'N/A')}\n"
            f"Potential impact: {gap.get('potential_impact', 'N/A')}"
        )
    return f"Broad direction exploration: {context.direction}"


def _parse_plan_json(text: str) -> dict | None:
    """Extract and parse JSON from LLM response text.

    Handles cases where the response contains markdown code fences
    or extra text before/after the JSON.
    """
    content = text.strip()

    # Strip markdown code fences if present
    if content.startswith("```"):
        # Remove opening fence (possibly ```json)
        first_newline = content.index("\n") if "\n" in content else len(content)
        content = content[first_newline + 1 :]
        # Remove closing fence
        if content.rstrip().endswith("```"):
            content = content.rstrip()[:-3].rstrip()

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # Try to find JSON object in the text
        start = content.find("{")
        end = content.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(content[start : end + 1])
            except json.JSONDecodeError:
                pass
    return None


# ─── Main Entry Point ───────────────────────────────────────────────────


async def generate_experiment_plans(
    context: PlanGenerationContext,
    session: AsyncSession,
    user_id: str,
    num_plans: int = 3,
    num_reflections: int = 3,
) -> list[dict]:
    """Generate experiment plans with AI-Scientist-style reflection.

    For each plan:
    1. Build initial prompt from context (SOTA, gaps, improvements).
    2. Call LLM to generate initial plan draft.
    3. Run reflection loop (2 to num_reflections rounds).
       - If reflector returns "I am done", break early.
       - Otherwise, parse updated draft and continue.
    4. Append final draft to results.

    Plans are generated sequentially for cost control in v1.

    Args:
        context: Assembled plan generation context.
        session: DB session for LLM cost tracking.
        user_id: User ID for cost tracking.
        num_plans: Number of plans to generate (1-5).
        num_reflections: Maximum reflection rounds per plan.

    Returns:
        List of plan draft dicts. May be shorter than num_plans
        if some plans fail to generate.
    """
    sota_summary = _format_sota_summary(context.sota)
    gaps_summary = _format_gaps_summary(context.gaps)
    improvements_summary = _format_improvements_summary(context.improvements)
    entry_context = _format_entry_context(context)

    results: list[dict] = []

    for plan_idx in range(num_plans):
        try:
            draft = await _generate_single_plan(
                direction=context.direction,
                sota_summary=sota_summary,
                gaps_summary=gaps_summary,
                improvements_summary=improvements_summary,
                entry_context=entry_context,
                session=session,
                user_id=user_id,
                num_reflections=num_reflections,
                plan_idx=plan_idx,
            )
            if draft is not None:
                results = [*results, draft]
        except Exception as exc:
            logger.warning(
                "Plan %d/%d generation failed: %s", plan_idx + 1, num_plans, exc
            )
            continue

    logger.info(
        "Generated %d/%d experiment plans for direction: %s",
        len(results),
        num_plans,
        context.direction[:60],
    )
    return results


async def _generate_single_plan(
    direction: str,
    sota_summary: str,
    gaps_summary: str,
    improvements_summary: str,
    entry_context: str,
    session: AsyncSession,
    user_id: str,
    num_reflections: int,
    plan_idx: int,
) -> dict | None:
    """Generate a single plan with reflection rounds.

    Returns the final plan draft dict, or None if generation fails.
    """
    # Step 1: Initial generation
    messages = build_plan_generation_prompt(
        direction=direction,
        sota_summary=sota_summary,
        gaps_summary=gaps_summary,
        improvements_summary=improvements_summary,
        entry_context=entry_context,
    )

    response = await llm_completion(
        session=session,
        user_id=user_id,
        messages=messages,
        model=None,  # Sonnet for quality
        max_tokens=4096,
        request_type="plan_generation",
    )

    draft = _parse_plan_json(response.content)
    if draft is None:
        logger.warning("Plan %d: failed to parse initial generation", plan_idx + 1)
        return None

    # Step 2: Reflection loop (rounds 2..num_reflections)
    for round_num in range(2, num_reflections + 1):
        draft_json = json.dumps(draft, ensure_ascii=False, indent=2)
        reflection_messages = build_reflection_prompt(
            plan_draft_json=draft_json,
            round_num=round_num,
            total_rounds=num_reflections,
        )

        reflection_response = await llm_completion(
            session=session,
            user_id=user_id,
            messages=reflection_messages,
            model=None,  # Sonnet for quality reflection
            max_tokens=4096,
            request_type="plan_reflection",
        )

        text = reflection_response.content

        # Check for early termination (AI-Scientist pattern)
        if "I am done" in text:
            logger.info(
                "Plan %d: reflection done at round %d/%d",
                plan_idx + 1,
                round_num,
                num_reflections,
            )
            # Parse the repeated JSON after "I am done"
            updated = _parse_plan_json(text)
            if updated is not None:
                draft = updated
            break

        # Parse updated draft
        updated = _parse_plan_json(text)
        if updated is not None:
            draft = updated
        else:
            logger.warning(
                "Plan %d: failed to parse reflection round %d, keeping previous draft",
                plan_idx + 1,
                round_num,
            )

    return draft
