"""CNKI (China National Knowledge Infrastructure) scraper client.

Uses patchright (stealth Playwright) to render CNKI search pages and
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
_CNKI_DELAY = 4.0  # seconds between requests

# ─── CSS Selectors (module-level constants for easy maintenance) ────
# Primary selectors for CNKI KNS8 result page
CNKI_SELECTORS = {
    "result_row": "table.result-table-list tbody tr",
    "title": "td.name a.fz14",
    "authors": "td.author a",
    "venue": "td.source a",
    "date": "td.date",
    "cite_count": "td.quote a",
    "download_count": "td.download a",
}

# Fallback selectors (alternative DOM structure)
CNKI_SELECTORS_FALLBACK = {
    "result_row": ".result-table-list tr",
    "title": ".fz14",
    "authors": ".author a",
    "venue": ".source a",
    "date": ".date",
    "cite_count": ".quote a",
}

# CAPTCHA indicators
_CAPTCHA_SELECTORS = [".verify-img-panel", ".verify-wrap"]
_CAPTCHA_URL_PATTERN = "vericode"


class CnkiCaptchaError(Exception):
    """Raised when CNKI presents a CAPTCHA challenge."""


class CnkiSelectorMismatchError(Exception):
    """Raised when CNKI page loaded but CSS selectors matched nothing."""


class CnkiClient(BasePaperClient):
    """CNKI paper search via headless browser scraping.

    Renders CNKI search pages with patchright, parses results with
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
        """Search CNKI by keyword query using browser automation."""
        url = f"https://kns.cnki.net/kns8s/defaultresult/index?kw={query}"
        return await self._browser_search(url, limit)

    async def search_doi(self, doi: str) -> PaperResult | None:
        """CNKI does not support public DOI lookup."""
        return None

    async def search_author(
        self, author: str, limit: int = 25
    ) -> list[PaperResult]:
        """Search CNKI by author name."""
        url = (
            f"https://kns.cnki.net/kns8s/defaultresult/index"
            f"?kw={author}&korder=AU"
        )
        return await self._browser_search(url, limit)

    async def _browser_search(
        self, url: str, limit: int
    ) -> list[PaperResult]:
        """Execute a browser-based search and parse results."""
        async with self._pool.get_context("cnki.net") as ctx:
            page = await ctx.new_page()
            try:
                await page.goto(url, wait_until="networkidle", timeout=30000)
                await self._check_captcha(page)
                content = await page.content()
                results = self._parse_results(content, limit)

                # Detect selector mismatch: page loaded but nothing parsed
                if not results and len(content) > 5000:
                    logger.warning(
                        "SELECTOR_MISMATCH: CNKI page loaded (%d bytes) "
                        "but 0 results parsed. DOM structure may have changed.",
                        len(content),
                    )

                return results
            finally:
                await page.close()
                await asyncio.sleep(_CNKI_DELAY)

    def _parse_results(
        self, html: str, limit: int
    ) -> list[PaperResult]:
        """Parse CNKI search results HTML into PaperResult objects.

        Tries primary selectors first, falls back to alternative selectors
        if primary yields no results.
        """
        soup = BeautifulSoup(html, "lxml")

        # Try primary selectors
        papers = self._extract_papers(soup, CNKI_SELECTORS, limit)

        # Fallback if primary yields nothing
        if not papers:
            papers = self._extract_papers(soup, CNKI_SELECTORS_FALLBACK, limit)

        return papers

    def _extract_papers(
        self,
        soup: BeautifulSoup,
        selectors: dict[str, str],
        limit: int,
    ) -> list[PaperResult]:
        """Extract papers using a given set of CSS selectors."""
        papers: list[PaperResult] = []

        rows = soup.select(selectors["result_row"])
        for item in rows[:limit]:
            if not isinstance(item, Tag):
                continue

            title_el = item.select_one(selectors["title"])
            if not title_el:
                continue

            title = title_el.get_text(strip=True)
            if not title:
                continue

            # Extract CNKI ID from title link href
            cnki_id = self._extract_cnki_id(title_el)

            papers.append(
                PaperResult(
                    title=title,
                    authors=[
                        a.get_text(strip=True)
                        for a in item.select(selectors["authors"])
                    ],
                    venue=self._safe_text(item, selectors.get("venue", "")),
                    year=self._extract_year(item, selectors),
                    citation_count=self._extract_citations(
                        item, selectors
                    ),
                    language="zh",
                    sources=[PaperSource.CNKI],
                    cnki_id=cnki_id,
                )
            )

        return papers

    async def _check_captcha(self, page: object) -> None:
        """Detect CAPTCHA indicators on the page.

        Raises CnkiCaptchaError if a CAPTCHA challenge is detected,
        allowing the caller to handle gracefully.
        """
        # Check URL for vericode redirect
        current_url = str(page.url)  # type: ignore[attr-defined]
        if _CAPTCHA_URL_PATTERN in current_url:
            raise CnkiCaptchaError("CAPTCHA verification required (URL redirect)")

        # Check for CAPTCHA DOM elements
        for selector in _CAPTCHA_SELECTORS:
            element = await page.query_selector(selector)  # type: ignore[attr-defined]
            if element:
                logger.warning("CNKI CAPTCHA detected via selector: %s", selector)
                raise CnkiCaptchaError("CAPTCHA verification required")

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
        """Extract publication year from date field."""
        date_selector = selectors.get("date", "")
        if not date_selector:
            return None
        date_el = item.select_one(date_selector)
        if date_el is None:
            return None
        text = date_el.get_text(strip=True)
        # Match 4-digit year
        match = re.search(r"(\d{4})", text)
        return int(match.group(1)) if match else None

    @staticmethod
    def _extract_citations(item: Tag, selectors: dict[str, str]) -> int:
        """Extract citation count from quote field."""
        cite_selector = selectors.get("cite_count", "")
        if not cite_selector:
            return 0
        cite_el = item.select_one(cite_selector)
        if cite_el is None:
            return 0
        text = cite_el.get_text(strip=True)
        try:
            return int(text)
        except (ValueError, TypeError):
            return 0

    @staticmethod
    def _extract_cnki_id(title_el: Tag) -> str | None:
        """Extract CNKI paper ID from the title link href."""
        href = title_el.get("href", "")
        if not href:
            return None
        # CNKI links often contain dbname and filename params
        match = re.search(r"FileName=([^&]+)", str(href))
        return match.group(1) if match else None
