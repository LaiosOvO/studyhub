"""Paper search API endpoints.

Provides GET /search/papers with two-phase search strategy:
1. Query Meilisearch first (sub-second response with filters/sort)
2. Fall back to multi-source aggregator on cache miss, then index results

This "index-on-search" pattern fills Meilisearch gradually as users search.
"""

import logging

import httpx
from fastapi import APIRouter, Query, Request

from app.middleware.rate_limit import limiter
from app.schemas.common import ApiResponse
from app.schemas.paper import PaperResult, PaperSource
from app.schemas.search import SearchRequest, SearchResponse, SearchType
from app.services.paper_search.aggregator import search_all_sources

logger = logging.getLogger(__name__)

router = APIRouter()

SEARCH_RATE_LIMIT = "30/minute"


def _get_http_client(request: Request) -> httpx.AsyncClient:
    """Get the shared HTTP client from app state."""
    return request.app.state.http_client


def _get_meilisearch(request: Request):
    """Get the Meilisearch service from app state (may be None)."""
    return getattr(request.app.state, "meilisearch", None)


@router.get("/papers", response_model=ApiResponse[SearchResponse])
@limiter.limit(SEARCH_RATE_LIMIT)
async def search_papers(
    request: Request,
    q: str = Query(..., min_length=1, max_length=500, description="Search query"),
    type: SearchType = Query(default=SearchType.KEYWORD, description="Search type"),
    limit: int = Query(default=25, ge=1, le=100, description="Max results"),
    page: int = Query(default=1, ge=1, description="Page number"),
    sources: str | None = Query(default=None, description="Comma-separated sources to query"),
    year_from: int | None = Query(default=None, description="Filter: minimum year"),
    year_to: int | None = Query(default=None, description="Filter: maximum year"),
    min_citations: int | None = Query(default=None, ge=0, description="Filter: minimum citations"),
    venue: str | None = Query(default=None, description="Filter: venue name"),
    language: str | None = Query(default=None, description="Filter: language code"),
    sort_by: str | None = Query(
        default=None,
        description="Sort by: relevance, citations, or recency",
    ),
) -> ApiResponse[SearchResponse]:
    """Search academic papers with filtering and sorting.

    Two-phase strategy:
    1. If Meilisearch is available, query it first (ms-level response).
    2. On cache miss (0 results), fall back to 4-source aggregator,
       then index the fresh results in Meilisearch for next time.
    """
    # Parse sources filter
    source_list: list[PaperSource] | None = None
    if sources:
        try:
            source_list = [PaperSource(s.strip()) for s in sources.split(",")]
        except ValueError as exc:
            return ApiResponse(success=False, error=f"Invalid source: {exc}")

    offset = (page - 1) * limit
    ms_service = _get_meilisearch(request)

    # Build filter dict for Meilisearch
    filters: dict = {}
    if year_from is not None:
        filters["year_from"] = year_from
    if year_to is not None:
        filters["year_to"] = year_to
    if min_citations is not None:
        filters["min_citations"] = min_citations
    if venue:
        filters["venue"] = venue
    if language:
        filters["language"] = language

    # Phase 1: Try Meilisearch first (if available and keyword search)
    if ms_service is not None and type == SearchType.KEYWORD:
        try:
            hits, total = await ms_service.search(
                query=q,
                filters=filters if filters else None,
                sort_by=sort_by,
                limit=limit,
                offset=offset,
            )
            if hits:
                # Convert Meilisearch hits to PaperResult
                papers = [_hit_to_paper(h) for h in hits]
                return ApiResponse(
                    success=True,
                    data=SearchResponse(
                        papers=papers,
                        total=total,
                        sources_queried=[],
                        sources_failed=[],
                        from_cache=True,
                    ),
                )
        except Exception as exc:
            logger.warning("Meilisearch search failed, falling back to aggregator: %s", exc)

    # Phase 2: Fall back to multi-source aggregator
    search_request = SearchRequest(
        query=q,
        search_type=type,
        limit=limit,
        sources=source_list,
    )

    http_client = _get_http_client(request)

    try:
        response = await search_all_sources(search_request, http_client)

        # Index fresh results in Meilisearch for next time
        if ms_service is not None and response.papers:
            try:
                await ms_service.index_papers(response.papers)
            except Exception as exc:
                logger.warning("Failed to index results in Meilisearch: %s", exc)

        return ApiResponse(success=True, data=response)
    except Exception as exc:
        logger.error("Search failed: %s", exc)
        return ApiResponse(success=False, error="Search failed. Please try again.")


def _hit_to_paper(hit: dict) -> PaperResult:
    """Convert a Meilisearch hit dict to PaperResult."""
    source_values = hit.get("sources") or []
    paper_sources: list[PaperSource] = []
    for s in source_values:
        try:
            paper_sources.append(PaperSource(s))
        except ValueError:
            pass

    return PaperResult(
        doi=hit.get("doi"),
        openalex_id=hit.get("openalex_id"),
        s2_id=hit.get("s2_id"),
        pmid=hit.get("pmid"),
        arxiv_id=hit.get("arxiv_id"),
        title=hit.get("title", ""),
        abstract=hit.get("abstract"),
        authors=hit.get("authors") or [],
        year=hit.get("year"),
        venue=hit.get("venue"),
        language=hit.get("language"),
        citation_count=hit.get("citation_count", 0),
        pdf_url=hit.get("pdf_url"),
        is_open_access=hit.get("is_open_access", False),
        sources=paper_sources,
    )
