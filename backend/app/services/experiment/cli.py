"""CLI entry point for experiment loop execution.

Bridges the Tauri subprocess model with the async Python experiment loop.
Reads stdin for control signals, prints JSON status to stdout.

Usage:
    python -m app.services.experiment.cli \\
        --plan-id <id> --run-id <id> --gpu 0 --max-rounds 20
"""

import argparse
import asyncio
import json
import sys
import threading
from pathlib import Path

from app.services.experiment.docker_runner import DockerRunner
from app.services.experiment.environment import (
    EXPERIMENTS_BASE,
    setup_baseline,
    setup_workspace,
)
from app.services.experiment.git_manager import GitManager
from app.services.experiment.loop_agent import (
    ControlSignal,
    ExperimentConfig,
    run_experiment_loop,
)


def _emit(event_type: str, data: object) -> None:
    """Print one JSON event line to stdout."""
    line = json.dumps({"type": event_type, "data": data}, ensure_ascii=False)
    print(line, flush=True)


def _read_stdin_signals(queue: asyncio.Queue, loop: asyncio.AbstractEventLoop) -> None:
    """Read control signals from stdin in a background thread.

    Protocol:
    - "pause" -> ControlSignal.PAUSE
    - "resume" -> ControlSignal.RESUME
    - "skip" -> ControlSignal.SKIP
    - "cancel" -> ControlSignal.CANCEL
    - "guide:<text>" -> (ControlSignal.GUIDE, text)
    """
    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue

            if line == "pause":
                loop.call_soon_threadsafe(queue.put_nowait, ControlSignal.PAUSE)
            elif line == "resume":
                loop.call_soon_threadsafe(queue.put_nowait, ControlSignal.RESUME)
            elif line == "skip":
                loop.call_soon_threadsafe(queue.put_nowait, ControlSignal.SKIP)
            elif line == "cancel":
                loop.call_soon_threadsafe(queue.put_nowait, ControlSignal.CANCEL)
            elif line.startswith("guide:"):
                guidance = line[6:]
                loop.call_soon_threadsafe(
                    queue.put_nowait, (ControlSignal.GUIDE, guidance)
                )
    except Exception:
        pass


async def _on_iteration(round_num: int, result: dict) -> None:
    """Callback for each experiment iteration."""
    _emit("iteration", {
        "round": round_num,
        "status": result.get("status"),
        "metric_value": result.get("metric_value"),
        "description": result.get("description", ""),
        "git_sha": result.get("git_sha"),
        "duration_seconds": result.get("duration_seconds"),
    })


async def run(args: argparse.Namespace) -> None:
    """Main async entry point."""
    _emit("status", "setting_up")

    # Load plan from database
    from app.database import get_db_session
    from app.models.experiment_plan import ExperimentPlan
    from sqlalchemy import select

    plan = None
    async for session in get_db_session():
        result = await session.execute(
            select(ExperimentPlan).where(ExperimentPlan.id == args.plan_id)
        )
        plan = result.scalar_one_or_none()
        break

    if plan is None:
        _emit("error", f"Plan {args.plan_id} not found")
        _emit("status", "failed")
        return

    # Setup workspace
    workspace = await setup_workspace(plan, args.run_id, args.gpu)
    _emit("status", "baseline")

    # Create services
    git = GitManager(workspace)
    runner = DockerRunner(
        workspace=workspace,
        gpu_device=args.gpu,
        run_id=args.run_id,
    )

    # Run baseline
    baseline = await setup_baseline(workspace, runner, git)
    if baseline is None:
        _emit("error", "Baseline failed - no metrics extracted")
        _emit("status", "failed")
        return

    _emit("iteration", {
        "round": 0,
        "status": "baseline",
        "metric_value": baseline["primary_value"],
        "description": f"Baseline: {baseline['primary_name']}={baseline['primary_value']:.6f}",
        "git_sha": None,
        "duration_seconds": None,
    })

    # Create config
    config = ExperimentConfig(
        plan_id=args.plan_id,
        run_id=args.run_id,
        workspace=workspace,
        gpu_device=args.gpu,
        max_rounds=args.max_rounds,
        consecutive_no_improve_limit=args.no_improve_limit,
        time_budget_minutes=args.time_budget,
        primary_metric=baseline["primary_name"],
    )

    # Setup control queue and stdin reader
    control_queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_event_loop()
    stdin_thread = threading.Thread(
        target=_read_stdin_signals,
        args=(control_queue, loop),
        daemon=True,
    )
    stdin_thread.start()

    # Run experiment loop
    _emit("status", "running")
    results = await run_experiment_loop(
        config=config,
        runner=runner,
        git=git,
        control_queue=control_queue,
        on_iteration=_on_iteration,
    )

    _emit("result", results)
    _emit("status", results.get("status", "completed"))


def main() -> None:
    """Parse arguments and run."""
    parser = argparse.ArgumentParser(description="StudyHub Experiment Runner")
    parser.add_argument("--plan-id", required=True, help="Experiment plan ID")
    parser.add_argument("--run-id", required=True, help="Experiment run ID")
    parser.add_argument("--gpu", type=int, default=0, help="GPU device index")
    parser.add_argument("--max-rounds", type=int, default=20, help="Maximum rounds")
    parser.add_argument("--no-improve-limit", type=int, default=5, help="Consecutive no-improvement limit")
    parser.add_argument("--time-budget", type=int, default=None, help="Time budget in minutes")
    args = parser.parse_args()

    asyncio.run(run(args))


if __name__ == "__main__":
    main()
