"""Async Neo4j client for citation graph storage.

Wraps the neo4j async driver with batch merge operations for papers
and citation edges. Managed by FastAPI lifespan (startup/shutdown).

Reference: AI-Scientist citation graph patterns, Neo4j async driver docs.
"""

import logging
from typing import Any

from neo4j import AsyncGraphDatabase

logger = logging.getLogger(__name__)


class Neo4jClient:
    """Async Neo4j client with batch operations for citation graphs."""

    def __init__(self, uri: str, user: str, password: str) -> None:
        self._driver = AsyncGraphDatabase.driver(uri, auth=(user, password))

    async def close(self) -> None:
        """Close the Neo4j driver connection."""
        await self._driver.close()

    async def verify_connectivity(self) -> None:
        """Verify the driver can connect to Neo4j."""
        await self._driver.verify_connectivity()

    async def setup_schema(self) -> None:
        """Create constraints and indexes for the citation graph schema."""
        queries = [
            "CREATE CONSTRAINT paper_id_unique IF NOT EXISTS FOR (p:Paper) REQUIRE p.paper_id IS UNIQUE",
            "CREATE INDEX paper_doi_idx IF NOT EXISTS FOR (p:Paper) ON (p.doi)",
            "CREATE INDEX paper_quality_score_idx IF NOT EXISTS FOR (p:Paper) ON (p.quality_score)",
            "CREATE INDEX paper_s2_id_idx IF NOT EXISTS FOR (p:Paper) ON (p.s2_id)",
        ]
        async with self._driver.session() as session:
            for query in queries:
                await session.execute_write(_run_query, query)
        logger.info("Neo4j schema setup complete (constraints + indexes)")

    async def batch_merge_papers(self, papers: list[dict]) -> None:
        """Batch upsert Paper nodes using UNWIND-based MERGE.

        Each dict should contain: paper_id, title, doi, year,
        citation_count, s2_id, openalex_id.
        """
        if not papers:
            return

        query = """
        UNWIND $papers AS p
        MERGE (paper:Paper {paper_id: p.paper_id})
        ON CREATE SET
            paper.title = p.title,
            paper.doi = p.doi,
            paper.year = p.year,
            paper.citation_count = p.citation_count,
            paper.s2_id = p.s2_id,
            paper.openalex_id = p.openalex_id
        ON MATCH SET
            paper.citation_count = p.citation_count
        """
        async with self._driver.session() as session:
            await session.execute_write(_run_query, query, papers=papers)

    async def batch_merge_edges(self, edges: list[dict]) -> None:
        """Batch upsert CITES relationships using UNWIND-based MERGE.

        Each dict should contain: citing_id, cited_id (paper_id values).
        """
        if not edges:
            return

        query = """
        UNWIND $edges AS e
        MATCH (citing:Paper {paper_id: e.citing_id})
        MATCH (cited:Paper {paper_id: e.cited_id})
        MERGE (citing)-[:CITES]->(cited)
        """
        async with self._driver.session() as session:
            await session.execute_write(_run_query, query, edges=edges)

    async def batch_merge_similarity_edges(
        self, source_s2_id: str, target_s2_ids: list[str]
    ) -> None:
        """Batch upsert RELATED_TO relationships for semantic similarity.

        Creates edges from source paper to each target paper.
        """
        if not target_s2_ids:
            return

        query = """
        UNWIND $targets AS target_id
        MATCH (a:Paper {s2_id: $source_id})
        MATCH (b:Paper {s2_id: target_id})
        MERGE (a)-[r:RELATED_TO]->(b)
        ON CREATE SET r.source = 's2_recommendations'
        """
        async with self._driver.session() as session:
            await session.execute_write(
                _run_query, query, source_id=source_s2_id, targets=target_s2_ids
            )

    async def get_paper_neighborhood(
        self, paper_id: str, depth: int = 1
    ) -> dict[str, Any]:
        """Query variable-length paths around a paper node.

        Returns dict with 'nodes' (paper dicts) and 'edges' (relationship tuples).
        """
        query = f"""
        MATCH path = (p:Paper {{paper_id: $paper_id}})-[*1..{depth}]-(connected:Paper)
        WITH DISTINCT connected, relationships(path) AS rels
        RETURN
            collect(DISTINCT properties(connected)) AS nodes,
            [r IN collect(DISTINCT rels) |
                [startNode(r[0]).paper_id, endNode(r[0]).paper_id, type(r[0])]] AS edges
        """
        async with self._driver.session() as session:
            result = await session.execute_read(
                _run_query_single, query, paper_id=paper_id
            )
            if result:
                return {"nodes": result.get("nodes", []), "edges": result.get("edges", [])}
            return {"nodes": [], "edges": []}

    async def update_quality_scores(self, updates: list[dict]) -> None:
        """Batch update quality_score on Paper nodes.

        Each dict should contain: s2_id, score.
        """
        if not updates:
            return

        query = """
        UNWIND $updates AS u
        MATCH (p:Paper {s2_id: u.s2_id})
        SET p.quality_score = u.score
        """
        async with self._driver.session() as session:
            await session.execute_write(_run_query, query, updates=updates)

    async def get_top_papers_by_quality(self, n: int = 10) -> list[dict]:
        """Return top-N papers ordered by quality_score descending."""
        query = """
        MATCH (p:Paper)
        WHERE p.quality_score IS NOT NULL
        RETURN properties(p) AS paper
        ORDER BY p.quality_score DESC
        LIMIT $n
        """
        async with self._driver.session() as session:
            return await session.execute_read(_run_query_collect, query, n=n)


# ─── Transaction helper functions ─────────────────────────────────────


async def _run_query(tx: Any, query: str, **params: Any) -> list[dict]:
    """Execute a write query within a transaction, consuming all results."""
    result = await tx.run(query, **params)
    return [record.data() async for record in result]


async def _run_query_single(tx: Any, query: str, **params: Any) -> dict | None:
    """Execute a read query and return the first record or None."""
    result = await tx.run(query, **params)
    record = await result.single()
    return record.data() if record else None


async def _run_query_collect(tx: Any, query: str, **params: Any) -> list[dict]:
    """Execute a read query and collect all records as dicts."""
    result = await tx.run(query, **params)
    return [record.data() async for record in result]
