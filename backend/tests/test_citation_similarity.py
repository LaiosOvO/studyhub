"""Tests for citation similarity service and citation REST endpoints.

All tests use mocks -- NO real API or database calls.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.schemas.citation import CitationGraph
from app.schemas.paper import PaperResult, PaperSource


# ─── Helpers ─────────────────────────────────────────────────────────


def _make_paper(s2_id: str, title: str = "Test Paper", citation_count: int = 10) -> PaperResult:
    return PaperResult(
        s2_id=s2_id,
        title=title,
        citation_count=citation_count,
        sources=[PaperSource.SEMANTIC_SCHOLAR],
    )


def _make_s2_rec_response(papers: list[dict]) -> dict:
    return {"recommendedPapers": papers}


def _make_s2_paper_dict(paper_id: str, title: str = "Paper") -> dict:
    return {
        "paperId": paper_id,
        "externalIds": {"DOI": f"10.1234/{paper_id}"},
        "title": title,
        "abstract": "Abstract",
        "authors": [{"name": "Author A"}],
        "year": 2023,
        "citationCount": 50,
        "venue": "NeurIPS",
        "isOpenAccess": True,
        "openAccessPdf": {"url": f"https://example.com/{paper_id}.pdf"},
    }


# ─── Similarity Service Tests ────────────────────────────────────────


class TestGetSimilarPapers:
    @pytest.mark.asyncio
    async def test_success(self):
        """Verify get_similar_papers returns PaperResult objects."""
        from app.services.citation_network.similarity_service import get_similar_papers

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = _make_s2_rec_response([
            _make_s2_paper_dict("rec1", "Recommended 1"),
            _make_s2_paper_dict("rec2", "Recommended 2"),
            _make_s2_paper_dict("rec3", "Recommended 3"),
        ])
        mock_response.raise_for_status = MagicMock()

        mock_http = AsyncMock()
        mock_http.get = AsyncMock(return_value=mock_response)

        papers = await get_similar_papers(mock_http, "source1")

        assert len(papers) == 3
        assert papers[0].s2_id == "rec1"
        assert papers[1].s2_id == "rec2"

    @pytest.mark.asyncio
    async def test_404_returns_empty(self):
        """Verify 404 response returns empty list."""
        from app.services.citation_network.similarity_service import get_similar_papers

        mock_response = MagicMock()
        mock_response.status_code = 404
        exc = httpx.HTTPStatusError("Not found", request=MagicMock(), response=mock_response)
        mock_response.raise_for_status.side_effect = exc

        mock_http = AsyncMock()
        mock_http.get = AsyncMock(return_value=mock_response)

        papers = await get_similar_papers(mock_http, "nonexistent")
        assert papers == []

    @pytest.mark.asyncio
    async def test_with_api_key(self):
        """Verify x-api-key header is included when api_key provided."""
        from app.services.citation_network.similarity_service import get_similar_papers

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = _make_s2_rec_response([])
        mock_response.raise_for_status = MagicMock()

        mock_http = AsyncMock()
        mock_http.get = AsyncMock(return_value=mock_response)

        await get_similar_papers(mock_http, "source1", api_key="test-key")

        call_kwargs = mock_http.get.call_args
        assert call_kwargs.kwargs["headers"]["x-api-key"] == "test-key"


class TestDiscoverAndStoreSimilar:
    @pytest.mark.asyncio
    async def test_stores_papers_and_edges(self):
        """Verify batch_merge_papers and similarity edges are created."""
        from app.services.citation_network.similarity_service import discover_and_store_similar

        mock_papers = [_make_paper(f"sim{i}", f"Similar {i}") for i in range(3)]

        with patch(
            "app.services.citation_network.similarity_service.get_similar_papers",
            new_callable=AsyncMock,
            return_value=mock_papers,
        ):
            mock_neo4j = AsyncMock()
            mock_http = AsyncMock()

            result = await discover_and_store_similar("source1", mock_neo4j, mock_http)

            assert len(result) == 3
            mock_neo4j.batch_merge_papers.assert_called_once()
            mock_neo4j.batch_merge_similarity_edges.assert_called_once_with(
                "source1", ["sim0", "sim1", "sim2"]
            )


# ─── Citations Router Tests ──────────────────────────────────────────


class TestCitationsRouter:
    @pytest.mark.asyncio
    async def test_expand_neo4j_unavailable(self):
        """Verify 503 when neo4j is None."""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from app.routers.citations import router

        app = FastAPI()
        app.include_router(router, prefix="/citations")
        app.state.neo4j = None
        app.state.http_client = AsyncMock()

        client = TestClient(app)
        response = client.post(
            "/citations/expand",
            json={"seed_paper_ids": ["p1"], "max_depth": 1},
        )
        assert response.status_code == 503

    @pytest.mark.asyncio
    async def test_expand_success(self):
        """Verify POST /expand returns papers and edges."""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from app.routers.citations import router

        mock_graph = CitationGraph(
            papers={"p1": _make_paper("p1"), "p2": _make_paper("p2")},
            edges=[("p1", "p2")],
            seed_ids=["seed1"],
        )

        app = FastAPI()
        app.include_router(router, prefix="/citations")
        app.state.neo4j = AsyncMock()
        app.state.http_client = AsyncMock()

        with patch(
            "app.routers.citations.get_settings",
            return_value=MagicMock(s2_api_key=""),
        ), patch(
            "app.services.citation_network.expansion_engine.expand_citations",
            new_callable=AsyncMock,
            return_value=mock_graph,
        ), patch(
            "app.services.citation_network.similarity_service.discover_and_store_similar",
            new_callable=AsyncMock,
            return_value=[],
        ):
            client = TestClient(app)
            response = client.post(
                "/citations/expand",
                json={"seed_paper_ids": ["seed1"], "max_depth": 1},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["total_discovered"] == 2

    @pytest.mark.asyncio
    async def test_expand_node_success(self):
        """Verify POST /expand-node/{s2_id} works."""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from app.routers.citations import router

        mock_graph = CitationGraph(
            papers={"n1": _make_paper("n1")},
            edges=[],
            seed_ids=["target"],
        )

        app = FastAPI()
        app.include_router(router, prefix="/citations")
        app.state.neo4j = AsyncMock()
        app.state.http_client = AsyncMock()

        with patch(
            "app.routers.citations.get_settings",
            return_value=MagicMock(s2_api_key=""),
        ), patch(
            "app.services.citation_network.expansion_engine.expand_citations",
            new_callable=AsyncMock,
            return_value=mock_graph,
        ), patch(
            "app.services.citation_network.similarity_service.discover_and_store_similar",
            new_callable=AsyncMock,
            return_value=[],
        ):
            client = TestClient(app)
            response = client.post("/citations/expand-node/target?budget=10")
            assert response.status_code == 200
            assert response.json()["total_discovered"] == 1

    @pytest.mark.asyncio
    async def test_graph_query_success(self):
        """Verify GET /graph/{paper_id} returns nodes and edges."""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from app.routers.citations import router

        app = FastAPI()
        app.include_router(router, prefix="/citations")
        mock_neo4j = AsyncMock()
        mock_neo4j.get_paper_neighborhood = AsyncMock(
            return_value={"nodes": [{"paper_id": "p1"}], "edges": []}
        )
        app.state.neo4j = mock_neo4j
        app.state.http_client = AsyncMock()

        client = TestClient(app)
        response = client.get("/citations/graph/p1?depth=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["nodes"]) == 1

    @pytest.mark.asyncio
    async def test_graph_query_depth_validation(self):
        """Verify depth > 3 is rejected."""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from app.routers.citations import router

        app = FastAPI()
        app.include_router(router, prefix="/citations")
        app.state.neo4j = AsyncMock()
        app.state.http_client = AsyncMock()

        client = TestClient(app)
        response = client.get("/citations/graph/p1?depth=5")
        assert response.status_code == 422  # Validation error
