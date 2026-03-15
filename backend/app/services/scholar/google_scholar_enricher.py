"""Google Scholar enrichment for scholar profiles.

Uses the `scholarly` library (wrapped in asyncio.to_thread) to search
Google Scholar and extract bibliometric data: h-index, citation count,
and Google Scholar profile ID.

Rate-limited with asyncio.Semaphore(1) + 5s sleep between requests
to avoid Google Scholar blocking.

Note: scholarly can be fragile with Google Scholar rate limits.
If scholarly proves unreliable, a direct httpx scraping fallback
could be implemented. See TODO below.

Reference: pyalex (sync) with asyncio.to_thread pattern from Phase 2.
"""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scholar import Scholar
from app.schemas.scholar import ScholarResponse

logger = logging.getLogger(__name__)

# Rate limiting: one request at a time + 5s cooldown
_semaphore = asyncio.Semaphore(1)
_COOLDOWN_SECONDS = 5.0


def _search_scholar_sync(name: str, institution: str | None = None) -> dict | None:
    """Synchronous Google Scholar search via scholarly library.

    Called via asyncio.to_thread for async compatibility.
    Returns dict with scholar data or None if not found.
    """
    try:
        from scholarly import scholarly
    except ImportError:
        logger.error(
            "scholarly package not installed. Run: uv add scholarly"
        )
        return None

    try:
        search_query = scholarly.search_author(name)
        for author in search_query:
            # If institution provided, check affiliation
            if institution:
                affiliation = (author.get("affiliation") or "").lower()
                if institution.lower() not in affiliation:
                    # Also check with simplified institution name
                    continue

            # Fill in full author details
            author_full = scholarly.fill(author, sections=["basics", "indices"])

            # Extract recent publications (up to 10)
            publications = []
            for pub in (author_full.get("publications") or [])[:10]:
                pub_info = {
                    "title": pub.get("bib", {}).get("title", ""),
                    "year": pub.get("bib", {}).get("pub_year"),
                    "citations": pub.get("num_citations", 0),
                }
                publications.append(pub_info)

            return {
                "scholar_id": author_full.get("scholar_id"),
                "name": author_full.get("name"),
                "h_index": author_full.get("hindex"),
                "total_citations": author_full.get("citedby"),
                "interests": author_full.get("interests", []),
                "publications": publications,
                "affiliation": author_full.get("affiliation"),
            }

        return None

    except Exception as exc:
        logger.warning("Google Scholar search failed for '%s': %s", name, exc)
        return None


class GoogleScholarEnricher:
    """Enriches scholar profiles with Google Scholar bibliometric data.

    Searches by name (Chinese first, then English fallback),
    updates h-index, total citations, and Google Scholar ID.
    """

    async def search_scholar(
        self, name: str, institution: str | None = None
    ) -> dict | None:
        """Search Google Scholar for a researcher by name.

        Uses asyncio.to_thread to run the sync scholarly library
        without blocking the event loop.

        Args:
            name: Scholar name to search.
            institution: Optional institution for filtering results.

        Returns:
            Dict with scholar_id, h_index, total_citations, etc.
            None if not found or on error.
        """
        async with _semaphore:
            result = await asyncio.to_thread(
                _search_scholar_sync, name, institution
            )
            # Cooldown to avoid rate limiting
            await asyncio.sleep(_COOLDOWN_SECONDS)
            return result

    async def enrich_scholar(
        self, scholar: Scholar, db: AsyncSession
    ) -> Scholar:
        """Enrich a scholar record with Google Scholar data.

        Tries Chinese name first, then English name if available.
        Updates h_index, total_citations, and google_scholar_id.

        Args:
            scholar: Scholar model instance to enrich.
            db: Async database session.

        Returns:
            Updated Scholar instance (re-queried from DB).
        """
        # Try Chinese name first
        gs_data = await self.search_scholar(scholar.name, scholar.institution)

        # Fallback to English name
        if gs_data is None and scholar.name_en:
            gs_data = await self.search_scholar(
                scholar.name_en, scholar.institution
            )

        if gs_data is None:
            logger.info(
                "No Google Scholar profile found for '%s'", scholar.name
            )
            return scholar

        # Build new source_urls list (immutable: create new list)
        existing_urls = list(scholar.source_urls or [])
        gs_url = {
            "source": "google_scholar",
            "url": f"https://scholar.google.com/citations?user={gs_data['scholar_id']}",
        }
        # Avoid duplicate source entries
        has_gs = any(u.get("source") == "google_scholar" for u in existing_urls)
        updated_urls = existing_urls if has_gs else [*existing_urls, gs_url]

        # Update via SQLAlchemy update statement (immutable pattern)
        update_values = {
            "h_index": gs_data["h_index"],
            "total_citations": gs_data["total_citations"],
            "google_scholar_id": gs_data["scholar_id"],
            "source_urls": updated_urls,
            "updated_at": datetime.now(timezone.utc),
        }

        stmt = (
            update(Scholar)
            .where(Scholar.id == scholar.id)
            .values(**update_values)
        )
        await db.execute(stmt)
        await db.commit()

        # Re-query for fresh instance
        result = await db.execute(
            select(Scholar).where(Scholar.id == scholar.id)
        )
        return result.scalar_one()
