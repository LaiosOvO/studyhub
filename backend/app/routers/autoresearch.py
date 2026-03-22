"""AutoResearch API — real code execution with git versioning.

Endpoints for the Karpathy-style autoresearch loop:
  init → write code → execute → keep/discard → repeat
"""

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services.autoresearch import executor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/autoresearch", tags=["autoresearch"])


# ─── Request / Response Schemas ──────────────────────────────────────────


class InitRunRequest(BaseModel):
    """Request to initialize a new autoresearch run."""

    base_code: str | None = Field(None, description="Initial train.py content")
    prepare_code: str | None = Field(None, description="Read-only prepare.py content")
    requirements: str | None = Field(None, description="Python requirements.txt content")
    run_id: str | None = Field(None, description="Custom run ID (auto-generated if omitted)")


class InitRunResponse(BaseModel):
    """Response after initializing a run."""

    run_id: str
    workspace_path: str


class WriteCodeRequest(BaseModel):
    """Request to write code to the workspace."""

    path: str = Field(default="train.py", description="File path relative to workspace")
    content: str = Field(..., description="File content")
    message: str | None = Field(None, description="Git commit message")


class WriteCodeResponse(BaseModel):
    """Response after writing code."""

    commit_sha: str
    path: str


class ExecuteRequest(BaseModel):
    """Request to execute code in the workspace."""

    command: str = Field(default="python train.py", description="Command to run")
    timeout_seconds: int = Field(default=300, ge=5, le=1800, description="Time budget in seconds")
    env_vars: dict[str, str] | None = Field(None, description="Extra environment variables")


class ExecuteResponse(BaseModel):
    """Response after execution completes."""

    exit_code: int
    duration_seconds: float
    stdout: str
    stderr: str
    metrics: dict[str, float]
    error: str | None


class KeepDiscardRequest(BaseModel):
    """Request to keep or discard the last iteration."""

    keep: bool = Field(..., description="True = keep commit, False = git reset --hard HEAD~1")
    iteration: int = Field(..., description="Iteration number for results tracking")
    commit_sha: str = Field(default="", description="SHA of the commit being judged")
    duration: float = Field(default=0, description="Execution duration for logging")
    exit_code: int = Field(default=0, description="Exit code for logging")
    extra_metrics: dict[str, float] | None = Field(None, description="Metrics to log")


class KeepDiscardResponse(BaseModel):
    """Response after keep/discard decision."""

    head_sha: str
    action: str


class RunStatusResponse(BaseModel):
    """Current status of an autoresearch run."""

    exists: bool
    run_id: str
    files: list[str] = []
    recent_commits: list[dict[str, Any]] = []
    total_iterations: int = 0
    results: list[dict[str, Any]] = []


class ReadCodeResponse(BaseModel):
    """Response with current code content."""

    path: str
    content: str | None


# ─── Endpoints ───────────────────────────────────────────────────────────


@router.post("/runs", response_model=ApiResponse[InitRunResponse], status_code=201)
async def init_run(
    body: InitRunRequest,
    user: User = Depends(get_current_user),
) -> ApiResponse[InitRunResponse]:
    """Initialize a new autoresearch run with a git workspace."""
    run_id = body.run_id or f"ar-{user.id[:8]}-{uuid.uuid4().hex[:8]}"

    try:
        workspace = await executor.init_run(
            run_id=run_id,
            base_code=body.base_code,
            prepare_code=body.prepare_code,
            requirements=body.requirements,
        )
    except Exception as exc:
        logger.error("Failed to init run %s: %s", run_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize run: {exc}",
        )

    return ApiResponse(
        success=True,
        data=InitRunResponse(run_id=run_id, workspace_path=str(workspace)),
    )


@router.post(
    "/runs/{run_id}/code",
    response_model=ApiResponse[WriteCodeResponse],
)
async def write_code(
    run_id: str,
    body: WriteCodeRequest,
    user: User = Depends(get_current_user),
) -> ApiResponse[WriteCodeResponse]:
    """Write code to the workspace and commit."""
    try:
        sha = await executor.write_code(
            run_id=run_id,
            path=body.path,
            content=body.content,
            message=body.message,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to write code: %s", exc)
        raise HTTPException(status_code=500, detail=f"Write failed: {exc}")

    return ApiResponse(
        success=True,
        data=WriteCodeResponse(commit_sha=sha, path=body.path),
    )


@router.post(
    "/runs/{run_id}/execute",
    response_model=ApiResponse[ExecuteResponse],
)
async def execute_code(
    run_id: str,
    body: ExecuteRequest,
    user: User = Depends(get_current_user),
) -> ApiResponse[ExecuteResponse]:
    """Execute code in the workspace with a time budget.

    Runs the command via subprocess, captures stdout/stderr,
    and extracts metrics from the output.
    """
    try:
        result = await executor.execute(
            run_id=run_id,
            command=body.command,
            timeout_seconds=body.timeout_seconds,
            env_vars=body.env_vars,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Execution error for run %s: %s", run_id, exc)
        raise HTTPException(status_code=500, detail=f"Execution failed: {exc}")

    return ApiResponse(
        success=True,
        data=ExecuteResponse(
            exit_code=result.exit_code,
            duration_seconds=result.duration_seconds,
            stdout=result.stdout,
            stderr=result.stderr,
            metrics=result.metrics,
            error=result.error,
        ),
    )


@router.post(
    "/runs/{run_id}/decide",
    response_model=ApiResponse[KeepDiscardResponse],
)
async def keep_or_discard(
    run_id: str,
    body: KeepDiscardRequest,
    user: User = Depends(get_current_user),
) -> ApiResponse[KeepDiscardResponse]:
    """Keep or discard the last iteration.

    keep=true: advance (commit stays)
    keep=false: git reset --hard HEAD~1 (discard last commit)
    """
    try:
        head_sha = await executor.keep_or_discard(run_id, body.keep)

        # Log to results.tsv
        action = "keep" if body.keep else "discard"
        await executor.append_result(
            run_id=run_id,
            iteration=body.iteration,
            commit_sha=body.commit_sha or head_sha,
            action=action,
            duration=body.duration,
            exit_code=body.exit_code,
            extra_metrics=body.extra_metrics,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Keep/discard failed for run %s: %s", run_id, exc)
        raise HTTPException(status_code=500, detail=f"Decision failed: {exc}")

    return ApiResponse(
        success=True,
        data=KeepDiscardResponse(
            head_sha=head_sha,
            action="keep" if body.keep else "discard",
        ),
    )


@router.get(
    "/runs/{run_id}",
    response_model=ApiResponse[RunStatusResponse],
)
async def get_run_status(
    run_id: str,
    user: User = Depends(get_current_user),
) -> ApiResponse[RunStatusResponse]:
    """Get the current status of an autoresearch run."""
    try:
        status_data = await executor.get_run_status(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return ApiResponse(
        success=True,
        data=RunStatusResponse(**status_data),
    )


@router.get(
    "/runs/{run_id}/code/{path:path}",
    response_model=ApiResponse[ReadCodeResponse],
)
async def read_code(
    run_id: str,
    path: str,
    user: User = Depends(get_current_user),
) -> ApiResponse[ReadCodeResponse]:
    """Read the current version of a code file."""
    try:
        content = await executor.get_current_code(run_id, path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return ApiResponse(
        success=True,
        data=ReadCodeResponse(path=path, content=content),
    )


@router.post(
    "/runs/{run_id}/install",
    response_model=ApiResponse[ExecuteResponse],
)
async def install_deps(
    run_id: str,
    user: User = Depends(get_current_user),
) -> ApiResponse[ExecuteResponse]:
    """Install Python dependencies from requirements.txt."""
    try:
        result = await executor.install_dependencies(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Install deps failed for %s: %s", run_id, exc)
        raise HTTPException(status_code=500, detail=f"Install failed: {exc}")

    return ApiResponse(
        success=True,
        data=ExecuteResponse(
            exit_code=result.exit_code,
            duration_seconds=result.duration_seconds,
            stdout=result.stdout,
            stderr=result.stderr,
            metrics=result.metrics,
            error=result.error,
        ),
    )
