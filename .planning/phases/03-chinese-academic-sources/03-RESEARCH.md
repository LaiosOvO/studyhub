# Phase 3: Chinese Academic Sources - Research

**Researched:** 2026-03-15
**Domain:** Chinese academic database scraping (CNKI, Wanfang), anti-scraping resilience, metadata normalization
**Confidence:** MEDIUM

## Summary

Phase 3 adds CNKI (China National Knowledge Infrastructure) and Wanfang as Chinese academic paper sources to the existing multi-source search pipeline. Unlike the Phase 2 APIs (OpenAlex, Semantic Scholar, PubMed, arXiv) which provide official REST APIs, CNKI and Wanfang do not offer public APIs. Both require browser-based scraping with anti-detection measures. CNKI is particularly aggressive with anti-scraping: it uses JavaScript rendering, CAPTCHA challenges (puzzle verification every ~30 pages), and IP-based rate limiting. Wanfang is somewhat more accessible but still requires session management.

The existing architecture from Phase 2 provides a clean extension point: `BasePaperClient` abstract class, `PaperSource` enum, `PaperResult` unified schema, and the `search_all_sources` aggregator with per-source semaphores and graceful failure handling (`return_exceptions=True`). The deduplicator already handles CJK characters. The primary challenge is the scraping layer itself -- all existing clients use httpx for REST APIs, but CNKI/Wanfang require a headless browser.

The recommended approach is **Playwright with stealth patches** (via `patchright` or `playwright-stealth`) for rendering CNKI/Wanfang search pages, extracting metadata from the rendered DOM, and normalizing to `PaperResult`. Each scraper client wraps Playwright behind the same `BasePaperClient` interface. Rate limiting uses conservative delays (3-5s between requests, longer pauses every 20-30 results). When blocked or unavailable, the aggregator already reports `sources_failed` -- Phase 3 extends this with per-source status codes (available, rate-limited, blocked, unavailable).

**Primary recommendation:** Use Playwright (via `patchright` for undetectable automation) for both CNKI and Wanfang scrapers. Implement a `BrowserPool` that manages reusable browser contexts with cookie persistence. Add `PaperSource.CNKI` and `PaperSource.WANFANG` to the enum and register them in the aggregator. Conservative rate limits with exponential backoff on detection.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CNKI-01 | Search CNKI for Chinese papers matching user query | Playwright-based scraper targeting `kns.cnki.net/kns8s/defaultresult/index?kw={query}`, extracting results from rendered DOM |
| CNKI-02 | Search Wanfang for Chinese papers matching user query | Playwright-based scraper targeting `s.wanfangdata.com.cn/paper?q={query}`, extracting results from rendered DOM |
| CNKI-03 | Extract and normalize Chinese paper metadata | Map DOM elements to PaperResult fields: title, authors, abstract, journal (venue), year, citation count; handle Chinese-specific fields |
| CNKI-04 | Handle anti-scraping with rate limiting and session management | Patchright stealth browser, cookie persistence, conservative delays (3-5s), CAPTCHA detection with graceful fallback |
| CNKI-05 | Degrade gracefully when sources unavailable | Existing aggregator pattern handles this; extend with SourceStatus enum (available/rate_limited/blocked/unavailable) for richer feedback |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| patchright | >=1.49 | Stealth Playwright fork for undetectable browser automation | Patches CDP Runtime.enable detection that Playwright-stealth misses; best anti-detection in 2025-2026 |
| beautifulsoup4 | >=4.12 | HTML parsing of rendered page content | Lightweight, battle-tested; parse Playwright page.content() without complex selectors |
| lxml | >=5.0 | Fast HTML parser backend for BeautifulSoup | C-based, 10x faster than html.parser; handles malformed HTML from CNKI |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tenacity | >=9.1 | Retry with exponential backoff (already installed) | All scraping operations; handle transient failures |
| asyncio.Semaphore | stdlib | Per-source concurrency control (pattern from Phase 2) | Limit CNKI to 1 concurrent request, Wanfang to 1 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| patchright | playwright + playwright-stealth plugin | playwright-stealth leaves CDP detection loopholes; patchright patches at source level |
| patchright | Selenium + undetected-chromedriver | Selenium is older, slower, no native async; Playwright/patchright has better API and multi-browser support |
| BeautifulSoup | Playwright locators only | BS4 is more robust for complex HTML extraction; Playwright locators break when DOM structure changes |
| Headless browser | Raw httpx to CNKI API | CNKI requires JavaScript rendering; raw HTTP fails on dynamically-loaded content |

**Installation:**
```bash
cd backend && uv add patchright beautifulsoup4 lxml
# Install browser binaries (one-time)
python -m patchright install chromium
```

## Architecture Patterns

### Recommended Project Structure
```
backend/app/services/paper_search/
  base_client.py          # (existing) BasePaperClient ABC
  openalex_client.py      # (existing)
  s2_client.py            # (existing)
  pubmed_client.py        # (existing)
  arxiv_client.py         # (existing)
  deduplicator.py         # (existing, already handles CJK)
  aggregator.py           # (existing, extend with CNKI/Wanfang)
  browser_pool.py         # NEW: manages Playwright browser contexts
  cnki_client.py          # NEW: CNKI scraper
  wanfang_client.py       # NEW: Wanfang scraper
```

### Pattern 1: Browser Pool for Shared Browser Contexts

**What:** A singleton that manages Playwright browser instances and reusable contexts with cookie persistence. Each scraper client borrows a context from the pool rather than launching its own browser.

**When to use:** Both CNKI and Wanfang clients need browser automation. Launching a browser per request is expensive (~2s startup). Pool reuses contexts.

**Example:**
```python
# browser_pool.py
import asyncio
from contextlib import asynccontextmanager
from patchright.async_api import async_playwright, Browser, BrowserContext

class BrowserPool:
    """Manages reusable Playwright browser contexts with cookie persistence."""

    def __init__(self, max_contexts: int = 2) -> None:
        self._playwright = None
        self._browser: Browser | None = None
        self._semaphore = asyncio.Semaphore(max_contexts)
        self._cookie_store: dict[str, list[dict]] = {}  # domain -> cookies

    async def start(self) -> None:
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
        )

    async def stop(self) -> None:
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()

    @asynccontextmanager
    async def get_context(self, domain: str):
        """Borrow a browser context with cookie persistence for a domain."""
        async with self._semaphore:
            context = await self._browser.new_context(
                locale="zh-CN",
                timezone_id="Asia/Shanghai",
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...",
            )
            # Restore cookies from previous session
            if domain in self._cookie_store:
                await context.add_cookies(self._cookie_store[domain])
            try:
                yield context
            finally:
                # Save cookies for next session
                self._cookie_store[domain] = await context.cookies()
                await context.close()
```

### Pattern 2: Scraper Client Implementing BasePaperClient

**What:** Each Chinese source scraper extends `BasePaperClient` but uses the `BrowserPool` instead of httpx.

**When to use:** CNKI and Wanfang scraper implementations.

**Example:**
```python
# cnki_client.py
import asyncio
import logging
from bs4 import BeautifulSoup
from app.schemas.paper import PaperResult, PaperSource
from .base_client import BasePaperClient
from .browser_pool import BrowserPool

logger = logging.getLogger(__name__)

# Conservative rate limiting
_CNKI_DELAY = 4.0  # seconds between requests
_CNKI_BATCH_PAUSE = 30.0  # seconds after every 20 results


class CnkiClient(BasePaperClient):
    """CNKI paper search via headless browser scraping."""

    def __init__(self, http_client, browser_pool: BrowserPool) -> None:
        super().__init__(http_client)
        self._pool = browser_pool
        self._request_count = 0

    async def search_keywords(self, query: str, limit: int = 25) -> list[PaperResult]:
        url = f"https://kns.cnki.net/kns8s/defaultresult/index?kw={query}"
        async with self._pool.get_context("cnki.net") as ctx:
            page = await ctx.new_page()
            try:
                await page.goto(url, wait_until="networkidle", timeout=30000)
                await self._check_captcha(page)
                content = await page.content()
                return self._parse_results(content)
            finally:
                await page.close()

    def _parse_results(self, html: str) -> list[PaperResult]:
        soup = BeautifulSoup(html, "lxml")
        papers = []
        for item in soup.select("table.result-table-list tbody tr"):
            title_el = item.select_one("td.name a")
            if not title_el:
                continue
            papers.append(PaperResult(
                title=title_el.get_text(strip=True),
                authors=[a.get_text(strip=True)
                         for a in item.select("td.author a")],
                venue=self._safe_text(item, "td.source a"),
                year=self._extract_year(item),
                citation_count=self._extract_citations(item),
                language="zh",
                sources=[PaperSource.CNKI],
            ))
        return papers

    async def _check_captcha(self, page) -> None:
        """Detect CAPTCHA and wait/retry."""
        if await page.query_selector(".verify-img-panel"):
            logger.warning("CNKI CAPTCHA detected, raising for retry")
            raise CnkiCaptchaError("CAPTCHA verification required")
```

### Pattern 3: Source Status Reporting for Graceful Degradation

**What:** Extend `SearchResponse` with per-source status information beyond simple success/failure.

**When to use:** When CNKI or Wanfang is rate-limited or requires CAPTCHA, the UI needs to show WHY a source failed, not just that it failed.

**Example:**
```python
# schemas/search.py (extension)
class SourceStatus(str, Enum):
    AVAILABLE = "available"
    RATE_LIMITED = "rate_limited"
    CAPTCHA_BLOCKED = "captcha_blocked"
    UNAVAILABLE = "unavailable"
    ERROR = "error"

class SourceReport(BaseModel):
    source: PaperSource
    status: SourceStatus
    result_count: int = 0
    message: str | None = None
```

### Anti-Patterns to Avoid

- **Launching a new browser per request:** Extremely slow (~2-3s per launch). Use BrowserPool.
- **Aggressive scraping rates:** CNKI triggers CAPTCHA after ~30 rapid page loads. Use 3-5s delays minimum.
- **Parsing CNKI/Wanfang with raw httpx:** Both sites use heavy JavaScript rendering. Raw HTTP gets empty or blocked responses.
- **Storing browser cookies in-memory only:** Cookie loss on restart means re-triggering anti-bot detection. Persist cookies to Valkey.
- **Blocking the aggregator on slow scrapers:** CNKI/Wanfang are 10-50x slower than API sources. Use per-source timeouts (30s for Chinese sources vs 10s for APIs).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser automation | Custom httpx + JS engine | patchright (Playwright fork) | CDP detection, cookie management, page rendering are deceptively complex |
| Anti-detection | Custom User-Agent rotation | patchright's built-in patches | Modern anti-bot detects dozens of signals beyond User-Agent |
| HTML parsing | Regex on raw HTML | BeautifulSoup + lxml | CNKI HTML is messy; regex breaks on structure changes |
| Rate limiting | Manual sleep() calls | tenacity + asyncio.Semaphore | Exponential backoff, configurable retries, jitter |
| Cookie persistence | File-based pickle | Valkey with TTL | Atomic, shared across workers, auto-expiry |
| CJK deduplication | Custom similarity | Existing deduplicator (already CJK-aware) | Phase 2 already handles CJK character comparison in fuzzy matching |

**Key insight:** The hard part of this phase is NOT the architecture (which is well-defined from Phase 2) but the anti-scraping resilience. CNKI and Wanfang change their DOM structure and anti-bot measures periodically. The scraper must be designed for easy maintenance -- CSS selectors in config, not hardcoded, with fallback parsing strategies.

## Common Pitfalls

### Pitfall 1: CNKI CAPTCHA Spiral
**What goes wrong:** Scraper hits CAPTCHA, retries aggressively, gets IP-blocked entirely.
**Why it happens:** CNKI triggers puzzle CAPTCHA after ~30 rapid page loads. Retrying immediately makes it worse.
**How to avoid:** On CAPTCHA detection: (1) stop all requests to CNKI, (2) wait 60-120s, (3) try ONE request with fresh context. If still blocked, mark source as `CAPTCHA_BLOCKED` and skip for this search. Report status to user.
**Warning signs:** Sudden drop to 0 results; page redirects to `vericode.aspx`.

### Pitfall 2: DOM Structure Changes
**What goes wrong:** CNKI or Wanfang updates their HTML structure, breaking all CSS selectors silently (returns empty results, not errors).
**Why it happens:** Chinese academic sites update frequently without versioned APIs.
**How to avoid:** Validate that parsed results are non-empty when the page loaded successfully. If page loaded but parsing yields 0 results, log a `SELECTOR_MISMATCH` warning. Use multiple fallback selector strategies.
**Warning signs:** Successful HTTP 200 responses but consistently 0 parsed papers.

### Pitfall 3: Mixing Browser and API Timeouts
**What goes wrong:** Aggregator applies same 10s timeout to CNKI (browser-based, needs 15-30s) as to OpenAlex (API, needs 3-5s).
**Why it happens:** Default timeout in aggregator doesn't account for browser startup + rendering time.
**How to avoid:** Per-source timeout configuration. CNKI/Wanfang: 30s. API sources: 10s.
**Warning signs:** Chinese sources always appearing in `sources_failed` due to timeout.

### Pitfall 4: Browser Memory Leaks
**What goes wrong:** Playwright browser contexts accumulate memory over time, eventually crashing the worker.
**Why it happens:** Browser contexts not properly closed on error paths; page objects leaked.
**How to avoid:** Always close contexts in `finally` blocks (as shown in BrowserPool pattern). Restart browser after every N requests (e.g., 50). Monitor memory usage.
**Warning signs:** Gradually increasing memory usage of backend process; eventual OOM kills.

### Pitfall 5: Search Result Pagination Confusion
**What goes wrong:** Scraper only gets first page (20 results) when user requests 50.
**Why it happens:** CNKI/Wanfang paginate results; need to click "next page" or change page-size selector.
**How to avoid:** First, change results-per-page to 50 via DOM manipulation. If limit > 50, implement page-turn logic. Cap at first 2 pages (100 results) to avoid CAPTCHA.
**Warning signs:** Always returning exactly 20 results regardless of limit parameter.

## Code Examples

### CNKI Search URL Construction
```python
# CNKI KNS8 search URL patterns (verified from 2025 blog posts)
# Basic keyword search
CNKI_SEARCH_URL = "https://kns.cnki.net/kns8s/defaultresult/index"
# Query params: kw=keyword, korder=SU (subject), AU (author), FT (fulltext)
# Default sort is relevance
url = f"{CNKI_SEARCH_URL}?kw={query}"

# Author search
author_url = f"{CNKI_SEARCH_URL}?kw={author_name}&korder=AU"
```

### Wanfang Search URL Construction
```python
# Wanfang search URL patterns
WANFANG_SEARCH_URL = "https://s.wanfangdata.com.cn/paper"
# Query params: q=query, style=detail (for abstracts)
url = f"{WANFANG_SEARCH_URL}?q={query}&style=detail"
```

### CNKI Metadata Extraction Selectors
```python
# CNKI result page CSS selectors (as of 2025, subject to change)
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
}
```

### Wanfang Metadata Extraction Selectors
```python
# Wanfang result page CSS selectors (as of 2025, subject to change)
WANFANG_SELECTORS = {
    "result_item": ".normal-list .normal-list-item",
    "title": ".title a",
    "authors": ".author a",
    "venue": ".source a",
    "year": ".year",
    "abstract": ".abstract",
}
```

### Extending PaperSource Enum
```python
# paper.py (extend existing enum)
class PaperSource(str, Enum):
    OPENALEX = "openalex"
    SEMANTIC_SCHOLAR = "semantic_scholar"
    PUBMED = "pubmed"
    ARXIV = "arxiv"
    CNKI = "cnki"        # NEW
    WANFANG = "wanfang"  # NEW
```

### Extending PaperResult for Chinese Sources
```python
# paper.py (extend existing model)
class PaperResult(BaseModel):
    # ... existing fields ...

    # Chinese source IDs (NEW)
    cnki_id: str | None = None
    wanfang_id: str | None = None
```

### Registering Chinese Sources in Aggregator
```python
# aggregator.py (extend existing)
_SOURCE_SEMAPHORES: dict[PaperSource, asyncio.Semaphore] = {
    PaperSource.OPENALEX: asyncio.Semaphore(10),
    PaperSource.SEMANTIC_SCHOLAR: asyncio.Semaphore(1),
    PaperSource.PUBMED: asyncio.Semaphore(3),
    PaperSource.ARXIV: asyncio.Semaphore(1),
    PaperSource.CNKI: asyncio.Semaphore(1),      # NEW: one at a time
    PaperSource.WANFANG: asyncio.Semaphore(1),    # NEW: one at a time
}

# Per-source timeouts
_SOURCE_TIMEOUTS: dict[PaperSource, float] = {
    PaperSource.OPENALEX: 10.0,
    PaperSource.SEMANTIC_SCHOLAR: 10.0,
    PaperSource.PUBMED: 10.0,
    PaperSource.ARXIV: 10.0,
    PaperSource.CNKI: 30.0,         # Browser-based, needs more time
    PaperSource.WANFANG: 30.0,      # Browser-based, needs more time
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Selenium + undetected-chromedriver | Playwright/Patchright + stealth | 2024-2025 | Patchright patches CDP detection at source level; more reliable than UC plugins |
| CNKI search.cnki.net (old) | kns.cnki.net/kns8s (KNS8) | 2023 | New platform with different DOM structure; old selectors broken |
| Wanfang c.wanfangdata.com.cn | s.wanfangdata.com.cn | 2024 | New search interface with better metadata display |
| requests + BeautifulSoup | Headless browser required | 2023+ | Both CNKI and Wanfang now require JavaScript rendering |

**Deprecated/outdated:**
- `search.cnki.net` -- old CNKI interface, most scrapers targeting this are broken
- MagicCNKI PyPI package -- targets old API, likely non-functional
- yanzhou/CnkiSpider -- explicitly marked Deprecated
- Selenium-based approaches -- still work but Playwright is faster and has better async support

## Open Questions

1. **CNKI Abstract Availability Without Login**
   - What we know: CNKI shows titles, authors, venue on search results page. Abstracts may require clicking into detail page.
   - What's unclear: Whether abstracts are visible on the search results page in 2026, or only on the detail page (requiring an additional page load per paper).
   - Recommendation: First attempt to extract abstracts from search results list. If not available, implement detail-page fetching for top-N results only (expensive -- 1 page load per paper).

2. **CNKI Institutional Access**
   - What we know: Many CNKI features (full-text, DOI) require institutional access. Public search shows limited metadata.
   - What's unclear: Whether the StudyHub deployment will have institutional CNKI access or use public endpoints only.
   - Recommendation: Build for public access first (metadata-only). Add institutional login support as optional enhancement. Log what metadata is missing due to access level.

3. **Wanfang API Existence**
   - What we know: Wanfang has a web search interface at `s.wanfangdata.com.cn`. No public API documentation found.
   - What's unclear: Whether Wanfang has undocumented REST endpoints that could be used instead of browser scraping (faster, more reliable).
   - Recommendation: Start with browser scraping. During implementation, inspect network requests in Wanfang search to see if there are XHR/fetch endpoints returning JSON. If found, switch to httpx client.

4. **Patchright Browser Binary in Docker**
   - What we know: Patchright requires Chromium binary. Docker image needs to include it.
   - What's unclear: Exact Docker image setup for patchright in production.
   - Recommendation: Use `mcr.microsoft.com/playwright/python:v1.49.0-noble` as base image or install chromium in existing Dockerfile. Test in Docker Compose during development.

## Sources

### Primary (HIGH confidence)
- Phase 2 codebase: `backend/app/services/paper_search/` -- existing architecture patterns, BasePaperClient, aggregator, deduplicator
- Phase 2 RESEARCH.md -- stack decisions, deduplication approach, Meilisearch integration
- [CNKI KNS8 search interface](https://kns.cnki.net/kns8s/defaultresult/index) -- verified current URL
- [Wanfang search interface](https://s.wanfangdata.com.cn/paper) -- verified current URL

### Secondary (MEDIUM confidence)
- [2025 CNKI scraping guide](https://www.cnblogs.com/ofnoname/p/18751494) -- detailed Selenium-based approach with KNS8 URLs, CAPTCHA handling, batch strategies
- [CSDN CNKI scraping guide](https://blog.csdn.net/2301_78150559/article/details/143819995) -- metadata extraction patterns, Selenium + BeautifulSoup approach
- [Karmenzind/WanFangData](https://github.com/Karmenzind/WanFangData) -- Scrapy-based Wanfang scraper architecture, download delay strategy
- [Patchright anti-detection](https://www.zenrows.com/blog/patchright) -- CDP Runtime.enable patching approach

### Tertiary (LOW confidence)
- CNKI CSS selectors -- derived from 2025 blog posts but CNKI changes DOM frequently; **must be validated during implementation**
- Wanfang CSS selectors -- inferred from general patterns; **must be validated during implementation**
- [yanzhou/CnkiSpider](https://github.com/yanzhou/CnkiSpider) -- deprecated, architecture concepts only
- [wnma3mz/cnki-crawler](https://github.com/wnma3mz/cnki-crawler) -- overseas CNKI variant, may not apply to mainland

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM -- patchright is the best current option but the scraping domain is inherently fragile; sites change without notice
- Architecture: HIGH -- clean extension of existing Phase 2 patterns (BasePaperClient, aggregator, deduplicator)
- Pitfalls: HIGH -- well-documented from multiple Chinese developer sources and open-source scrapers
- CSS selectors: LOW -- must be validated against live sites during implementation; treat all selectors as configurable, not hardcoded

**Research date:** 2026-03-15
**Valid until:** 2026-04-01 (7 days for CNKI/Wanfang DOM stability; 30 days for architecture patterns)
