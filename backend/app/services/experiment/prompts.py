"""LLM prompt builders for the experiment loop.

Constructs chat messages for code analysis, modification,
fix attempts, and user-guided changes.

Reference: autoresearch program.md + AI-Scientist perform_experiments.py.
"""

ANALYSIS_SYSTEM = (
    "You are an ML experiment assistant. Analyze the current training code "
    "and experiment results. Propose ONE specific code modification to improve "
    "the target metric. Be concrete -- specify exact changes (function names, "
    "hyperparameters, architecture modifications). Respond with a brief "
    "description of the change (2-4 sentences)."
)

CODE_MODIFICATION_SYSTEM = (
    "You are a code modification assistant. Apply the proposed change to the "
    "training script. Return ONLY the complete modified Python file. "
    "Do not include explanations, markdown fences, or any text before or "
    "after the code. The code must be syntactically valid and self-contained."
)

FIX_SYSTEM_TEMPLATE = (
    "The training script crashed. Fix the error. Return ONLY the complete "
    "fixed Python file. Do not include explanations, markdown fences, or "
    "any text before or after the code. This is fix attempt {attempt} of {max_attempts}."
)

GUIDANCE_SYSTEM = (
    "You are an ML experiment assistant. The user has provided specific "
    "guidance for the next experiment iteration. Follow their direction "
    "precisely while proposing a concrete code modification. Respond with "
    "a brief description of the change (2-4 sentences)."
)


def _detect_chinese(text: str) -> bool:
    """Check if text contains Chinese characters."""
    return any("\u4e00" <= ch <= "\u9fff" for ch in text)


def _format_results_history(results: list[dict], max_entries: int = 5) -> str:
    """Format recent results for inclusion in prompts."""
    recent = results[-max_entries:] if len(results) > max_entries else results
    if not recent:
        return "No previous results."

    lines = []
    for r in recent:
        status = r.get("status", "unknown")
        metric = r.get("metric_value", "N/A")
        desc = r.get("description", "")
        lines.append(f"  Round {r.get('round', '?')}: {status} | metric={metric} | {desc}")

    return "\n".join(lines)


def build_analysis_prompt(
    current_code: str,
    results_history: list[dict],
    plan_context: dict,
) -> list[dict]:
    """Build analysis prompt for LLM to propose an improvement.

    Returns messages list for LLM API.
    """
    hypothesis = plan_context.get("hypothesis", "")
    method = plan_context.get("method_description", "")
    baseline = plan_context.get("baseline_metric", "N/A")
    best = plan_context.get("best_metric", "N/A")

    # Use Chinese system prompt if plan context is Chinese
    lang_hint = ""
    if _detect_chinese(hypothesis) or _detect_chinese(method):
        lang_hint = " Respond in Chinese if the plan context is in Chinese."

    user_content = (
        f"## Current Training Code\n\n```python\n{current_code}\n```\n\n"
        f"## Experiment Context\n"
        f"- Hypothesis: {hypothesis}\n"
        f"- Method: {method}\n"
        f"- Baseline metric: {baseline}\n"
        f"- Best metric so far: {best}\n\n"
        f"## Recent Results\n{_format_results_history(results_history)}\n\n"
        f"Propose ONE specific code modification to improve the target metric."
    )

    return [
        {"role": "system", "content": ANALYSIS_SYSTEM + lang_hint},
        {"role": "user", "content": user_content},
    ]


def build_code_modification_prompt(
    current_code: str,
    proposed_change: str,
    plan_context: dict,
) -> list[dict]:
    """Build prompt for LLM to apply a proposed code change.

    Returns messages list for LLM API.
    """
    hypothesis = plan_context.get("hypothesis", "")

    user_content = (
        f"## Current Code\n\n```python\n{current_code}\n```\n\n"
        f"## Proposed Change\n{proposed_change}\n\n"
        f"## Context\nHypothesis: {hypothesis}\n\n"
        f"Apply this change and return the complete modified Python file."
    )

    return [
        {"role": "system", "content": CODE_MODIFICATION_SYSTEM},
        {"role": "user", "content": user_content},
    ]


def build_fix_prompt(
    current_code: str,
    error_log: str,
    attempt: int,
    max_attempts: int = 3,
) -> list[dict]:
    """Build prompt for LLM to fix a crashed training script.

    Returns messages list for LLM API.
    """
    # Truncate error log to last 100 lines
    error_lines = error_log.strip().splitlines()
    if len(error_lines) > 100:
        error_lines = error_lines[-100:]
    truncated_error = "\n".join(error_lines)

    system = FIX_SYSTEM_TEMPLATE.format(attempt=attempt, max_attempts=max_attempts)

    user_content = (
        f"## Current Code\n\n```python\n{current_code}\n```\n\n"
        f"## Error Output\n```\n{truncated_error}\n```\n\n"
        f"Fix the error and return the complete fixed Python file."
    )

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user_content},
    ]


def build_guidance_prompt(
    current_code: str,
    user_guidance: str,
    results_history: list[dict],
) -> list[dict]:
    """Build prompt using user's specific guidance for the next iteration.

    Like build_analysis_prompt but replaces LLM's own analysis with
    user's specific direction (EXPR-07).
    """
    user_content = (
        f"## Current Training Code\n\n```python\n{current_code}\n```\n\n"
        f"## User Guidance\n{user_guidance}\n\n"
        f"## Recent Results\n{_format_results_history(results_history)}\n\n"
        f"Follow the user's guidance and propose a specific code modification."
    )

    return [
        {"role": "system", "content": GUIDANCE_SYSTEM},
        {"role": "user", "content": user_content},
    ]
