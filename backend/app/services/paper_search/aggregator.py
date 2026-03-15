"""Fan-out search aggregator across all academic paper sources.

Dispatches searches to OpenAlex, Semantic Scholar, PubMed, arXiv,
CNKI, and Wanfang concurrently via asyncio.gather, then deduplicates
the combined results. Chinese sources (CNKI/Wanfang) require a
BrowserPool and have longer timeouts.
"""

from __future__ import annotations

import asyncio
import logging

import httpx

from app.config import get_settings
from app.schemas.paper import PaperSource
from app.schemas.search import (
    SearchRequest,
    SearchResponse,
    SearchType,
    SourceReport,
    SourceStatus,
)

from .arxiv_client import ArxivClient
from .base_client import BasePaperClient
from .browser_pool import BrowserPool
from .cnki_client import CnkiCaptchaError, CnkiClient
from .deduplicator import deduplicate
from .openalex_client import OpenAlexClient
from .pubmed_client import PubMedClient
from .s2_client import SemanticScholarClient
from .wanfang_client import WanfangBlockedError, WanfangClient

logger = logging.getLogger(__name__)

# Per-source concurrency limits
_SOURCE_SEMAPHORES: dict[PaperSource, asyncio.Semaphore] = {
    PaperSource.OPENALEX: asyncio.Semaphore(10),
    PaperSource.SEMANTIC_SCHOLAR: asyncio.Semaphore(1),
    PaperSource.PUBMED: asyncio.Semaphore(3),
    PaperSource.ARXIV: asyncio.Semaphore(1),
    PaperSource.CNKI: asyncio.Semaphore(1),
    PaperSource.WANFANG: asyncio.Semaphore(1),
}

# Per-source timeouts: browser-based scrapers need more time
_SOURCE_TIMEOUTS: dict[PaperSource, float] = {
    PaperSource.OPENALEX: 10.0,
    PaperSource.SEMANTIC_SCHOLAR: 10.0,
    PaperSource.PUBMED: 10.0,
    PaperSource.ARXIV: 10.0,
    PaperSource.CNKI: 30.0,
    PaperSource.WANFANG: 30.0,
}


def _create_clients(
    http_client: httpx.AsyncClient,
    browser_pool: BrowserPool | None = None,
) -> dict[PaperSource, BasePaperClient]:
    """Create all source clients with shared HTTP client.

    When browser_pool is provided, includes CNKI and Wanfang clients.
    When browser_pool is None, only API-based sources are available
    (backward compatible).
    """
    settings = get_settings()
    clients: dict[PaperSource, BasePaperClient] = {
        PaperSource.OPENALEX: OpenAlexClient(
            http_client, api_key=settings.openalex_api_key
        ),
        PaperSource.SEMANTIC_SCHOLAR: SemanticScholarClient(
            http_client, api_key=settings.s2_api_key
        ),
        PaperSource.PUBMED: PubMedClient(
            http_client, api_key=settings.pubmed_api_key
        ),
        PaperSource.ARXIV: ArxivClient(http_client),
    }

    if browser_pool is not None:
        clients[PaperSource.CNKI] = CnkiClient(http_client, browser_pool)
        clients[PaperSource.WANFANG] = WanfangClient(http_client, browser_pool)

    return clients


def _classify_error(source: PaperSource, error: Exception) -> SourceReport:
    """Classify an exception into a SourceReport with appropriate status."""
    if isinstance(error, CnkiCaptchaError):
        return SourceReport(
            source=source,
            status=SourceStatus.CAPTCHA_BLOCKED,
            message=str(error),
        )
    if isinstance(error, WanfangBlockedError):
        return SourceReport(
            source=source,
            status=SourceStatus.RATE_LIMITED,
            message=str(error),
        )
    if isinstance(error, asyncio.TimeoutError):
        return SourceReport(
            source=source,
            status=SourceStatus.UNAVAILABLE,
            message=f"Timeout after {_SOURCE_TIMEOUTS.get(source, 10.0)}s",
        )
    return SourceReport(
        source=source,
        status=SourceStatus.ERROR,
        message=str(error),
    )


async def _search_source(
    source: PaperSource,
    client: BasePaperClient,
    request: SearchRequest,
) -> list:
    """Search a single source with its concurrency semaphore and timeout."""
    semaphore = _SOURCE_SEMAPHORES.get(source, asyncio.Semaphore(1))
    timeout = _SOURCE_TIMEOUTS.get(source, 10.0)

    async with semaphore:
        task = _execute_search(client, request)
        return await asyncio.wait_for(task, timeout=timeout)


async def _execute_search(
    client: BasePaperClient,
    request: SearchRequest,
) -> list:
    """Execute the appropriate search method on a client."""
    match request.search_type:
        case SearchType.DOI:
            result = await client.search_doi(request.query)
            return [result] if result else []
        case SearchType.AUTHOR:
            return await client.search_author(
                request.query, limit=request.limit
            )
        case SearchType.KEYWORD | SearchType.TITLE:
            return await client.search_keywords(
                request.query, limit=request.limit
            )


async def search_all_sources(
    request: SearchRequest,
    http_client: httpx.AsyncClient,
    browser_pool: BrowserPool | None = None,
) -> SearchResponse:
    """Fan out search to all sources, gather results, and deduplicate.

    Sources that fail are reported in sources_failed and source_reports
    but do not prevent results from other sources from being returned.
    When browser_pool is None, CNKI and Wanfang are not queried.
    """
    clients = _create_clients(http_client, browser_pool=browser_pool)

    # Filter to requested sources, or use all available
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
    source_reports: list[SourceReport] = []

    for source, result in zip(tasks.keys(), results):
        if isinstance(result, Exception):
            logger.warning("Source %s failed: %s", source.value, result)
            sources_failed.append(source)
            source_reports.append(_classify_error(source, result))
        else:
            all_papers.extend(result)
            source_reports.append(
                SourceReport(
                    source=source,
                    status=SourceStatus.AVAILABLE,
                    result_count=len(result),
                )
            )

    # Deduplicate across sources
    unique_papers = deduplicate(all_papers)

    return SearchResponse(
        papers=unique_papers,
        total=len(unique_papers),
        sources_queried=sources_queried,
        sources_failed=sources_failed,
        source_reports=source_reports,
    )
