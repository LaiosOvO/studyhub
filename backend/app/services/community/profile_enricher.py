"""OpenAlex author profile enrichment service.

Uses pyalex (sync) via asyncio.to_thread for async compatibility,
following the same pattern as paper_search/openalex_client.py.
"""

import asyncio
import logging
from datetime import datetime, timezone

import pyalex
from pyalex import Authors, Works
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.researcher_profile import ResearcherProfile

logger = logging.getLogger(__name__)

# Configure pyalex for polite pool
pyalex.config.email = "studyhub@example.com"

_settings = get_settings()
if _settings.openalex_api_key:
    pyalex.config.api_key = _settings.openalex_api_key


def _search_openalex_author_sync(
    name: str, institution: str | None
) -> dict | None:
    """Search OpenAlex Authors API by name and institution (sync).

    Returns a dict with author metadata or None if not found.
    """
    try:
        # Build filter
        search_query = name
        authors_results = Authors().search(search_query).get()

        if not authors_results:
            return None

        # If institution provided, try to find best match
        best_match = authors_results[0]
        if institution:
            institution_lower = institution.lower()
            for author in authors_results[:10]:
                last_known = author.get("last_known_institutions") or []
                for inst in last_known:
                    if institution_lower in (inst.get("display_name", "").lower()):
                        best_match = author
                        break

        author_id = best_match.get("id", "")
        openalex_id = author_id.split("/")[-1] if author_id else None

        # Fetch recent works
        recent_works: list[dict] = []
        if openalex_id:
            try:
                works_results = (
                    Works()
                    .filter(authorships={"author": {"id": openalex_id}})
                    .sort(publication_date="desc")[:10]
                )
                works_list = list(works_results)
                for work in works_list:
                    recent_works.append({
                        "title": work.get("title", ""),
                        "year": work.get("publication_year"),
                        "cited_by_count": work.get("cited_by_count", 0),
                        "doi": work.get("doi"),
                    })
            except Exception as exc:
                logger.warning("Failed to fetch works for %s: %s", openalex_id, exc)

        # Extract co-authors from recent works
        co_author_names: list[str] = []
        seen_names: set[str] = set()
        for work in works_list if openalex_id else []:
            for authorship in work.get("authorships", []):
                author_name = authorship.get("author", {}).get("display_name", "")
                if author_name and author_name != name and author_name not in seen_names:
                    co_author_names.append(author_name)
                    seen_names.add(author_name)
                    if len(co_author_names) >= 20:
                        break

        # Extract topics/keywords
        topics: list[str] = []
        for topic in (best_match.get("topics") or [])[:15]:
            display_name = topic.get("display_name", "")
            if display_name:
                topics.append(display_name)

        return {
            "openalex_id": openalex_id,
            "display_name": best_match.get("display_name", name),
            "h_index": best_match.get("summary_stats", {}).get("h_index"),
            "cited_by_count": best_match.get("cited_by_count", 0),
            "works_count": best_match.get("works_count", 0),
            "topics": topics,
            "recent_works": recent_works,
            "co_authors": co_author_names,
        }

    except Exception as exc:
        logger.error("OpenAlex author search failed for %s: %s", name, exc)
        return None


async def enrich_from_openalex(
    name: str, institution: str | None
) -> dict | None:
    """Async wrapper for OpenAlex author search via asyncio.to_thread."""
    return await asyncio.to_thread(
        _search_openalex_author_sync, name, institution
    )


async def enrich_profile(
    session: AsyncSession, profile_id: str
) -> ResearcherProfile:
    """Full enrichment pipeline for a researcher profile.

    Fetches profile from DB, enriches from OpenAlex, updates fields,
    and returns the updated profile.
    """
    # Fetch profile
    result = await session.execute(
        select(ResearcherProfile).where(ResearcherProfile.id == profile_id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise ValueError(f"Profile not found: {profile_id}")

    # Mark as enriching
    profile.enrichment_status = "enriching"
    await session.commit()

    try:
        openalex_data = await enrich_from_openalex(
            profile.display_name, profile.institution
        )

        if openalex_data is None:
            profile.enrichment_status = "failed"
            await session.commit()
            return profile

        # Update profile with enriched data
        profile.h_index = openalex_data.get("h_index")
        profile.total_citations = openalex_data.get("cited_by_count")
        profile.publication_count = openalex_data.get("works_count")
        profile.publications = openalex_data.get("recent_works", [])
        profile.co_authors = openalex_data.get("co_authors", [])
        profile.research_keywords = openalex_data.get("topics", [])
        profile.openalex_author_id = openalex_data.get("openalex_id")
        profile.enrichment_status = "completed"
        profile.enriched_at = datetime.now(timezone.utc)

        await session.commit()
        await session.refresh(profile)
        return profile

    except Exception as exc:
        logger.error("Profile enrichment failed for %s: %s", profile_id, exc)
        profile.enrichment_status = "failed"
        await session.commit()
        return profile
