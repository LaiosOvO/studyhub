"""Paper search API endpoints.

Provides GET /search/papers with multi-source fan-out,
deduplication, and optional Meilisearch-backed cached search.
"""

import logging

import httpx
from fastapi import APIRouter, Depends, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.middleware.rate_limit import limiter
from app.schemas.common import ApiResponse
from app.schemas.paper import PaperSource
from app.schemas.search import SearchRequest, SearchResponse, SearchType
from app.services.paper_search.aggregator import search_all_sources

logger = logging.getLogger(__name__)

router = APIRouter()

SEARCH_RATE_LIMIT = "30/minute"


def _get_http_client(request: Request) -> httpx.AsyncClient:
    """Get the shared HTTP client from app state."""
    return request.app.state.http_client


@router.get("/papers", response_model=ApiResponse[SearchResponse])
@limiter.limit(SEARCH_RATE_LIMIT)
async def search_papers(
    request: Request,
    q: str = Query(..., min_length=1, max_length=500, description="Search query"),
    type: SearchType = Query(default=SearchType.KEYWORD, description="Search type"),
    limit: int = Query(default=25, ge=1, le=100, description="Max results"),
    sources: str | None = Query(default=None, description="Comma-separated sources to query"),
) -> ApiResponse[SearchResponse]:
    """Search academic papers across multiple sources.

    Fans out to OpenAlex, Semantic Scholar, PubMed, and arXiv,
    deduplicates results, and returns a unified response.
    """
    # Parse sources filter
    source_list: list[PaperSource] | None = None
    if sources:
        try:
            source_list = [PaperSource(s.strip()) for s in sources.split(",")]
        except ValueError as exc:
            return ApiResponse(success=False, error=f"Invalid source: {exc}")

    search_request = SearchRequest(
        query=q,
        search_type=type,
        limit=limit,
        sources=source_list,
    )

    http_client = _get_http_client(request)

    try:
        response = await search_all_sources(search_request, http_client)
        return ApiResponse(success=True, data=response)
    except Exception as exc:
        logger.error("Search failed: %s", exc)
        return ApiResponse(success=False, error="Search failed. Please try again.")
