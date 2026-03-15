"""FastAPI application entry point.

Configures the app, middleware, and routes.
Extended by subsequent plans (auth, additional routers).
"""

import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request, status
from pydantic import BaseModel, Field
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.routers.llm import limiter, router as llm_router
from app.services.temporal_service import get_temporal_client, reset_client, start_workflow
from app.workflows.deep_research import DeepResearchInput, DeepResearchWorkflow

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown hooks."""
    # Startup: attempt Temporal connection (non-fatal if unavailable)
    try:
        await get_temporal_client()
        logger.info("Temporal client connected successfully")
    except Exception as exc:
        logger.warning("Temporal not available at startup: %s", exc)

    yield

    # Shutdown: reset Temporal client
    await reset_client()


app = FastAPI(
    title="StudyHub API",
    version="0.1.0",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Routers
app.include_router(llm_router)


@app.get("/health")
async def health_check() -> dict:
    """Basic health check endpoint."""
    return {"status": "ok"}


# ─── Workflow endpoints ────────────────────────────────────────────────


class StartDeepResearchRequest(BaseModel):
    """Request body to start a Deep Research workflow."""

    research_direction: str = Field(
        ..., min_length=1, max_length=500,
        description="Research topic or question to investigate",
    )
    depth: int = Field(default=2, ge=1, le=5)
    max_papers: int = Field(default=100, ge=1, le=1000)


class StartWorkflowResponse(BaseModel):
    """Response after starting a workflow."""

    workflow_id: str
    status: str


@app.post("/workflows/deep-research", response_model=dict)
async def start_deep_research(
    request: Request,
    body: StartDeepResearchRequest,
) -> dict:
    """Start a Deep Research workflow via Temporal.

    Requires authentication (user_id in request state).
    Returns the workflow ID for status tracking.
    """
    user_id = getattr(request.state, "user_id", None)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    workflow_id = f"deep-research-{user_id}-{uuid.uuid4().hex[:8]}"

    try:
        await start_workflow(
            workflow_class=DeepResearchWorkflow,
            workflow_id=workflow_id,
            args=DeepResearchInput(
                user_id=user_id,
                research_direction=body.research_direction,
                depth=body.depth,
                max_papers=body.max_papers,
            ),
        )
    except Exception as exc:
        logger.error("Failed to start workflow: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Workflow service unavailable",
        ) from exc

    return {
        "success": True,
        "data": StartWorkflowResponse(
            workflow_id=workflow_id,
            status="started",
        ).model_dump(),
        "error": None,
    }
