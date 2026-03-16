"""Tests for Docker container runner.

All Docker operations are mocked -- tests run without Docker daemon.
"""

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.experiment.docker_runner import (
    CONTAINER_LABEL,
    DockerRunner,
    DockerRunnerError,
)


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    return tmp_path


@pytest.fixture
def runner(workspace: Path) -> DockerRunner:
    return DockerRunner(workspace=workspace, gpu_device=0, run_id="test-run-001")


# ─── preflight_check ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_preflight_check_all_ok(runner: DockerRunner):
    """Reports all OK when Docker daemon, GPU, and image are available."""
    mock_client = MagicMock()
    mock_client.ping.return_value = True
    mock_client.info.return_value = {"Runtimes": {"nvidia": {}}}
    mock_client.images.get.return_value = MagicMock()

    with patch.object(runner, "_get_client", return_value=mock_client):
        runner._client = mock_client
        result = await runner.preflight_check()

    assert result["docker_ok"] is True
    assert result["gpu_ok"] is True
    assert result["image_ok"] is True
    assert result["errors"] == []


@pytest.mark.asyncio
async def test_preflight_check_no_docker(runner: DockerRunner):
    """Reports docker_ok=False when daemon is unreachable."""
    with patch.object(runner, "_get_client", side_effect=Exception("connection refused")):
        result = await runner.preflight_check()

    assert result["docker_ok"] is False
    assert len(result["errors"]) >= 1


@pytest.mark.asyncio
async def test_preflight_check_no_gpu(runner: DockerRunner):
    """Reports gpu_ok=False when NVIDIA runtime missing."""
    mock_client = MagicMock()
    mock_client.ping.return_value = True
    mock_client.info.return_value = {"Runtimes": {"runc": {}}}
    mock_client.images.get.return_value = MagicMock()

    with patch.object(runner, "_get_client", return_value=mock_client):
        runner._client = mock_client
        result = await runner.preflight_check()

    assert result["docker_ok"] is True
    assert result["gpu_ok"] is False


@pytest.mark.asyncio
async def test_preflight_check_no_image(runner: DockerRunner):
    """Reports image_ok=False when image not found."""
    mock_client = MagicMock()
    mock_client.ping.return_value = True
    mock_client.info.return_value = {"Runtimes": {"nvidia": {}}}
    mock_client.images.get.side_effect = Exception("image not found")

    with patch.object(runner, "_get_client", return_value=mock_client):
        runner._client = mock_client
        result = await runner.preflight_check()

    assert result["image_ok"] is False


# ─── build_image ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_build_image_dockerfile_not_found(runner: DockerRunner):
    """Raises DockerRunnerError if Dockerfile missing."""
    with pytest.raises(DockerRunnerError) as exc_info:
        await runner.build_image(Path("/nonexistent/Dockerfile"))
    assert exc_info.value.operation == "build_image"


@pytest.mark.asyncio
async def test_build_image_success(runner: DockerRunner, workspace: Path):
    """Successfully builds image and returns tag."""
    dockerfile = workspace / "Dockerfile"
    dockerfile.write_text("FROM python:3.12-slim\n")

    mock_client = MagicMock()
    mock_client.images.build.return_value = (MagicMock(), [])

    with patch.object(runner, "_get_client", return_value=mock_client):
        runner._client = mock_client
        tag = await runner.build_image(dockerfile)

    assert tag == runner._image


# ─── run_training ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_run_training_success(runner: DockerRunner):
    """Returns logs and exit code 0 on success."""
    mock_container = MagicMock()
    mock_container.wait.return_value = {"StatusCode": 0}
    mock_container.logs.return_value = b"val_loss: 0.45\n"
    mock_container.remove.return_value = None

    mock_client = MagicMock()
    mock_client.containers.run.return_value = mock_container

    with patch.object(runner, "_get_client", return_value=mock_client):
        runner._client = mock_client
        with patch.dict("sys.modules", {"docker": MagicMock()}):
            import sys
            mock_docker = sys.modules["docker"]
            mock_docker.types.DeviceRequest = MagicMock()
            log_text, exit_code = await runner.run_training()

    assert exit_code == 0
    assert "val_loss" in log_text


@pytest.mark.asyncio
async def test_run_training_crash(runner: DockerRunner):
    """Returns non-zero exit code on training crash."""
    mock_container = MagicMock()
    mock_container.wait.return_value = {"StatusCode": 1}
    mock_container.logs.return_value = b"RuntimeError: CUDA OOM\n"
    mock_container.remove.return_value = None

    mock_client = MagicMock()
    mock_client.containers.run.return_value = mock_container

    with patch.object(runner, "_get_client", return_value=mock_client):
        runner._client = mock_client
        with patch.dict("sys.modules", {"docker": MagicMock()}):
            import sys
            mock_docker = sys.modules["docker"]
            mock_docker.types.DeviceRequest = MagicMock()
            log_text, exit_code = await runner.run_training()

    assert exit_code == 1
    assert "CUDA OOM" in log_text


# ─── stop_container ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_stop_container_no_container(runner: DockerRunner):
    """Does nothing when no container is running."""
    await runner.stop_container()  # Should not raise


@pytest.mark.asyncio
async def test_stop_container_stops_and_removes(runner: DockerRunner):
    """Stops and removes the running container."""
    mock_container = MagicMock()
    runner._container = mock_container
    await runner.stop_container()
    mock_container.stop.assert_called_once()
    mock_container.remove.assert_called_once()
    assert runner._container is None


# ─── cleanup_orphans ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cleanup_orphans_removes_containers(runner: DockerRunner):
    """Removes containers with studyhub label."""
    mock_container_1 = MagicMock()
    mock_container_2 = MagicMock()
    mock_client = MagicMock()
    mock_client.containers.list.return_value = [mock_container_1, mock_container_2]

    with patch.object(runner, "_get_client", return_value=mock_client):
        runner._client = mock_client
        removed = await runner.cleanup_orphans()

    assert removed == 2
    mock_container_1.remove.assert_called_once()
    mock_container_2.remove.assert_called_once()


@pytest.mark.asyncio
async def test_cleanup_orphans_no_orphans(runner: DockerRunner):
    """Returns 0 when no orphan containers found."""
    mock_client = MagicMock()
    mock_client.containers.list.return_value = []

    with patch.object(runner, "_get_client", return_value=mock_client):
        runner._client = mock_client
        removed = await runner.cleanup_orphans()

    assert removed == 0
