"""arXiv API client for academic paper search.

Uses the arXiv Atom XML API with strict rate limiting
(1 request per 3 seconds, enforced via asyncio.Semaphore + sleep).
"""

import asyncio
import logging
import xml.etree.ElementTree as ET

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.schemas.paper import PaperResult, PaperSource

from .base_client import BasePaperClient

logger = logging.getLogger(__name__)

ARXIV_BASE = "https://export.arxiv.org/api/query"

# arXiv namespace in Atom feed
ATOM_NS = "http://www.w3.org/2005/Atom"
ARXIV_NS = "http://arxiv.org/schemas/atom"

# Global rate limiter: 1 request per 3 seconds
_arxiv_semaphore = asyncio.Semaphore(1)


def _extract_arxiv_id(id_url: str) -> str:
    """Extract arXiv ID from the full URL (e.g., http://arxiv.org/abs/2301.12345v1)."""
    # Strip version suffix and extract ID
    parts = id_url.rstrip("/").split("/")
    arxiv_id = parts[-1] if parts else id_url
    # Remove version (e.g., v1, v2)
    if "v" in arxiv_id and arxiv_id.split("v")[-1].isdigit():
        arxiv_id = arxiv_id.rsplit("v", 1)[0]
    return arxiv_id


def _map_arxiv_to_paper(entry: ET.Element) -> PaperResult | None:
    """Map an arXiv Atom entry to PaperResult."""
    title_elem = entry.find(f"{{{ATOM_NS}}}title")
    title = (title_elem.text or "").strip().replace("\n", " ") if title_elem is not None else ""
    if not title:
        return None

    # arXiv ID from entry id
    id_elem = entry.find(f"{{{ATOM_NS}}}id")
    arxiv_id = _extract_arxiv_id(id_elem.text or "") if id_elem is not None else None

    # Abstract
    summary_elem = entry.find(f"{{{ATOM_NS}}}summary")
    abstract = (summary_elem.text or "").strip().replace("\n", " ") if summary_elem is not None else None

    # Authors
    authors: list[str] = []
    for author_elem in entry.findall(f"{{{ATOM_NS}}}author"):
        name_elem = author_elem.find(f"{{{ATOM_NS}}}name")
        if name_elem is not None and name_elem.text:
            authors.append(name_elem.text.strip())

    # Published year
    published_elem = entry.find(f"{{{ATOM_NS}}}published")
    year = None
    if published_elem is not None and published_elem.text:
        try:
            year = int(published_elem.text[:4])
        except (ValueError, IndexError):
            pass

    # PDF link
    pdf_url = None
    for link in entry.findall(f"{{{ATOM_NS}}}link"):
        if link.get("title") == "pdf":
            pdf_url = link.get("href")
            break

    # DOI (from arxiv:doi element if present)
    doi_elem = entry.find(f"{{{ARXIV_NS}}}doi")
    doi = doi_elem.text.strip() if doi_elem is not None and doi_elem.text else None

    # Category/venue
    primary_cat = entry.find(f"{{{ARXIV_NS}}}primary_category")
    venue = primary_cat.get("term") if primary_cat is not None else None

    return PaperResult(
        doi=doi,
        arxiv_id=arxiv_id,
        title=title,
        abstract=abstract,
        authors=authors,
        year=year,
        venue=venue,
        pdf_url=pdf_url,
        is_open_access=True,  # All arXiv papers are open access
        sources=[PaperSource.ARXIV],
    )


class ArxivClient(BasePaperClient):
    """arXiv paper search client with strict rate limiting."""

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=3, max=15),
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TimeoutException)),
    )
    async def _query(self, search_query: str, max_results: int = 25) -> list[PaperResult]:
        """Execute an arXiv API query with rate limiting."""
        async with _arxiv_semaphore:
            response = await self._client.get(
                ARXIV_BASE,
                params={
                    "search_query": search_query,
                    "start": "0",
                    "max_results": str(min(max_results, 100)),
                },
                timeout=30.0,
            )
            response.raise_for_status()

            # Enforce 3-second delay between requests
            await asyncio.sleep(3)

        root = ET.fromstring(response.text)
        papers: list[PaperResult] = []
        for entry in root.findall(f"{{{ATOM_NS}}}entry"):
            paper = _map_arxiv_to_paper(entry)
            if paper is not None:
                papers.append(paper)
        return papers

    async def search_keywords(
        self, query: str, limit: int = 25
    ) -> list[PaperResult]:
        """Search arXiv by keyword."""
        return await self._query(f"all:{query}", max_results=limit)

    async def search_doi(self, doi: str) -> PaperResult | None:
        """arXiv does not support DOI search natively."""
        # arXiv doesn't index by DOI; return None
        return None

    async def search_author(
        self, author: str, limit: int = 25
    ) -> list[PaperResult]:
        """Search arXiv papers by author name."""
        return await self._query(f"au:{author}", max_results=limit)
