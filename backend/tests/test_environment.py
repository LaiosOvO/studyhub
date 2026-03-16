"""Tests for experiment environment setup and teardown.

Covers setup_workspace, setup_baseline, teardown_workspace,
and download_datasets. External services (Docker, HTTP) are mocked.
"""

import json
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.experiment.environment import (
    download_datasets,
    setup_baseline,
    setup_workspace,
    teardown_workspace,
)


# ─── Helper: mock plan object ───────────────────────────────────────────────


def _make_plan(
    plan_id: str = "plan-001",
    title: str = "Test Plan",
    code_skeleton: str | None = None,
    datasets: list | None = None,
    hypothesis: str = "h1",
    method_description: str = "m1",
):
    plan = MagicMock()
    plan.id = plan_id
    plan.title = title
    plan.code_skeleton = code_skeleton
    plan.datasets = datasets or []
    plan.baselines = []
    plan.metrics = []
    plan.hypothesis = hypothesis
    plan.method_description = method_description
    return plan


# ─── setup_workspace ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_setup_workspace_creates_directory(tmp_path: Path):
    """Workspace directory is created with plan.json and train.py."""
    plan = _make_plan(code_skeleton="print('val_loss: 1.0')")

    with patch(
        "app.services.experiment.environment.EXPERIMENTS_BASE", tmp_path
    ):
        workspace = await setup_workspace(plan, "run-001")

    assert workspace.exists()
    assert (workspace / "train.py").exists()
    assert (workspace / "plan.json").exists()
    assert (workspace / ".git").is_dir()


@pytest.mark.asyncio
async def test_setup_workspace_writes_code_skeleton(tmp_path: Path):
    """train.py contains the plan's code skeleton."""
    plan = _make_plan(code_skeleton="x = 42\nprint(x)")

    with patch(
        "app.services.experiment.environment.EXPERIMENTS_BASE", tmp_path
    ):
        workspace = await setup_workspace(plan, "run-001")

    code = (workspace / "train.py").read_text()
    assert "x = 42" in code


@pytest.mark.asyncio
async def test_setup_workspace_default_code(tmp_path: Path):
    """Uses default placeholder when no code skeleton provided."""
    plan = _make_plan(code_skeleton=None)

    with patch(
        "app.services.experiment.environment.EXPERIMENTS_BASE", tmp_path
    ):
        workspace = await setup_workspace(plan, "run-001")

    code = (workspace / "train.py").read_text()
    assert "val_loss" in code


@pytest.mark.asyncio
async def test_setup_workspace_plan_json_contents(tmp_path: Path):
    """plan.json contains correct metadata."""
    plan = _make_plan(hypothesis="Test hypothesis")

    with patch(
        "app.services.experiment.environment.EXPERIMENTS_BASE", tmp_path
    ):
        workspace = await setup_workspace(plan, "run-001")

    plan_data = json.loads((workspace / "plan.json").read_text())
    assert plan_data["hypothesis"] == "Test hypothesis"
    assert plan_data["run_id"] == "run-001"


@pytest.mark.asyncio
async def test_setup_workspace_creates_requirements_with_datasets(tmp_path: Path):
    """requirements.txt is created when datasets are specified."""
    plan = _make_plan(datasets=[{"name": "mnist", "url": "http://example.com/mnist.gz"}])

    with patch(
        "app.services.experiment.environment.EXPERIMENTS_BASE", tmp_path
    ):
        workspace = await setup_workspace(plan, "run-001")

    assert (workspace / "requirements.txt").exists()


@pytest.mark.asyncio
async def test_setup_workspace_git_branch(tmp_path: Path):
    """Git repo is on experiment/{run_id} branch."""
    from git import Repo

    plan = _make_plan()

    with patch(
        "app.services.experiment.environment.EXPERIMENTS_BASE", tmp_path
    ):
        workspace = await setup_workspace(plan, "run-001")

    repo = Repo(workspace)
    assert repo.active_branch.name == "experiment/run-001"


# ─── setup_baseline ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_setup_baseline_success():
    """Returns metrics when training produces output."""
    mock_runner = AsyncMock()
    mock_runner.run_training.return_value = ("val_loss: 1.23\n", 0)

    mock_git = MagicMock()
    mock_git.commit.return_value = "abc123"

    workspace = MagicMock()

    result = await setup_baseline(workspace, mock_runner, mock_git)

    assert result is not None
    assert result["primary_name"] == "val_loss"
    assert result["primary_value"] == pytest.approx(1.23)
    assert result["exit_code"] == 0
    mock_git.commit.assert_called_once()


@pytest.mark.asyncio
async def test_setup_baseline_no_metrics():
    """Returns None when training produces no valid metrics."""
    mock_runner = AsyncMock()
    mock_runner.run_training.return_value = ("Loading...\nDone.\n", 0)

    mock_git = MagicMock()
    workspace = MagicMock()

    result = await setup_baseline(workspace, mock_runner, mock_git)
    assert result is None


@pytest.mark.asyncio
async def test_setup_baseline_crash():
    """Returns None when training crashes."""
    mock_runner = AsyncMock()
    mock_runner.run_training.return_value = ("Traceback: error\n", 1)

    mock_git = MagicMock()
    workspace = MagicMock()

    result = await setup_baseline(workspace, mock_runner, mock_git)
    assert result is None


# ─── teardown_workspace ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_teardown_workspace_removes_directory(tmp_path: Path):
    """Workspace directory is removed after teardown."""
    workspace = tmp_path / "test-workspace"
    workspace.mkdir()
    (workspace / "train.py").write_text("pass")

    await teardown_workspace(workspace)
    assert not workspace.exists()


@pytest.mark.asyncio
async def test_teardown_workspace_nonexistent():
    """No error when workspace doesn't exist."""
    await teardown_workspace(Path("/nonexistent/workspace"))


# ─── download_datasets ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_download_datasets_success(tmp_path: Path):
    """Downloads dataset files to workspace/data/."""
    datasets = [{"name": "test.csv", "url": "http://example.com/test.csv"}]

    mock_response = MagicMock()
    mock_response.content = b"col1,col2\n1,2\n"
    mock_response.raise_for_status = MagicMock()

    with patch("app.services.experiment.environment.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_cls.return_value = mock_client

        downloaded = await download_datasets(tmp_path, datasets)

    assert len(downloaded) == 1
    assert "test.csv" in downloaded[0]


@pytest.mark.asyncio
async def test_download_datasets_empty_list(tmp_path: Path):
    """Returns empty list for no datasets."""
    # Should not make any HTTP calls
    with patch("app.services.experiment.environment.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_cls.return_value = mock_client

        downloaded = await download_datasets(tmp_path, [])

    assert downloaded == []


@pytest.mark.asyncio
async def test_download_datasets_skips_no_url(tmp_path: Path):
    """Skips datasets with no URL."""
    datasets = [{"name": "local_data", "url": ""}]

    with patch("app.services.experiment.environment.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_cls.return_value = mock_client

        downloaded = await download_datasets(tmp_path, datasets)

    assert downloaded == []
