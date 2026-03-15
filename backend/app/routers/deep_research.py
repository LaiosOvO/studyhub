"""Deep Research REST and WebSocket endpoints.

Provides task management (create, list, get) and real-time
progress streaming via WebSocket for the Deep Research pipeline.
"""

import asyncio
import logging
import uuid
from typing import Annotated

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.responses import PlainTextResponse
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
    ExpandAreaRequest,
    ExpandAreaResponse,
    RefineRequest,
    RefineResponse,
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


@router.post(
    "/tasks/{task_id}/refine",
    response_model=ApiResponse[RefineResponse],
)
async def refine_deep_research_task(
    task_id: str,
    body: RefineRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[RefineResponse]:
    """Refine a completed Deep Research task by adjusting filters.

    Applies exclusion filters to paper analyses and optionally
    triggers partial re-analysis via a new Temporal workflow.
    """
    result = await session.execute(
        select(DeepResearchTask).where(DeepResearchTask.id == task_id)
    )
    task = result.scalar_one_or_none()

    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if task.status not in ("completed",):
        raise HTTPException(status_code=409, detail="Task must be completed to refine")

    # Apply filters to paper analyses
    paper_analyses = task.config.get("paper_analyses", {})
    filtered_ids = []

    for paper_id, analysis in paper_analyses.items():
        # Exclude by methods
        if body.exclude_methods:
            paper_methods = set(analysis.get("methods", []))
            if paper_methods & set(body.exclude_methods):
                continue

        # Exclude by paper type
        if body.exclude_paper_types:
            if analysis.get("paper_type") in body.exclude_paper_types:
                continue

        filtered_ids.append(paper_id)

    filtered_count = len(filtered_ids)

    # Store filter settings in config (immutable update)
    updated_config = {
        **task.config,
        "refinement_filters": {
            "exclude_methods": body.exclude_methods,
            "exclude_paper_types": body.exclude_paper_types,
            "year_from": body.year_from,
            "year_to": body.year_to,
            "filtered_paper_ids": filtered_ids,
        },
    }
    task.config = updated_config

    workflow_id = None
    message = f"Filtered to {filtered_count} papers"

    if body.reanalyze and filtered_ids:
        # Start partial re-analysis workflow
        refine_wf_id = f"deep-research-refine-{task_id}-{uuid.uuid4().hex[:8]}"
        workflow_input = DeepResearchWorkflowInput(
            task_id=task_id,
            user_id=user.id,
            research_direction=task.research_direction,
            entry_type=task.entry_type,
            depth=task.config.get("depth", 2),
            max_papers=filtered_count,
        )

        try:
            await start_workflow(
                workflow_class=DeepResearchWorkflow,
                workflow_id=refine_wf_id,
                args=workflow_input,
            )
            task.status = "running"
            workflow_id = refine_wf_id
            message = f"Re-analysis started on {filtered_count} filtered papers"
        except Exception as exc:
            logger.warning("Failed to start refinement workflow: %s", exc)
            message = f"Filtered to {filtered_count} papers (re-analysis failed: {exc})"

    await session.commit()

    return ApiResponse(
        success=True,
        data=RefineResponse(
            task_id=task_id,
            workflow_id=workflow_id,
            filtered_count=filtered_count,
            message=message,
        ),
    )


@router.post(
    "/tasks/{task_id}/expand",
    response_model=ApiResponse[ExpandAreaResponse],
)
async def expand_deep_research_area(
    task_id: str,
    body: ExpandAreaRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[ExpandAreaResponse]:
    """Expand specific graph areas from a completed research task.

    Reuses the citation expansion engine to discover more papers
    around specific nodes of interest.
    """
    result = await session.execute(
        select(DeepResearchTask).where(DeepResearchTask.id == task_id)
    )
    task = result.scalar_one_or_none()

    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if task.status not in ("completed", "running"):
        raise HTTPException(
            status_code=409,
            detail="Task must be completed or running to expand",
        )

    settings = get_settings()
    new_papers = 0
    new_edges = 0

    try:
        from app.services.citation_network.expansion_engine import expand_citations
        from app.services.citation_network.neo4j_client import Neo4jClient
        from app.services.paper_search.s2_client import SemanticScholarClient

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=10.0),
            follow_redirects=True,
        ) as http_client:
            s2_client = SemanticScholarClient(http_client, api_key=settings.s2_api_key)
            neo4j_client = Neo4jClient(
                settings.neo4j_uri, settings.neo4j_user, settings.neo4j_password
            )
            try:
                graph = await expand_citations(
                    seed_paper_ids=body.paper_ids,
                    s2_client=s2_client,
                    neo4j_client=neo4j_client,
                    max_depth=body.depth,
                    budget_per_level=body.budget // max(body.depth, 1),
                    total_budget=body.budget,
                )
                new_papers = len(graph.papers)
                new_edges = len(graph.edges)
            finally:
                await neo4j_client.close()

    except Exception as exc:
        logger.warning("Manual expansion failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=f"Expansion service unavailable: {exc}",
        ) from exc

    return ApiResponse(
        success=True,
        data=ExpandAreaResponse(
            task_id=task_id,
            new_papers=new_papers,
            new_edges=new_edges,
            message=f"Expanded {new_papers} papers, {new_edges} edges",
        ),
    )


@router.get("/tasks/{task_id}/report")
async def get_deep_research_report(
    task_id: str,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> PlainTextResponse:
    """Retrieve the Markdown literature review for a completed task."""
    result = await session.execute(
        select(DeepResearchTask).where(DeepResearchTask.id == task_id)
    )
    task = result.scalar_one_or_none()

    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if task.report_markdown is None:
        raise HTTPException(status_code=404, detail="Report not yet generated")

    return PlainTextResponse(
        content=task.report_markdown,
        media_type="text/markdown",
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
