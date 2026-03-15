"""Fan-out search aggregator across all academic paper sources.

Dispatches searches to OpenAlex, Semantic Scholar, PubMed, and arXiv
concurrently via asyncio.gather, then deduplicates the combined results.
"""

import asyncio
import logging

import httpx

from app.config import get_settings
from app.schemas.paper import PaperSource
from app.schemas.search import SearchRequest, SearchResponse, SearchType

from .arxiv_client import ArxivClient
from .deduplicator import deduplicate
from .openalex_client import OpenAlexClient
from .pubmed_client import PubMedClient
from .s2_client import SemanticScholarClient

logger = logging.getLogger(__name__)

# Per-source concurrency limits
_SOURCE_SEMAPHORES: dict[PaperSource, asyncio.Semaphore] = {
    PaperSource.OPENALEX: asyncio.Semaphore(10),
    PaperSource.SEMANTIC_SCHOLAR: asyncio.Semaphore(1),
    PaperSource.PUBMED: asyncio.Semaphore(3),
    PaperSource.ARXIV: asyncio.Semaphore(1),
}


def _create_clients(
    http_client: httpx.AsyncClient,
) -> dict[PaperSource, OpenAlexClient | SemanticScholarClient | PubMedClient | ArxivClient]:
    """Create all source clients with shared HTTP client."""
    settings = get_settings()
    return {
        PaperSource.OPENALEX: OpenAlexClient(http_client, api_key=settings.openalex_api_key),
        PaperSource.SEMANTIC_SCHOLAR: SemanticScholarClient(http_client, api_key=settings.s2_api_key),
        PaperSource.PUBMED: PubMedClient(http_client, api_key=settings.pubmed_api_key),
        PaperSource.ARXIV: ArxivClient(http_client),
    }


async def _search_source(
    source: PaperSource,
    client: OpenAlexClient | SemanticScholarClient | PubMedClient | ArxivClient,
    request: SearchRequest,
) -> list:
    """Search a single source with its concurrency semaphore."""
    semaphore = _SOURCE_SEMAPHORES.get(source, asyncio.Semaphore(1))
    async with semaphore:
        match request.search_type:
            case SearchType.DOI:
                result = await client.search_doi(request.query)
                return [result] if result else []
            case SearchType.AUTHOR:
                return await client.search_author(request.query, limit=request.limit)
            case SearchType.KEYWORD | SearchType.TITLE:
                return await client.search_keywords(request.query, limit=request.limit)


async def search_all_sources(
    request: SearchRequest,
    http_client: httpx.AsyncClient,
) -> SearchResponse:
    """Fan out search to all sources, gather results, and deduplicate.

    Sources that fail are reported in sources_failed but do not
    prevent results from other sources from being returned.
    """
    clients = _create_clients(http_client)

    # Filter to requested sources, or use all
    active_sources = request.sources or list(clients.keys())
    sources_queried = list(active_sources)

    # Create tasks for each source
    tasks = {
        source: _search_source(source, clients[source], request)
        for source in active_sources
        if source in clients
    }

    # Fan out with return_exceptions=True for resilience
    results = await asyncio.gather(
        *tasks.values(),
        return_exceptions=True,
    )

    all_papers = []
    sources_failed: list[PaperSource] = []

    for source, result in zip(tasks.keys(), results):
        if isinstance(result, Exception):
            logger.warning("Source %s failed: %s", source.value, result)
            sources_failed.append(source)
        else:
            all_papers.extend(result)

    # Deduplicate across sources
    unique_papers = deduplicate(all_papers)

    return SearchResponse(
        papers=unique_papers,
        total=len(unique_papers),
        sources_queried=sources_queried,
        sources_failed=sources_failed,
    )
