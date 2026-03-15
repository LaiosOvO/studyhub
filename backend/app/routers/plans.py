"""REST endpoints for experiment plan CRUD and generation.

Provides plan listing, retrieval, editing, approval, deletion,
and workflow-backed generation via Temporal.

Reference: deep_research router patterns for auth and response envelope.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.deep_research import DeepResearchTask
from app.models.experiment_plan import ExperimentPlan
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.plan import (
    ExperimentPlanResponse,
    ExperimentPlanUpdate,
    PlanGenerationInput,
)
from app.services.temporal_service import start_workflow
from app.workflows.plan_generation import (
    PlanGenerationWorkflow,
    PlanGenerationWorkflowInput,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/generate",
    response_model=ApiResponse[dict],
    status_code=status.HTTP_202_ACCEPTED,
)
async def generate_plans(
    body: PlanGenerationInput,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[dict]:
    """Start plan generation workflow for a completed research task.

    Validates task ownership and completion status, then starts
    a Temporal workflow for durable plan generation.
    """
    # Validate task exists and belongs to user
    result = await session.execute(
        select(DeepResearchTask).where(DeepResearchTask.id == body.task_id)
    )
    task = result.scalar_one_or_none()

    if task is None:
        raise HTTPException(status_code=404, detail="Research task not found")
    if task.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if task.status != "completed":
        raise HTTPException(
            status_code=409,
            detail="Research task must be completed before generating plans",
        )

    # Start Temporal workflow
    workflow_id = f"plan-gen-{body.task_id}-{uuid.uuid4().hex[:8]}"

    workflow_input = PlanGenerationWorkflowInput(
        task_id=body.task_id,
        user_id=user.id,
        entry_type=body.entry_type,
        source_paper_id=body.source_paper_id,
        source_gap_index=body.source_gap_index,
        data_strategy=body.data_strategy,
        num_plans=body.num_plans,
    )

    try:
        await start_workflow(
            workflow_class=PlanGenerationWorkflow,
            workflow_id=workflow_id,
            args=workflow_input,
        )
    except Exception as exc:
        logger.error("Failed to start plan generation workflow: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Workflow service unavailable",
        ) from exc

    return ApiResponse(
        success=True,
        data={
            "workflow_id": workflow_id,
            "task_id": body.task_id,
            "num_plans": body.num_plans,
        },
        message="Plan generation started",
    )


@router.get(
    "/",
    response_model=ApiResponse[list[ExperimentPlanResponse]],
)
async def list_plans(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
    task_id: str | None = Query(default=None),
    plan_status: str | None = Query(default=None, alias="status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> ApiResponse[list[ExperimentPlanResponse]]:
    """List experiment plans for the current user.

    Supports filtering by task_id and status, with pagination.
    """
    query = (
        select(ExperimentPlan)
        .where(ExperimentPlan.user_id == user.id)
        .order_by(ExperimentPlan.created_at.desc())
    )

    if task_id is not None:
        query = query.where(ExperimentPlan.task_id == task_id)
    if plan_status is not None:
        query = query.where(ExperimentPlan.status == plan_status)

    query = query.offset(skip).limit(limit)

    result = await session.execute(query)
    plans = list(result.scalars().all())

    return ApiResponse(
        success=True,
        data=[ExperimentPlanResponse.model_validate(p) for p in plans],
    )


@router.get(
    "/{plan_id}",
    response_model=ApiResponse[ExperimentPlanResponse],
)
async def get_plan(
    plan_id: str,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[ExperimentPlanResponse]:
    """Get a single experiment plan by ID. Requires ownership."""
    result = await session.execute(
        select(ExperimentPlan).where(ExperimentPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()

    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    if plan.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return ApiResponse(
        success=True,
        data=ExperimentPlanResponse.model_validate(plan),
    )


@router.patch(
    "/{plan_id}",
    response_model=ApiResponse[ExperimentPlanResponse],
)
async def update_plan(
    plan_id: str,
    body: ExperimentPlanUpdate,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[ExperimentPlanResponse]:
    """Update a draft plan's fields. Only draft plans can be edited."""
    result = await session.execute(
        select(ExperimentPlan).where(ExperimentPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()

    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    if plan.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if plan.status != "draft":
        raise HTTPException(
            status_code=409,
            detail="Only draft plans can be edited",
        )

    # Apply updates (only non-None fields)
    update_data = body.model_dump(exclude_unset=True)
    for field_name, value in update_data.items():
        setattr(plan, field_name, value)

    plan.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(plan)

    return ApiResponse(
        success=True,
        data=ExperimentPlanResponse.model_validate(plan),
        message="Plan updated",
    )


@router.delete(
    "/{plan_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_plan(
    plan_id: str,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a draft plan. Only draft plans can be deleted."""
    result = await session.execute(
        select(ExperimentPlan).where(ExperimentPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()

    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    if plan.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if plan.status != "draft":
        raise HTTPException(
            status_code=409,
            detail="Only draft plans can be deleted",
        )

    await session.delete(plan)
    await session.commit()


@router.post(
    "/{plan_id}/approve",
    response_model=ApiResponse[ExperimentPlanResponse],
)
async def approve_plan(
    plan_id: str,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[ExperimentPlanResponse]:
    """Approve a draft plan, changing status to 'approved'."""
    result = await session.execute(
        select(ExperimentPlan).where(ExperimentPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()

    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    if plan.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if plan.status != "draft":
        raise HTTPException(
            status_code=409,
            detail="Only draft plans can be approved",
        )

    plan.status = "approved"
    plan.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(plan)

    return ApiResponse(
        success=True,
        data=ExperimentPlanResponse.model_validate(plan),
        message="Plan approved",
    )
