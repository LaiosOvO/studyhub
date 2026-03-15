"""Baidu Baike scraper for scholar profile extraction.

Fetches scholar pages from baike.baidu.com and extracts structured
metadata including institution, titles, research fields, and honors.

Reference: gpt-researcher async scraping patterns.
CSS selectors as module-level constants (per Phase 3 decision).
"""

import logging
import urllib.parse

import httpx
from lxml import html

from app.schemas.scholar import ScholarCreate

logger = logging.getLogger(__name__)

# ─── Browser-like UA to avoid basic blocking ──────────────────────────
_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

# ─── CSS selectors with fallback (same pattern as CNKI/Wanfang scrapers) ─
_SELECTORS = {
    "basic_info": [
        ".basic-info",
        ".basicInfo-block",
        "#基本信息",
    ],
    "basic_info_item_name": [
        "dt.basicInfo-item.name",
        "dt.name",
        ".basic-info dt",
    ],
    "basic_info_item_value": [
        "dd.basicInfo-item.value",
        "dd.value",
        ".basic-info dd",
    ],
    "summary": [
        ".lemma-summary .para",
        ".lemmaWgt-lemmaSummary .para",
        ".J-summary .para",
    ],
    "honors_section": [
        "#人物荣誉",
        "#所获荣誉",
        "#荣誉奖项",
    ],
}


def _try_selectors(tree: html.HtmlElement, selectors: list[str]) -> list:
    """Try multiple CSS selectors, return first non-empty result."""
    for selector in selectors:
        elements = tree.cssselect(selector)
        if elements:
            return elements
    return []


def _clean_text(text: str) -> str:
    """Strip whitespace and invisible characters from extracted text."""
    return " ".join(text.split()).strip()


def _extract_basic_info(tree: html.HtmlElement) -> dict:
    """Extract key-value pairs from the basic info table."""
    info = {}
    names = _try_selectors(tree, _SELECTORS["basic_info_item_name"])
    values = _try_selectors(tree, _SELECTORS["basic_info_item_value"])

    for name_el, value_el in zip(names, values, strict=False):
        key = _clean_text(name_el.text_content())
        value = _clean_text(value_el.text_content())
        if key and value:
            info[key] = value

    return info


def _parse_birth_year(info: dict) -> int | None:
    """Extract birth year from basic info fields."""
    for key in ("出生日期", "出生年月", "出生时间"):
        date_str = info.get(key, "")
        if date_str:
            # Try to extract year from formats like "1962年" or "1962年1月"
            for part in date_str.replace("年", " ").replace("/", " ").split():
                if part.isdigit() and 1900 <= int(part) <= 2010:
                    return int(part)
    return None


def _parse_titles(info: dict) -> list[str]:
    """Extract professional titles from basic info."""
    titles = []
    for key in ("职称", "职务", "专业方向", "职业"):
        value = info.get(key, "")
        if value:
            # Split on common delimiters
            for title in value.replace("；", "、").replace(",", "、").split("、"):
                cleaned = title.strip()
                if cleaned and cleaned not in titles:
                    titles.append(cleaned)
    return titles


def _parse_institution(info: dict) -> str | None:
    """Extract institution from basic info."""
    for key in ("任职院校", "工作单位", "就职单位", "所在单位", "毕业院校"):
        value = info.get(key, "")
        if value:
            return value.strip()
    return None


def _parse_research_fields(info: dict, summary_text: str) -> list[str]:
    """Extract research fields from basic info and summary."""
    fields = []
    for key in ("研究方向", "研究领域", "主要成就", "代表作品"):
        value = info.get(key, "")
        if value:
            for field in value.replace("；", "、").replace(",", "、").split("、"):
                cleaned = field.strip()
                if cleaned and cleaned not in fields:
                    fields.append(cleaned)
    return fields


class BaikeScraper:
    """Scraper for extracting scholar profiles from Baidu Baike.

    Uses httpx for async HTTP requests and lxml for HTML parsing.
    Returns ScholarCreate on success, None on failure.
    """

    def __init__(self, http_client: httpx.AsyncClient) -> None:
        self._client = http_client

    async def scrape_profile(
        self, name: str, baike_url: str | None = None
    ) -> ScholarCreate | None:
        """Scrape a scholar profile from Baidu Baike.

        Args:
            name: Scholar name (Chinese).
            baike_url: Direct URL to the Baike page. If None, constructs
                       from the name.

        Returns:
            ScholarCreate with extracted metadata, or None if not found
            or parsing fails.
        """
        url = baike_url or f"https://baike.baidu.com/item/{urllib.parse.quote(name)}"

        try:
            response = await self._client.get(
                url,
                headers={"User-Agent": _USER_AGENT},
                follow_redirects=True,
            )
            if response.status_code != 200:
                logger.warning(
                    "Baike returned %d for %s", response.status_code, name
                )
                return None
        except httpx.HTTPError as exc:
            logger.warning("HTTP error fetching Baike page for %s: %s", name, exc)
            return None

        try:
            return self._parse_page(name, url, response.text)
        except Exception as exc:
            logger.warning("Failed to parse Baike page for %s: %s", name, exc)
            return None

    def _parse_page(
        self, name: str, url: str, page_html: str
    ) -> ScholarCreate | None:
        """Parse HTML content into a ScholarCreate object."""
        tree = html.fromstring(page_html)

        # Extract basic info table
        basic_info = _extract_basic_info(tree)
        if not basic_info:
            logger.info("No basic info table found for %s", name)

        # Extract summary text
        summary_elements = _try_selectors(tree, _SELECTORS["summary"])
        summary_text = " ".join(
            _clean_text(el.text_content()) for el in summary_elements
        )

        # Parse fields from basic info
        institution = _parse_institution(basic_info) or "未知"
        birth_year = _parse_birth_year(basic_info)
        titles = _parse_titles(basic_info)
        research_fields = _parse_research_fields(basic_info, summary_text)

        # Determine rank from titles
        rank = None
        rank_keywords = ["院士", "教授", "主任医师", "副教授", "副主任医师", "研究员"]
        for keyword in rank_keywords:
            for title in titles:
                if keyword in title:
                    rank = keyword
                    break
            if rank:
                break

        # Extract English name if present
        name_en = basic_info.get("外文名", None) or basic_info.get("英文名", None)

        # Extract education
        education = {}
        for key in ("毕业院校", "学位/学历"):
            value = basic_info.get(key, "")
            if value:
                education["institution"] = value
        if not education:
            education = None

        return ScholarCreate(
            name=name,
            name_en=name_en,
            institution=institution,
            title=titles,
            rank=rank,
            birth_year=birth_year,
            research_fields=research_fields,
            honors=[],
            education=education,
            source_urls=[{"source": "baike", "url": url}],
        )
