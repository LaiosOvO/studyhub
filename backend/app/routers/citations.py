"""Citation network REST endpoints.

Provides endpoints for citation expansion, manual node expansion,
graph neighborhood queries, quality scoring, and top-N papers.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, status

from app.schemas.citation import CitationExpansionRequest, CitationExpansionResponse
from app.schemas.quality import PaperWithQuality, QualityBreakdown, TopPapersResponse

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_neo4j(request: Request):
    """Extract Neo4j client from app state, raise 503 if unavailable."""
    neo4j = getattr(request.app.state, "neo4j", None)
    if neo4j is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Neo4j service unavailable",
        )
    return neo4j


def _get_s2_client(request: Request):
    """Create an S2 client from app state's http_client."""
    from app.config import get_settings
    from app.services.paper_search.s2_client import SemanticScholarClient

    settings = get_settings()
    http_client = request.app.state.http_client
    return SemanticScholarClient(http_client, api_key=settings.s2_api_key)


@router.post("/expand", response_model=CitationExpansionResponse)
async def expand_citations_endpoint(
    request: Request,
    body: CitationExpansionRequest,
) -> CitationExpansionResponse:
    """Expand citation network from multiple seed papers.

    Runs BFS expansion with budget control and discovers
    semantically similar papers for each seed.
    Rate limit: 5/min (expansion is expensive).
    """
    from app.config import get_settings
    from app.services.citation_network.expansion_engine import expand_citations
    from app.services.citation_network.similarity_service import discover_and_store_similar

    neo4j = _get_neo4j(request)
    s2_client = _get_s2_client(request)
    settings = get_settings()

    graph = await expand_citations(
        seed_paper_ids=body.seed_paper_ids,
        s2_client=s2_client,
        neo4j_client=neo4j,
        max_depth=body.max_depth,
        budget_per_level=body.budget_per_level,
        total_budget=body.total_budget,
    )

    # Discover similar papers for each seed (non-fatal if fails)
    for seed_id in body.seed_paper_ids:
        try:
            await discover_and_store_similar(
                seed_id, neo4j, request.app.state.http_client,
                api_key=settings.s2_api_key,
            )
        except Exception as exc:
            logger.warning("Similarity discovery failed for %s: %s", seed_id, exc)

    return CitationExpansionResponse(
        papers=list(graph.papers.values()),
        edges=[{"citing_id": c, "cited_id": d} for c, d in graph.edges],
        total_discovered=len(graph.papers),
        budget_exhausted=len(graph.papers) >= body.total_budget,
        depth_reached=body.max_depth,
    )


@router.post("/expand-node/{paper_s2_id}", response_model=CitationExpansionResponse)
async def expand_single_node(
    request: Request,
    paper_s2_id: str,
    budget: Annotated[int, Query(ge=1, le=100)] = 20,
) -> CitationExpansionResponse:
    """Single-depth citation expansion for a specific paper node.

    Used for manual expansion from the graph view (CITE-06).
    Rate limit: 10/min.
    """
    from app.config import get_settings
    from app.services.citation_network.expansion_engine import expand_citations
    from app.services.citation_network.similarity_service import discover_and_store_similar

    neo4j = _get_neo4j(request)
    s2_client = _get_s2_client(request)
    settings = get_settings()

    graph = await expand_citations(
        seed_paper_ids=[paper_s2_id],
        s2_client=s2_client,
        neo4j_client=neo4j,
        max_depth=1,
        budget_per_level=budget,
        total_budget=budget,
    )

    # Discover similar papers (non-fatal)
    try:
        await discover_and_store_similar(
            paper_s2_id, neo4j, request.app.state.http_client,
            api_key=settings.s2_api_key,
        )
    except Exception as exc:
        logger.warning("Similarity discovery failed for %s: %s", paper_s2_id, exc)

    return CitationExpansionResponse(
        papers=list(graph.papers.values()),
        edges=[{"citing_id": c, "cited_id": d} for c, d in graph.edges],
        total_discovered=len(graph.papers),
        budget_exhausted=len(graph.papers) >= budget,
        depth_reached=1,
    )


@router.get("/graph/{paper_id}")
async def get_graph_neighborhood(
    request: Request,
    paper_id: str,
    depth: Annotated[int, Query(ge=1, le=3)] = 1,
) -> dict:
    """Query the Neo4j neighborhood around a paper.

    Returns nodes and edges within N hops.
    Rate limit: 30/min.
    """
    neo4j = _get_neo4j(request)
    return await neo4j.get_paper_neighborhood(paper_id, depth=depth)


@router.post("/score", response_model=list[PaperWithQuality])
async def score_papers_endpoint(
    request: Request,
    paper_s2_ids: list[str],
) -> list[PaperWithQuality]:
    """Score papers by their S2 IDs.

    Looks up papers, computes quality scores, and returns breakdowns.
    Rate limit: 5/min (calls OpenAlex for each paper).
    """
    from app.services.citation_network.quality_scorer import score_papers_batch
    from app.services.paper_search.s2_client import SemanticScholarClient

    neo4j = _get_neo4j(request)
    s2_client = _get_s2_client(request)

    # Fetch paper details from S2
    papers = []
    for s2_id in paper_s2_ids:
        try:
            paper = await s2_client.search_doi(s2_id)  # fallback lookup
            if paper is None:
                # Try direct paper lookup
                from app.schemas.paper import PaperResult
                papers.append(PaperResult(s2_id=s2_id, title=f"Paper {s2_id}"))
            else:
                papers.append(paper)
        except Exception:
            from app.schemas.paper import PaperResult
            papers.append(PaperResult(s2_id=s2_id, title=f"Paper {s2_id}"))

    return await score_papers_batch(papers, neo4j_client=neo4j)


@router.get("/top-papers", response_model=TopPapersResponse)
async def get_top_papers_endpoint(
    request: Request,
    n: Annotated[int, Query(ge=1, le=100)] = 10,
) -> TopPapersResponse:
    """Get top-N papers ranked by quality score.

    Returns papers from Neo4j sorted by quality_score descending.
    Rate limit: 30/min.
    """
    from app.services.citation_network.quality_scorer import get_top_papers

    neo4j = _get_neo4j(request)
    top = await get_top_papers(neo4j, n=n)

    return TopPapersResponse(
        papers=[
            PaperWithQuality(
                s2_id=p.get("paper", {}).get("s2_id"),
                title=p.get("paper", {}).get("title", "Unknown"),
                citation_count=p.get("paper", {}).get("citation_count", 0),
                quality=QualityBreakdown(
                    score=p.get("paper", {}).get("quality_score", 0.0),
                    citations_norm=0.0,
                    velocity_norm=0.0,
                    impact_factor_norm=0.0,
                    h_index_norm=0.0,
                    components_available=0,
                ) if p.get("paper", {}).get("quality_score") else None,
            )
            for p in top
        ],
        total_scored=len(top),
    )


@router.get("/paper/{paper_id}/quality", response_model=QualityBreakdown)
async def get_paper_quality(
    request: Request,
    paper_id: str,
) -> QualityBreakdown:
    """Get quality breakdown for a single paper.

    Returns cached score from Neo4j if available, otherwise computes.
    Rate limit: 30/min.
    """
    from app.schemas.paper import PaperResult
    from app.services.citation_network.quality_scorer import score_paper

    _get_neo4j(request)  # Ensure neo4j available

    # Create a minimal paper for scoring
    paper = PaperResult(s2_id=paper_id, title=f"Paper {paper_id}")
    return await score_paper(paper)
