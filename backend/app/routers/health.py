"""Health check endpoint.

Provides a lightweight health probe for container orchestration
and monitoring systems.
"""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict:
    """Return service health status.

    Used by Docker Compose health checks and load balancers.
    """
    return {"status": "ok"}
