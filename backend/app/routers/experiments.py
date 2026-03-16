"""REST and WebSocket endpoints for experiment run management.

Provides CRUD operations, desktop-to-web sync, and real-time
status streaming for the experiment execution engine.

Reference: deep_research router patterns for auth and WebSocket.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Annotated

import jwt
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import get_current_user, get_db
from app.models.experiment_plan import ExperimentPlan
from app.models.experiment_run import ExperimentRun
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.experiment import (
    ExperimentRunCreate,
    ExperimentRunResponse,
    ExperimentRunUpdate,
    ExperimentSyncPayload,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# ─── Valid Status Transitions ─────────────────────────────────────────────────

VALID_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"setting_up", "cancelled"},
    "setting_up": {"baseline", "failed", "cancelled"},
    "baseline": {"running", "failed", "cancelled"},
    "running": {"paused", "completed", "failed", "cancelled"},
    "paused": {"running", "cancelled"},
    "completed": set(),
    "failed": set(),
    "cancelled": set(),
}


def _validate_transition(current: str, target: str) -> None:
    """Validate that a status transition is allowed."""
    allowed = VALID_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot transition from '{current}' to '{target}'",
        )


# ─── REST Endpoints ──────────────────────────────────────────────────────────


@router.post(
    "/",
    response_model=ApiResponse[ExperimentRunResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_experiment_run(
    body: ExperimentRunCreate,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[ExperimentRunResponse]:
    """Create a new experiment run from an approved plan.

    Validates plan ownership and approved status, then sets
    the plan status to 'executing'.
    """
    # Validate plan exists and belongs to user
    result = await session.execute(
        select(ExperimentPlan).where(ExperimentPlan.id == body.plan_id)
    )
    plan = result.scalar_one_or_none()

    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    if plan.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if plan.status != "approved":
        raise HTTPException(
            status_code=409,
            detail="Plan must be approved before creating an experiment run",
        )

    # Create experiment run
    run = ExperimentRun(
        user_id=user.id,
        plan_id=body.plan_id,
        gpu_device=body.gpu_device,
        max_rounds=body.max_rounds,
        consecutive_no_improve_limit=body.consecutive_no_improve_limit,
        time_budget_minutes=body.time_budget_minutes,
        docker_image=body.docker_image,
    )
    session.add(run)

    # Mark plan as executing
    plan.status = "executing"
    plan.updated_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(run)

    return ApiResponse(
        success=True,
        data=ExperimentRunResponse.model_validate(run),
        message="Experiment run created",
    )


@router.get(
    "/",
    response_model=ApiResponse[list[ExperimentRunResponse]],
)
async def list_experiment_runs(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
    plan_id: str | None = Query(default=None),
    run_status: str | None = Query(default=None, alias="status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> ApiResponse[list[ExperimentRunResponse]]:
    """List experiment runs for the current user.

    Supports filtering by plan_id and status, with pagination.
    """
    query = (
        select(ExperimentRun)
        .where(ExperimentRun.user_id == user.id)
        .order_by(ExperimentRun.created_at.desc())
    )

    if plan_id is not None:
        query = query.where(ExperimentRun.plan_id == plan_id)
    if run_status is not None:
        query = query.where(ExperimentRun.status == run_status)

    query = query.offset(skip).limit(limit)

    result = await session.execute(query)
    runs = list(result.scalars().all())

    return ApiResponse(
        success=True,
        data=[ExperimentRunResponse.model_validate(r) for r in runs],
    )


@router.get(
    "/{run_id}",
    response_model=ApiResponse[ExperimentRunResponse],
)
async def get_experiment_run(
    run_id: str,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[ExperimentRunResponse]:
    """Get a single experiment run by ID. Requires ownership."""
    result = await session.execute(
        select(ExperimentRun).where(ExperimentRun.id == run_id)
    )
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(status_code=404, detail="Experiment run not found")
    if run.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return ApiResponse(
        success=True,
        data=ExperimentRunResponse.model_validate(run),
    )


@router.patch(
    "/{run_id}",
    response_model=ApiResponse[ExperimentRunResponse],
)
async def update_experiment_run(
    run_id: str,
    body: ExperimentRunUpdate,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[ExperimentRunResponse]:
    """Update experiment run state. Validates status transitions."""
    result = await session.execute(
        select(ExperimentRun).where(ExperimentRun.id == run_id)
    )
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(status_code=404, detail="Experiment run not found")
    if run.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Validate status transition if status is being changed
    if body.status is not None and body.status != run.status:
        _validate_transition(run.status, body.status)
        run.status = body.status

        # Auto-set timestamps on terminal states
        if body.status in ("completed", "failed", "cancelled"):
            run.completed_at = datetime.now(timezone.utc)
        elif body.status == "setting_up" and run.started_at is None:
            run.started_at = datetime.now(timezone.utc)

    if body.config is not None:
        # Merge config immutably
        merged = {**run.config, **body.config}
        run.config = merged

    if body.user_guidance is not None:
        # Store guidance in config for the loop agent to pick up
        merged = {**run.config, "user_guidance": body.user_guidance}
        run.config = merged

    run.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(run)

    return ApiResponse(
        success=True,
        data=ExperimentRunResponse.model_validate(run),
        message="Experiment run updated",
    )


@router.delete(
    "/{run_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_experiment_run(
    run_id: str,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete an experiment run. Only pending/failed/cancelled runs."""
    result = await session.execute(
        select(ExperimentRun).where(ExperimentRun.id == run_id)
    )
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(status_code=404, detail="Experiment run not found")
    if run.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if run.status not in ("pending", "failed", "cancelled"):
        raise HTTPException(
            status_code=409,
            detail="Only pending, failed, or cancelled runs can be deleted",
        )

    await session.delete(run)
    await session.commit()


@router.post(
    "/{run_id}/sync",
    response_model=ApiResponse[ExperimentRunResponse],
)
async def sync_experiment_status(
    run_id: str,
    body: ExperimentSyncPayload,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[ExperimentRunResponse]:
    """Accept sync payload from desktop agent to update run state.

    This is how the Tauri desktop app pushes experiment status
    to the web platform.
    """
    result = await session.execute(
        select(ExperimentRun).where(ExperimentRun.id == run_id)
    )
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(status_code=404, detail="Experiment run not found")
    if run.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Update run state from sync payload
    run.status = body.status
    run.current_round = body.current_round

    if body.best_metric_value is not None:
        run.best_metric_value = body.best_metric_value

    if body.latest_round is not None:
        # Append round immutably
        updated_rounds = [*run.rounds, body.latest_round.model_dump()]
        run.rounds = updated_rounds

    if body.gpu_metrics is not None:
        # Store latest GPU metrics in config
        merged = {**run.config, "gpu_metrics": body.gpu_metrics.model_dump()}
        run.config = merged

    run.updated_at = datetime.now(timezone.utc)

    # Auto-set timestamps
    if body.status in ("completed", "failed", "cancelled"):
        run.completed_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(run)

    return ApiResponse(
        success=True,
        data=ExperimentRunResponse.model_validate(run),
        message="Experiment state synced",
    )


# ─── WebSocket Endpoint ──────────────────────────────────────────────────────


@router.websocket("/ws/{run_id}")
async def experiment_progress(
    websocket: WebSocket,
    run_id: str,
    token: str = Query(default=""),
) -> None:
    """Stream real-time experiment status to web frontend via WebSocket.

    Authenticates via `token` query parameter (JWT access token).
    Polls experiment run status every 2 seconds and sends JSON updates.
    Closes when experiment reaches a terminal state.
    """
    # Authenticate via JWT token in query params
    if not token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return

    settings = get_settings()
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        if payload.get("type") != "access":
            await websocket.close(code=4001, reason="Invalid token type")
            return
        user_id = payload["sub"]
    except jwt.PyJWTError:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    await websocket.accept()

    try:
        while True:
            # Get fresh session for each poll
            from app.database import get_db_session

            async for session in get_db_session():
                result = await session.execute(
                    select(ExperimentRun).where(ExperimentRun.id == run_id)
                )
                run = result.scalar_one_or_none()
                break

            if run is None:
                await websocket.send_json({"error": "Experiment run not found"})
                break

            if run.user_id != user_id:
                await websocket.send_json({"error": "Not authorized"})
                break

            progress = {
                "run_id": run.id,
                "status": run.status,
                "current_round": run.current_round,
                "max_rounds": run.max_rounds,
                "best_metric_name": run.best_metric_name,
                "best_metric_value": run.best_metric_value,
                "baseline_metric_value": run.baseline_metric_value,
                "rounds": run.rounds,
                "gpu_metrics": run.config.get("gpu_metrics"),
            }

            await websocket.send_json(progress)

            # Stop streaming on terminal states
            if run.status in ("completed", "failed", "cancelled"):
                break

            await asyncio.sleep(2)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for experiment %s", run_id)
    except Exception as exc:
        logger.error("WebSocket error for experiment %s: %s", run_id, exc)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
