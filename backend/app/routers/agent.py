"""Agent Runtime API — REST endpoints and WebSocket for agent execution.

Provides endpoints to:
- List available skills
- Start an agent run (creates plan)
- Approve/reject a plan
- Stream execution progress via WebSocket
- Get run status, logs, and output
"""

import asyncio
import logging
from typing import Annotated, Any

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_session_factory
from app.dependencies import get_current_user, get_db
from app.models.agent_run import AgentLog, AgentRun
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services.agent.agent_loop import AgentLoop
from app.services.agent.skill_loader import list_skills, load_skill
from app.services.agent.types import AgentEvent, AgentPlan, PlanStep, RunStatus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/agent", tags=["agent"])

# ── Active runs registry (for WebSocket event forwarding) ─────────────────────
_active_ws: dict[str, list[WebSocket]] = {}  # run_id -> list of connected WebSockets


# ── Schemas ───────────────────────────────────────────────────────────────────

class SkillInfo(BaseModel):
    name: str
    display_name: str
    description: str
    output_format: str


class StartRunRequest(BaseModel):
    skill_name: str = Field(..., min_length=1)
    task_id: str | None = None
    auto_approve: bool = False


class RunResponse(BaseModel):
    id: str
    user_id: str
    skill_name: str
    task_id: str | None
    status: str
    plan: dict | None = None
    total_cost: float = 0.0
    total_steps: int = 0
    output_format: str | None = None
    error: str | None = None
    created_at: str
    started_at: str | None = None
    completed_at: str | None = None


class LogEntry(BaseModel):
    id: int
    event_type: str
    step_number: int | None = None
    message: str | None = None
    data: dict | None = None
    timestamp: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _run_to_response(run: AgentRun) -> RunResponse:
    return RunResponse(
        id=run.id,
        user_id=run.user_id,
        skill_name=run.skill_name,
        task_id=run.task_id,
        status=run.status,
        plan=run.plan,
        total_cost=run.total_cost,
        total_steps=run.total_steps,
        output_format=run.output_format,
        error=run.error,
        created_at=run.created_at.isoformat() if run.created_at else "",
        started_at=run.started_at.isoformat() if run.started_at else None,
        completed_at=run.completed_at.isoformat() if run.completed_at else None,
    )


def _dict_to_plan(plan_dict: dict | None) -> AgentPlan | None:
    """Convert a plan dict back to AgentPlan."""
    if not plan_dict:
        return None
    return AgentPlan(
        goal=plan_dict.get("goal", ""),
        steps=[
            PlanStep(
                id=s.get("id", i + 1),
                description=s.get("description", ""),
                tool=s.get("tool"),
                args=s.get("args", {}),
            )
            for i, s in enumerate(plan_dict.get("steps", []))
        ],
        estimated_sections=plan_dict.get("estimated_sections", 0),
    )


def _make_event_forwarder(run_id: str):
    """Create an event callback that forwards to WebSocket clients."""
    async def on_event(event: AgentEvent) -> None:
        ws_list = _active_ws.get(run_id, [])
        if not ws_list:
            return
        msg = event.to_ws_dict()
        dead = []
        for ws in ws_list:
            try:
                await ws.send_json(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            ws_list.remove(ws)
    return on_event


# ── REST Endpoints ────────────────────────────────────────────────────────────

@router.get("/skills")
async def get_skills() -> ApiResponse:
    """List all available agent skills."""
    skills = list_skills()
    return ApiResponse(
        success=True,
        data=[
            SkillInfo(
                name=s.name,
                display_name=s.display_name,
                description=s.description,
                output_format=s.output_format,
            ).model_dump()
            for s in skills
        ],
    )


@router.post("/runs", status_code=201)
async def start_run(
    req: StartRunRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse:
    """Start a new agent run. Generates a plan and waits for approval."""
    loop = AgentLoop(
        session=session,
        user_id=user.id,
        skill_name=req.skill_name,
        task_id=req.task_id,
        on_event=None,  # Will be set once we have run_id
        auto_approve=req.auto_approve,
    )

    try:
        run_id = await loop.start()
        # Now set the event forwarder with the real run_id
        loop.on_event = _make_event_forwarder(run_id)
        await session.commit()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Failed to start agent run")
        await session.rollback()
        raise HTTPException(status_code=500, detail="Failed to start agent run")

    run = await session.get(AgentRun, run_id)
    if not run:
        raise HTTPException(status_code=500, detail="Run record not found after creation")

    return ApiResponse(
        success=True,
        data=_run_to_response(run).model_dump(),
        message="Agent run created" + (" and executing" if req.auto_approve else ", awaiting approval"),
    )


@router.post("/runs/{run_id}/approve")
async def approve_run(
    run_id: str,
    session: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse:
    """Approve the plan and start execution."""
    run = await session.get(AgentRun, run_id)
    if not run or run.user_id != user.id:
        raise HTTPException(status_code=404, detail="Run not found")

    if run.status != RunStatus.AWAITING_APPROVAL.value:
        raise HTTPException(status_code=400, detail=f"Run is not awaiting approval (status: {run.status})")

    # Capture values before response returns (session will close after response)
    skill_name = run.skill_name
    task_id = run.task_id
    plan_dict = run.plan
    user_id = user.id

    run.status = RunStatus.EXECUTING.value
    await session.commit()
    run_response = _run_to_response(run).model_dump()

    # Run execution in background with its own session
    async def _bg_execute() -> None:
        factory = get_session_factory()
        async with factory() as bg_session:
            try:
                loop = AgentLoop(
                    session=bg_session,
                    user_id=user_id,
                    skill_name=skill_name,
                    task_id=task_id,
                    on_event=_make_event_forwarder(run_id),
                )
                loop.run_id = run_id
                loop.plan = _dict_to_plan(plan_dict)
                loop.skill = load_skill(skill_name)
                await loop.execute()
                await bg_session.commit()
            except Exception:
                logger.exception("Background execution failed for run %s", run_id)
                await bg_session.rollback()

    asyncio.create_task(_bg_execute())

    return ApiResponse(success=True, data=run_response, message="Execution started")


@router.post("/runs/{run_id}/reject")
async def reject_run(
    run_id: str,
    session: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse:
    """Reject the plan and cancel the run."""
    run = await session.get(AgentRun, run_id)
    if not run or run.user_id != user.id:
        raise HTTPException(status_code=404, detail="Run not found")

    run.status = RunStatus.CANCELLED.value
    await session.commit()

    return ApiResponse(success=True, data=_run_to_response(run).model_dump(), message="Run cancelled")


@router.get("/runs/{run_id}")
async def get_run(
    run_id: str,
    session: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse:
    """Get run status and details."""
    run = await session.get(AgentRun, run_id)
    if not run or run.user_id != user.id:
        raise HTTPException(status_code=404, detail="Run not found")
    return ApiResponse(success=True, data=_run_to_response(run).model_dump())


@router.get("/runs/{run_id}/output")
async def get_run_output(
    run_id: str,
    session: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse:
    """Get the generated document output."""
    run = await session.get(AgentRun, run_id)
    if not run or run.user_id != user.id:
        raise HTTPException(status_code=404, detail="Run not found")

    if not run.output_artifact:
        raise HTTPException(status_code=404, detail="No output available yet")

    return ApiResponse(
        success=True,
        data={
            "content": run.output_artifact,
            "format": run.output_format,
            "length": len(run.output_artifact),
        },
    )


@router.get("/runs/{run_id}/logs")
async def get_run_logs(
    run_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    session: Annotated[AsyncSession, Depends(get_db)] = None,
    user: Annotated[User, Depends(get_current_user)] = None,
) -> ApiResponse:
    """Get agent run logs (execution history)."""
    run = await session.get(AgentRun, run_id)
    if not run or run.user_id != user.id:
        raise HTTPException(status_code=404, detail="Run not found")

    stmt = (
        select(AgentLog)
        .where(AgentLog.run_id == run_id)
        .order_by(AgentLog.timestamp.asc())
        .offset(offset)
        .limit(limit)
    )
    result = await session.execute(stmt)
    logs = result.scalars().all()

    return ApiResponse(
        success=True,
        data=[
            LogEntry(
                id=log.id,
                event_type=log.event_type,
                step_number=log.step_number,
                message=log.message,
                data=log.data,
                timestamp=log.timestamp.isoformat() if log.timestamp else "",
            ).model_dump()
            for log in logs
        ],
    )


@router.get("/runs")
async def list_runs(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: Annotated[AsyncSession, Depends(get_db)] = None,
    user: Annotated[User, Depends(get_current_user)] = None,
) -> ApiResponse:
    """List user's agent runs."""
    stmt = (
        select(AgentRun)
        .where(AgentRun.user_id == user.id)
        .order_by(AgentRun.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await session.execute(stmt)
    runs = result.scalars().all()

    return ApiResponse(
        success=True,
        data=[_run_to_response(r).model_dump() for r in runs],
    )


# ── WebSocket ─────────────────────────────────────────────────────────────────

@router.websocket("/runs/{run_id}/ws")
async def ws_run_progress(
    websocket: WebSocket,
    run_id: str,
    token: str = Query(default=""),
) -> None:
    """WebSocket endpoint for real-time agent execution events.

    Connect with: ws://host/api/v1/agent/runs/{run_id}/ws?token=JWT
    """
    # Verify JWT (same pattern as deep_research WebSocket)
    if not token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return

    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "access":
            await websocket.close(code=4001, reason="Invalid token type")
            return
        user_id = payload.get("sub")
    except jwt.PyJWTError:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    # Verify the user owns this run
    factory = get_session_factory()
    async with factory() as ws_session:
        run = await ws_session.get(AgentRun, run_id)
        if not run or run.user_id != user_id:
            await websocket.close(code=4003, reason="Access denied")
            return

    await websocket.accept()

    # Register WebSocket
    if run_id not in _active_ws:
        _active_ws[run_id] = []
    _active_ws[run_id].append(websocket)

    try:
        # Send current status immediately
        await websocket.send_json({
            "event_type": "status",
            "message": "WebSocket 已连接",
            "data": {"run_id": run_id},
        })

        # Keep connection alive, listen for client messages
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                if data == "ping":
                    await websocket.send_json({"event_type": "pong", "message": "pong"})
            except asyncio.TimeoutError:
                try:
                    await websocket.send_json({"event_type": "keepalive", "message": ""})
                except Exception:
                    break

    except WebSocketDisconnect:
        pass
    finally:
        ws_list = _active_ws.get(run_id, [])
        if websocket in ws_list:
            ws_list.remove(websocket)
        if not ws_list:
            _active_ws.pop(run_id, None)
