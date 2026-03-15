"""Temporal workflow for scheduled scholar profile refresh.

Supports batch enrichment via Google Scholar and paper linking
for all or specific scholars. Activities have retry policies
and timeout configuration.

Reference: DeepResearchWorkflow pattern from Phase 1.
"""

import logging
from dataclasses import dataclass, field
from datetime import timedelta

from temporalio import activity, workflow
from temporalio.common import RetryPolicy

logger = logging.getLogger(__name__)


@dataclass
class ScholarRefreshInput:
    """Input parameters for the scholar refresh workflow."""

    scholar_ids: list[str] | None = None  # None = refresh all
    enrich_google_scholar: bool = True
    link_papers: bool = True


@dataclass
class ScholarRefreshResult:
    """Output of the scholar refresh workflow."""

    status: str
    enriched: int = 0
    linked: int = 0
    failed: int = 0
    details: list[dict] = field(default_factory=list)


@activity.defn
async def enrich_scholar_activity(scholar_id: str) -> dict:
    """Temporal activity: enrich a single scholar with Google Scholar data.

    Creates its own DB session and enricher instance per invocation.

    Returns:
        Dict with scholar_id, status, and h_index if enriched.
    """
    from app.database import get_session_factory
    from app.models.scholar import Scholar
    from app.services.scholar.google_scholar_enricher import GoogleScholarEnricher

    from sqlalchemy import select

    factory = get_session_factory()
    async with factory() as db:
        result = await db.execute(
            select(Scholar).where(Scholar.id == scholar_id)
        )
        scholar = result.scalar_one_or_none()

        if scholar is None:
            return {"scholar_id": scholar_id, "status": "not_found"}

        try:
            enricher = GoogleScholarEnricher()
            updated = await enricher.enrich_scholar(scholar, db)
            return {
                "scholar_id": scholar_id,
                "status": "enriched" if updated.google_scholar_id else "no_profile",
                "h_index": updated.h_index,
                "total_citations": updated.total_citations,
            }
        except Exception as exc:
            logger.warning(
                "Enrichment activity failed for %s: %s", scholar_id, exc
            )
            return {"scholar_id": scholar_id, "status": "failed", "error": str(exc)}


@activity.defn
async def link_scholar_papers_activity(scholar_id: str) -> dict:
    """Temporal activity: link a scholar to papers via name matching.

    Creates its own DB session per invocation.

    Returns:
        Dict with scholar_id and linked_count.
    """
    from app.database import get_session_factory
    from app.models.scholar import Scholar
    from app.services.scholar.paper_linker import link_scholar_papers

    from sqlalchemy import select, update

    factory = get_session_factory()
    async with factory() as db:
        result = await db.execute(
            select(Scholar).where(Scholar.id == scholar_id)
        )
        scholar = result.scalar_one_or_none()

        if scholar is None:
            return {"scholar_id": scholar_id, "status": "not_found", "linked_count": 0}

        try:
            paper_ids = await link_scholar_papers(scholar, db)

            # Update linked_paper_ids
            stmt = (
                update(Scholar)
                .where(Scholar.id == scholar_id)
                .values(linked_paper_ids=paper_ids)
            )
            await db.execute(stmt)
            await db.commit()

            return {
                "scholar_id": scholar_id,
                "status": "linked",
                "linked_count": len(paper_ids),
            }
        except Exception as exc:
            logger.warning(
                "Paper linking activity failed for %s: %s", scholar_id, exc
            )
            return {
                "scholar_id": scholar_id,
                "status": "failed",
                "linked_count": 0,
                "error": str(exc),
            }


@activity.defn
async def get_all_scholar_ids() -> list[str]:
    """Temporal activity: retrieve all scholar IDs from the database."""
    from app.database import get_session_factory
    from app.models.scholar import Scholar

    from sqlalchemy import select

    factory = get_session_factory()
    async with factory() as db:
        result = await db.execute(select(Scholar.id))
        return list(result.scalars().all())


@workflow.defn
class ScholarRefreshWorkflow:
    """Temporal workflow for batch scholar enrichment and paper linking.

    Supports enriching all or specific scholars with Google Scholar
    data and linking them to papers in the database. Activities run
    with retry policies and configurable timeouts.
    """

    @workflow.run
    async def run(self, input: ScholarRefreshInput) -> ScholarRefreshResult:
        """Execute the scholar refresh pipeline.

        For each scholar: optionally enrich with Google Scholar,
        then optionally link to papers.
        """
        retry_policy = RetryPolicy(maximum_attempts=2)

        # Get scholar IDs
        if input.scholar_ids is not None:
            scholar_ids = input.scholar_ids
        else:
            scholar_ids = await workflow.execute_activity(
                get_all_scholar_ids,
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=retry_policy,
            )

        enriched = 0
        linked = 0
        failed = 0
        details: list[dict] = []

        for scholar_id in scholar_ids:
            # Enrich with Google Scholar
            if input.enrich_google_scholar:
                enrich_result = await workflow.execute_activity(
                    enrich_scholar_activity,
                    scholar_id,
                    start_to_close_timeout=timedelta(seconds=60),
                    retry_policy=retry_policy,
                )
                if enrich_result["status"] == "enriched":
                    enriched += 1
                elif enrich_result["status"] == "failed":
                    failed += 1
                details.append(enrich_result)

            # Link to papers
            if input.link_papers:
                link_result = await workflow.execute_activity(
                    link_scholar_papers_activity,
                    scholar_id,
                    start_to_close_timeout=timedelta(seconds=60),
                    retry_policy=retry_policy,
                )
                if link_result["status"] == "linked":
                    linked += 1
                elif link_result["status"] == "failed":
                    failed += 1
                details.append(link_result)

        return ScholarRefreshResult(
            status="completed",
            enriched=enriched,
            linked=linked,
            failed=failed,
            details=details,
        )
