"""Tests for the Meilisearch search index service.

Covers: index configuration, document ID generation, filter string building,
sort parameter mapping, paper indexing, and search endpoint integration.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.schemas.paper import PaperResult, PaperSource
from app.schemas.search import SearchResponse
from app.services.search_index.index_config import (
    FILTERABLE_ATTRIBUTES,
    PAPERS_INDEX_NAME,
    RANKING_RULES,
    SEARCHABLE_ATTRIBUTES,
    SORTABLE_ATTRIBUTES,
)
from app.services.search_index.meilisearch_service import (
    SORT_MAP,
    MeilisearchService,
    _generate_doc_id,
    _paper_to_document,
    build_filter_string,
)


# ─── Index Config Tests ──────────────────────────────────────────────


class TestIndexConfig:
    def test_papers_index_name(self):
        assert PAPERS_INDEX_NAME == "papers"

    def test_filterable_attributes_not_empty(self):
        assert len(FILTERABLE_ATTRIBUTES) > 0
        assert "year" in FILTERABLE_ATTRIBUTES
        assert "citation_count" in FILTERABLE_ATTRIBUTES
        assert "venue" in FILTERABLE_ATTRIBUTES
        assert "language" in FILTERABLE_ATTRIBUTES

    def test_sortable_attributes_not_empty(self):
        assert len(SORTABLE_ATTRIBUTES) > 0
        assert "citation_count" in SORTABLE_ATTRIBUTES
        assert "year" in SORTABLE_ATTRIBUTES

    def test_searchable_attributes_not_empty(self):
        assert len(SEARCHABLE_ATTRIBUTES) > 0
        assert "title" in SEARCHABLE_ATTRIBUTES
        assert "abstract" in SEARCHABLE_ATTRIBUTES

    def test_ranking_rules_not_empty(self):
        assert len(RANKING_RULES) > 0
        assert "words" in RANKING_RULES


# ─── Document ID Tests ───────────────────────────────────────────────


class TestDocumentId:
    def test_deterministic_from_doi(self):
        paper = PaperResult(doi="10.1234/test", title="Test Paper")
        id1 = _generate_doc_id(paper)
        id2 = _generate_doc_id(paper)
        assert id1 == id2

    def test_different_dois_different_ids(self):
        paper1 = PaperResult(doi="10.1234/test1", title="Paper 1")
        paper2 = PaperResult(doi="10.1234/test2", title="Paper 2")
        assert _generate_doc_id(paper1) != _generate_doc_id(paper2)

    def test_no_doi_uses_title(self):
        paper = PaperResult(title="A Specific Paper Title")
        doc_id = _generate_doc_id(paper)
        assert len(doc_id) == 24

    def test_doi_case_insensitive(self):
        paper1 = PaperResult(doi="10.1234/TEST", title="Paper")
        paper2 = PaperResult(doi="10.1234/test", title="Paper")
        assert _generate_doc_id(paper1) == _generate_doc_id(paper2)


# ─── Document Conversion Tests ───────────────────────────────────────


class TestDocumentConversion:
    def test_paper_to_document(self):
        paper = PaperResult(
            doi="10.1234/test",
            title="Test Paper",
            abstract="A" * 1000,
            year=2024,
            sources=[PaperSource.OPENALEX],
        )
        doc = _paper_to_document(paper)
        assert doc["title"] == "Test Paper"
        assert len(doc["abstract"]) == 500  # Truncated
        assert doc["sources"] == ["openalex"]
        assert "id" in doc

    def test_paper_to_document_short_abstract(self):
        paper = PaperResult(
            title="Test",
            abstract="Short abstract",
            sources=[],
        )
        doc = _paper_to_document(paper)
        assert doc["abstract"] == "Short abstract"


# ─── Filter String Tests ─────────────────────────────────────────────


class TestFilterString:
    def test_no_filters(self):
        assert build_filter_string(None) is None
        assert build_filter_string({}) is None

    def test_year_range(self):
        result = build_filter_string({"year_from": 2020, "year_to": 2024})
        assert "year >= 2020" in result
        assert "year <= 2024" in result
        assert "AND" in result

    def test_year_from_only(self):
        result = build_filter_string({"year_from": 2020})
        assert result == "year >= 2020"

    def test_year_to_only(self):
        result = build_filter_string({"year_to": 2024})
        assert result == "year <= 2024"

    def test_min_citations(self):
        result = build_filter_string({"min_citations": 10})
        assert result == "citation_count >= 10"

    def test_venue_filter(self):
        result = build_filter_string({"venue": "NeurIPS"})
        assert 'venue = "NeurIPS"' in result

    def test_language_filter(self):
        result = build_filter_string({"language": "en"})
        assert 'language = "en"' in result

    def test_combined_filters(self):
        result = build_filter_string({
            "year_from": 2020,
            "year_to": 2024,
            "min_citations": 10,
            "venue": "NeurIPS",
        })
        assert "year >= 2020" in result
        assert "year <= 2024" in result
        assert "citation_count >= 10" in result
        assert 'venue = "NeurIPS"' in result
        assert result.count("AND") == 3

    def test_none_values_ignored(self):
        result = build_filter_string({"year_from": None, "min_citations": 5})
        assert result == "citation_count >= 5"


# ─── Sort Mapping Tests ──────────────────────────────────────────────


class TestSortMapping:
    def test_relevance_is_none(self):
        assert SORT_MAP["relevance"] is None

    def test_citations_sort(self):
        assert SORT_MAP["citations"] == "citation_count:desc"

    def test_recency_sort(self):
        assert SORT_MAP["recency"] == "year:desc"


# ─── Meilisearch Service Tests ───────────────────────────────────────


class TestMeilisearchService:
    @pytest.mark.asyncio
    async def test_index_papers_calls_add_documents(self):
        papers = [
            PaperResult(
                doi="10.1234/test",
                title="Test Paper",
                sources=[PaperSource.OPENALEX],
            ),
        ]

        with patch("meilisearch_python_sdk.AsyncClient") as MockClient:
            mock_index = AsyncMock()
            mock_instance = MagicMock()
            mock_instance.index.return_value = mock_index
            MockClient.return_value = mock_instance

            service = MeilisearchService("http://localhost:7700", "test_key")
            service._index = mock_index

            await service.index_papers(papers)
            mock_index.add_documents.assert_called_once()
            docs = mock_index.add_documents.call_args[0][0]
            assert len(docs) == 1
            assert docs[0]["title"] == "Test Paper"

    @pytest.mark.asyncio
    async def test_index_empty_list_noop(self):
        with patch("meilisearch_python_sdk.AsyncClient") as MockClient:
            mock_index = AsyncMock()
            mock_instance = MagicMock()
            mock_instance.index.return_value = mock_index
            MockClient.return_value = mock_instance

            service = MeilisearchService("http://localhost:7700", "test_key")
            service._index = mock_index

            await service.index_papers([])
            mock_index.add_documents.assert_not_called()

    @pytest.mark.asyncio
    async def test_search_with_filters(self):
        with patch("meilisearch_python_sdk.AsyncClient") as MockClient:
            mock_result = MagicMock()
            mock_result.hits = [{"title": "Test", "id": "abc"}]
            mock_result.estimated_total_hits = 1

            mock_index = AsyncMock()
            mock_index.search = AsyncMock(return_value=mock_result)

            mock_instance = MagicMock()
            mock_instance.index.return_value = mock_index
            MockClient.return_value = mock_instance

            service = MeilisearchService("http://localhost:7700", "test_key")
            service._index = mock_index

            hits, total = await service.search(
                "test",
                filters={"year_from": 2020},
                sort_by="citations",
            )
            assert len(hits) == 1
            assert total == 1

            # Verify filter and sort were passed
            call_kwargs = mock_index.search.call_args
            assert call_kwargs.kwargs["filter"] == "year >= 2020"
            assert call_kwargs.kwargs["sort"] == ["citation_count:desc"]


# ─── Search Endpoint Integration Tests ────────────────────────────────


class TestSearchEndpointWithMeilisearch:
    @pytest_asyncio.fixture
    async def search_client(self, test_engine):
        """Create a test client with http_client and meilisearch on app state."""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from app.dependencies import get_db
        from app.main import create_app

        factory = async_sessionmaker(
            test_engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

        async def _override_get_db():
            async with factory() as session:
                yield session

        application = create_app()
        application.dependency_overrides[get_db] = _override_get_db
        application.state.http_client = httpx.AsyncClient()
        application.state.meilisearch = None  # No Meilisearch in tests

        transport = ASGITransport(app=application)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client

    @pytest.mark.asyncio
    async def test_search_with_year_filter(self, search_client):
        mock_response = SearchResponse(
            papers=[PaperResult(title="Test", year=2023, sources=[PaperSource.OPENALEX])],
            total=1,
            sources_queried=[PaperSource.OPENALEX],
            sources_failed=[],
        )

        with patch("app.routers.search.search_all_sources", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = mock_response
            response = await search_client.get(
                "/search/papers?q=test&year_from=2020&year_to=2024"
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True

    @pytest.mark.asyncio
    async def test_search_with_citations_sort(self, search_client):
        mock_response = SearchResponse(
            papers=[PaperResult(title="Test", sources=[PaperSource.OPENALEX])],
            total=1,
            sources_queried=[PaperSource.OPENALEX],
            sources_failed=[],
        )

        with patch("app.routers.search.search_all_sources", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = mock_response
            response = await search_client.get(
                "/search/papers?q=test&sort_by=citations"
            )
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_meilisearch_cache_hit(self, search_client):
        """When Meilisearch has results, return them directly."""
        mock_ms = AsyncMock()
        mock_ms.search = AsyncMock(return_value=(
            [{"title": "Cached Paper", "doi": "10.1/cached", "authors": [],
              "sources": ["openalex"], "citation_count": 5, "is_open_access": False}],
            1,
        ))

        search_client._transport.app.state.meilisearch = mock_ms

        response = await search_client.get("/search/papers?q=cached+paper")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["from_cache"] is True

    @pytest.mark.asyncio
    async def test_meilisearch_cache_miss_falls_back(self, search_client):
        """When Meilisearch returns 0 results, fall back to aggregator."""
        mock_ms = AsyncMock()
        mock_ms.search = AsyncMock(return_value=([], 0))
        mock_ms.index_papers = AsyncMock()

        search_client._transport.app.state.meilisearch = mock_ms

        mock_response = SearchResponse(
            papers=[PaperResult(title="Fresh", sources=[PaperSource.OPENALEX])],
            total=1,
            sources_queried=[PaperSource.OPENALEX],
            sources_failed=[],
        )

        with patch("app.routers.search.search_all_sources", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = mock_response
            response = await search_client.get("/search/papers?q=fresh+query")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["data"]["from_cache"] is False
            # Verify results were indexed
            mock_ms.index_papers.assert_called_once()

    @pytest.mark.asyncio
    async def test_meilisearch_unavailable_graceful_fallback(self, search_client):
        """When Meilisearch raises an exception, fall back to aggregator."""
        mock_ms = AsyncMock()
        mock_ms.search = AsyncMock(side_effect=Exception("Connection refused"))

        search_client._transport.app.state.meilisearch = mock_ms

        mock_response = SearchResponse(
            papers=[PaperResult(title="Fallback", sources=[PaperSource.OPENALEX])],
            total=1,
            sources_queried=[PaperSource.OPENALEX],
            sources_failed=[],
        )

        with patch("app.routers.search.search_all_sources", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = mock_response
            response = await search_client.get("/search/papers?q=test")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
