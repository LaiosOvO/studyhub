"""Tests for the Wanfang Data scraper client.

Covers: HTML parsing (primary + fallback selectors), result normalization,
client instantiation, and edge cases.
"""

from unittest.mock import MagicMock

import httpx
import pytest

from app.schemas.paper import PaperSource
from app.services.paper_search.wanfang_client import (
    WANFANG_SELECTORS,
    WANFANG_SELECTORS_FALLBACK,
    WanfangBlockedError,
    WanfangClient,
)


# ─── Mock HTML Fixtures ─────────────────────────────────────────────

WANFANG_RESULT_HTML_PRIMARY = """
<html>
<body>
<div class="normal-list">
  <div class="normal-list-item">
    <div class="title">
      <a href="/paper/detail/WF2023001">
        基于BERT的中文情感分析方法研究
      </a>
    </div>
    <div class="author">
      <a>刘一</a>
      <a>陈二</a>
    </div>
    <div class="source"><a>计算机应用</a></div>
    <div class="year">2023</div>
    <div class="abstract">
      本文提出了一种基于BERT预训练模型的中文情感分析方法，
      通过微调策略实现了在多个数据集上的最优表现。
    </div>
  </div>
  <div class="normal-list-item">
    <div class="title">
      <a href="/paper/detail/WF2023002">
        知识图谱在医学领域的应用综述
      </a>
    </div>
    <div class="author">
      <a>吴三</a>
    </div>
    <div class="source"><a>生物医学工程学杂志</a></div>
    <div class="year">2024</div>
    <div class="abstract">
      综述了知识图谱技术在医学诊断、药物研发等领域的最新进展。
    </div>
  </div>
</div>
</body>
</html>
"""

WANFANG_RESULT_HTML_FALLBACK = """
<html>
<body>
<div class="paper-list">
  <div class="paper-item">
    <h3><a href="/detail/FBK2024001">图神经网络综述</a></h3>
    <div class="info">
      <span class="author"><a>马四</a></span>
      <span class="periodical"><a>自动化学报</a></span>
      <span class="year">2024</span>
    </div>
    <div class="desc">本文系统综述了图神经网络的发展历程。</div>
  </div>
</div>
</body>
</html>
"""

WANFANG_EMPTY_HTML = """
<html>
<body>
<div class="no-result">暂无搜索结果</div>
</body>
</html>
"""


# ─── Helper ──────────────────────────────────────────────────────────


def _make_client() -> WanfangClient:
    """Create a WanfangClient with mocked dependencies."""
    mock_pool = MagicMock()
    return WanfangClient(
        http_client=httpx.AsyncClient(),
        browser_pool=mock_pool,
    )


# ─── Parse Results Tests ────────────────────────────────────────────


class TestWanfangParseResults:
    def test_parse_primary_selectors(self):
        client = _make_client()
        results = client._parse_results(WANFANG_RESULT_HTML_PRIMARY, limit=25)

        assert len(results) == 2

        # First paper
        assert results[0].title == "基于BERT的中文情感分析方法研究"
        assert results[0].authors == ["刘一", "陈二"]
        assert results[0].venue == "计算机应用"
        assert results[0].year == 2023
        assert results[0].language == "zh"
        assert PaperSource.WANFANG in results[0].sources
        assert results[0].wanfang_id == "WF2023001"

    def test_parse_includes_abstract(self):
        client = _make_client()
        results = client._parse_results(WANFANG_RESULT_HTML_PRIMARY, limit=25)

        assert results[0].abstract is not None
        assert "BERT" in results[0].abstract

    def test_parse_with_limit(self):
        client = _make_client()
        results = client._parse_results(WANFANG_RESULT_HTML_PRIMARY, limit=1)

        assert len(results) == 1

    def test_parse_fallback_selectors(self):
        client = _make_client()
        results = client._parse_results(WANFANG_RESULT_HTML_FALLBACK, limit=25)

        assert len(results) == 1
        assert results[0].title == "图神经网络综述"
        assert results[0].authors == ["马四"]
        assert results[0].venue == "自动化学报"
        assert results[0].year == 2024
        assert results[0].wanfang_id == "FBK2024001"

    def test_parse_empty_html(self):
        client = _make_client()
        results = client._parse_results(WANFANG_EMPTY_HTML, limit=25)

        assert results == []

    def test_parse_truly_empty(self):
        client = _make_client()
        results = client._parse_results("", limit=25)

        assert results == []

    def test_parse_results_have_correct_source(self):
        client = _make_client()
        results = client._parse_results(WANFANG_RESULT_HTML_PRIMARY, limit=25)

        for paper in results:
            assert paper.sources == [PaperSource.WANFANG]
            assert paper.language == "zh"


# ─── Client Instantiation Tests ─────────────────────────────────────


class TestWanfangClientInstantiation:
    def test_client_creation(self):
        mock_pool = MagicMock()
        client = WanfangClient(
            http_client=httpx.AsyncClient(),
            browser_pool=mock_pool,
        )
        assert client._pool is mock_pool

    @pytest.mark.asyncio
    async def test_search_doi_returns_none(self):
        client = _make_client()
        result = await client.search_doi("10.1234/test")
        assert result is None

    def test_selectors_are_module_constants(self):
        """CSS selectors should be module-level constants."""
        assert isinstance(WANFANG_SELECTORS, dict)
        assert isinstance(WANFANG_SELECTORS_FALLBACK, dict)
        assert "result_item" in WANFANG_SELECTORS
        assert "title" in WANFANG_SELECTORS
