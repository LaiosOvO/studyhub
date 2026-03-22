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

    # Write search results to workspace Git repo
    try:
        from app.services.workspace_service import init_workspace, write_and_commit

        task_id = params.get("task_id")
        if task_id:
            await init_workspace(task_id)

            # Build CSV: id,title,authors,year,venue,citations,quality_score
            csv_lines = ["id,title,authors,year,venue,citations,quality_score"]
            papers_json_list = []
            for pr in response.papers:
                authors_str = "; ".join(pr.authors) if pr.authors else ""
                # Escape commas in CSV fields
                title_safe = pr.title.replace('"', '""') if pr.title else ""
                authors_safe = authors_str.replace('"', '""')
                venue_safe = (pr.venue or "").replace('"', '""')
                csv_lines.append(
                    f'"{pr.doi or ""}","{title_safe}","{authors_safe}",'
                    f'{pr.year or ""},"{venue_safe}",{pr.citation_count or 0},'
                )
                papers_json_list.append({
                    "doi": pr.doi,
                    "title": pr.title,
                    "authors": pr.authors,
                    "year": pr.year,
                    "venue": pr.venue,
                    "citation_count": pr.citation_count,
                    "abstract": pr.abstract,
                    "sources": [s.value for s in pr.sources] if pr.sources else [],
                })

            csv_content = "\n".join(csv_lines)
            json_content = json.dumps(papers_json_list, ensure_ascii=False, indent=2)

            await write_and_commit(
                task_id, "papers.csv", csv_content,
                f"stage: search — found {len(paper_ids)} papers",
            )
            await write_and_commit(
                task_id, "papers.json", json_content,
                f"stage: search — paper metadata JSON ({len(paper_ids)} papers)",
            )
    except Exception as ws_exc:
        logger.warning("Workspace write failed in search_papers_activity (non-fatal): %s", ws_exc)

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

        graph = None
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

    # Write citation network to workspace Git repo
    try:
        from app.services.workspace_service import write_and_commit

        task_id = params.get("task_id")
        if task_id and node_count > 0 and graph is not None:
            citations_data = {
                "node_count": node_count,
                "edge_count": edge_count,
                "nodes": [
                    {"paper_id": p.paper_id, "title": p.title}
                    for p in graph.papers
                ],
                "edges": [
                    {"citing": e.citing_id, "cited": e.cited_id}
                    for e in graph.edges
                ],
            }
            citations_json = json.dumps(citations_data, ensure_ascii=False, indent=2)
            await write_and_commit(
                task_id, "network/citations.json", citations_json,
                f"stage: citations — {node_count} nodes, {edge_count} edges",
            )
    except Exception as ws_exc:
        logger.warning("Workspace write failed in expand_citations_activity (non-fatal): %s", ws_exc)

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
                score_map[key] = scored_paper.quality.score

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
    """Run tiered LLM analysis on papers (Haiku screening + Sonnet deep analysis).

    Input JSON: {paper_ids, user_id, task_id, top_n, cost_ceiling}
    Output JSON: {analyzed_count, total_cost, paper_analyses}

    Stores per-paper analysis in DeepResearchTask.config["paper_analyses"].
    """
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from app.database import get_db_engine
    from app.models.deep_research import DeepResearchTask
    from app.models.paper import Paper
    from app.services.deep_research.analyzer import analyze_papers_tiered

    params = json.loads(input_json)
    paper_ids = params.get("paper_ids", [])
    user_id = params["user_id"]
    task_id = params["task_id"]
    top_n = params.get("top_n", 20)
    cost_ceiling = params.get("cost_ceiling", 10.0)

    if not paper_ids:
        return json.dumps({"analyzed_count": 0, "total_cost": 0.0})

    engine = get_db_engine()
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        # Load papers from DB
        result = await session.execute(
            select(Paper).where(Paper.id.in_(paper_ids))
        )
        papers = list(result.scalars().all())

        # Run tiered analysis
        analyses = await analyze_papers_tiered(
            papers=papers,
            session=session,
            user_id=user_id,
            top_n=top_n,
            cost_ceiling=cost_ceiling,
        )

        # Store analyses in DeepResearchTask.config["paper_analyses"]
        task_result = await session.execute(
            select(DeepResearchTask).where(DeepResearchTask.id == task_id)
        )
        task = task_result.scalar_one_or_none()

        if task:
            paper_analyses = {
                a.paper_id: a.model_dump() for a in analyses
            }
            updated_config = {**task.config, "paper_analyses": paper_analyses}
            task.config = updated_config
            task.papers_analyzed = len(analyses)
            await session.commit()

    await engine.dispose()

    analyzed_count = len(analyses)
    # Rough cost estimate: $0.01 per screening + $0.10 per deep
    total_cost = analyzed_count * 0.01 + min(top_n, analyzed_count) * 0.10

    logger.info(
        "analyze_papers_activity: analyzed %d papers, est. cost $%.2f",
        analyzed_count,
        total_cost,
    )

    # Write per-paper analysis markdown to workspace Git repo
    try:
        from app.services.workspace_service import write_and_commit

        if task_id and analyses:
            for analysis in analyses:
                methods_str = ", ".join(analysis.methods) if analysis.methods else "N/A"
                contributions_str = ""
                if analysis.key_contributions:
                    contributions_str = "\n".join(
                        f"- {c}" for c in analysis.key_contributions
                    )
                else:
                    contributions_str = "N/A"

                limitations_str = ""
                if analysis.limitations:
                    limitations_str = "\n".join(
                        f"- {lim}" for lim in analysis.limitations
                    )
                else:
                    limitations_str = "N/A"

                md_content = (
                    f"# Paper Analysis: {analysis.paper_id}\n\n"
                    f"## TL;DR (EN)\n{analysis.tldr_en or 'N/A'}\n\n"
                    f"## TL;DR (ZH)\n{analysis.tldr_zh or 'N/A'}\n\n"
                    f"## Methods\n{methods_str}\n\n"
                    f"## Datasets\n{', '.join(analysis.datasets) if analysis.datasets else 'N/A'}\n\n"
                    f"## Paper Type\n{analysis.paper_type}\n\n"
                    f"## Key Contributions\n{contributions_str}\n\n"
                    f"## Limitations\n{limitations_str}\n\n"
                    f"## Detailed Methodology\n{analysis.detailed_methodology or 'N/A'}\n"
                )
                await write_and_commit(
                    task_id,
                    f"analysis/{analysis.paper_id}.md",
                    md_content,
                    f"stage: analysis — {analysis.paper_id}",
                )
    except Exception as ws_exc:
        logger.warning("Workspace write failed in analyze_papers_activity (non-fatal): %s", ws_exc)

    return json.dumps({
        "analyzed_count": analyzed_count,
        "total_cost": total_cost,
    })


@activity.defn
async def classify_relationships_activity(input_json: str) -> str:
    """Classify relationships for citation-connected paper pairs.

    Input JSON: {task_id, user_id}
    Output JSON: {classified_count}

    Queries Neo4j for CITES edges, classifies each pair, updates edge properties.
    """
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from app.database import get_db_engine
    from app.models.deep_research import DeepResearchTask
    from app.models.paper import Paper
    from app.services.deep_research.analyzer import classify_relationships

    params = json.loads(input_json)
    task_id = params["task_id"]
    user_id = params["user_id"]

    settings = get_settings()
    engine = get_db_engine()
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    classified_count = 0

    async with session_factory() as session:
        # Load task to get paper IDs from config
        task_result = await session.execute(
            select(DeepResearchTask).where(DeepResearchTask.id == task_id)
        )
        task = task_result.scalar_one_or_none()

        if not task or not task.config.get("paper_analyses"):
            await engine.dispose()
            return json.dumps({"classified_count": 0})

        paper_ids = list(task.config["paper_analyses"].keys())

        # Query Neo4j for citation edges between these papers
        try:
            from app.services.citation_network.neo4j_client import Neo4jClient

            neo4j_client = Neo4jClient(
                settings.neo4j_uri, settings.neo4j_user, settings.neo4j_password
            )

            try:
                # Find CITES edges where both papers are in our corpus
                edge_query = """
                MATCH (a:Paper)-[r:CITES]->(b:Paper)
                WHERE a.paper_id IN $paper_ids AND b.paper_id IN $paper_ids
                RETURN a.paper_id AS citing, b.paper_id AS cited
                LIMIT 500
                """
                edges = await neo4j_client.execute_read(
                    edge_query, paper_ids=paper_ids
                )

                if edges:
                    # Load Paper objects for classification
                    all_paper_ids_in_edges = set()
                    for edge in edges:
                        all_paper_ids_in_edges.add(edge["citing"])
                        all_paper_ids_in_edges.add(edge["cited"])

                    # Map s2_id/paper_id to DB papers
                    result = await session.execute(
                        select(Paper).where(
                            Paper.id.in_(list(all_paper_ids_in_edges))
                            | Paper.s2_id.in_(list(all_paper_ids_in_edges))
                        )
                    )
                    db_papers = list(result.scalars().all())
                    paper_map = {}
                    for p in db_papers:
                        paper_map[p.id] = p
                        if p.s2_id:
                            paper_map[p.s2_id] = p

                    # Build paper pairs
                    pairs = []
                    for edge in edges:
                        paper_a = paper_map.get(edge["citing"])
                        paper_b = paper_map.get(edge["cited"])
                        if paper_a and paper_b:
                            pairs.append((paper_a, paper_b))

                    # Classify relationships
                    if pairs:
                        results = await classify_relationships(
                            paper_pairs=pairs,
                            session=session,
                            user_id=user_id,
                        )

                        # Update Neo4j edges with classification
                        for rel_result in results:
                            if rel_result.relationship != "unrelated":
                                update_query = """
                                MATCH (a:Paper {paper_id: $citing})-[r:CITES]->(b:Paper {paper_id: $cited})
                                SET r.relationship_type = $rel_type, r.confidence = $confidence
                                """
                                await neo4j_client.execute_write(
                                    update_query,
                                    citing=rel_result.paper_a_id,
                                    cited=rel_result.paper_b_id,
                                    rel_type=rel_result.relationship,
                                    confidence=rel_result.confidence,
                                )

                        classified_count = len(results)
            finally:
                await neo4j_client.close()

        except Exception as exc:
            logger.warning("Relationship classification failed (non-fatal): %s", exc)

    await engine.dispose()

    logger.info("classify_relationships_activity: classified %d pairs", classified_count)

    # Update papers.csv with relationship/cluster info in workspace
    try:
        from app.services.workspace_service import read_file, write_and_commit

        if task_id and classified_count > 0:
            # Try to read existing CSV and append cluster column
            try:
                existing_csv = await read_file(task_id, "papers.csv")
                lines = existing_csv.splitlines()
                if lines:
                    # Add cluster_info column to header
                    header = lines[0]
                    if "cluster_info" not in header:
                        lines[0] = header + ",cluster_info"
                    # Append cluster_info to existing rows
                    updated_lines = [lines[0]]
                    for line in lines[1:]:
                        if line.strip():
                            updated_lines.append(line + f",classified ({classified_count} pairs)")
                    updated_csv = "\n".join(updated_lines)
                    await write_and_commit(
                        task_id, "papers.csv", updated_csv,
                        f"stage: classify — {classified_count} relationship pairs classified",
                    )
            except FileNotFoundError:
                logger.debug("papers.csv not found for classify update, skipping")
    except Exception as ws_exc:
        logger.warning("Workspace write failed in classify_relationships_activity (non-fatal): %s", ws_exc)

    return json.dumps({"classified_count": classified_count})


@activity.defn
async def detect_gaps_activity(input_json: str) -> str:
    """Detect research gaps and method trends from analyzed corpus.

    Input JSON: {task_id, user_id, direction}
    Output JSON: {gap_count, trend_summary}

    Loads paper analyses from task config, runs gap and trend detection,
    stores results in DeepResearchTask.gaps and .trends.
    """
    from datetime import datetime

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from app.database import get_db_engine
    from app.models.deep_research import DeepResearchTask
    from app.models.paper import Paper
    from app.services.deep_research.analyzer import PaperAnalysis
    from app.services.deep_research.gap_detector import detect_gaps, detect_trends

    params = json.loads(input_json)
    task_id = params["task_id"]
    user_id = params["user_id"]
    direction = params["direction"]

    engine = get_db_engine()
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    gap_count = 0
    trend_summary = ""

    async with session_factory() as session:
        # Load task and paper analyses
        task_result = await session.execute(
            select(DeepResearchTask).where(DeepResearchTask.id == task_id)
        )
        task = task_result.scalar_one_or_none()

        if not task or not task.config.get("paper_analyses"):
            await engine.dispose()
            return json.dumps({"gap_count": 0, "trend_summary": ""})

        # Reconstruct PaperAnalysis objects from stored JSON
        analyses = [
            PaperAnalysis(**data)
            for data in task.config["paper_analyses"].values()
        ]

        # Load Paper objects from DB
        paper_ids = list(task.config["paper_analyses"].keys())
        paper_result = await session.execute(
            select(Paper).where(Paper.id.in_(paper_ids))
        )
        papers = list(paper_result.scalars().all())

        # Detect gaps
        gap_result = await detect_gaps(analyses, papers, direction, session, user_id)

        # Detect trends
        trend_result = await detect_trends(analyses, papers, direction, session, user_id)

        # Store in task
        task.gaps = gap_result.model_dump()
        task.trends = trend_result.model_dump()
        await session.commit()

        gap_count = len(gap_result.gaps)
        ascending = len(trend_result.ascending_methods)
        declining = len(trend_result.declining_methods)
        trend_summary = f"{ascending} ascending, {declining} declining methods"

    await engine.dispose()

    logger.info(
        "detect_gaps_activity: %d gaps, %s",
        gap_count,
        trend_summary,
    )

    # Write gaps.md and trends.md to workspace Git repo
    try:
        from app.services.workspace_service import write_and_commit

        if task_id:
            # Build gaps.md
            gaps_lines = ["# Research Gaps\n"]
            if gap_result.gaps:
                gaps_lines.append("## Identified Gaps\n")
                for i, gap in enumerate(gap_result.gaps, 1):
                    gaps_lines.append(f"### Gap {i}: {gap.description}")
                    gaps_lines.append(f"- **Evidence**: {gap.evidence}")
                    gaps_lines.append(f"- **Potential Impact**: {gap.potential_impact}\n")

            if gap_result.underexplored:
                gaps_lines.append("## Underexplored Combinations\n")
                for item in gap_result.underexplored:
                    gaps_lines.append(f"- **{item.combination}**: {item.why_promising}")

            if gap_result.missing_evaluations:
                gaps_lines.append("\n## Missing Evaluations\n")
                for item in gap_result.missing_evaluations:
                    gaps_lines.append(f"- **{item.method}**: missing {item.missing}")

            gaps_md = "\n".join(gaps_lines)
            await write_and_commit(
                task_id, "gaps.md", gaps_md,
                f"stage: gaps — {gap_count} research gaps identified",
            )

            # Build trends.md
            trends_lines = ["# Method Trends\n"]
            if trend_result.ascending_methods:
                trends_lines.append("## Ascending Methods\n")
                for t in trend_result.ascending_methods:
                    trends_lines.append(f"- **{t.method}**: {t.evidence}")

            if trend_result.declining_methods:
                trends_lines.append("\n## Declining Methods\n")
                for t in trend_result.declining_methods:
                    trends_lines.append(f"- **{t.method}**: {t.evidence}")

            if trend_result.emerging_topics:
                trends_lines.append("\n## Emerging Topics\n")
                for t in trend_result.emerging_topics:
                    trends_lines.append(f"- **{t.topic}**: {t.evidence}")

            if trend_result.stable_methods:
                trends_lines.append("\n## Stable Methods\n")
                for t in trend_result.stable_methods:
                    trends_lines.append(f"- **{t.method}**: {t.evidence}")

            trends_md = "\n".join(trends_lines)
            await write_and_commit(
                task_id, "trends.md", trends_md,
                f"stage: trends — {trend_summary}",
            )
    except Exception as ws_exc:
        logger.warning("Workspace write failed in detect_gaps_activity (non-fatal): %s", ws_exc)

    return json.dumps({"gap_count": gap_count, "trend_summary": trend_summary})


@activity.defn
async def generate_report_activity(input_json: str) -> str:
    """Generate Markdown literature review report.

    Input JSON: {task_id, user_id, language}
    Output JSON: {report_length, status}

    Loads all analysis data from task, renders Jinja2 template,
    stores report in DeepResearchTask.report_markdown.
    """
    from datetime import datetime, timezone

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from app.database import get_db_engine
    from app.models.deep_research import DeepResearchTask
    from app.models.paper import Paper
    from app.services.deep_research.analyzer import PaperAnalysis
    from app.services.deep_research.gap_detector import GapResult, TrendResult
    from app.services.deep_research.report_generator import generate_literature_review

    params = json.loads(input_json)
    task_id = params["task_id"]
    language = params.get("language", "zh")

    engine = get_db_engine()
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    report_length = 0

    async with session_factory() as session:
        # Load task
        task_result = await session.execute(
            select(DeepResearchTask).where(DeepResearchTask.id == task_id)
        )
        task = task_result.scalar_one_or_none()

        if not task:
            await engine.dispose()
            return json.dumps({"report_length": 0, "status": "failed"})

        # Reconstruct analysis data
        analyses = []
        if task.config.get("paper_analyses"):
            analyses = [
                PaperAnalysis(**data)
                for data in task.config["paper_analyses"].values()
            ]

        gaps = GapResult(**task.gaps) if task.gaps else GapResult()
        trends = TrendResult(**task.trends) if task.trends else TrendResult()

        # Load papers
        paper_ids = list(task.config.get("paper_analyses", {}).keys())
        if paper_ids:
            paper_result = await session.execute(
                select(Paper).where(Paper.id.in_(paper_ids))
            )
            papers = list(paper_result.scalars().all())
        else:
            papers = []

        # Generate report with inline citations (LLM-powered)
        user_id = params.get("user_id", "system")
        markdown = await generate_literature_review(
            task=task,
            analyses=analyses,
            gaps=gaps,
            trends=trends,
            papers=papers,
            language=language,
            session=session,
            user_id=user_id,
        )

        # Store report and mark completed
        task.report_markdown = markdown
        task.status = "completed"
        task.completed_at = datetime.now(timezone.utc)
        await session.commit()

        report_length = len(markdown)

    await engine.dispose()

    logger.info(
        "generate_report_activity: report %d chars, status=completed",
        report_length,
    )

    # Write report.md to workspace Git repo
    try:
        from app.services.workspace_service import write_and_commit

        if task_id and report_length > 0:
            await write_and_commit(
                task_id, "report.md", markdown,
                f"stage: report — literature review ({report_length} chars)",
            )
    except Exception as ws_exc:
        logger.warning("Workspace write failed in generate_report_activity (non-fatal): %s", ws_exc)

    return json.dumps({"report_length": report_length, "status": "completed"})


@activity.defn
async def fail_task_activity(input_json: str) -> str:
    """Mark a deep research task as failed in the database.

    Input JSON: {task_id, error}
    """
    from datetime import datetime, timezone

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from app.database import get_db_engine
    from app.models.deep_research import DeepResearchTask

    params = json.loads(input_json)
    task_id = params["task_id"]
    error_msg = params.get("error", "Unknown error")

    engine = get_db_engine()
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with session_factory() as session:
        result = await session.execute(
            select(DeepResearchTask).where(DeepResearchTask.id == task_id)
        )
        task = result.scalar_one_or_none()
        if task and task.status != "completed":
            task.status = "failed"
            task.completed_at = datetime.now(timezone.utc)
            await session.commit()
            logger.info("fail_task_activity: marked task %s as failed: %s", task_id, error_msg)

    await engine.dispose()
    return json.dumps({"status": "failed", "task_id": task_id})


@activity.defn
async def generate_plans_activity(input_json: str) -> str:
    """Generate experiment plans with SOTA analysis, reflection, and scoring.

    Input JSON: {task_id, user_id, entry_type, source_paper_id,
                 source_gap_index, data_strategy, num_plans}
    Output JSON: {plan_ids, count, total_cost}

    Internally orchestrates:
    1. Load DeepResearchTask from DB
    2. Build PlanGenerationContext (SOTA + improvements)
    3. Generate plans with reflection (AI-Scientist pattern)
    4. Score feasibility (Haiku for cost efficiency)
    5. Recommend datasets from HF Hub
    6. Persist ExperimentPlan records

    Reference: AI-Scientist generate_ideas.py pipeline.
    """
    from datetime import datetime, timezone

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from app.database import get_db_engine
    from app.models.deep_research import DeepResearchTask
    from app.models.experiment_plan import ExperimentPlan
    from app.services.plan_generation.dataset_recommender import recommend_datasets
    from app.services.plan_generation.feasibility_scorer import score_plans_batch
    from app.services.plan_generation.improvement_analyzer import create_plan_context
    from app.services.plan_generation.plan_generator import generate_experiment_plans

    params = json.loads(input_json)
    task_id = params["task_id"]
    user_id = params["user_id"]
    entry_type = params.get("entry_type", "direction")
    source_paper_id = params.get("source_paper_id")
    source_gap_index = params.get("source_gap_index")
    data_strategy = params.get("data_strategy", "open_source")
    num_plans = params.get("num_plans", 3)

    engine = get_db_engine()
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    plan_ids: list[str] = []
    total_cost = 0.0

    async with session_factory() as session:
        # Step 1: Load DeepResearchTask
        task_result = await session.execute(
            select(DeepResearchTask).where(DeepResearchTask.id == task_id)
        )
        task = task_result.scalar_one_or_none()

        if not task:
            await engine.dispose()
            return json.dumps({"plan_ids": [], "count": 0, "total_cost": 0.0})

        # Step 2: Build PlanGenerationContext
        context = await create_plan_context(
            entry_type=entry_type,
            task=task,
            session=session,
            paper_id=source_paper_id,
            gap_index=source_gap_index,
        )

        # Step 3: Generate plans with reflection
        plan_drafts = await generate_experiment_plans(
            context=context,
            session=session,
            user_id=user_id,
            num_plans=num_plans,
            num_reflections=3,
        )

        if not plan_drafts:
            await engine.dispose()
            return json.dumps({"plan_ids": [], "count": 0, "total_cost": 0.0})

        # Step 4: Score feasibility for all plans
        feasibility_scores = await score_plans_batch(
            plan_drafts=plan_drafts,
            direction=context.direction,
            session=session,
            user_id=user_id,
        )

        # Step 5 & 6: Recommend datasets and persist each plan
        for i, draft in enumerate(plan_drafts):
            # Dataset recommendation per plan
            plan_dataset_names = [
                d.get("name", "") for d in draft.get("datasets", [])
            ]
            dataset_recs = await recommend_datasets(
                direction=context.direction,
                plan_datasets=plan_dataset_names,
                data_strategy=data_strategy,
            )

            # Merge HF recommendations into plan datasets
            merged_datasets = list(draft.get("datasets", []))
            for rec in dataset_recs:
                # Avoid duplicating datasets already in the plan
                existing_names = {d.get("name", "").lower() for d in merged_datasets}
                if rec.name.lower() not in existing_names:
                    merged_datasets = [
                        *merged_datasets,
                        {
                            "name": rec.name,
                            "url": rec.url,
                            "downloads": rec.downloads,
                            "license": rec.license,
                            "source": "huggingface_hub",
                        },
                    ]

            # Get feasibility score for this plan
            feasibility = (
                feasibility_scores[i].model_dump()
                if i < len(feasibility_scores)
                else None
            )

            # Create ExperimentPlan record
            plan = ExperimentPlan(
                user_id=user_id,
                task_id=task_id,
                entry_type=entry_type,
                source_paper_id=source_paper_id,
                source_gap_index=source_gap_index,
                title=draft.get("title", f"Plan {i + 1}"),
                hypothesis=draft.get("hypothesis", ""),
                method_description=draft.get("method_description", ""),
                baselines=draft.get("baselines", []),
                metrics=draft.get("metrics", []),
                datasets=merged_datasets,
                technical_roadmap=draft.get("technical_roadmap", []),
                feasibility=feasibility,
                data_strategy=data_strategy,
                code_skeleton=None,
                status="draft",
            )
            session.add(plan)
            await session.flush()

            # Generate code skeleton for this plan
            try:
                from app.services.plan_generation.code_skeleton import generate_code_skeleton
                skeleton = await generate_code_skeleton(plan)
                plan.code_skeleton = skeleton
            except Exception as skel_err:
                logger.warning("Code skeleton generation failed for plan %s: %s", plan.id, skel_err)

            plan_ids = [*plan_ids, plan.id]

        await session.commit()

    await engine.dispose()

    # Rough cost estimate
    # Sonnet: ~$0.05 per plan generation + ~$0.05 per reflection * 2 rounds
    # Haiku: ~$0.005 per feasibility scoring
    total_cost = len(plan_drafts) * (0.05 + 0.05 * 2 + 0.005)

    logger.info(
        "generate_plans_activity: created %d plans for task %s, est. cost $%.3f",
        len(plan_ids),
        task_id,
        total_cost,
    )
    return json.dumps({
        "plan_ids": plan_ids,
        "count": len(plan_ids),
        "total_cost": total_cost,
    })
