"""Temporal activity definitions for the Deep Research pipeline.

Each activity creates its own clients/sessions (isolation pattern)
and uses JSON string I/O for Temporal payload serialization.

Reference: gpt-researcher async data fetching, AI-Scientist pipeline.
"""

import json
import logging

import httpx
from temporalio import activity

from app.config import get_settings

logger = logging.getLogger(__name__)


@activity.defn
async def placeholder_search(research_direction: str) -> dict:
    """Placeholder search activity from Phase 1. Kept for backward compatibility."""
    return {"status": "placeholder", "direction": research_direction}


@activity.defn
async def search_papers_activity(input_json: str) -> str:
    """Search academic sources and persist papers to PostgreSQL.

    Input JSON: {query, search_type, limit, sources, user_id, task_id}
    Output JSON: {paper_ids, count}
    """
    from sqlalchemy import select

    from app.database import get_db_engine
    from app.models.paper import Paper
    from app.schemas.paper import PaperSource
    from app.schemas.search import SearchRequest
    from app.services.paper_search.aggregator import search_all_sources

    params = json.loads(input_json)

    # Build search request
    sources = None
    if params.get("sources"):
        sources = [PaperSource(s) for s in params["sources"]]

    search_request = SearchRequest(
        query=params["query"],
        search_type=params.get("search_type", "keyword"),
        limit=params.get("limit", 25),
        sources=sources,
    )

    # Create isolated HTTP client for this activity
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(30.0, connect=10.0),
        follow_redirects=True,
    ) as http_client:
        response = await search_all_sources(
            request=search_request,
            http_client=http_client,
            browser_pool=None,  # API-only in workflow context
        )

    # Persist papers to PostgreSQL
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    engine = get_db_engine()
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    paper_ids: list[str] = []

    async with session_factory() as session:
        for paper_result in response.papers:
            # Check if paper already exists by DOI or title
            existing = None
            if paper_result.doi:
                result = await session.execute(
                    select(Paper).where(Paper.doi == paper_result.doi)
                )
                existing = result.scalar_one_or_none()

            if existing:
                paper_ids.append(existing.id)
            else:
                paper = Paper(
                    title=paper_result.title,
                    abstract=paper_result.abstract,
                    authors=paper_result.authors,
                    year=paper_result.year,
                    venue=paper_result.venue,
                    language=paper_result.language,
                    citation_count=paper_result.citation_count,
                    doi=paper_result.doi,
                    openalex_id=paper_result.openalex_id,
                    s2_id=paper_result.s2_id,
                    pmid=paper_result.pmid,
                    arxiv_id=paper_result.arxiv_id,
                    pdf_url=paper_result.pdf_url,
                    is_open_access=paper_result.is_open_access,
                    sources=[s.value for s in paper_result.sources],
                )
                session.add(paper)
                await session.flush()
                paper_ids.append(paper.id)

            await session.commit()

    await engine.dispose()

    logger.info(
        "search_papers_activity: found %d papers, persisted %d",
        response.total,
        len(paper_ids),
    )

    return json.dumps({"paper_ids": paper_ids, "count": len(paper_ids)})


@activity.defn
async def expand_citations_activity(input_json: str) -> str:
    """Expand citation network from seed papers via Semantic Scholar.

    Input JSON: {paper_ids, depth, budget_per_level, total_budget}
    Output JSON: {node_count, edge_count}
    """
    params = json.loads(input_json)
    paper_ids = params.get("paper_ids", [])

    if not paper_ids:
        return json.dumps({"node_count": 0, "edge_count": 0})

    settings = get_settings()

    # Create isolated clients
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(30.0, connect=10.0),
        follow_redirects=True,
    ) as http_client:
        from app.services.citation_network.neo4j_client import Neo4jClient
        from app.services.paper_search.s2_client import SemanticScholarClient

        s2_client = SemanticScholarClient(http_client, api_key=settings.s2_api_key)

        neo4j_client = Neo4jClient(
            settings.neo4j_uri, settings.neo4j_user, settings.neo4j_password
        )

        try:
            from app.services.citation_network.expansion_engine import expand_citations

            graph = await expand_citations(
                seed_paper_ids=paper_ids,
                s2_client=s2_client,
                neo4j_client=neo4j_client,
                max_depth=params.get("depth", 2),
                budget_per_level=params.get("budget_per_level", 50),
                total_budget=params.get("total_budget", 200),
            )

            node_count = len(graph.papers)
            edge_count = len(graph.edges)
        except Exception as exc:
            logger.warning("Citation expansion failed (non-fatal): %s", exc)
            node_count = 0
            edge_count = 0
        finally:
            await neo4j_client.close()

    logger.info(
        "expand_citations_activity: %d nodes, %d edges",
        node_count,
        edge_count,
    )

    return json.dumps({"node_count": node_count, "edge_count": edge_count})


@activity.defn
async def score_papers_activity(input_json: str) -> str:
    """Score papers by quality and persist scores.

    Input JSON: {paper_ids, task_id}
    Output JSON: {scored_count}
    """
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from app.database import get_db_engine
    from app.models.paper import Paper
    from app.schemas.paper import PaperResult
    from app.services.citation_network.quality_scorer import score_papers_batch

    params = json.loads(input_json)
    paper_ids = params.get("paper_ids", [])

    if not paper_ids:
        return json.dumps({"scored_count": 0})

    settings = get_settings()
    engine = get_db_engine()
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    scored_count = 0

    async with session_factory() as session:
        # Load papers from DB
        result = await session.execute(
            select(Paper).where(Paper.id.in_(paper_ids))
        )
        db_papers = list(result.scalars().all())

        # Convert to PaperResult for scoring
        paper_results = [
            PaperResult(
                title=p.title,
                abstract=p.abstract,
                authors=p.authors or [],
                year=p.year,
                venue=p.venue,
                citation_count=p.citation_count,
                doi=p.doi,
                openalex_id=p.openalex_id,
                s2_id=p.s2_id,
            )
            for p in db_papers
        ]

        # Score papers (Neo4j optional)
        try:
            from app.services.citation_network.neo4j_client import Neo4jClient

            neo4j_client = Neo4jClient(
                settings.neo4j_uri, settings.neo4j_user, settings.neo4j_password
            )
            try:
                scored = await score_papers_batch(paper_results, neo4j_client)
            finally:
                await neo4j_client.close()
        except Exception:
            logger.warning("Neo4j unavailable for scoring, scoring without persistence")
            scored = await score_papers_batch(paper_results, None)

        # Update quality scores in PostgreSQL
        score_map = {}
        for scored_paper in scored:
            key = scored_paper.doi or scored_paper.s2_id or scored_paper.title
            if scored_paper.quality:
                score_map[key] = scored_paper.quality.composite

        for db_paper in db_papers:
            key = db_paper.doi or db_paper.s2_id or db_paper.title
            if key in score_map:
                db_paper.quality_score = score_map[key]
                scored_count += 1

        await session.commit()

    await engine.dispose()

    logger.info("score_papers_activity: scored %d papers", scored_count)
    return json.dumps({"scored_count": scored_count})


@activity.defn
async def analyze_papers_activity(input_json: str) -> str:
    """Placeholder for Plan 02: AI analysis of papers.

    Input JSON: {paper_ids, user_id, task_id, top_n, cost_ceiling}
    Output JSON: {analyzed_count, total_cost}
    """
    params = json.loads(input_json)
    logger.info(
        "analyze_papers_activity: placeholder for %d papers",
        len(params.get("paper_ids", [])),
    )
    return json.dumps({"analyzed_count": 0, "total_cost": 0.0})


@activity.defn
async def classify_relationships_activity(input_json: str) -> str:
    """Placeholder for Plan 02: Classify citation relationships.

    Input JSON: {task_id, user_id}
    Output JSON: {classified_count}
    """
    params = json.loads(input_json)
    logger.info("classify_relationships_activity: placeholder for task %s", params.get("task_id"))
    return json.dumps({"classified_count": 0})


@activity.defn
async def detect_gaps_activity(input_json: str) -> str:
    """Placeholder for Plan 03: Gap detection and trend analysis.

    Input JSON: {task_id, user_id, direction}
    Output JSON: {gap_count, trend_summary}
    """
    params = json.loads(input_json)
    logger.info("detect_gaps_activity: placeholder for task %s", params.get("task_id"))
    return json.dumps({"gap_count": 0, "trend_summary": ""})


@activity.defn
async def generate_report_activity(input_json: str) -> str:
    """Placeholder for Plan 03: Generate literature review report.

    Input JSON: {task_id, user_id, language}
    Output JSON: {report_length, status}
    """
    params = json.loads(input_json)
    logger.info("generate_report_activity: placeholder for task %s", params.get("task_id"))
    return json.dumps({"report_length": 0, "status": "completed"})
