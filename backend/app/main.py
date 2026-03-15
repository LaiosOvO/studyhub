"""FastAPI application entry point.

Configures the app, middleware, and routes.
Extended by subsequent plans (auth, additional routers).
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.routers.llm import limiter, router as llm_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown hooks."""
    # Startup: future plans add DB pool warmup, Temporal client, etc.
    yield
    # Shutdown: cleanup


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
