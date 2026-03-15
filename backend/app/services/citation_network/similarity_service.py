"""Semantic similarity discovery via S2 Recommendations API.

Discovers related papers beyond direct citation links and stores
RELATED_TO edges in Neo4j alongside CITES edges.

Reference: gpt-researcher multi-source discovery patterns.
"""

import logging

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.schemas.paper import PaperResult
from app.services.citation_network.neo4j_client import Neo4jClient
from app.services.paper_search.s2_client import S2_FIELDS, _map_s2_to_paper

logger = logging.getLogger(__name__)

S2_RECS_BASE = "https://api.semanticscholar.org/recommendations/v1"


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TimeoutException)),
)
async def get_similar_papers(
    http_client: httpx.AsyncClient,
    paper_s2_id: str,
    limit: int = 20,
    api_key: str = "",
) -> list[PaperResult]:
    """Discover semantically related papers via S2 Recommendations API.

    Args:
        http_client: Shared httpx async client.
        paper_s2_id: Semantic Scholar paper ID.
        limit: Maximum number of recommendations.
        api_key: Optional S2 API key for higher rate limits.

    Returns:
        List of recommended PaperResult objects.
    """
    headers: dict[str, str] = {}
    if api_key:
        headers["x-api-key"] = api_key

    try:
        response = await http_client.get(
            f"{S2_RECS_BASE}/papers/forpaper/{paper_s2_id}",
            params={"fields": S2_FIELDS, "limit": min(limit, 500)},
            headers=headers,
            timeout=30.0,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            logger.warning("No recommendations found for paper %s", paper_s2_id)
            return []
        raise

    recommended = response.json().get("recommendedPapers") or []
    return [
        _map_s2_to_paper(paper_data)
        for paper_data in recommended
        if paper_data.get("paperId")
    ]


async def discover_and_store_similar(
    paper_s2_id: str,
    neo4j_client: Neo4jClient,
    http_client: httpx.AsyncClient,
    limit: int = 20,
    api_key: str = "",
) -> list[PaperResult]:
    """Discover similar papers and store them with RELATED_TO edges in Neo4j.

    Fetches recommendations from S2, merges paper nodes, then creates
    RELATED_TO edges between the source paper and each similar paper.

    Args:
        paper_s2_id: Source paper S2 ID.
        neo4j_client: Neo4j client for graph storage.
        http_client: Shared httpx async client.
        limit: Maximum number of similar papers.
        api_key: Optional S2 API key.

    Returns:
        List of discovered similar PaperResult objects.
    """
    similar_papers = await get_similar_papers(http_client, paper_s2_id, limit, api_key)

    if not similar_papers:
        return []

    # Store paper nodes in Neo4j
    paper_dicts = [
        {
            "paper_id": p.s2_id or p.doi or p.title,
            "title": p.title,
            "doi": p.doi,
            "year": p.year,
            "citation_count": p.citation_count,
            "s2_id": p.s2_id,
            "openalex_id": p.openalex_id,
        }
        for p in similar_papers
    ]
    await neo4j_client.batch_merge_papers(paper_dicts)

    # Create RELATED_TO edges
    target_ids = [p.s2_id for p in similar_papers if p.s2_id]
    await neo4j_client.batch_merge_similarity_edges(paper_s2_id, target_ids)

    logger.info(
        "Stored %d similar papers for %s with RELATED_TO edges",
        len(similar_papers), paper_s2_id,
    )

    return similar_papers
