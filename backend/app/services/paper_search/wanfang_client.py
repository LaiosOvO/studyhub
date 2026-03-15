"""Wanfang Data scraper client.

Uses patchright (stealth Playwright) to render Wanfang search pages and
BeautifulSoup to extract paper metadata from the rendered DOM.
Implements BasePaperClient for integration with the search aggregator.
"""

import asyncio
import logging
import re

import httpx
from bs4 import BeautifulSoup, Tag

from app.schemas.paper import PaperResult, PaperSource

from .base_client import BasePaperClient
from .browser_pool import BrowserPool

logger = logging.getLogger(__name__)

# ─── Rate Limiting ──────────────────────────────────────────────────
_WANFANG_DELAY = 3.0  # seconds between requests

# ─── CSS Selectors (module-level constants for easy maintenance) ────
# Primary selectors for Wanfang search results
WANFANG_SELECTORS = {
    "result_item": ".normal-list .normal-list-item",
    "title": ".title a",
    "authors": ".author a",
    "venue": ".source a",
    "year": ".year",
    "abstract": ".abstract",
}

# Fallback selectors (alternative DOM structure)
WANFANG_SELECTORS_FALLBACK = {
    "result_item": ".paper-list .paper-item",
    "title": "h3 a",
    "authors": ".info .author a",
    "venue": ".info .periodical a",
    "year": ".info .year",
    "abstract": ".desc",
}


class WanfangBlockedError(Exception):
    """Raised when Wanfang blocks the scraper."""


class WanfangClient(BasePaperClient):
    """Wanfang paper search via headless browser scraping.

    Renders Wanfang search pages with patchright, parses results with
    BeautifulSoup, and normalizes metadata to PaperResult objects.
    """

    def __init__(
        self, http_client: httpx.AsyncClient, browser_pool: BrowserPool
    ) -> None:
        super().__init__(http_client)
        self._pool = browser_pool

    async def search_keywords(
        self, query: str, limit: int = 25
    ) -> list[PaperResult]:
        """Search Wanfang by keyword query using browser automation."""
        url = f"https://s.wanfangdata.com.cn/paper?q={query}&style=detail"
        return await self._browser_search(url, limit)

    async def search_doi(self, doi: str) -> PaperResult | None:
        """Wanfang does not support public DOI lookup."""
        return None

    async def search_author(
        self, author: str, limit: int = 25
    ) -> list[PaperResult]:
        """Search Wanfang by author name."""
        url = f"https://s.wanfangdata.com.cn/paper?q={author}&style=detail"
        return await self._browser_search(url, limit)

    async def _browser_search(
        self, url: str, limit: int
    ) -> list[PaperResult]:
        """Execute a browser-based search and parse results."""
        async with self._pool.get_context("wanfangdata.com.cn") as ctx:
            page = await ctx.new_page()
            try:
                await page.goto(url, wait_until="networkidle", timeout=30000)
                content = await page.content()
                results = self._parse_results(content, limit)

                # Detect selector mismatch
                if not results and len(content) > 5000:
                    logger.warning(
                        "SELECTOR_MISMATCH: Wanfang page loaded (%d bytes) "
                        "but 0 results parsed. DOM structure may have changed.",
                        len(content),
                    )

                return results
            finally:
                await page.close()
                await asyncio.sleep(_WANFANG_DELAY)

    def _parse_results(
        self, html: str, limit: int
    ) -> list[PaperResult]:
        """Parse Wanfang search results HTML into PaperResult objects.

        Tries primary selectors first, falls back to alternative selectors
        if primary yields no results.
        """
        soup = BeautifulSoup(html, "lxml")

        # Try primary selectors
        papers = self._extract_papers(soup, WANFANG_SELECTORS, limit)

        # Fallback if primary yields nothing
        if not papers:
            papers = self._extract_papers(
                soup, WANFANG_SELECTORS_FALLBACK, limit
            )

        return papers

    def _extract_papers(
        self,
        soup: BeautifulSoup,
        selectors: dict[str, str],
        limit: int,
    ) -> list[PaperResult]:
        """Extract papers using a given set of CSS selectors."""
        papers: list[PaperResult] = []

        items = soup.select(selectors["result_item"])
        for item in items[:limit]:
            if not isinstance(item, Tag):
                continue

            title_el = item.select_one(selectors["title"])
            if not title_el:
                continue

            title = title_el.get_text(strip=True)
            if not title:
                continue

            # Extract Wanfang ID from title link href
            wanfang_id = self._extract_wanfang_id(title_el)

            # Extract abstract if available
            abstract = self._safe_text(
                item, selectors.get("abstract", "")
            )

            papers.append(
                PaperResult(
                    title=title,
                    authors=[
                        a.get_text(strip=True)
                        for a in item.select(selectors["authors"])
                    ],
                    venue=self._safe_text(
                        item, selectors.get("venue", "")
                    ),
                    year=self._extract_year(item, selectors),
                    abstract=abstract,
                    language="zh",
                    sources=[PaperSource.WANFANG],
                    wanfang_id=wanfang_id,
                )
            )

        return papers

    @staticmethod
    def _safe_text(item: Tag, selector: str) -> str | None:
        """Safely extract text from a CSS selector match."""
        if not selector:
            return None
        el = item.select_one(selector)
        if el is None:
            return None
        text = el.get_text(strip=True)
        return text if text else None

    @staticmethod
    def _extract_year(item: Tag, selectors: dict[str, str]) -> int | None:
        """Extract publication year from year field."""
        year_selector = selectors.get("year", "")
        if not year_selector:
            return None
        year_el = item.select_one(year_selector)
        if year_el is None:
            return None
        text = year_el.get_text(strip=True)
        match = re.search(r"(\d{4})", text)
        return int(match.group(1)) if match else None

    @staticmethod
    def _extract_wanfang_id(title_el: Tag) -> str | None:
        """Extract Wanfang paper ID from the title link href."""
        href = title_el.get("href", "")
        if not href:
            return None
        # Wanfang links often contain /paper/detail/<id> pattern
        match = re.search(r"/(?:detail|paper)/([^/?]+)", str(href))
        return match.group(1) if match else None
