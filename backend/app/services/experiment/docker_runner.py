"""Docker container lifecycle management with GPU passthrough.

Manages building experiment images, running training in sandboxed
containers, and container cleanup. All blocking docker-py calls
are wrapped in asyncio.to_thread.

Reference: 08-RESEARCH.md Pattern 3 (Docker execution).
"""

import asyncio
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Default experiment runner image
DEFAULT_IMAGE = "studyhub/experiment-runner:latest"
DEFAULT_DOCKERFILE = Path(__file__).parent.parent.parent.parent.parent / "infra" / "docker" / "experiment-runner.Dockerfile"

# Label for identifying StudyHub experiment containers
CONTAINER_LABEL = "com.studyhub.experiment"


class DockerRunnerError(Exception):
    """Docker operation failed in experiment context."""

    def __init__(self, operation: str, detail: str) -> None:
        self.operation = operation
        self.detail = detail
        super().__init__(f"Docker {operation} failed: {detail}")


class DockerRunner:
    """Manage Docker container lifecycle with GPU passthrough.

    All public async methods wrap blocking docker-py calls
    via asyncio.to_thread to keep the event loop free.
    """

    def __init__(
        self,
        workspace: Path,
        gpu_device: int = 0,
        image: str = DEFAULT_IMAGE,
        run_id: str = "",
    ) -> None:
        self._workspace = workspace
        self._gpu_device = gpu_device
        self._image = image
        self._run_id = run_id
        self._client: Any = None
        self._container: Any = None

    def _get_client(self) -> Any:
        """Get docker client. Lazy initialization."""
        if self._client is None:
            import docker

            self._client = docker.from_env()
        return self._client

    async def preflight_check(self) -> dict:
        """Validate Docker daemon, GPU access, image available.

        Returns {docker_ok, gpu_ok, image_ok, errors}.
        Run this before starting experiments.
        """
        errors: list[str] = []
        docker_ok = False
        gpu_ok = False
        image_ok = False

        # Check Docker daemon
        try:
            client = await asyncio.to_thread(self._get_client)
            await asyncio.to_thread(client.ping)
            docker_ok = True
        except Exception as exc:
            errors.append(f"Docker daemon not available: {exc}")

        # Check GPU access
        if docker_ok:
            try:
                info = await asyncio.to_thread(client.info)
                runtimes = info.get("Runtimes", {})
                if "nvidia" in runtimes:
                    gpu_ok = True
                else:
                    errors.append("NVIDIA Docker runtime not found")
            except Exception as exc:
                errors.append(f"Cannot check GPU runtime: {exc}")

        # Check image availability
        if docker_ok:
            try:
                await asyncio.to_thread(client.images.get, self._image)
                image_ok = True
            except Exception:
                errors.append(
                    f"Image {self._image} not found. Build with build_image() first."
                )

        return {
            "docker_ok": docker_ok,
            "gpu_ok": gpu_ok,
            "image_ok": image_ok,
            "errors": errors,
        }

    async def build_image(self, dockerfile_path: Path | None = None) -> str:
        """Build experiment runner image if not exists. Returns image tag."""
        dockerfile = dockerfile_path or DEFAULT_DOCKERFILE

        if not dockerfile.exists():
            raise DockerRunnerError(
                "build_image",
                f"Dockerfile not found: {dockerfile}",
            )

        client = await asyncio.to_thread(self._get_client)

        try:
            _image, _logs = await asyncio.to_thread(
                client.images.build,
                path=str(dockerfile.parent),
                dockerfile=dockerfile.name,
                tag=self._image,
                rm=True,
            )
            logger.info("Built image %s", self._image)
            return self._image
        except Exception as exc:
            raise DockerRunnerError("build_image", str(exc)) from exc

    async def install_requirements(self, requirements_path: Path) -> bool:
        """Run pip install -r inside container for project-specific deps."""
        if not requirements_path.exists():
            return True

        client = await asyncio.to_thread(self._get_client)

        try:
            result = await asyncio.to_thread(
                client.containers.run,
                self._image,
                command=f"pip install --no-cache-dir -r /workspace/requirements.txt",
                volumes={
                    str(self._workspace): {"bind": "/workspace", "mode": "rw"},
                },
                working_dir="/workspace",
                remove=True,
            )
            logger.info("Installed requirements from %s", requirements_path)
            return True
        except Exception as exc:
            logger.error("Failed to install requirements: %s", exc)
            return False

    async def run_training(
        self,
        command: str = "python train.py",
        timeout_seconds: int = 3600,
    ) -> tuple[str, int]:
        """Run training in Docker container. Returns (stdout_log, exit_code).

        Container config:
        - volumes: workspace bind-mounted at /workspace (rw)
        - device_requests: GPU with device_ids=[str(gpu_device)]
        - network_mode: 'none' (sandboxed -- EXPR-08)
        - mem_limit: '32g'
        - shm_size: '8g' (PyTorch DataLoader requirement)
        - working_dir: '/workspace'
        - auto_remove: False (need to capture logs first)
        - labels: {CONTAINER_LABEL: run_id}
        """
        import docker

        client = await asyncio.to_thread(self._get_client)

        container_config = {
            "image": self._image,
            "command": command,
            "volumes": {
                str(self._workspace): {"bind": "/workspace", "mode": "rw"},
            },
            "working_dir": "/workspace",
            "network_mode": "none",
            "mem_limit": "32g",
            "shm_size": "8g",
            "labels": {CONTAINER_LABEL: self._run_id},
            "auto_remove": False,
            "device_requests": [
                docker.types.DeviceRequest(
                    device_ids=[str(self._gpu_device)],
                    capabilities=[["gpu"]],
                )
            ],
        }

        try:
            container = await asyncio.to_thread(
                client.containers.run,
                detach=True,
                **container_config,
            )
            self._container = container

            # Wait for completion with timeout
            try:
                result = await asyncio.wait_for(
                    asyncio.to_thread(container.wait),
                    timeout=timeout_seconds,
                )
                exit_code = result.get("StatusCode", -1)
            except asyncio.TimeoutError:
                logger.warning("Training timed out after %ds", timeout_seconds)
                await asyncio.to_thread(container.stop, timeout=10)
                exit_code = -1

            # Capture logs before removing
            logs = await asyncio.to_thread(
                container.logs, stdout=True, stderr=True
            )
            log_text = logs.decode("utf-8", errors="replace")

            # Remove container
            try:
                await asyncio.to_thread(container.remove, force=True)
            except Exception:
                pass

            self._container = None
            return log_text, exit_code

        except Exception as exc:
            raise DockerRunnerError("run_training", str(exc)) from exc

    async def stop_container(self) -> None:
        """Stop running container (for pause/cancel)."""
        if self._container is not None:
            try:
                await asyncio.to_thread(self._container.stop, timeout=10)
                await asyncio.to_thread(self._container.remove, force=True)
                self._container = None
                logger.info("Stopped and removed container")
            except Exception as exc:
                logger.warning("Failed to stop container: %s", exc)

    async def cleanup_orphans(self) -> int:
        """Find and remove containers with studyhub label.

        Returns count removed. Run on app startup.
        """
        client = await asyncio.to_thread(self._get_client)
        removed = 0

        try:
            containers = await asyncio.to_thread(
                client.containers.list,
                all=True,
                filters={"label": CONTAINER_LABEL},
            )
            for container in containers:
                try:
                    await asyncio.to_thread(container.remove, force=True)
                    removed += 1
                except Exception:
                    pass

            if removed > 0:
                logger.info("Cleaned up %d orphan containers", removed)
        except Exception as exc:
            logger.warning("Failed to cleanup orphans: %s", exc)

        return removed
