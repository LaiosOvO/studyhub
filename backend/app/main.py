"""FastAPI application entry point.

Configures the app with lifespan, middleware, and routes.
Includes auth, health, LLM, and workflow endpoints.
"""

import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request, status
from pydantic import BaseModel, Field
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.middleware.cors import setup_cors
from app.middleware.rate_limit import limiter
from app.routers.auth import router as auth_router
from app.routers.health import router as health_router
from app.routers.llm import router as llm_router
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


def create_app() -> FastAPI:
    """Application factory. Creates and configures the FastAPI instance."""
    application = FastAPI(
        title="StudyHub API",
        version="0.1.0",
        lifespan=lifespan,
    )

    # ─── Middleware ────────────────────────────────────────────────────
    setup_cors(application)

    # Rate limiting
    application.state.limiter = limiter
    application.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # ─── Routers ──────────────────────────────────────────────────────
    application.include_router(health_router)
    application.include_router(auth_router)
    application.include_router(llm_router)

    # ─── Workflow endpoints ───────────────────────────────────────────
    _register_workflow_routes(application)

    return application


# ─── Workflow endpoints ───────────────────────────────────────────────────


class StartDeepResearchRequest(BaseModel):
    """Request body to start a Deep Research workflow."""

    research_direction: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Research topic or question to investigate",
    )
    depth: int = Field(default=2, ge=1, le=5)
    max_papers: int = Field(default=100, ge=1, le=1000)


class StartWorkflowResponse(BaseModel):
    """Response after starting a workflow."""

    workflow_id: str
    status: str


def _register_workflow_routes(application: FastAPI) -> None:
    """Register workflow-related routes on the application."""

    @application.post("/workflows/deep-research", response_model=dict)
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


# Module-level app instance for uvicorn
app = create_app()
