"""REST and WebSocket endpoints for experiment run management.

Provides CRUD operations, desktop-to-web sync via Valkey pub/sub,
and real-time status streaming for the experiment execution engine.

Reference: deep_research router patterns for auth and WebSocket.
"""

import asyncio
import json
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
    ExperimentQueueReorder,
    ExperimentRunCreate,
    ExperimentRunResponse,
    ExperimentRunUpdate,
    ExperimentSyncPayload,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Valkey Pub/Sub Helper ───────────────────────────────────────────────────


async def _get_valkey_client():
    """Create a Valkey async client. Returns None if connection fails."""
    try:
        from valkey.asyncio import Valkey

        settings = get_settings()
        client = Valkey.from_url(settings.valkey_url)
        await client.ping()
        return client
    except Exception as exc:
        logger.warning("Valkey connection failed (pub/sub disabled): %s", exc)
        return None

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

    # Publish progress to Valkey pub/sub for instant WebSocket push
    progress_data = {
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
    try:
        valkey = await _get_valkey_client()
        if valkey is not None:
            channel = f"experiment:{run.id}"
            await valkey.publish(channel, json.dumps(progress_data, default=str))
            await valkey.aclose()
    except Exception as exc:
        logger.warning("Valkey publish failed for %s: %s", run.id, exc)

    return ApiResponse(
        success=True,
        data=ExperimentRunResponse.model_validate(run),
        message="Experiment state synced",
    )


# ─── Queue Management & Cancel ───────────────────────────────────────────────


@router.patch(
    "/{run_id}/reorder",
    response_model=ApiResponse[ExperimentRunResponse],
)
async def reorder_experiment_run(
    run_id: str,
    body: ExperimentQueueReorder,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[ExperimentRunResponse]:
    """Reorder a pending experiment in the queue using fractional positioning."""
    result = await session.execute(
        select(ExperimentRun).where(ExperimentRun.id == run_id)
    )
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(status_code=404, detail="Experiment run not found")
    if run.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if run.status != "pending":
        raise HTTPException(
            status_code=409,
            detail="Only pending experiments can be reordered",
        )

    # Compute new position using fractional positioning
    after_pos: float | None = None
    before_pos: float | None = None

    if body.after_run_id is not None:
        after_result = await session.execute(
            select(ExperimentRun).where(ExperimentRun.id == body.after_run_id)
        )
        after_run = after_result.scalar_one_or_none()
        if after_run is None:
            raise HTTPException(status_code=404, detail="after_run_id not found")
        if after_run.user_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized for after_run")
        after_pos = after_run.queue_position

    if body.before_run_id is not None:
        before_result = await session.execute(
            select(ExperimentRun).where(ExperimentRun.id == body.before_run_id)
        )
        before_run = before_result.scalar_one_or_none()
        if before_run is None:
            raise HTTPException(status_code=404, detail="before_run_id not found")
        if before_run.user_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized for before_run")
        before_pos = before_run.queue_position

    if after_pos is None and before_pos is None:
        # Place at end: max position + 1
        from sqlalchemy import func as sa_func

        max_result = await session.execute(
            select(sa_func.max(ExperimentRun.queue_position)).where(
                ExperimentRun.user_id == user.id,
                ExperimentRun.status == "pending",
            )
        )
        max_pos = max_result.scalar() or 0.0
        new_pos = max_pos + 1.0
    elif after_pos is not None and before_pos is not None:
        new_pos = (after_pos + before_pos) / 2.0
    elif after_pos is not None:
        # Find next pending run after the reference
        next_result = await session.execute(
            select(ExperimentRun.queue_position)
            .where(
                ExperimentRun.user_id == user.id,
                ExperimentRun.status == "pending",
                ExperimentRun.queue_position > after_pos,
                ExperimentRun.id != run_id,
            )
            .order_by(ExperimentRun.queue_position.asc())
            .limit(1)
        )
        next_pos = next_result.scalar()
        new_pos = (after_pos + next_pos) / 2.0 if next_pos is not None else after_pos + 1.0
    else:
        # before_pos is not None, after_pos is None
        prev_result = await session.execute(
            select(ExperimentRun.queue_position)
            .where(
                ExperimentRun.user_id == user.id,
                ExperimentRun.status == "pending",
                ExperimentRun.queue_position < before_pos,
                ExperimentRun.id != run_id,
            )
            .order_by(ExperimentRun.queue_position.desc())
            .limit(1)
        )
        prev_pos = prev_result.scalar()
        new_pos = (prev_pos + before_pos) / 2.0 if prev_pos is not None else before_pos - 1.0

    run.queue_position = new_pos
    run.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(run)

    return ApiResponse(
        success=True,
        data=ExperimentRunResponse.model_validate(run),
        message="Experiment reordered",
    )


@router.post(
    "/{run_id}/cancel",
    response_model=ApiResponse[ExperimentRunResponse],
)
async def cancel_experiment_run(
    run_id: str,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[ExperimentRunResponse]:
    """Cancel a pending, running, or paused experiment."""
    result = await session.execute(
        select(ExperimentRun).where(ExperimentRun.id == run_id)
    )
    run = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(status_code=404, detail="Experiment run not found")
    if run.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    _validate_transition(run.status, "cancelled")

    run.status = "cancelled"
    run.completed_at = datetime.now(timezone.utc)
    run.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(run)

    return ApiResponse(
        success=True,
        data=ExperimentRunResponse.model_validate(run),
        message="Experiment cancelled",
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
        # Send initial snapshot from DB
        from app.database import get_db_session

        async for session in get_db_session():
            result = await session.execute(
                select(ExperimentRun).where(ExperimentRun.id == run_id)
            )
            run = result.scalar_one_or_none()
            break

        if run is None:
            await websocket.send_json({"error": "Experiment run not found"})
            return
        if run.user_id != user_id:
            await websocket.send_json({"error": "Not authorized"})
            return

        initial_progress = {
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
        await websocket.send_json(initial_progress)

        if run.status in ("completed", "failed", "cancelled"):
            return

        # Try Valkey pub/sub for instant push; fall back to 2s polling
        valkey = await _get_valkey_client()
        if valkey is not None:
            await _ws_valkey_loop(websocket, valkey, run_id)
        else:
            logger.info("Valkey unavailable, falling back to polling for %s", run_id)
            await _ws_polling_loop(websocket, run_id, user_id)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for experiment %s", run_id)
    except Exception as exc:
        logger.error("WebSocket error for experiment %s: %s", run_id, exc)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


async def _ws_valkey_loop(
    websocket: WebSocket, valkey, run_id: str
) -> None:
    """Listen for Valkey pub/sub messages and forward to WebSocket."""
    channel = f"experiment:{run_id}"
    pubsub = valkey.pubsub()
    try:
        await pubsub.subscribe(channel)
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            data = message["data"]
            if isinstance(data, bytes):
                data = data.decode("utf-8")
            parsed = json.loads(data)
            await websocket.send_json(parsed)
            # Close on terminal states
            if parsed.get("status") in ("completed", "failed", "cancelled"):
                break
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
        await valkey.aclose()


async def _ws_polling_loop(
    websocket: WebSocket, run_id: str, user_id: str
) -> None:
    """Fallback 2s polling loop when Valkey is unavailable."""
    from app.database import get_db_session

    while True:
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

        if run.status in ("completed", "failed", "cancelled"):
            break

        await asyncio.sleep(2)
