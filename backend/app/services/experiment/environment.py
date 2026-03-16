"""Experiment workspace setup and teardown orchestration.

Creates isolated experiment directories, writes code skeletons,
initializes git repos, and runs baseline reproduction.

Reference: 08-RESEARCH.md workspace isolation recommendation.
"""

import asyncio
import json
import logging
import shutil
from pathlib import Path

import httpx

from app.services.experiment.docker_runner import DockerRunner
from app.services.experiment.git_manager import GitManager
from app.services.experiment.metrics import parse_training_output

logger = logging.getLogger(__name__)

# Base directory for all experiment workspaces
EXPERIMENTS_BASE = Path.home() / ".studyhub" / "experiments"


async def setup_workspace(
    plan: object,
    run_id: str,
    gpu_device: int = 0,
) -> Path:
    """Set up isolated experiment workspace.

    Steps:
    1. Create directory: ~/.studyhub/experiments/{plan_id}/{run_id}/
    2. Write code_skeleton as train.py
    3. Write plan metadata as plan.json
    4. Write requirements.txt if datasets need downloading
    5. Initialize git repo with GitManager
    6. Create branch: experiment/{run_id}
    7. Initial commit: "setup: experiment workspace from plan {plan.title}"

    Returns workspace path.
    """
    plan_id = getattr(plan, "id", "unknown")
    title = getattr(plan, "title", "untitled")
    code_skeleton = getattr(plan, "code_skeleton", None)
    datasets = getattr(plan, "datasets", [])
    baselines = getattr(plan, "baselines", [])
    metrics = getattr(plan, "metrics", [])
    hypothesis = getattr(plan, "hypothesis", "")
    method_description = getattr(plan, "method_description", "")

    workspace = EXPERIMENTS_BASE / plan_id / run_id
    await asyncio.to_thread(workspace.mkdir, parents=True, exist_ok=True)

    # Write code skeleton as train.py
    train_path = workspace / "train.py"
    if code_skeleton:
        await asyncio.to_thread(
            train_path.write_text, code_skeleton, "utf-8"
        )
    else:
        # Default placeholder
        default_code = (
            "# Train script placeholder\n"
            "# Replace with actual training code\n"
            "print('val_loss: 1.0')\n"
        )
        await asyncio.to_thread(
            train_path.write_text, default_code, "utf-8"
        )

    # Write plan metadata
    plan_meta = {
        "plan_id": plan_id,
        "run_id": run_id,
        "title": title,
        "hypothesis": hypothesis,
        "method_description": method_description,
        "baselines": baselines if isinstance(baselines, list) else [],
        "metrics": metrics if isinstance(metrics, list) else [],
        "datasets": datasets if isinstance(datasets, list) else [],
    }
    plan_json_path = workspace / "plan.json"
    await asyncio.to_thread(
        plan_json_path.write_text,
        json.dumps(plan_meta, indent=2, ensure_ascii=False),
        "utf-8",
    )

    # Write requirements.txt for dataset-specific dependencies
    if datasets and isinstance(datasets, list):
        reqs = ["requests>=2.31.0", "tqdm>=4.66.0"]
        reqs_path = workspace / "requirements.txt"
        await asyncio.to_thread(
            reqs_path.write_text, "\n".join(reqs) + "\n", "utf-8"
        )

    # Initialize git repo
    git = GitManager(workspace)
    await asyncio.to_thread(git.init_repo)
    await asyncio.to_thread(git.create_branch, f"experiment/{run_id}")
    await asyncio.to_thread(
        git.commit,
        f"setup: experiment workspace from plan {title}",
    )

    logger.info("Set up experiment workspace at %s", workspace)
    return workspace


async def setup_baseline(
    workspace: Path,
    runner: DockerRunner,
    git: GitManager,
) -> dict | None:
    """Run baseline training and record results (EXPR-03).

    Steps:
    1. Run training via DockerRunner (runs code_skeleton as-is)
    2. Parse output metrics
    3. If metrics found: commit as "baseline: {metric_name}={metric_value}"
    4. If no metrics (crash): return None
    """
    log_text, exit_code = await runner.run_training()

    if exit_code != 0:
        logger.warning("Baseline training failed with exit code %d", exit_code)

    metrics = parse_training_output(log_text)

    if metrics is None:
        logger.warning("No metrics found in baseline output")
        return None

    # Find primary metric (first recognized metric)
    primary_name = next(iter(metrics))
    primary_value = metrics[primary_name]

    # Commit baseline results
    commit_msg = f"baseline: {primary_name}={primary_value:.6f}"
    await asyncio.to_thread(git.commit, commit_msg)

    logger.info("Baseline established: %s", commit_msg)
    return {
        "metrics": metrics,
        "primary_name": primary_name,
        "primary_value": primary_value,
        "log_text": log_text,
        "exit_code": exit_code,
    }


async def teardown_workspace(workspace: Path) -> None:
    """Clean up workspace directory.

    Removes the workspace directory and its contents.
    Note: In production, archive results.tsv and .git to
    SeaweedFS before removal.
    """
    if workspace.exists():
        await asyncio.to_thread(shutil.rmtree, workspace, ignore_errors=True)
        logger.info("Removed workspace %s", workspace)


async def download_datasets(
    workspace: Path,
    datasets: list[dict],
) -> list[str]:
    """Download datasets to workspace/data/.

    Returns list of downloaded paths. Non-fatal: logs warning
    on failure, continues.
    """
    data_dir = workspace / "data"
    await asyncio.to_thread(data_dir.mkdir, parents=True, exist_ok=True)

    downloaded: list[str] = []

    async with httpx.AsyncClient(timeout=300.0, follow_redirects=True) as client:
        for dataset in datasets:
            url = dataset.get("url", "")
            name = dataset.get("name", "unknown")

            if not url:
                continue

            target = data_dir / name
            try:
                response = await client.get(url)
                response.raise_for_status()
                await asyncio.to_thread(
                    target.write_bytes, response.content
                )
                downloaded.append(str(target))
                logger.info("Downloaded dataset %s to %s", name, target)
            except Exception as exc:
                logger.warning(
                    "Failed to download dataset %s from %s: %s",
                    name,
                    url,
                    exc,
                )

    return downloaded
