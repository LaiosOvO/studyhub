"""Tests for the multi-source paper search pipeline.

Covers: schema validation, deduplication (DOI, title, fuzzy, CJK),
client instantiation, aggregator fan-out, and search endpoint.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.schemas.paper import PaperCreate, PaperResult, PaperSource
from app.schemas.search import SearchRequest, SearchResponse, SearchType
from app.services.paper_search.base_client import BasePaperClient
from app.services.paper_search.deduplicator import (
    _fuzzy_match,
    _normalize_title,
    deduplicate,
)


# ─── Schema Tests ────────────────────────────────────────────────────


class TestPaperSchemas:
    def test_paper_result_minimal(self):
        paper = PaperResult(title="Test Paper")
        assert paper.title == "Test Paper"
        assert paper.doi is None
        assert paper.authors == []
        assert paper.citation_count == 0
        assert paper.sources == []

    def test_paper_result_full(self):
        paper = PaperResult(
            doi="10.1234/test",
            openalex_id="W123",
            s2_id="abc123",
            pmid="12345",
            arxiv_id="2301.12345",
            title="Attention Is All You Need",
            abstract="We propose the Transformer...",
            authors=["Vaswani", "Shazeer"],
            year=2017,
            venue="NeurIPS",
            language="en",
            citation_count=50000,
            pdf_url="https://arxiv.org/pdf/1706.03762",
            is_open_access=True,
            sources=[PaperSource.OPENALEX, PaperSource.SEMANTIC_SCHOLAR],
        )
        assert paper.doi == "10.1234/test"
        assert len(paper.sources) == 2

    def test_paper_create_extends_result(self):
        paper = PaperCreate(
            title="Test",
            parsed_content={"title": "Test", "sections": []},
            pdf_storage_key="papers/123/paper.pdf",
        )
        assert paper.parsed_content is not None
        assert paper.pdf_storage_key is not None

    def test_paper_source_enum(self):
        assert PaperSource.OPENALEX.value == "openalex"
        assert PaperSource.SEMANTIC_SCHOLAR.value == "semantic_scholar"
        assert PaperSource.PUBMED.value == "pubmed"
        assert PaperSource.ARXIV.value == "arxiv"

    def test_search_request_defaults(self):
        req = SearchRequest(query="transformers")
        assert req.search_type == SearchType.KEYWORD
        assert req.limit == 25
        assert req.sources is None

    def test_search_response_structure(self):
        resp = SearchResponse(
            papers=[PaperResult(title="Test")],
            total=1,
            sources_queried=[PaperSource.OPENALEX],
            sources_failed=[],
        )
        assert resp.total == 1
        assert len(resp.papers) == 1


# ─── Deduplication Tests ─────────────────────────────────────────────


class TestDeduplication:
    def test_normalize_title(self):
        assert _normalize_title("  Hello,  World!  ") == "hello world"
        assert _normalize_title("A Title: With Punctuation.") == "a title with punctuation"

    def test_deduplicate_by_doi(self):
        papers = [
            PaperResult(
                doi="10.1234/test",
                title="Paper A",
                sources=[PaperSource.OPENALEX],
            ),
            PaperResult(
                doi="10.1234/TEST",
                title="Paper A",
                sources=[PaperSource.SEMANTIC_SCHOLAR],
            ),
        ]
        result = deduplicate(papers)
        assert len(result) == 1
        assert PaperSource.OPENALEX in result[0].sources
        assert PaperSource.SEMANTIC_SCHOLAR in result[0].sources

    def test_deduplicate_by_title_year(self):
        papers = [
            PaperResult(
                title="Attention Is All You Need",
                year=2017,
                sources=[PaperSource.OPENALEX],
            ),
            PaperResult(
                title="attention is all you need",
                year=2017,
                sources=[PaperSource.ARXIV],
            ),
        ]
        result = deduplicate(papers)
        assert len(result) == 1
        assert len(result[0].sources) == 2

    def test_deduplicate_fuzzy_match(self):
        papers = [
            PaperResult(
                title="Attention Is All You Need",
                year=2017,
                sources=[PaperSource.OPENALEX],
            ),
            PaperResult(
                title="Attention is All You Need!",
                year=2018,  # Different year to avoid tier 2 match
                sources=[PaperSource.ARXIV],
            ),
        ]
        result = deduplicate(papers)
        assert len(result) == 1

    def test_deduplicate_no_false_merge(self):
        papers = [
            PaperResult(
                title="Paper About Cats",
                year=2020,
                sources=[PaperSource.OPENALEX],
            ),
            PaperResult(
                title="Paper About Dogs",
                year=2020,
                sources=[PaperSource.ARXIV],
            ),
        ]
        result = deduplicate(papers)
        assert len(result) == 2

    def test_deduplicate_merge_fields(self):
        papers = [
            PaperResult(
                doi="10.1234/test",
                title="Test Paper",
                abstract=None,
                sources=[PaperSource.OPENALEX],
                citation_count=10,
            ),
            PaperResult(
                doi="10.1234/test",
                title="Test Paper",
                abstract="This is the abstract",
                s2_id="s2_123",
                sources=[PaperSource.SEMANTIC_SCHOLAR],
                citation_count=15,
            ),
        ]
        result = deduplicate(papers)
        assert len(result) == 1
        assert result[0].abstract == "This is the abstract"
        assert result[0].s2_id == "s2_123"
        assert result[0].citation_count == 15

    def test_fuzzy_match_cjk(self):
        score = _fuzzy_match("基于Transformer的机器翻译", "基于Transformer的机器翻译模型")
        # These are similar but not identical
        assert score > 70

    def test_deduplicate_chinese_titles(self):
        papers = [
            PaperResult(
                title="基于深度学习的自然语言处理研究",
                year=2023,
                sources=[PaperSource.OPENALEX],
            ),
            PaperResult(
                title="基于深度学习的自然语言处理研究",
                year=2023,
                sources=[PaperSource.SEMANTIC_SCHOLAR],
            ),
        ]
        result = deduplicate(papers)
        assert len(result) == 1
        assert len(result[0].sources) == 2

    def test_deduplicate_empty_list(self):
        assert deduplicate([]) == []

    def test_deduplicate_single_paper(self):
        papers = [PaperResult(title="Solo Paper", sources=[PaperSource.ARXIV])]
        result = deduplicate(papers)
        assert len(result) == 1


# ─── Client Tests ────────────────────────────────────────────────────


class TestClientInstantiation:
    def test_base_client_is_abstract(self):
        with pytest.raises(TypeError):
            BasePaperClient(httpx.AsyncClient())

    def test_openalex_client_creation(self):
        from app.services.paper_search.openalex_client import OpenAlexClient
        client = OpenAlexClient(httpx.AsyncClient(), api_key="test_key")
        assert client is not None

    def test_s2_client_creation(self):
        from app.services.paper_search.s2_client import SemanticScholarClient
        client = SemanticScholarClient(httpx.AsyncClient(), api_key="test_key")
        assert client is not None

    def test_pubmed_client_creation(self):
        from app.services.paper_search.pubmed_client import PubMedClient
        client = PubMedClient(httpx.AsyncClient(), api_key="test_key")
        assert client is not None

    def test_arxiv_client_creation(self):
        from app.services.paper_search.arxiv_client import ArxivClient
        client = ArxivClient(httpx.AsyncClient())
        assert client is not None


# ─── Aggregator Tests ────────────────────────────────────────────────


class TestAggregator:
    @pytest.mark.asyncio
    async def test_aggregator_all_sources_succeed(self):
        mock_papers = [
            PaperResult(title="Paper 1", sources=[PaperSource.OPENALEX]),
        ]

        with patch("app.services.paper_search.aggregator._create_clients") as mock_create:
            mock_client = AsyncMock()
            mock_client.search_keywords = AsyncMock(return_value=mock_papers)
            mock_create.return_value = {
                PaperSource.OPENALEX: mock_client,
                PaperSource.SEMANTIC_SCHOLAR: mock_client,
                PaperSource.PUBMED: mock_client,
                PaperSource.ARXIV: mock_client,
            }

            from app.services.paper_search.aggregator import search_all_sources
            request = SearchRequest(query="test")
            result = await search_all_sources(request, httpx.AsyncClient())

            assert isinstance(result, SearchResponse)
            assert len(result.papers) > 0
            assert len(result.sources_failed) == 0

    @pytest.mark.asyncio
    async def test_aggregator_one_source_fails(self):
        mock_papers = [
            PaperResult(title="Paper 1", doi="10.1/a", sources=[PaperSource.OPENALEX]),
        ]

        with patch("app.services.paper_search.aggregator._create_clients") as mock_create:
            success_client = AsyncMock()
            success_client.search_keywords = AsyncMock(return_value=mock_papers)

            fail_client = AsyncMock()
            fail_client.search_keywords = AsyncMock(side_effect=httpx.TimeoutException("timeout"))

            mock_create.return_value = {
                PaperSource.OPENALEX: success_client,
                PaperSource.SEMANTIC_SCHOLAR: fail_client,
                PaperSource.PUBMED: success_client,
                PaperSource.ARXIV: success_client,
            }

            from app.services.paper_search.aggregator import search_all_sources
            request = SearchRequest(query="test")
            result = await search_all_sources(request, httpx.AsyncClient())

            assert len(result.papers) > 0
            assert PaperSource.SEMANTIC_SCHOLAR in result.sources_failed

    @pytest.mark.asyncio
    async def test_aggregator_doi_search(self):
        mock_paper = PaperResult(
            doi="10.1234/test",
            title="Test Paper",
            sources=[PaperSource.OPENALEX],
        )

        with patch("app.services.paper_search.aggregator._create_clients") as mock_create:
            mock_client = AsyncMock()
            mock_client.search_doi = AsyncMock(return_value=mock_paper)
            mock_create.return_value = {
                PaperSource.OPENALEX: mock_client,
                PaperSource.SEMANTIC_SCHOLAR: mock_client,
                PaperSource.PUBMED: mock_client,
                PaperSource.ARXIV: mock_client,
            }

            from app.services.paper_search.aggregator import search_all_sources
            request = SearchRequest(query="10.1234/test", search_type=SearchType.DOI)
            result = await search_all_sources(request, httpx.AsyncClient())

            assert len(result.papers) > 0

    @pytest.mark.asyncio
    async def test_aggregator_author_search(self):
        mock_papers = [
            PaperResult(title="Author's Paper", sources=[PaperSource.OPENALEX]),
        ]

        with patch("app.services.paper_search.aggregator._create_clients") as mock_create:
            mock_client = AsyncMock()
            mock_client.search_author = AsyncMock(return_value=mock_papers)
            mock_create.return_value = {
                PaperSource.OPENALEX: mock_client,
                PaperSource.SEMANTIC_SCHOLAR: mock_client,
                PaperSource.PUBMED: mock_client,
                PaperSource.ARXIV: mock_client,
            }

            from app.services.paper_search.aggregator import search_all_sources
            request = SearchRequest(query="Vaswani", search_type=SearchType.AUTHOR)
            result = await search_all_sources(request, httpx.AsyncClient())

            assert len(result.papers) > 0


# ─── Search Endpoint Tests ────────────────────────────────────────────


class TestSearchEndpoint:
    @pytest_asyncio.fixture
    async def search_client(self, test_engine):
        """Create a test client with http_client set on app state."""
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
        # Set http_client on state (normally done in lifespan)
        application.state.http_client = httpx.AsyncClient()

        transport = ASGITransport(app=application)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client

    @pytest.mark.asyncio
    async def test_search_endpoint_success(self, search_client):
        mock_response = SearchResponse(
            papers=[PaperResult(title="Test", sources=[PaperSource.OPENALEX])],
            total=1,
            sources_queried=[PaperSource.OPENALEX],
            sources_failed=[],
        )

        with patch("app.routers.search.search_all_sources", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = mock_response
            response = await search_client.get("/search/papers?q=transformers")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True

    @pytest.mark.asyncio
    async def test_search_endpoint_missing_query(self, search_client):
        response = await search_client.get("/search/papers")
        assert response.status_code == 422
