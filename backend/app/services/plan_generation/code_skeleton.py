"""Code skeleton generation via Jinja2 template + LLM stubs.

Produces a Python experiment scaffold tailored to a plan's methodology,
technical roadmap, and evaluation strategy. LLM generates method-specific
function stubs; Jinja2 template provides the structural scaffold.

Falls back to template-only rendering when LLM call fails.

Reference: AI-Scientist perform_experiments.py for plan consumption pattern.
"""

import json
import logging
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.llm_service import llm_completion

logger = logging.getLogger(__name__)

# Template directory (same pattern as report_generator.py)
_TEMPLATE_DIR = Path(__file__).resolve().parents[3] / "templates"


# ─── Pure Functions ────────────────────────────────────────────────────────


def _build_skeleton_prompt(plan: dict) -> list[dict]:
    """Build prompt asking LLM to generate specific function implementations.

    Not generic PyTorch boilerplate -- specific to the proposed method changes.

    Args:
        plan: Dict with hypothesis, method_description, baselines,
              technical_roadmap, metrics, datasets.

    Returns:
        OpenAI-format message list for llm_completion.
    """
    roadmap_text = ""
    for step in plan.get("technical_roadmap", []):
        roadmap_text = (
            f"{roadmap_text}\n  Step {step.get('step', '?')}: "
            f"{step.get('description', '')}"
        )

    baselines_text = ", ".join(
        bl.get("name", "?") for bl in plan.get("baselines", [])
    )
    metrics_text = ", ".join(plan.get("metrics", []))
    datasets_text = ", ".join(
        ds.get("name", "?") for ds in plan.get("datasets", [])
    )

    system = (
        "You are a research engineer writing Python function stubs for an "
        "experiment. Write specific, method-aware implementations -- not "
        "generic boilerplate. Include docstrings, type hints, and inline "
        "comments explaining the algorithmic approach. The code should be "
        "directly usable as a starting point for the experiment."
    )
    user = (
        f"Hypothesis: {plan.get('hypothesis', 'N/A')}\n\n"
        f"Method description: {plan.get('method_description', 'N/A')}\n\n"
        f"Technical roadmap:{roadmap_text}\n\n"
        f"Baselines: {baselines_text}\n"
        f"Metrics: {metrics_text}\n"
        f"Datasets: {datasets_text}\n\n"
        "Generate Python function stubs that implement the key novel parts "
        "of this method. For each technical roadmap step, write a function "
        "with:\n"
        "- A clear docstring explaining what this step does specifically\n"
        "- Type-annotated parameters\n"
        "- Inline comments describing the algorithmic approach\n"
        "- Placeholder logic (can use `raise NotImplementedError` for "
        "complex parts, but include the algorithmic sketch)\n\n"
        "Focus on the NOVEL parts of the method -- what makes this "
        "experiment different from baselines. Do not include imports, "
        "training loops, or evaluation code (those are in the template). "
        "Return ONLY Python code, no markdown fences or explanation."
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _render_template(plan: dict, llm_stubs: str) -> str:
    """Render the Jinja2 code skeleton template with plan data.

    Args:
        plan: Dict with title, hypothesis, metrics, datasets, baselines,
              technical_roadmap fields.
        llm_stubs: LLM-generated function stubs (empty string if unavailable).

    Returns:
        Rendered Python code skeleton as string.
    """
    env = Environment(
        loader=FileSystemLoader(str(_TEMPLATE_DIR)),
        keep_trailing_newline=True,
    )
    template = env.get_template("code_skeleton.py.j2")

    context = {
        "title": plan.get("title", "Untitled Experiment"),
        "hypothesis": plan.get("hypothesis", ""),
        "metrics": plan.get("metrics", []),
        "datasets": plan.get("datasets", []),
        "baselines": plan.get("baselines", []),
        "technical_roadmap": plan.get("technical_roadmap", []),
        "llm_stubs": llm_stubs.strip() if llm_stubs else "",
    }

    return template.render(**context)


# ─── Main Entry Point ─────────────────────────────────────────────────────


async def generate_code_skeleton(
    plan_draft: dict,
    session: AsyncSession,
    user_id: str,
) -> str:
    """Generate a code skeleton for an experiment plan.

    Step 1: Use LLM to generate method-specific function stubs.
    Step 2: Render Jinja2 template with plan fields + LLM stubs.
    Step 3: Return combined code skeleton as a string.

    Falls back to template-only rendering on LLM failure.

    Args:
        plan_draft: Dict containing plan fields (title, hypothesis,
                    method_description, baselines, metrics, datasets,
                    technical_roadmap).
        session: Database session for LLM usage tracking.
        user_id: User ID for LLM usage tracking.

    Returns:
        Python code skeleton as a string.
    """
    # Step 1: Generate LLM-specific stubs
    llm_stubs = ""
    try:
        messages = _build_skeleton_prompt(plan_draft)
        response = await llm_completion(
            session=session,
            user_id=user_id,
            messages=messages,
            model=None,  # Sonnet for quality
            max_tokens=4096,
            request_type="plan_code_skeleton",
        )
        # Strip any accidental markdown fences from LLM output
        content = response.content.strip()
        if content.startswith("```"):
            # Remove opening fence
            first_newline = content.index("\n")
            content = content[first_newline + 1 :]
        if content.endswith("```"):
            content = content[:-3].rstrip()
        llm_stubs = content

    except Exception as exc:
        logger.warning(
            "LLM code skeleton generation failed, using template-only: %s",
            exc,
        )

    # Step 2 & 3: Render template with plan data + LLM stubs
    return _render_template(plan_draft, llm_stubs)
