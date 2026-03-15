"""Meilisearch service for paper indexing and search.

Provides CRUD operations and filtered/sorted search against
the Meilisearch papers index with sub-second response times.
"""

import hashlib
import logging

from meilisearch_python_sdk import AsyncClient

from app.schemas.paper import PaperResult

from .index_config import PAPERS_INDEX_NAME

logger = logging.getLogger(__name__)

# Sort parameter mapping
SORT_MAP: dict[str, str | None] = {
    "relevance": None,  # Use default Meilisearch relevance
    "citations": "citation_count:desc",
    "recency": "year:desc",
}


def _generate_doc_id(paper: PaperResult) -> str:
    """Generate a deterministic document ID for a paper.

    Uses DOI hash if available, otherwise title hash.
    This prevents re-indexing duplicates.
    """
    if paper.doi:
        key = paper.doi.lower().strip()
    else:
        key = paper.title.lower().strip()
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:24]


def _paper_to_document(paper: PaperResult) -> dict:
    """Convert a PaperResult to a Meilisearch document.

    Truncates abstract to 500 chars for indexing performance.
    Full abstract stays in PostgreSQL.
    """
    abstract = paper.abstract or ""
    truncated_abstract = abstract[:500] if len(abstract) > 500 else abstract

    return {
        "id": _generate_doc_id(paper),
        "doi": paper.doi,
        "openalex_id": paper.openalex_id,
        "s2_id": paper.s2_id,
        "pmid": paper.pmid,
        "arxiv_id": paper.arxiv_id,
        "title": paper.title,
        "abstract": truncated_abstract,
        "authors": paper.authors,
        "year": paper.year,
        "venue": paper.venue,
        "language": paper.language,
        "citation_count": paper.citation_count,
        "pdf_url": paper.pdf_url,
        "is_open_access": paper.is_open_access,
        "sources": [s.value for s in paper.sources],
    }


def build_filter_string(filters: dict | None) -> str | None:
    """Build a Meilisearch filter string from a filter dictionary.

    Supports: year_from, year_to, min_citations, venue, language, is_open_access.

    Returns None if no filters are provided.
    """
    if not filters:
        return None

    parts: list[str] = []

    if "year_from" in filters and filters["year_from"] is not None:
        parts.append(f"year >= {filters['year_from']}")

    if "year_to" in filters and filters["year_to"] is not None:
        parts.append(f"year <= {filters['year_to']}")

    if "min_citations" in filters and filters["min_citations"] is not None:
        parts.append(f"citation_count >= {filters['min_citations']}")

    if "venue" in filters and filters["venue"]:
        # Escape quotes in venue name
        venue = filters["venue"].replace('"', '\\"')
        parts.append(f'venue = "{venue}"')

    if "language" in filters and filters["language"]:
        lang = filters["language"].replace('"', '\\"')
        parts.append(f'language = "{lang}"')

    if "is_open_access" in filters and filters["is_open_access"] is not None:
        parts.append(f"is_open_access = {str(filters['is_open_access']).lower()}")

    return " AND ".join(parts) if parts else None


class MeilisearchService:
    """Async Meilisearch service for paper indexing and search."""

    def __init__(self, meilisearch_url: str, api_key: str) -> None:
        self._client = AsyncClient(meilisearch_url, api_key)
        self._index = self._client.index(PAPERS_INDEX_NAME)

    @property
    def client(self) -> AsyncClient:
        """Return the underlying Meilisearch client for index setup."""
        return self._client

    async def index_papers(self, papers: list[PaperResult]) -> None:
        """Index a list of papers in Meilisearch.

        Converts papers to documents with deterministic IDs
        and adds them in a single batch.
        """
        if not papers:
            return

        documents = [_paper_to_document(p) for p in papers]
        try:
            await self._index.add_documents(documents)
            logger.info("Indexed %d papers in Meilisearch", len(documents))
        except Exception as exc:
            logger.error("Failed to index papers: %s", exc)
            raise

    async def search(
        self,
        query: str,
        filters: dict | None = None,
        sort_by: str | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """Search papers in Meilisearch with optional filters and sorting.

        Returns:
            Tuple of (results list, total hits count).
        """
        filter_string = build_filter_string(filters)

        # Map sort parameter
        sort_list = None
        if sort_by and sort_by in SORT_MAP and SORT_MAP[sort_by] is not None:
            sort_list = [SORT_MAP[sort_by]]

        try:
            result = await self._index.search(
                query,
                filter=filter_string,
                sort=sort_list,
                limit=limit,
                offset=offset,
            )
            hits = result.hits or []
            total = result.estimated_total_hits or len(hits)
            return hits, total
        except Exception as exc:
            logger.error("Meilisearch search failed: %s", exc)
            raise

    async def delete_paper(self, doc_id: str) -> None:
        """Delete a paper document from the index."""
        try:
            await self._index.delete_document(doc_id)
        except Exception as exc:
            logger.error("Failed to delete document %s: %s", doc_id, exc)
            raise

    async def get_paper(self, doc_id: str) -> dict | None:
        """Retrieve a single paper document by ID."""
        try:
            return await self._index.get_document(doc_id)
        except Exception:
            return None
