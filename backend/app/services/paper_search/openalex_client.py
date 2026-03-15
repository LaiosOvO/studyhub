"""OpenAlex API client for academic paper search.

Uses the pyalex library (sync) via asyncio.to_thread for async compatibility.
Requires an API key configured in settings (mandatory since Feb 2026).
"""

import asyncio
import logging

import httpx
import pyalex
from pyalex import Works
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.schemas.paper import PaperResult, PaperSource

from .base_client import BasePaperClient

logger = logging.getLogger(__name__)


def _invert_abstract_index(inverted_index: dict | None) -> str | None:
    """Convert OpenAlex abstract_inverted_index to plain text."""
    if not inverted_index:
        return None
    word_positions: list[tuple[int, str]] = []
    for word, positions in inverted_index.items():
        for pos in positions:
            word_positions.append((pos, word))
    word_positions.sort(key=lambda x: x[0])
    return " ".join(w for _, w in word_positions)


def _map_openalex_to_paper(record: dict) -> PaperResult:
    """Map an OpenAlex work record to the unified PaperResult schema."""
    doi_raw = record.get("doi") or ""
    doi = doi_raw.replace("https://doi.org/", "").strip() if doi_raw else None

    authors = [
        authorship.get("author", {}).get("display_name", "")
        for authorship in (record.get("authorships") or [])
        if authorship.get("author", {}).get("display_name")
    ]

    primary_location = record.get("primary_location") or {}
    source = primary_location.get("source") or {}
    venue = source.get("display_name")

    open_access = record.get("open_access") or {}
    pdf_url = open_access.get("oa_url")

    return PaperResult(
        doi=doi,
        openalex_id=record.get("id"),
        title=record.get("title") or record.get("display_name") or "",
        abstract=_invert_abstract_index(record.get("abstract_inverted_index")),
        authors=authors,
        year=record.get("publication_year"),
        venue=venue,
        language=record.get("language"),
        citation_count=record.get("cited_by_count") or 0,
        pdf_url=pdf_url,
        is_open_access=open_access.get("is_oa", False),
        sources=[PaperSource.OPENALEX],
    )


class OpenAlexClient(BasePaperClient):
    """OpenAlex paper search client using pyalex."""

    def __init__(self, http_client: httpx.AsyncClient, api_key: str = "") -> None:
        super().__init__(http_client)
        if api_key:
            pyalex.config.api_key = api_key
        pyalex.config.email = "studyhub@example.com"

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.HTTPStatusError, ConnectionError)),
    )
    async def search_keywords(
        self, query: str, limit: int = 25
    ) -> list[PaperResult]:
        """Search OpenAlex works by keyword."""

        def _sync_search() -> list[dict]:
            results = (
                Works()
                .search(query)
                .select([
                    "id", "doi", "title", "display_name", "authorships",
                    "publication_year", "cited_by_count", "primary_location",
                    "open_access", "abstract_inverted_index", "language",
                ])
                .get(per_page=min(limit, 200))
            )
            return list(results) if results else []

        records = await asyncio.to_thread(_sync_search)
        return [_map_openalex_to_paper(r) for r in records]

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.HTTPStatusError, ConnectionError)),
    )
    async def search_doi(self, doi: str) -> PaperResult | None:
        """Look up a paper by DOI in OpenAlex."""

        def _sync_doi_search() -> list[dict]:
            results = (
                Works()
                .filter(doi=doi)
                .select([
                    "id", "doi", "title", "display_name", "authorships",
                    "publication_year", "cited_by_count", "primary_location",
                    "open_access", "abstract_inverted_index", "language",
                ])
                .get(per_page=1)
            )
            return list(results) if results else []

        records = await asyncio.to_thread(_sync_doi_search)
        if not records:
            return None
        return _map_openalex_to_paper(records[0])

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.HTTPStatusError, ConnectionError)),
    )
    async def search_author(
        self, author: str, limit: int = 25
    ) -> list[PaperResult]:
        """Search papers by author name in OpenAlex."""

        def _sync_author_search() -> list[dict]:
            results = (
                Works()
                .filter(authorships={"author": {"display_name": {"search": author}}})
                .select([
                    "id", "doi", "title", "display_name", "authorships",
                    "publication_year", "cited_by_count", "primary_location",
                    "open_access", "abstract_inverted_index", "language",
                ])
                .get(per_page=min(limit, 200))
            )
            return list(results) if results else []

        records = await asyncio.to_thread(_sync_author_search)
        return [_map_openalex_to_paper(r) for r in records]
