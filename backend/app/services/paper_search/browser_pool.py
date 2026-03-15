"""Reusable Playwright browser context pool with cookie persistence.

Manages headless Chromium instances via patchright (stealth Playwright fork)
for browser-based scraping of Chinese academic databases (CNKI, Wanfang).
Contexts are gated by a semaphore and cookies are preserved per domain.
"""

import asyncio
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator
from typing import Any

from patchright.async_api import Browser, BrowserContext, Playwright, async_playwright

# Realistic user agent to avoid detection
_DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)


class BrowserPool:
    """Manages reusable Playwright browser contexts with cookie persistence.

    Each scraper client borrows a context from the pool via get_context(),
    which handles concurrency limiting, cookie restore/save, and cleanup.
    """

    def __init__(self, max_contexts: int = 2) -> None:
        self._max_contexts = max_contexts
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        self._semaphore = asyncio.Semaphore(max_contexts)
        self._cookie_store: dict[str, list[dict[str, Any]]] = {}

    async def start(self) -> None:
        """Launch patchright and chromium browser."""
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
        )

    async def stop(self) -> None:
        """Close browser and playwright instances."""
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None

    @asynccontextmanager
    async def get_context(
        self, domain: str
    ) -> AsyncGenerator[BrowserContext, None]:
        """Borrow a browser context with cookie persistence for a domain.

        Gated by semaphore to limit concurrent browser contexts.
        Cookies are saved on exit and restored on next borrow for the
        same domain, maintaining session state across requests.
        """
        if self._browser is None:
            raise RuntimeError("BrowserPool not started. Call start() first.")

        async with self._semaphore:
            context = await self._browser.new_context(
                locale="zh-CN",
                timezone_id="Asia/Shanghai",
                user_agent=_DEFAULT_USER_AGENT,
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
