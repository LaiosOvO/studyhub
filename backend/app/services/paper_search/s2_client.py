"""Semantic Scholar API client for academic paper search.

Uses httpx async directly against the S2 Graph API v1.
Supports optional API key for dedicated rate limits (1 RPS vs shared pool).
"""

import logging

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.schemas.paper import PaperResult, PaperSource

from .base_client import BasePaperClient

# Lazy import to avoid circular dependency at module level
# CitationEdge imported inside methods that need it

logger = logging.getLogger(__name__)

S2_BASE = "https://api.semanticscholar.org/graph/v1"
S2_FIELDS = (
    "paperId,externalIds,title,abstract,authors,year,"
    "citationCount,venue,isOpenAccess,openAccessPdf"
)


def _map_s2_to_paper(record: dict) -> PaperResult:
    """Map a Semantic Scholar paper record to PaperResult."""
    external_ids = record.get("externalIds") or {}
    doi = external_ids.get("DOI")
    arxiv_id = external_ids.get("ArXiv")
    pmid = external_ids.get("PubMed")

    authors = [
        a.get("name", "")
        for a in (record.get("authors") or [])
        if a.get("name")
    ]

    oa_pdf = record.get("openAccessPdf") or {}

    return PaperResult(
        doi=doi,
        s2_id=record.get("paperId"),
        arxiv_id=arxiv_id,
        pmid=pmid,
        title=record.get("title") or "",
        abstract=record.get("abstract"),
        authors=authors,
        year=record.get("year"),
        venue=record.get("venue") or None,
        citation_count=record.get("citationCount") or 0,
        pdf_url=oa_pdf.get("url"),
        is_open_access=record.get("isOpenAccess", False),
        sources=[PaperSource.SEMANTIC_SCHOLAR],
    )


class SemanticScholarClient(BasePaperClient):
    """Semantic Scholar paper search client."""

    def __init__(self, http_client: httpx.AsyncClient, api_key: str = "") -> None:
        super().__init__(http_client)
        self._headers: dict[str, str] = {}
        if api_key:
            self._headers["x-api-key"] = api_key

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TimeoutException)),
    )
    async def search_keywords(
        self, query: str, limit: int = 25
    ) -> list[PaperResult]:
        """Search S2 papers by keyword."""
        response = await self._client.get(
            f"{S2_BASE}/paper/search",
            params={"query": query, "limit": min(limit, 100), "fields": S2_FIELDS},
            headers=self._headers,
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json().get("data") or []
        return [_map_s2_to_paper(p) for p in data]

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TimeoutException)),
    )
    async def search_doi(self, doi: str) -> PaperResult | None:
        """Look up a paper by DOI in Semantic Scholar."""
        try:
            response = await self._client.get(
                f"{S2_BASE}/paper/DOI:{doi}",
                params={"fields": S2_FIELDS},
                headers=self._headers,
                timeout=30.0,
            )
            response.raise_for_status()
            return _map_s2_to_paper(response.json())
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                return None
            raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TimeoutException)),
    )
    async def search_author(
        self, author: str, limit: int = 25
    ) -> list[PaperResult]:
        """Search papers by author name in Semantic Scholar."""
        # Step 1: Find the author
        author_resp = await self._client.get(
            f"{S2_BASE}/author/search",
            params={"query": author, "limit": 1},
            headers=self._headers,
            timeout=30.0,
        )
        author_resp.raise_for_status()
        author_data = author_resp.json().get("data") or []
        if not author_data:
            return []

        author_id = author_data[0].get("authorId")
        if not author_id:
            return []

        # Step 2: Get author's papers
        papers_resp = await self._client.get(
            f"{S2_BASE}/author/{author_id}/papers",
            params={"limit": min(limit, 100), "fields": S2_FIELDS},
            headers=self._headers,
            timeout=30.0,
        )
        papers_resp.raise_for_status()
        papers = papers_resp.json().get("data") or []
        return [_map_s2_to_paper(p) for p in papers]

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TimeoutException)),
    )
    async def get_citations(
        self, paper_id: str, limit: int = 100, offset: int = 0
    ) -> list:
        """Fetch papers that cite the given paper.

        Returns list of CitationEdge with citing paper and metadata.
        """
        from app.schemas.citation import CitationEdge

        try:
            response = await self._client.get(
                f"{S2_BASE}/paper/{paper_id}/citations",
                params={
                    "fields": f"citingPaper.{S2_FIELDS},isInfluential,intents",
                    "limit": min(limit, 1000),
                    "offset": offset,
                },
                headers=self._headers,
                timeout=30.0,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                return []
            raise

        data = response.json().get("data") or []
        edges: list[CitationEdge] = []
        for item in data:
            citing_paper_data = item.get("citingPaper")
            if not citing_paper_data or not citing_paper_data.get("paperId"):
                continue
            edges.append(
                CitationEdge(
                    citing_paper=_map_s2_to_paper(citing_paper_data),
                    is_influential=item.get("isInfluential", False),
                    intents=item.get("intents") or [],
                )
            )
        return edges

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TimeoutException)),
    )
    async def get_references(
        self, paper_id: str, limit: int = 100, offset: int = 0
    ) -> list:
        """Fetch papers referenced by the given paper.

        Returns list of CitationEdge with cited paper and metadata.
        """
        from app.schemas.citation import CitationEdge

        try:
            response = await self._client.get(
                f"{S2_BASE}/paper/{paper_id}/references",
                params={
                    "fields": f"citedPaper.{S2_FIELDS},isInfluential,intents",
                    "limit": min(limit, 1000),
                    "offset": offset,
                },
                headers=self._headers,
                timeout=30.0,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                return []
            raise

        data = response.json().get("data") or []
        edges: list[CitationEdge] = []
        for item in data:
            cited_paper_data = item.get("citedPaper")
            if not cited_paper_data or not cited_paper_data.get("paperId"):
                continue
            edges.append(
                CitationEdge(
                    citing_paper=_map_s2_to_paper(cited_paper_data),
                    is_influential=item.get("isInfluential", False),
                    intents=item.get("intents") or [],
                )
            )
        return edges
