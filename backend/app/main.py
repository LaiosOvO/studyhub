"""FastAPI application entry point.

Configures the app with lifespan, middleware, and routes.
Includes auth, health, LLM, search, citation, scholar, and
deep research endpoints.
"""

import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.middleware.cors import setup_cors
from app.middleware.rate_limit import limiter
from app.routers.auth import router as auth_router
from app.routers.citations import router as citations_router
from app.routers.deep_research import router as deep_research_router
from app.routers.health import router as health_router
from app.routers.llm import router as llm_router
from app.routers.papers import router as papers_router
from app.routers.scholars import router as scholars_router
from app.routers.search import router as search_router
from app.services.temporal_service import get_temporal_client, reset_client

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown hooks."""
    # Startup: shared HTTP client for paper search
    app.state.http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(30.0, connect=10.0),
        follow_redirects=True,
        limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
    )

    # Startup: Meilisearch for paper search index (non-fatal if unavailable)
    try:
        from app.config import get_settings
        from app.services.search_index.index_config import setup_papers_index
        from app.services.search_index.meilisearch_service import MeilisearchService

        settings = get_settings()
        ms_service = MeilisearchService(settings.meilisearch_url, settings.meilisearch_api_key)
        await setup_papers_index(ms_service.client)
        app.state.meilisearch = ms_service
        logger.info("Meilisearch connected and papers index configured")
    except Exception as exc:
        logger.warning("Meilisearch not available at startup: %s", exc)
        app.state.meilisearch = None

    # Startup: Neo4j for citation graph (non-fatal if unavailable)
    try:
        from app.config import get_settings as _get_neo4j_settings
        from app.services.citation_network.neo4j_client import Neo4jClient

        _settings = _get_neo4j_settings()
        neo4j_client = Neo4jClient(
            _settings.neo4j_uri, _settings.neo4j_user, _settings.neo4j_password
        )
        await neo4j_client.verify_connectivity()
        await neo4j_client.setup_schema()
        app.state.neo4j = neo4j_client
        logger.info("Neo4j connected and schema configured")
    except Exception as exc:
        logger.warning("Neo4j not available at startup: %s", exc)
        app.state.neo4j = None

    # Startup: attempt Temporal connection (non-fatal if unavailable)
    try:
        await get_temporal_client()
        logger.info("Temporal client connected successfully")
    except Exception as exc:
        logger.warning("Temporal not available at startup: %s", exc)

    yield

    # Shutdown: close shared HTTP client
    await app.state.http_client.aclose()

    # Shutdown: close Neo4j connection
    if getattr(app.state, "neo4j", None) is not None:
        await app.state.neo4j.close()

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
    application.include_router(search_router, prefix="/search", tags=["search"])
    application.include_router(papers_router, prefix="/papers", tags=["papers"])
    application.include_router(citations_router, prefix="/citations", tags=["citations"])
    application.include_router(scholars_router, prefix="/scholars", tags=["scholars"])
    application.include_router(deep_research_router, prefix="/api/v1", tags=["deep-research"])

    return application


# Module-level app instance for uvicorn
app = create_app()
