"""Tests for the citation network: schemas, Neo4j client, S2 citation methods, and BFS expansion.

All tests use mocks -- NO real API or database calls.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.schemas.citation import (
    CitationEdge,
    CitationExpansionRequest,
    CitationExpansionResponse,
    CitationGraph,
)
from app.schemas.paper import PaperResult, PaperSource


# ─── Helpers ─────────────────────────────────────────────────────────


def _make_paper(s2_id: str, title: str = "Test Paper", citation_count: int = 10) -> PaperResult:
    """Create a PaperResult for testing."""
    return PaperResult(
        s2_id=s2_id,
        title=title,
        citation_count=citation_count,
        sources=[PaperSource.SEMANTIC_SCHOLAR],
    )


def _make_s2_response(papers: list[dict]) -> dict:
    """Create a mock S2 API response."""
    return {"data": papers}


def _make_s2_paper_dict(paper_id: str, title: str = "Paper", citation_count: int = 5) -> dict:
    """Create a raw S2 API paper dict."""
    return {
        "paperId": paper_id,
        "externalIds": {"DOI": f"10.1234/{paper_id}"},
        "title": title,
        "abstract": "Abstract text",
        "authors": [{"name": "Author A"}],
        "year": 2023,
        "citationCount": citation_count,
        "venue": "NeurIPS",
        "isOpenAccess": True,
        "openAccessPdf": {"url": f"https://example.com/{paper_id}.pdf"},
    }


# ─── Schema Tests ────────────────────────────────────────────────────


class TestCitationSchemas:
    def test_citation_edge_construction(self):
        paper = _make_paper("abc123")
        edge = CitationEdge(citing_paper=paper, is_influential=True, intents=["methodology"])
        assert edge.citing_paper.s2_id == "abc123"
        assert edge.is_influential is True
        assert edge.intents == ["methodology"]

    def test_citation_edge_defaults(self):
        paper = _make_paper("abc123")
        edge = CitationEdge(citing_paper=paper)
        assert edge.is_influential is False
        assert edge.intents == []

    def test_expansion_request_validation_depth(self):
        req = CitationExpansionRequest(seed_paper_ids=["p1"], max_depth=3)
        assert req.max_depth == 3

    def test_expansion_request_depth_too_high(self):
        with pytest.raises(Exception):
            CitationExpansionRequest(seed_paper_ids=["p1"], max_depth=5)

    def test_expansion_request_empty_seeds(self):
        with pytest.raises(Exception):
            CitationExpansionRequest(seed_paper_ids=[])

    def test_expansion_request_budget_bounds(self):
        req = CitationExpansionRequest(
            seed_paper_ids=["p1"],
            budget_per_level=200,
            total_budget=1000,
        )
        assert req.budget_per_level == 200
        assert req.total_budget == 1000

    def test_expansion_response_construction(self):
        resp = CitationExpansionResponse(
            papers=[_make_paper("p1")],
            edges=[{"citing_id": "p1", "cited_id": "p2"}],
            total_discovered=1,
            budget_exhausted=False,
            depth_reached=1,
        )
        assert resp.total_discovered == 1
        assert len(resp.edges) == 1

    def test_citation_graph_construction(self):
        p1 = _make_paper("p1")
        graph = CitationGraph(
            papers={"p1": p1},
            edges=[("p1", "p2")],
            seed_ids=["p1"],
        )
        assert "p1" in graph.papers
        assert len(graph.edges) == 1


# ─── Neo4j Client Tests ──────────────────────────────────────────────


class TestNeo4jClient:
    @pytest.mark.asyncio
    async def test_batch_merge_papers_calls_cypher(self):
        """Verify batch_merge_papers executes UNWIND MERGE query."""
        from app.services.citation_network.neo4j_client import Neo4jClient

        mock_driver = AsyncMock()
        mock_session = AsyncMock()
        mock_driver.session.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_driver.session.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.citation_network.neo4j_client.AsyncGraphDatabase") as mock_agd:
            mock_agd.driver.return_value = mock_driver
            client = Neo4jClient("bolt://localhost:7687", "neo4j", "test")

            papers = [{"paper_id": "p1", "title": "Test", "doi": "10.1234/test",
                       "year": 2023, "citation_count": 10, "s2_id": "p1", "openalex_id": None}]

            await client.batch_merge_papers(papers)
            mock_session.execute_write.assert_called_once()

    @pytest.mark.asyncio
    async def test_batch_merge_edges_calls_cypher(self):
        """Verify batch_merge_edges executes MATCH+MERGE for CITES."""
        from app.services.citation_network.neo4j_client import Neo4jClient

        mock_driver = AsyncMock()
        mock_session = AsyncMock()
        mock_driver.session.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_driver.session.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.citation_network.neo4j_client.AsyncGraphDatabase") as mock_agd:
            mock_agd.driver.return_value = mock_driver
            client = Neo4jClient("bolt://localhost:7687", "neo4j", "test")

            edges = [{"citing_id": "p1", "cited_id": "p2"}]
            await client.batch_merge_edges(edges)
            mock_session.execute_write.assert_called_once()

    @pytest.mark.asyncio
    async def test_setup_schema_creates_constraints(self):
        """Verify setup_schema executes constraint/index queries."""
        from app.services.citation_network.neo4j_client import Neo4jClient

        mock_driver = AsyncMock()
        mock_session = AsyncMock()
        mock_driver.session.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_driver.session.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.citation_network.neo4j_client.AsyncGraphDatabase") as mock_agd:
            mock_agd.driver.return_value = mock_driver
            client = Neo4jClient("bolt://localhost:7687", "neo4j", "test")

            await client.setup_schema()
            # 4 queries: 1 constraint + 3 indexes
            assert mock_session.execute_write.call_count == 4

    @pytest.mark.asyncio
    async def test_batch_merge_papers_skips_empty(self):
        """Verify empty paper list is a no-op."""
        from app.services.citation_network.neo4j_client import Neo4jClient

        mock_driver = AsyncMock()
        with patch("app.services.citation_network.neo4j_client.AsyncGraphDatabase") as mock_agd:
            mock_agd.driver.return_value = mock_driver
            client = Neo4jClient("bolt://localhost:7687", "neo4j", "test")

            await client.batch_merge_papers([])
            mock_driver.session.assert_not_called()


# ─── S2 Citation Method Tests ────────────────────────────────────────


class TestS2CitationMethods:
    @pytest.mark.asyncio
    async def test_get_citations_success(self):
        """Verify get_citations parses S2 citation response correctly."""
        from app.services.paper_search.s2_client import SemanticScholarClient

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [
                {
                    "citingPaper": _make_s2_paper_dict("cite1", "Citing Paper 1", 20),
                    "isInfluential": True,
                    "intents": ["methodology"],
                },
                {
                    "citingPaper": _make_s2_paper_dict("cite2", "Citing Paper 2", 5),
                    "isInfluential": False,
                    "intents": [],
                },
            ]
        }
        mock_response.raise_for_status = MagicMock()

        mock_http = AsyncMock()
        mock_http.get = AsyncMock(return_value=mock_response)

        client = SemanticScholarClient(mock_http)
        edges = await client.get_citations("seed1")

        assert len(edges) == 2
        assert edges[0].citing_paper.s2_id == "cite1"
        assert edges[0].is_influential is True
        assert edges[1].citing_paper.s2_id == "cite2"

    @pytest.mark.asyncio
    async def test_get_references_success(self):
        """Verify get_references parses S2 reference response correctly."""
        from app.services.paper_search.s2_client import SemanticScholarClient

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [
                {
                    "citedPaper": _make_s2_paper_dict("ref1", "Referenced Paper", 100),
                    "isInfluential": False,
                    "intents": ["background"],
                },
            ]
        }
        mock_response.raise_for_status = MagicMock()

        mock_http = AsyncMock()
        mock_http.get = AsyncMock(return_value=mock_response)

        client = SemanticScholarClient(mock_http)
        edges = await client.get_references("seed1")

        assert len(edges) == 1
        assert edges[0].citing_paper.s2_id == "ref1"

    @pytest.mark.asyncio
    async def test_get_citations_404_returns_empty(self):
        """Verify 404 returns empty list instead of raising."""
        from app.services.paper_search.s2_client import SemanticScholarClient

        mock_response = MagicMock()
        mock_response.status_code = 404
        exc = httpx.HTTPStatusError("Not found", request=MagicMock(), response=mock_response)
        mock_response.raise_for_status.side_effect = exc

        mock_http = AsyncMock()
        mock_http.get = AsyncMock(return_value=mock_response)

        client = SemanticScholarClient(mock_http)
        edges = await client.get_citations("nonexistent")
        assert edges == []

    @pytest.mark.asyncio
    async def test_get_references_skips_null_papers(self):
        """Verify papers with no paperId are filtered out."""
        from app.services.paper_search.s2_client import SemanticScholarClient

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [
                {
                    "citedPaper": {"paperId": None, "title": "Bad Paper"},
                    "isInfluential": False,
                    "intents": [],
                },
                {
                    "citedPaper": _make_s2_paper_dict("good1", "Good Paper"),
                    "isInfluential": False,
                    "intents": [],
                },
            ]
        }
        mock_response.raise_for_status = MagicMock()

        mock_http = AsyncMock()
        mock_http.get = AsyncMock(return_value=mock_response)

        client = SemanticScholarClient(mock_http)
        edges = await client.get_references("seed1")
        assert len(edges) == 1
        assert edges[0].citing_paper.s2_id == "good1"


# ─── Expansion Engine Tests ──────────────────────────────────────────


class TestExpansionEngine:
    @pytest.mark.asyncio
    async def test_depth_1_expansion(self):
        """Mock S2 returning 5 citations + 3 references, verify 8 discovered."""
        from app.services.citation_network.expansion_engine import expand_citations

        citations = [
            CitationEdge(citing_paper=_make_paper(f"cite{i}", f"Citing {i}", 10 + i))
            for i in range(5)
        ]
        references = [
            CitationEdge(citing_paper=_make_paper(f"ref{i}", f"Referenced {i}", 20 + i))
            for i in range(3)
        ]

        mock_s2 = AsyncMock()
        mock_s2.get_citations = AsyncMock(return_value=citations)
        mock_s2.get_references = AsyncMock(return_value=references)

        mock_neo4j = AsyncMock()
        mock_neo4j.batch_merge_papers = AsyncMock()
        mock_neo4j.batch_merge_edges = AsyncMock()

        graph = await expand_citations(
            seed_paper_ids=["seed1"],
            s2_client=mock_s2,
            neo4j_client=mock_neo4j,
            max_depth=1,
            budget_per_level=50,
            total_budget=200,
        )

        assert len(graph.papers) == 8
        assert graph.seed_ids == ["seed1"]
        mock_neo4j.batch_merge_papers.assert_called_once()
        mock_neo4j.batch_merge_edges.assert_called_once()

    @pytest.mark.asyncio
    async def test_budget_per_level_cap(self):
        """Mock S2 returning 100 papers, budget_per_level=10, verify only 10 selected."""
        from app.services.citation_network.expansion_engine import expand_citations

        many_citations = [
            CitationEdge(citing_paper=_make_paper(f"c{i}", f"Paper {i}", 100 - i))
            for i in range(100)
        ]

        mock_s2 = AsyncMock()
        mock_s2.get_citations = AsyncMock(return_value=many_citations)
        mock_s2.get_references = AsyncMock(return_value=[])

        mock_neo4j = AsyncMock()

        graph = await expand_citations(
            seed_paper_ids=["seed1"],
            s2_client=mock_s2,
            neo4j_client=mock_neo4j,
            max_depth=1,
            budget_per_level=10,
            total_budget=200,
        )

        assert len(graph.papers) == 10

    @pytest.mark.asyncio
    async def test_total_budget_stops_expansion(self):
        """total_budget=15 with depth=3, verify expansion stops at budget."""
        from app.services.citation_network.expansion_engine import expand_citations

        def make_citations_for(paper_id):
            return [
                CitationEdge(citing_paper=_make_paper(f"{paper_id}_c{i}", f"Paper {i}", 50 - i))
                for i in range(20)
            ]

        call_count = 0

        async def mock_get_citations(paper_id, limit=100):
            nonlocal call_count
            call_count += 1
            return make_citations_for(paper_id)

        mock_s2 = AsyncMock()
        mock_s2.get_citations = mock_get_citations
        mock_s2.get_references = AsyncMock(return_value=[])

        mock_neo4j = AsyncMock()

        graph = await expand_citations(
            seed_paper_ids=["seed1"],
            s2_client=mock_s2,
            neo4j_client=mock_neo4j,
            max_depth=3,
            budget_per_level=50,
            total_budget=15,
        )

        assert len(graph.papers) <= 15

    @pytest.mark.asyncio
    async def test_empty_citations_graceful(self):
        """Mock S2 returning empty, verify graceful completion."""
        from app.services.citation_network.expansion_engine import expand_citations

        mock_s2 = AsyncMock()
        mock_s2.get_citations = AsyncMock(return_value=[])
        mock_s2.get_references = AsyncMock(return_value=[])

        mock_neo4j = AsyncMock()

        graph = await expand_citations(
            seed_paper_ids=["seed1"],
            s2_client=mock_s2,
            neo4j_client=mock_neo4j,
            max_depth=2,
        )

        assert len(graph.papers) == 0
        assert len(graph.edges) == 0
        assert graph.seed_ids == ["seed1"]

    @pytest.mark.asyncio
    async def test_already_visited_not_readded(self):
        """Seed paper appears in citations, verify not re-added."""
        from app.services.citation_network.expansion_engine import expand_citations

        # Citation points back to seed paper
        citations = [
            CitationEdge(citing_paper=_make_paper("seed1", "Seed Paper", 100)),
            CitationEdge(citing_paper=_make_paper("new1", "New Paper", 50)),
        ]

        mock_s2 = AsyncMock()
        mock_s2.get_citations = AsyncMock(return_value=citations)
        mock_s2.get_references = AsyncMock(return_value=[])

        mock_neo4j = AsyncMock()

        graph = await expand_citations(
            seed_paper_ids=["seed1"],
            s2_client=mock_s2,
            neo4j_client=mock_neo4j,
            max_depth=1,
        )

        # Only new1 should be in results, not seed1
        assert "seed1" not in graph.papers
        assert "new1" in graph.papers
        assert len(graph.papers) == 1
