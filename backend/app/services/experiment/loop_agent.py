"""Autonomous experiment loop orchestrator.

Implements the core LLM-driven experiment cycle:
analyze -> modify -> train -> evaluate -> keep/discard.

Reference: autoresearch program.md + AI-Scientist perform_experiments.py.
"""

import asyncio
import logging
import re
import time
from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

from app.services.experiment.docker_runner import DockerRunner
from app.services.experiment.git_manager import GitManager
from app.services.experiment.metrics import (
    append_results_tsv,
    parse_training_output,
    read_results_tsv,
)
from app.services.experiment.prompts import (
    build_analysis_prompt,
    build_code_modification_prompt,
    build_fix_prompt,
    build_guidance_prompt,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ExperimentConfig:
    """Immutable configuration for an experiment run."""

    plan_id: str
    run_id: str
    workspace: Path
    gpu_device: int = 0
    max_rounds: int = 20
    consecutive_no_improve_limit: int = 5
    time_budget_minutes: int | None = None
    primary_metric: str = "val_loss"
    lower_is_better: bool = True
    max_fix_attempts: int = 3


class ControlSignal(Enum):
    """Control signals from Tauri UI to the experiment loop."""

    CONTINUE = "continue"
    PAUSE = "pause"
    RESUME = "resume"
    SKIP = "skip"
    CANCEL = "cancel"
    GUIDE = "guide"


def _extract_code_from_response(response_text: str) -> str:
    """Extract Python code from LLM response.

    Handles both raw code and markdown-fenced code blocks.
    """
    # Try to extract from markdown code block
    pattern = r"```(?:python)?\s*\n(.*?)\n```"
    match = re.search(pattern, response_text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # Otherwise treat entire response as code
    return response_text.strip()


def _is_improvement(
    current: float,
    best: float,
    lower_is_better: bool,
) -> bool:
    """Check if current metric improves on best."""
    if lower_is_better:
        return current < best
    return current > best


async def run_experiment_loop(
    config: ExperimentConfig,
    runner: DockerRunner,
    git: GitManager,
    control_queue: asyncio.Queue,
    on_iteration: Callable,
    user_guidance: str | None = None,
) -> dict:
    """Run the autonomous experiment loop.

    Args:
        config: Immutable experiment configuration.
        runner: DockerRunner for sandboxed training.
        git: GitManager for version control.
        control_queue: Receives ControlSignal from Tauri.
        on_iteration: Callback(round_num, result_dict) for status updates.
        user_guidance: Optional initial user guidance.

    Returns:
        Final results dict with status, rounds, metrics.
    """
    # Import LLM service lazily to avoid circular imports
    from app.database import get_db_session
    from app.services.llm_service import llm_completion

    train_path = config.workspace / "train.py"
    best_metric = None
    consecutive_no_improve = 0
    start_time = time.monotonic()
    current_guidance = user_guidance

    # Read plan context for prompts
    plan_json = config.workspace / "plan.json"
    plan_context: dict = {}
    if plan_json.exists():
        import json

        plan_context = json.loads(plan_json.read_text(encoding="utf-8"))

    for round_num in range(1, config.max_rounds + 1):
        round_start = time.monotonic()

        # ─── Check Control Signals ────────────────────────────────────
        while not control_queue.empty():
            try:
                signal_data = control_queue.get_nowait()
                if isinstance(signal_data, tuple):
                    signal, data = signal_data
                else:
                    signal = signal_data
                    data = None

                if signal == ControlSignal.CANCEL:
                    logger.info("Experiment cancelled at round %d", round_num)
                    return _build_result("cancelled", round_num - 1, best_metric, config)

                if signal == ControlSignal.SKIP:
                    logger.info("Skipping round %d", round_num)
                    continue

                if signal == ControlSignal.PAUSE:
                    logger.info("Experiment paused at round %d", round_num)
                    # Wait for resume
                    while True:
                        resume_signal = await control_queue.get()
                        if isinstance(resume_signal, tuple):
                            resume_signal = resume_signal[0]
                        if resume_signal == ControlSignal.RESUME:
                            logger.info("Experiment resumed")
                            break
                        if resume_signal == ControlSignal.CANCEL:
                            return _build_result("cancelled", round_num - 1, best_metric, config)

                if signal == ControlSignal.GUIDE:
                    current_guidance = data
                    logger.info("Received user guidance")

            except asyncio.QueueEmpty:
                break

        # ─── Clean State ──────────────────────────────────────────────
        await asyncio.to_thread(git.stash_and_clean)

        # ─── Read Current Code ────────────────────────────────────────
        current_code = await asyncio.to_thread(
            train_path.read_text, "utf-8"
        )
        results_history = read_results_tsv(config.workspace)

        # ─── LLM Analysis ────────────────────────────────────────────
        plan_context_for_prompt = {
            **plan_context,
            "baseline_metric": config.primary_metric,
            "best_metric": best_metric,
        }

        if current_guidance:
            analysis_messages = build_guidance_prompt(
                current_code, current_guidance, results_history
            )
            current_guidance = None  # Consume once
        else:
            analysis_messages = build_analysis_prompt(
                current_code, results_history, plan_context_for_prompt
            )

        # Get LLM analysis
        async for session in get_db_session():
            analysis_response = await llm_completion(
                session=session,
                user_id="system",
                messages=analysis_messages,
                request_type="experiment_analysis",
            )
            break

        proposed_change = analysis_response.content

        # ─── LLM Code Modification ───────────────────────────────────
        mod_messages = build_code_modification_prompt(
            current_code, proposed_change, plan_context_for_prompt
        )

        async for session in get_db_session():
            mod_response = await llm_completion(
                session=session,
                user_id="system",
                messages=mod_messages,
                request_type="experiment_code_mod",
            )
            break

        modified_code = _extract_code_from_response(mod_response.content)

        # ─── Write Modified Code ──────────────────────────────────────
        await asyncio.to_thread(
            train_path.write_text, modified_code, "utf-8"
        )

        # ─── Git Commit ──────────────────────────────────────────────
        description = proposed_change[:100].replace("\n", " ")
        commit_msg = f"experiment {round_num}: {description}"
        sha = await asyncio.to_thread(git.commit, commit_msg)

        # ─── Run Training ─────────────────────────────────────────────
        log_text, exit_code = await runner.run_training()

        # ─── Parse Metrics ────────────────────────────────────────────
        metrics = parse_training_output(log_text)

        # ─── Handle Crash ─────────────────────────────────────────────
        if metrics is None or exit_code != 0:
            # Try fix loop
            fixed = False
            for attempt in range(1, config.max_fix_attempts + 1):
                fix_messages = build_fix_prompt(
                    modified_code, log_text, attempt, config.max_fix_attempts
                )

                async for session in get_db_session():
                    fix_response = await llm_completion(
                        session=session,
                        user_id="system",
                        messages=fix_messages,
                        request_type="experiment_fix",
                    )
                    break

                fixed_code = _extract_code_from_response(fix_response.content)
                await asyncio.to_thread(
                    train_path.write_text, fixed_code, "utf-8"
                )
                fix_sha = await asyncio.to_thread(
                    git.commit, f"fix {round_num} attempt {attempt}"
                )

                log_text, exit_code = await runner.run_training()
                metrics = parse_training_output(log_text)

                if metrics is not None and exit_code == 0:
                    fixed = True
                    sha = fix_sha
                    modified_code = fixed_code
                    break

            if not fixed:
                # Reset and record crash
                await asyncio.to_thread(git.reset_to_previous)
                round_result = {
                    "round": round_num,
                    "status": "crash",
                    "metric_name": config.primary_metric,
                    "metric_value": None,
                    "description": f"Crash after {config.max_fix_attempts} fix attempts",
                    "git_sha": None,
                    "duration_seconds": time.monotonic() - round_start,
                }
                append_results_tsv(config.workspace, round_result)
                await on_iteration(round_num, round_result)
                consecutive_no_improve += 1

                if consecutive_no_improve >= config.consecutive_no_improve_limit:
                    return _build_result("completed", round_num, best_metric, config)
                continue

        # ─── Evaluate Metrics ─────────────────────────────────────────
        metric_value = metrics.get(config.primary_metric)
        if metric_value is None:
            # Use first available metric
            metric_value = next(iter(metrics.values()))

        if best_metric is None:
            best_metric = metric_value

        improved = _is_improvement(metric_value, best_metric, config.lower_is_better)

        if improved:
            # Keep: update best metric
            best_metric = metric_value
            consecutive_no_improve = 0
            round_status = "keep"
            logger.info(
                "Round %d: KEEP (metric=%s, improvement)",
                round_num,
                metric_value,
            )
        else:
            # Discard: reset to previous commit
            await asyncio.to_thread(git.reset_to_previous)
            consecutive_no_improve += 1
            round_status = "discard"
            logger.info(
                "Round %d: DISCARD (metric=%s, no improvement)",
                round_num,
                metric_value,
            )

        # ─── Record Results ───────────────────────────────────────────
        round_result = {
            "round": round_num,
            "status": round_status,
            "metric_name": config.primary_metric,
            "metric_value": metric_value,
            "description": description,
            "git_sha": sha if round_status == "keep" else None,
            "duration_seconds": time.monotonic() - round_start,
        }
        append_results_tsv(config.workspace, round_result)
        await on_iteration(round_num, round_result)

        # ─── Check Stopping Conditions ────────────────────────────────
        if consecutive_no_improve >= config.consecutive_no_improve_limit:
            logger.info(
                "Stopping: %d consecutive rounds without improvement",
                consecutive_no_improve,
            )
            return _build_result("completed", round_num, best_metric, config)

        if config.time_budget_minutes is not None:
            elapsed_minutes = (time.monotonic() - start_time) / 60
            if elapsed_minutes >= config.time_budget_minutes:
                logger.info("Stopping: time budget exceeded (%.1f min)", elapsed_minutes)
                return _build_result("completed", round_num, best_metric, config)

    # Max rounds reached
    return _build_result("completed", config.max_rounds, best_metric, config)


def _build_result(
    status: str,
    total_rounds: int,
    best_metric: float | None,
    config: ExperimentConfig,
) -> dict:
    """Build final results dict (immutable)."""
    results = read_results_tsv(config.workspace)
    baseline_value = None
    for r in results:
        if r.get("status") == "baseline":
            baseline_value = r.get("metric_value")
            break

    improvement = None
    if baseline_value is not None and best_metric is not None and baseline_value != 0:
        if isinstance(baseline_value, str):
            baseline_value = float(baseline_value)
        improvement = (baseline_value - best_metric) / abs(baseline_value) * 100

    return {
        "status": status,
        "total_rounds": total_rounds,
        "best_metric": best_metric,
        "baseline_metric": baseline_value,
        "improvement_over_baseline": improvement,
        "rounds": results,
    }
