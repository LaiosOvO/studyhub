"""Tests for the CNKI scraper client.

Covers: HTML parsing (primary + fallback selectors), CAPTCHA detection,
client instantiation, result normalization, and edge cases.
"""

from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from app.schemas.paper import PaperResult, PaperSource
from app.services.paper_search.cnki_client import (
    CNKI_SELECTORS,
    CNKI_SELECTORS_FALLBACK,
    CnkiCaptchaError,
    CnkiClient,
    CnkiSelectorMismatchError,
)


# ─── Mock HTML Fixtures ─────────────────────────────────────────────

CNKI_RESULT_HTML_PRIMARY = """
<html>
<body>
<table class="result-table-list">
<tbody>
<tr>
  <td class="name">
    <a class="fz14" href="/kcms2/article/abstract?v=abc&FileName=ZKJY202301001&DbName=CJFD">
      基于深度学习的中文文本分类研究
    </a>
  </td>
  <td class="author">
    <a>张三</a>
    <a>李四</a>
  </td>
  <td class="source"><a>计算机研究与发展</a></td>
  <td class="date">2023-06-15</td>
  <td class="quote"><a>42</a></td>
  <td class="download"><a>128</a></td>
</tr>
<tr>
  <td class="name">
    <a class="fz14" href="/kcms2/article/abstract?v=def&FileName=JSJX202302005">
      自然语言处理中的注意力机制综述
    </a>
  </td>
  <td class="author">
    <a>王五</a>
  </td>
  <td class="source"><a>中文信息学报</a></td>
  <td class="date">2023-03</td>
  <td class="quote"><a>15</a></td>
  <td class="download"><a>89</a></td>
</tr>
<tr>
  <td class="name">
    <a class="fz14" href="/kcms2/article/abstract?v=ghi&FileName=RJXB202304010">
      大语言模型在学术研究中的应用
    </a>
  </td>
  <td class="author">
    <a>赵六</a>
    <a>钱七</a>
    <a>孙八</a>
  </td>
  <td class="source"><a>软件学报</a></td>
  <td class="date">2023-12-01</td>
  <td class="quote"><a>8</a></td>
  <td class="download"><a>256</a></td>
</tr>
</tbody>
</table>
</body>
</html>
"""

CNKI_RESULT_HTML_FALLBACK = """
<html>
<body>
<div class="result-table-list">
<tr>
  <td>
    <a class="fz14" href="/article?FileName=TEST001">
      Transformer模型的优化方法
    </a>
  </td>
  <td class="author">
    <a>周九</a>
  </td>
  <td class="source"><a>电子学报</a></td>
  <td class="date">2024</td>
  <td class="quote"><a>3</a></td>
</tr>
</div>
</body>
</html>
"""

CNKI_CAPTCHA_HTML = """
<html>
<body>
<div class="verify-img-panel">
  <img src="/captcha.jpg" />
</div>
</body>
</html>
"""

CNKI_EMPTY_HTML = """
<html>
<body>
<div class="no-results">没有找到相关结果</div>
</body>
</html>
"""


# ─── Helper ──────────────────────────────────────────────────────────


def _make_client() -> CnkiClient:
    """Create a CnkiClient with mocked dependencies."""
    mock_pool = MagicMock()
    return CnkiClient(
        http_client=httpx.AsyncClient(),
        browser_pool=mock_pool,
    )


# ─── Parse Results Tests ────────────────────────────────────────────


class TestCnkiParseResults:
    def test_parse_primary_selectors(self):
        client = _make_client()
        results = client._parse_results(CNKI_RESULT_HTML_PRIMARY, limit=25)

        assert len(results) == 3

        # First paper
        assert results[0].title == "基于深度学习的中文文本分类研究"
        assert results[0].authors == ["张三", "李四"]
        assert results[0].venue == "计算机研究与发展"
        assert results[0].year == 2023
        assert results[0].citation_count == 42
        assert results[0].language == "zh"
        assert PaperSource.CNKI in results[0].sources
        assert results[0].cnki_id == "ZKJY202301001"

    def test_parse_all_authors(self):
        client = _make_client()
        results = client._parse_results(CNKI_RESULT_HTML_PRIMARY, limit=25)

        # Third paper has 3 authors
        assert results[2].authors == ["赵六", "钱七", "孙八"]

    def test_parse_with_limit(self):
        client = _make_client()
        results = client._parse_results(CNKI_RESULT_HTML_PRIMARY, limit=2)

        assert len(results) == 2

    def test_parse_fallback_selectors(self):
        client = _make_client()
        # Primary selectors won't match this HTML, fallback should work
        results = client._parse_results(CNKI_RESULT_HTML_FALLBACK, limit=25)

        assert len(results) == 1
        assert results[0].title == "Transformer模型的优化方法"
        assert results[0].authors == ["周九"]
        assert results[0].venue == "电子学报"
        assert results[0].year == 2024
        assert results[0].citation_count == 3
        assert results[0].cnki_id == "TEST001"

    def test_parse_empty_html(self):
        client = _make_client()
        results = client._parse_results(CNKI_EMPTY_HTML, limit=25)

        assert results == []

    def test_parse_truly_empty(self):
        client = _make_client()
        results = client._parse_results("", limit=25)

        assert results == []

    def test_parse_results_have_correct_source(self):
        client = _make_client()
        results = client._parse_results(CNKI_RESULT_HTML_PRIMARY, limit=25)

        for paper in results:
            assert paper.sources == [PaperSource.CNKI]
            assert paper.language == "zh"

    def test_parse_year_various_formats(self):
        client = _make_client()
        results = client._parse_results(CNKI_RESULT_HTML_PRIMARY, limit=25)

        # "2023-06-15" -> 2023
        assert results[0].year == 2023
        # "2023-03" -> 2023
        assert results[1].year == 2023
        # "2023-12-01" -> 2023
        assert results[2].year == 2023

    def test_cnki_id_extraction(self):
        client = _make_client()
        results = client._parse_results(CNKI_RESULT_HTML_PRIMARY, limit=25)

        assert results[0].cnki_id == "ZKJY202301001"
        assert results[1].cnki_id == "JSJX202302005"
        assert results[2].cnki_id == "RJXB202304010"


# ─── CAPTCHA Detection Tests ────────────────────────────────────────


class TestCnkiCaptchaDetection:
    @pytest.mark.asyncio
    async def test_captcha_detected_by_selector(self):
        client = _make_client()

        mock_page = AsyncMock()
        mock_page.url = "https://kns.cnki.net/kns8s/defaultresult/index"
        mock_page.query_selector = AsyncMock(
            side_effect=lambda sel: AsyncMock() if sel == ".verify-img-panel" else None
        )

        with pytest.raises(CnkiCaptchaError, match="CAPTCHA verification required"):
            await client._check_captcha(mock_page)

    @pytest.mark.asyncio
    async def test_captcha_detected_by_url(self):
        client = _make_client()

        mock_page = AsyncMock()
        mock_page.url = "https://kns.cnki.net/KNS8/vericode/index"

        with pytest.raises(CnkiCaptchaError, match="URL redirect"):
            await client._check_captcha(mock_page)

    @pytest.mark.asyncio
    async def test_no_captcha_passes(self):
        client = _make_client()

        mock_page = AsyncMock()
        mock_page.url = "https://kns.cnki.net/kns8s/defaultresult/index"
        mock_page.query_selector = AsyncMock(return_value=None)

        # Should not raise
        await client._check_captcha(mock_page)


# ─── Client Instantiation Tests ─────────────────────────────────────


class TestCnkiClientInstantiation:
    def test_client_creation(self):
        mock_pool = MagicMock()
        client = CnkiClient(
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
        """CSS selectors should be module-level constants, not hardcoded in methods."""
        assert isinstance(CNKI_SELECTORS, dict)
        assert isinstance(CNKI_SELECTORS_FALLBACK, dict)
        assert "result_row" in CNKI_SELECTORS
        assert "title" in CNKI_SELECTORS
        assert "result_row" in CNKI_SELECTORS_FALLBACK
