"""Deep Research REST and WebSocket endpoints.

Provides task management (create, list, get) and real-time
progress streaming via WebSocket for the Deep Research pipeline.
"""

import asyncio
import logging
import uuid
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import get_current_user, get_db
from app.models.deep_research import DeepResearchTask
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.deep_research import (
    DeepResearchInput,
    DeepResearchTaskResponse,
)
from app.services.temporal_service import get_temporal_client, start_workflow
from app.workflows.deep_research import DeepResearchWorkflow, DeepResearchWorkflowInput

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/deep-research", tags=["deep-research"])


@router.post(
    "/tasks",
    response_model=ApiResponse[DeepResearchTaskResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_deep_research_task(
    body: DeepResearchInput,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[DeepResearchTaskResponse]:
    """Start a new Deep Research task.

    Creates a DeepResearchTask in PostgreSQL and starts the Temporal
    workflow. Returns the task with its workflow_id for tracking.
    """
    task_id = uuid.uuid4().hex
    workflow_id = f"deep-research-{task_id}"

    # Create task record in PostgreSQL
    task = DeepResearchTask(
        id=task_id,
        user_id=user.id,
        workflow_id=workflow_id,
        research_direction=body.research_direction,
        entry_type=body.entry_type,
        config={
            "depth": body.depth,
            "max_papers": body.max_papers,
            "sources": [s.value for s in body.sources] if body.sources else None,
            "year_from": body.year_from,
            "year_to": body.year_to,
            "languages": body.languages,
        },
        status="pending",
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)

    # Start Temporal workflow
    try:
        workflow_input = DeepResearchWorkflowInput(
            task_id=task_id,
            user_id=user.id,
            research_direction=body.research_direction,
            entry_type=body.entry_type,
            depth=body.depth,
            max_papers=body.max_papers,
            sources=[s.value for s in body.sources] if body.sources else None,
            year_from=body.year_from,
            year_to=body.year_to,
            languages=body.languages,
        )

        await start_workflow(
            workflow_class=DeepResearchWorkflow,
            workflow_id=workflow_id,
            args=workflow_input,
        )

        task.status = "running"
        await session.commit()
        await session.refresh(task)

    except Exception as exc:
        logger.error("Failed to start Temporal workflow: %s", exc)
        task.status = "failed"
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Workflow service unavailable",
        ) from exc

    return ApiResponse(
        success=True,
        data=DeepResearchTaskResponse.model_validate(task),
        message="Deep research task started",
    )


@router.get(
    "/tasks",
    response_model=ApiResponse[list[DeepResearchTaskResponse]],
)
async def list_deep_research_tasks(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> ApiResponse[list[DeepResearchTaskResponse]]:
    """List the current user's Deep Research tasks, newest first."""
    result = await session.execute(
        select(DeepResearchTask)
        .where(DeepResearchTask.user_id == user.id)
        .order_by(DeepResearchTask.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    tasks = list(result.scalars().all())

    return ApiResponse(
        success=True,
        data=[DeepResearchTaskResponse.model_validate(t) for t in tasks],
    )


@router.get(
    "/tasks/{task_id}",
    response_model=ApiResponse[DeepResearchTaskResponse],
)
async def get_deep_research_task(
    task_id: str,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[DeepResearchTaskResponse]:
    """Get a single Deep Research task by ID. Requires ownership."""
    result = await session.execute(
        select(DeepResearchTask).where(DeepResearchTask.id == task_id)
    )
    task = result.scalar_one_or_none()

    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return ApiResponse(
        success=True,
        data=DeepResearchTaskResponse.model_validate(task),
    )


@router.websocket("/ws/{workflow_id}")
async def deep_research_progress(
    websocket: WebSocket,
    workflow_id: str,
    token: str = Query(default=""),
) -> None:
    """Stream real-time progress for a Deep Research workflow via WebSocket.

    Authenticates via `token` query parameter (JWT access token).
    Polls Temporal workflow query every 3 seconds and sends JSON progress.
    Closes automatically when workflow reaches 'completed' or 'failed'.
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
    except jwt.PyJWTError:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    await websocket.accept()

    try:
        client = await get_temporal_client()
        handle = client.get_workflow_handle(workflow_id)

        while True:
            try:
                progress = await handle.query(DeepResearchWorkflow.get_progress)
            except Exception as exc:
                logger.warning("Failed to query workflow progress: %s", exc)
                await websocket.send_json({"error": "Workflow not found or unreachable"})
                break

            await websocket.send_json(progress)

            phase = progress.get("phase", "")
            if phase in ("completed", "failed"):
                break

            await asyncio.sleep(3)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for workflow %s", workflow_id)
    except Exception as exc:
        logger.error("WebSocket error for workflow %s: %s", workflow_id, exc)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
