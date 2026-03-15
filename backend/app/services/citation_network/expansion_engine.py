"""BFS citation expansion engine with budget control.

Recursively discovers citing and referenced papers from seed papers
using the Semantic Scholar API, storing results in Neo4j. Budget caps
prevent graph explosion at each BFS level and globally.

Reference: gpt-researcher async data fetching patterns, AI-Scientist citation analysis.
"""

import asyncio
import logging

from app.schemas.citation import CitationGraph
from app.schemas.paper import PaperResult
from app.services.citation_network.neo4j_client import Neo4jClient
from app.services.paper_search.s2_client import SemanticScholarClient

logger = logging.getLogger(__name__)


def _paper_to_neo4j_dict(paper: PaperResult) -> dict:
    """Convert a PaperResult to a dict suitable for Neo4j batch merge.

    Pure function: creates new dict, never mutates input.
    """
    paper_id = paper.s2_id or paper.doi or paper.title
    return {
        "paper_id": paper_id,
        "title": paper.title,
        "doi": paper.doi,
        "year": paper.year,
        "citation_count": paper.citation_count,
        "s2_id": paper.s2_id,
        "openalex_id": paper.openalex_id,
    }


async def expand_citations(
    seed_paper_ids: list[str],
    s2_client: SemanticScholarClient,
    neo4j_client: Neo4jClient,
    max_depth: int = 2,
    budget_per_level: int = 50,
    total_budget: int = 200,
) -> CitationGraph:
    """BFS expansion of citation network from seed papers.

    For each paper in the queue at each depth level, fetches citations
    (papers that cite it) and references (papers it cites) from Semantic
    Scholar. Applies per-level and total budget caps.

    Args:
        seed_paper_ids: S2 paper IDs to start expansion from.
        s2_client: Semantic Scholar API client.
        neo4j_client: Neo4j client for graph storage.
        max_depth: Maximum BFS depth (1-3).
        budget_per_level: Max new papers to add per BFS level.
        total_budget: Max total new papers across all levels.

    Returns:
        CitationGraph with all discovered papers and edges.
    """
    # Track all discovered papers and edges
    all_papers: dict[str, PaperResult] = {}
    all_edges: list[tuple[str, str]] = []
    visited: set[str] = set(seed_paper_ids)
    total_added = 0

    # Current BFS queue starts with seed paper IDs
    current_queue = list(seed_paper_ids)

    # Rate limiting semaphore for S2 API (1 req/sec)
    rate_limiter = asyncio.Semaphore(1)

    for depth in range(max_depth):
        if not current_queue or total_added >= total_budget:
            logger.info(
                "BFS stopping at depth %d: queue=%d, total_added=%d",
                depth, len(current_queue), total_added,
            )
            break

        logger.info(
            "BFS depth %d: processing %d papers (total_added=%d/%d)",
            depth, len(current_queue), total_added, total_budget,
        )

        # Collect all candidates from this level
        level_candidates: list[PaperResult] = []
        level_edges: list[tuple[str, str]] = []

        for paper_id in current_queue:
            # Fetch citations (papers that cite this paper)
            async with rate_limiter:
                citations = await s2_client.get_citations(paper_id, limit=100)

            for edge in citations:
                citing_paper = edge.citing_paper
                if citing_paper.s2_id and citing_paper.s2_id not in visited:
                    level_candidates.append(citing_paper)
                    # citing_paper CITES paper_id
                    level_edges.append((citing_paper.s2_id, paper_id))

            # Fetch references (papers cited by this paper)
            async with rate_limiter:
                references = await s2_client.get_references(paper_id, limit=100)

            for edge in references:
                referenced_paper = edge.citing_paper  # citing_paper field holds the paper
                if referenced_paper.s2_id and referenced_paper.s2_id not in visited:
                    level_candidates.append(referenced_paper)
                    # paper_id CITES referenced_paper
                    level_edges.append((paper_id, referenced_paper.s2_id))

        # Deduplicate candidates within level
        seen_in_level: set[str] = set()
        unique_candidates: list[PaperResult] = []
        for paper in level_candidates:
            if paper.s2_id and paper.s2_id not in seen_in_level:
                seen_in_level.add(paper.s2_id)
                unique_candidates.append(paper)

        # Sort by citation count descending (priority selection)
        sorted_candidates = sorted(
            unique_candidates,
            key=lambda p: p.citation_count,
            reverse=True,
        )

        # Apply budget caps
        remaining_budget = total_budget - total_added
        take_count = min(budget_per_level, remaining_budget, len(sorted_candidates))
        selected = sorted_candidates[:take_count]

        # Track selected paper IDs for filtering edges
        selected_ids = {p.s2_id for p in selected if p.s2_id}

        # Store selected papers
        for paper in selected:
            if paper.s2_id:
                all_papers[paper.s2_id] = paper
                visited.add(paper.s2_id)

        # Filter edges to only include those involving selected papers
        for citing_id, cited_id in level_edges:
            if citing_id in selected_ids or cited_id in selected_ids:
                if (citing_id, cited_id) not in all_edges:
                    all_edges.append((citing_id, cited_id))

        # Persist to Neo4j
        neo4j_papers = [_paper_to_neo4j_dict(p) for p in selected]
        await neo4j_client.batch_merge_papers(neo4j_papers)

        neo4j_edges = [
            {"citing_id": citing, "cited_id": cited}
            for citing, cited in level_edges
            if citing in selected_ids or cited in selected_ids
        ]
        await neo4j_client.batch_merge_edges(neo4j_edges)

        total_added += len(selected)

        logger.info(
            "BFS depth %d complete: candidates=%d, selected=%d, total=%d",
            depth, len(unique_candidates), len(selected), total_added,
        )

        # Next level queue: S2 IDs of selected papers
        current_queue = [p.s2_id for p in selected if p.s2_id]

    return CitationGraph(
        papers=all_papers,
        edges=all_edges,
        seed_ids=seed_paper_ids,
    )
