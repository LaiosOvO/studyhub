"""Tests for aggregator integration with Chinese academic sources.

Covers: CNKI/Wanfang registration, graceful degradation (CAPTCHA,
timeout, blocked), per-source status reporting, backward compatibility
without browser_pool, and deduplication of Chinese source IDs.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.schemas.paper import PaperResult, PaperSource
from app.schemas.search import (
    SearchRequest,
    SearchResponse,
    SearchType,
    SourceReport,
    SourceStatus,
)
from app.services.paper_search.cnki_client import CnkiCaptchaError
from app.services.paper_search.deduplicator import deduplicate
from app.services.paper_search.wanfang_client import WanfangBlockedError


# ─── Helper ──────────────────────────────────────────────────────────


def _mock_paper(
    title: str,
    source: PaperSource,
    doi: str | None = None,
    cnki_id: str | None = None,
    wanfang_id: str | None = None,
) -> PaperResult:
    return PaperResult(
        title=title,
        doi=doi,
        sources=[source],
        language="zh" if source in (PaperSource.CNKI, PaperSource.WANFANG) else "en",
        cnki_id=cnki_id,
        wanfang_id=wanfang_id,
    )


def _create_mock_clients(
    success_papers: list[PaperResult] | None = None,
    cnki_error: Exception | None = None,
    wanfang_error: Exception | None = None,
) -> dict:
    """Create a dict of mock clients for all 6 sources."""
    papers = success_papers or [
        _mock_paper("Test Paper", PaperSource.OPENALEX, doi="10.1/test"),
    ]

    clients = {}
    for source in [
        PaperSource.OPENALEX,
        PaperSource.SEMANTIC_SCHOLAR,
        PaperSource.PUBMED,
        PaperSource.ARXIV,
    ]:
        mock = AsyncMock()
        mock.search_keywords = AsyncMock(return_value=papers)
        mock.search_doi = AsyncMock(return_value=papers[0] if papers else None)
        mock.search_author = AsyncMock(return_value=papers)
        clients[source] = mock

    # CNKI client
    cnki_mock = AsyncMock()
    if cnki_error:
        cnki_mock.search_keywords = AsyncMock(side_effect=cnki_error)
        cnki_mock.search_author = AsyncMock(side_effect=cnki_error)
    else:
        cnki_papers = [
            _mock_paper("中文论文", PaperSource.CNKI, cnki_id="CNKI001"),
        ]
        cnki_mock.search_keywords = AsyncMock(return_value=cnki_papers)
        cnki_mock.search_author = AsyncMock(return_value=cnki_papers)
    cnki_mock.search_doi = AsyncMock(return_value=None)
    clients[PaperSource.CNKI] = cnki_mock

    # Wanfang client
    wf_mock = AsyncMock()
    if wanfang_error:
        wf_mock.search_keywords = AsyncMock(side_effect=wanfang_error)
        wf_mock.search_author = AsyncMock(side_effect=wanfang_error)
    else:
        wf_papers = [
            _mock_paper("万方论文", PaperSource.WANFANG, wanfang_id="WF001"),
        ]
        wf_mock.search_keywords = AsyncMock(return_value=wf_papers)
        wf_mock.search_author = AsyncMock(return_value=wf_papers)
    wf_mock.search_doi = AsyncMock(return_value=None)
    clients[PaperSource.WANFANG] = wf_mock

    return clients


# ─── Aggregator Tests with Chinese Sources ───────────────────────────


class TestAggregatorWithChineseSources:
    @pytest.mark.asyncio
    async def test_all_six_sources_succeed(self):
        with patch(
            "app.services.paper_search.aggregator._create_clients"
        ) as mock_create:
            mock_create.return_value = _create_mock_clients()

            from app.services.paper_search.aggregator import search_all_sources

            request = SearchRequest(query="deep learning")
            result = await search_all_sources(
                request, httpx.AsyncClient(), browser_pool=MagicMock()
            )

            assert isinstance(result, SearchResponse)
            assert len(result.papers) > 0
            assert len(result.sources_failed) == 0
            assert len(result.source_reports) == 6

            statuses = {r.source: r.status for r in result.source_reports}
            assert statuses[PaperSource.CNKI] == SourceStatus.AVAILABLE
            assert statuses[PaperSource.WANFANG] == SourceStatus.AVAILABLE

    @pytest.mark.asyncio
    async def test_cnki_captcha_graceful_degradation(self):
        with patch(
            "app.services.paper_search.aggregator._create_clients"
        ) as mock_create:
            mock_create.return_value = _create_mock_clients(
                cnki_error=CnkiCaptchaError("CAPTCHA detected")
            )

            from app.services.paper_search.aggregator import search_all_sources

            request = SearchRequest(query="test")
            result = await search_all_sources(
                request, httpx.AsyncClient(), browser_pool=MagicMock()
            )

            # Other sources still return results
            assert len(result.papers) > 0
            assert PaperSource.CNKI in result.sources_failed

            # Source report shows CAPTCHA_BLOCKED
            cnki_report = next(
                r for r in result.source_reports if r.source == PaperSource.CNKI
            )
            assert cnki_report.status == SourceStatus.CAPTCHA_BLOCKED

    @pytest.mark.asyncio
    async def test_wanfang_blocked_graceful_degradation(self):
        with patch(
            "app.services.paper_search.aggregator._create_clients"
        ) as mock_create:
            mock_create.return_value = _create_mock_clients(
                wanfang_error=WanfangBlockedError("IP blocked")
            )

            from app.services.paper_search.aggregator import search_all_sources

            request = SearchRequest(query="test")
            result = await search_all_sources(
                request, httpx.AsyncClient(), browser_pool=MagicMock()
            )

            assert len(result.papers) > 0
            assert PaperSource.WANFANG in result.sources_failed

            wf_report = next(
                r for r in result.source_reports if r.source == PaperSource.WANFANG
            )
            assert wf_report.status == SourceStatus.RATE_LIMITED

    @pytest.mark.asyncio
    async def test_wanfang_timeout_unavailable(self):
        with patch(
            "app.services.paper_search.aggregator._create_clients"
        ) as mock_create:
            mock_create.return_value = _create_mock_clients(
                wanfang_error=asyncio.TimeoutError()
            )

            from app.services.paper_search.aggregator import search_all_sources

            request = SearchRequest(query="test")
            result = await search_all_sources(
                request, httpx.AsyncClient(), browser_pool=MagicMock()
            )

            assert len(result.papers) > 0
            wf_report = next(
                r for r in result.source_reports if r.source == PaperSource.WANFANG
            )
            assert wf_report.status == SourceStatus.UNAVAILABLE

    @pytest.mark.asyncio
    async def test_no_browser_pool_api_only(self):
        """Without browser_pool, only API sources are queried."""
        with patch(
            "app.services.paper_search.aggregator._create_clients"
        ) as mock_create:
            # Only return API clients (no CNKI/Wanfang)
            api_clients = {}
            for source in [
                PaperSource.OPENALEX,
                PaperSource.SEMANTIC_SCHOLAR,
                PaperSource.PUBMED,
                PaperSource.ARXIV,
            ]:
                mock = AsyncMock()
                mock.search_keywords = AsyncMock(
                    return_value=[_mock_paper("API Paper", source)]
                )
                api_clients[source] = mock
            mock_create.return_value = api_clients

            from app.services.paper_search.aggregator import search_all_sources

            request = SearchRequest(query="test")
            result = await search_all_sources(
                request, httpx.AsyncClient(), browser_pool=None
            )

            assert len(result.papers) > 0
            # CNKI and Wanfang should not appear in reports
            report_sources = {r.source for r in result.source_reports}
            assert PaperSource.CNKI not in report_sources
            assert PaperSource.WANFANG not in report_sources

    @pytest.mark.asyncio
    async def test_source_reports_include_result_counts(self):
        with patch(
            "app.services.paper_search.aggregator._create_clients"
        ) as mock_create:
            mock_create.return_value = _create_mock_clients()

            from app.services.paper_search.aggregator import search_all_sources

            request = SearchRequest(query="test")
            result = await search_all_sources(
                request, httpx.AsyncClient(), browser_pool=MagicMock()
            )

            for report in result.source_reports:
                if report.status == SourceStatus.AVAILABLE:
                    assert report.result_count >= 0

    @pytest.mark.asyncio
    async def test_generic_error_classified_as_error(self):
        with patch(
            "app.services.paper_search.aggregator._create_clients"
        ) as mock_create:
            mock_create.return_value = _create_mock_clients(
                cnki_error=RuntimeError("unexpected failure")
            )

            from app.services.paper_search.aggregator import search_all_sources

            request = SearchRequest(query="test")
            result = await search_all_sources(
                request, httpx.AsyncClient(), browser_pool=MagicMock()
            )

            cnki_report = next(
                r for r in result.source_reports if r.source == PaperSource.CNKI
            )
            assert cnki_report.status == SourceStatus.ERROR

    @pytest.mark.asyncio
    async def test_both_chinese_sources_fail_others_succeed(self):
        with patch(
            "app.services.paper_search.aggregator._create_clients"
        ) as mock_create:
            mock_create.return_value = _create_mock_clients(
                cnki_error=CnkiCaptchaError("blocked"),
                wanfang_error=WanfangBlockedError("blocked"),
            )

            from app.services.paper_search.aggregator import search_all_sources

            request = SearchRequest(query="test")
            result = await search_all_sources(
                request, httpx.AsyncClient(), browser_pool=MagicMock()
            )

            # API sources still work
            assert len(result.papers) > 0
            assert PaperSource.CNKI in result.sources_failed
            assert PaperSource.WANFANG in result.sources_failed


# ─── Deduplication with Chinese IDs ──────────────────────────────────


class TestDeduplicationWithChineseIds:
    def test_merge_cnki_and_wanfang_ids(self):
        papers = [
            PaperResult(
                title="基于深度学习的文本分类",
                year=2023,
                cnki_id="CNKI001",
                sources=[PaperSource.CNKI],
            ),
            PaperResult(
                title="基于深度学习的文本分类",
                year=2023,
                wanfang_id="WF001",
                sources=[PaperSource.WANFANG],
            ),
        ]
        result = deduplicate(papers)

        assert len(result) == 1
        assert result[0].cnki_id == "CNKI001"
        assert result[0].wanfang_id == "WF001"
        assert PaperSource.CNKI in result[0].sources
        assert PaperSource.WANFANG in result[0].sources

    def test_merge_chinese_with_international(self):
        papers = [
            PaperResult(
                title="Deep Learning for Text Classification",
                doi="10.1234/test",
                year=2023,
                sources=[PaperSource.OPENALEX],
            ),
            PaperResult(
                title="Deep Learning for Text Classification",
                doi="10.1234/test",
                year=2023,
                cnki_id="CNKI002",
                sources=[PaperSource.CNKI],
            ),
        ]
        result = deduplicate(papers)

        assert len(result) == 1
        assert result[0].doi == "10.1234/test"
        assert result[0].cnki_id == "CNKI002"
        assert PaperSource.OPENALEX in result[0].sources
        assert PaperSource.CNKI in result[0].sources
