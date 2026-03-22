"""AutoResearch executor — real code execution with git versioning.

Reference: Karpathy's autoresearch (train.py → subprocess → metrics → git keep/discard)

Each run gets an isolated git workspace. The LLM proposes code changes,
the executor writes them, runs via subprocess with a time budget, extracts
metrics from stdout, and the caller decides keep (advance) or discard (reset).
"""

import asyncio
import csv
import io
import logging
import os
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.services.workspace_service import (
    _run_git,
    _workspace_path,
    init_workspace,
    write_and_commit,
    read_file,
    list_files,
    get_log,
)

logger = logging.getLogger(__name__)

# Maximum time budget for a single subprocess run (seconds)
DEFAULT_TIMEOUT = 300  # 5 minutes, same as Karpathy's default
MAX_TIMEOUT = 1800  # 30 minutes hard cap


@dataclass(frozen=True)
class RunMetrics:
    """Metrics extracted from a subprocess run."""

    exit_code: int
    duration_seconds: float
    stdout: str
    stderr: str
    metrics: dict[str, float] = field(default_factory=dict)
    error: str | None = None


@dataclass(frozen=True)
class IterationResult:
    """Result of a single autoresearch iteration."""

    iteration: int
    commit_sha: str
    run_metrics: RunMetrics
    kept: bool | None = None  # None = pending decision


def _extract_metrics_from_stdout(stdout: str) -> dict[str, float]:
    """Extract key=value metric pairs from subprocess stdout.

    Looks for lines matching patterns like:
      val_bpb: 1.234
      accuracy=0.95
      F1 score: 0.87
      loss: 0.345

    Also parses Karpathy-style final results block.
    """
    metrics: dict[str, float] = {}

    # Pattern 1: "key: value" or "key = value" or "key=value"
    pattern = re.compile(
        r"^[\s]*([a-zA-Z_][\w./]*)\s*[:=]\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s*$",
        re.MULTILINE,
    )
    for match in pattern.finditer(stdout):
        key = match.group(1).strip().lower().replace(" ", "_")
        try:
            metrics[key] = float(match.group(2))
        except ValueError:
            continue

    # Pattern 2: "metric_name value" on last N lines (common in training scripts)
    last_lines = stdout.strip().split("\n")[-20:]
    for line in last_lines:
        parts = line.strip().split()
        if len(parts) == 2:
            try:
                metrics[parts[0].lower()] = float(parts[1])
            except ValueError:
                continue

    return metrics


async def init_run(
    run_id: str,
    base_code: str | None = None,
    prepare_code: str | None = None,
    requirements: str | None = None,
) -> Path:
    """Initialize a new autoresearch run workspace.

    Creates a git repo with optional initial files:
    - train.py: The main modifiable training script
    - prepare.py: Read-only data pipeline (if provided)
    - requirements.txt: Python dependencies (if provided)
    - results.tsv: Empty results log
    """
    workspace = await init_workspace(run_id)

    # Write initial train.py if provided
    if base_code:
        await write_and_commit(
            run_id, "train.py", base_code, "Initial train.py"
        )

    # Write prepare.py (read-only data pipeline)
    if prepare_code:
        await write_and_commit(
            run_id, "prepare.py", prepare_code, "Add prepare.py"
        )

    # Write requirements.txt
    if requirements:
        await write_and_commit(
            run_id, "requirements.txt", requirements, "Add requirements.txt"
        )

    # Initialize results.tsv header
    header = "iteration\tcommit\taction\tduration_s\texit_code"
    await write_and_commit(
        run_id, "results.tsv", header + "\n", "Initialize results.tsv"
    )

    logger.info("AutoResearch run initialized: %s", run_id)
    return workspace


async def write_code(
    run_id: str,
    path: str,
    content: str,
    message: str | None = None,
) -> str:
    """Write a code file and commit. Returns the commit SHA.

    This is the "LLM modifies code" step — the code is written and committed
    before execution so we can git reset if the run fails.
    """
    commit_msg = message or f"Iteration update: {path}"
    sha = await write_and_commit(run_id, path, content, commit_msg)
    logger.info("Code written and committed: %s @ %s", path, sha[:8])
    return sha


async def execute(
    run_id: str,
    command: str = "python train.py",
    timeout_seconds: int = DEFAULT_TIMEOUT,
    env_vars: dict[str, str] | None = None,
) -> RunMetrics:
    """Execute a command in the workspace via subprocess.

    Runs with a time budget. Captures stdout/stderr and extracts metrics.
    This is the core "real execution" step.
    """
    timeout_seconds = min(timeout_seconds, MAX_TIMEOUT)
    workspace = _workspace_path(run_id)

    # Build environment
    env = {**os.environ}
    if env_vars:
        env.update(env_vars)

    # Ensure Python can find local modules
    env["PYTHONPATH"] = str(workspace)
    # Unbuffered output for real-time metric extraction
    env["PYTHONUNBUFFERED"] = "1"

    logger.info(
        "Executing: %s (timeout=%ds) in %s", command, timeout_seconds, workspace
    )

    start_time = time.monotonic()

    try:
        process = await asyncio.create_subprocess_shell(
            command,
            cwd=str(workspace),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )

        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                process.communicate(), timeout=timeout_seconds
            )
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            duration = time.monotonic() - start_time
            return RunMetrics(
                exit_code=-1,
                duration_seconds=round(duration, 2),
                stdout="",
                stderr="",
                metrics={},
                error=f"Timeout after {timeout_seconds}s",
            )

        duration = time.monotonic() - start_time
        stdout_str = stdout_bytes.decode("utf-8", errors="replace")
        stderr_str = stderr_bytes.decode("utf-8", errors="replace")

        # Truncate very long outputs (keep last 50KB)
        max_output = 50_000
        if len(stdout_str) > max_output:
            stdout_str = f"... (truncated) ...\n{stdout_str[-max_output:]}"
        if len(stderr_str) > max_output:
            stderr_str = f"... (truncated) ...\n{stderr_str[-max_output:]}"

        metrics = _extract_metrics_from_stdout(stdout_str)

        return RunMetrics(
            exit_code=process.returncode or 0,
            duration_seconds=round(duration, 2),
            stdout=stdout_str,
            stderr=stderr_str,
            metrics=metrics,
            error=None if process.returncode == 0 else f"Exit code: {process.returncode}",
        )

    except Exception as exc:
        duration = time.monotonic() - start_time
        logger.error("Execution failed: %s", exc)
        return RunMetrics(
            exit_code=-2,
            duration_seconds=round(duration, 2),
            stdout="",
            stderr="",
            metrics={},
            error=str(exc),
        )


async def keep_or_discard(run_id: str, keep: bool) -> str:
    """Keep the current commit or discard it (git reset --hard HEAD~1).

    Returns the resulting HEAD SHA.
    """
    workspace = _workspace_path(run_id)

    if keep:
        sha = await _run_git(workspace, "rev-parse", "HEAD")
        logger.info("Keeping commit: %s", sha[:8])
        return sha

    # Discard: reset to previous commit
    await _run_git(workspace, "reset", "--hard", "HEAD~1")
    sha = await _run_git(workspace, "rev-parse", "HEAD")
    logger.info("Discarded last commit, HEAD now: %s", sha[:8])
    return sha


async def append_result(
    run_id: str,
    iteration: int,
    commit_sha: str,
    action: str,
    duration: float,
    exit_code: int,
    extra_metrics: dict[str, float] | None = None,
) -> None:
    """Append an iteration result to results.tsv."""
    workspace = _workspace_path(run_id)
    results_path = workspace / "results.tsv"

    # Build row
    row = f"{iteration}\t{commit_sha[:8]}\t{action}\t{duration:.1f}\t{exit_code}"
    if extra_metrics:
        for key, value in sorted(extra_metrics.items()):
            row += f"\t{key}={value}"

    # Append (don't commit every row — batch later)
    with open(results_path, "a", encoding="utf-8") as f:
        f.write(row + "\n")


async def get_results(run_id: str) -> list[dict[str, Any]]:
    """Read results.tsv and return as list of dicts."""
    try:
        content = await read_file(run_id, "results.tsv")
    except FileNotFoundError:
        return []

    rows: list[dict[str, Any]] = []
    reader = csv.DictReader(io.StringIO(content), delimiter="\t")
    for row in reader:
        rows.append(dict(row))
    return rows


async def get_current_code(run_id: str, path: str = "train.py") -> str | None:
    """Read the current version of a code file, or None if not found."""
    try:
        return await read_file(run_id, path)
    except FileNotFoundError:
        return None


async def get_run_status(run_id: str) -> dict[str, Any]:
    """Get the current status of an autoresearch run."""
    workspace = _workspace_path(run_id)
    exists = (workspace / ".git").exists()

    if not exists:
        return {"exists": False, "run_id": run_id}

    files = await list_files(run_id)
    log = await get_log(run_id, limit=5)
    results = await get_results(run_id)

    return {
        "exists": True,
        "run_id": run_id,
        "files": [f["path"] for f in files],
        "recent_commits": log[:5],
        "total_iterations": len(results),
        "results": results[-10:],  # Last 10 results
    }


async def install_dependencies(run_id: str) -> RunMetrics:
    """Install Python dependencies from requirements.txt if it exists."""
    workspace = _workspace_path(run_id)
    req_path = workspace / "requirements.txt"

    if not req_path.exists():
        return RunMetrics(
            exit_code=0,
            duration_seconds=0,
            stdout="No requirements.txt found",
            stderr="",
            metrics={},
        )

    return await execute(
        run_id,
        command="pip install -r requirements.txt --quiet",
        timeout_seconds=120,
    )
