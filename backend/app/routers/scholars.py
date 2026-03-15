"""Scholar profile REST API endpoints.

Provides CRUD operations, Baidu Baike scraping, seed import,
Google Scholar enrichment, paper linking, and Temporal refresh
for researcher profiles. All responses use the ApiResponse envelope.
"""

import logging

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.middleware.rate_limit import limiter
from app.models.scholar import Scholar
from app.schemas.common import ApiResponse
from app.schemas.scholar import (
    ScholarListResponse,
    ScholarResponse,
    ScholarScrapeRequest,
    ScholarUpdate,
)
from app.services.scholar.baike_scraper import BaikeScraper
from app.services.scholar.google_scholar_enricher import GoogleScholarEnricher
from app.services.scholar.paper_linker import link_scholar_papers
from app.services.scholar.seed_importer import import_seed_scholars

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", response_model=ApiResponse[ScholarListResponse])
async def list_scholars(
    db: AsyncSession = Depends(get_db),
    name: str | None = Query(None, description="Filter by name (partial match)"),
    institution: str | None = Query(None, description="Filter by institution"),
    research_field: str | None = Query(None, description="Filter by research field"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> ApiResponse:
    """List scholars with optional filters and pagination."""
    query = select(Scholar)

    if name:
        query = query.where(Scholar.name.ilike(f"%{name}%"))
    if institution:
        query = query.where(Scholar.institution.ilike(f"%{institution}%"))
    if research_field:
        # JSON array contains check -- cast to text for LIKE
        query = query.where(
            Scholar.research_fields.cast(str).ilike(f"%{research_field}%")
        )

    # Count total matching records
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Apply pagination
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit).order_by(Scholar.name)

    result = await db.execute(query)
    scholars = list(result.scalars().all())

    return ApiResponse(
        success=True,
        data=ScholarListResponse(
            scholars=[ScholarResponse.model_validate(s) for s in scholars],
            total=total,
        ),
    )


@router.get("/{scholar_id}", response_model=ApiResponse[ScholarResponse])
async def get_scholar(
    scholar_id: str,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Get a single scholar by ID."""
    result = await db.execute(select(Scholar).where(Scholar.id == scholar_id))
    scholar = result.scalar_one_or_none()

    if scholar is None:
        return ApiResponse(success=False, error="Scholar not found")

    return ApiResponse(
        success=True,
        data=ScholarResponse.model_validate(scholar),
    )


@router.post("/scrape/baike", response_model=ApiResponse[ScholarResponse])
@limiter.limit("10/minute")
async def scrape_baike(
    request: Request,
    body: ScholarScrapeRequest,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Scrape a scholar profile from Baidu Baike and upsert into DB.

    Independent API endpoint for on-demand scraping.
    Rate-limited to 10 requests per minute.
    """
    http_client = request.app.state.http_client
    scraper = BaikeScraper(http_client)

    scholar_data = await scraper.scrape_profile(body.name, body.baike_url)
    if scholar_data is None:
        return ApiResponse(
            success=False,
            error=f"Could not scrape profile for '{body.name}' from Baidu Baike",
        )

    # Upsert into database
    values = scholar_data.model_dump()
    stmt = pg_insert(Scholar).values(**values)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_scholar_name_institution",
        set_={
            "title": stmt.excluded.title,
            "rank": stmt.excluded.rank,
            "birth_year": stmt.excluded.birth_year,
            "research_fields": stmt.excluded.research_fields,
            "honors": stmt.excluded.honors,
            "education": stmt.excluded.education,
            "source_urls": stmt.excluded.source_urls,
            "note": stmt.excluded.note,
        },
    ).returning(Scholar.id)

    result = await db.execute(stmt)
    scholar_id = result.scalar_one()
    await db.commit()

    # Re-query for full response
    query_result = await db.execute(select(Scholar).where(Scholar.id == scholar_id))
    scholar = query_result.scalar_one()

    return ApiResponse(
        success=True,
        data=ScholarResponse.model_validate(scholar),
        message=f"Successfully scraped profile for '{body.name}'",
    )


@router.post("/import-seed", response_model=ApiResponse[ScholarListResponse])
@limiter.limit("5/minute")
async def import_seed(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Import seed scholars from ecg_scholars.json.

    Upserts all scholars from the seed file. Idempotent.
    Rate-limited to 5 requests per minute.
    """
    scholars = await import_seed_scholars(db)

    return ApiResponse(
        success=True,
        data=ScholarListResponse(
            scholars=scholars,
            total=len(scholars),
        ),
        message=f"Imported {len(scholars)} scholars from seed data",
    )


@router.put("/{scholar_id}", response_model=ApiResponse[ScholarResponse])
async def update_scholar(
    scholar_id: str,
    body: ScholarUpdate,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Update a scholar's fields. Accepts partial updates."""
    result = await db.execute(select(Scholar).where(Scholar.id == scholar_id))
    scholar = result.scalar_one_or_none()

    if scholar is None:
        return ApiResponse(success=False, error="Scholar not found")

    # Build update dict from non-None fields (immutable pattern)
    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        return ApiResponse(
            success=False, error="No fields to update"
        )

    # Apply updates via SQLAlchemy update statement
    stmt = update(Scholar).where(Scholar.id == scholar_id).values(**update_data)
    await db.execute(stmt)
    await db.commit()

    # Re-query for updated response
    query_result = await db.execute(select(Scholar).where(Scholar.id == scholar_id))
    updated_scholar = query_result.scalar_one()

    return ApiResponse(
        success=True,
        data=ScholarResponse.model_validate(updated_scholar),
        message="Scholar updated successfully",
    )


@router.delete("/{scholar_id}", response_model=ApiResponse)
async def delete_scholar(
    scholar_id: str,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Delete a scholar by ID."""
    result = await db.execute(select(Scholar).where(Scholar.id == scholar_id))
    scholar = result.scalar_one_or_none()

    if scholar is None:
        return ApiResponse(success=False, error="Scholar not found")

    await db.delete(scholar)
    await db.commit()

    return ApiResponse(
        success=True,
        message=f"Scholar '{scholar.name}' deleted successfully",
    )


# ─── Enrichment & Linking Endpoints (Plan 03.1-02) ────────────────────


@router.post("/{scholar_id}/enrich", response_model=ApiResponse[ScholarResponse])
@limiter.limit("5/minute")
async def enrich_scholar(
    scholar_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Enrich a scholar with Google Scholar data (h-index, citations).

    Rate-limited to 5 requests per minute to respect Google Scholar limits.
    """
    result = await db.execute(select(Scholar).where(Scholar.id == scholar_id))
    scholar = result.scalar_one_or_none()

    if scholar is None:
        return ApiResponse(success=False, error="Scholar not found")

    enricher = GoogleScholarEnricher()
    updated = await enricher.enrich_scholar(scholar, db)

    return ApiResponse(
        success=True,
        data=ScholarResponse.model_validate(updated),
        message="Scholar enriched with Google Scholar data",
    )


@router.post("/{scholar_id}/link-papers", response_model=ApiResponse)
async def link_papers(
    scholar_id: str,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Link a scholar to papers via fuzzy CJK-aware author name matching."""
    result = await db.execute(select(Scholar).where(Scholar.id == scholar_id))
    scholar = result.scalar_one_or_none()

    if scholar is None:
        return ApiResponse(success=False, error="Scholar not found")

    paper_ids = await link_scholar_papers(scholar, db)

    # Update scholar's linked_paper_ids (immutable: build new value)
    stmt = (
        update(Scholar)
        .where(Scholar.id == scholar_id)
        .values(linked_paper_ids=paper_ids)
    )
    await db.execute(stmt)
    await db.commit()

    return ApiResponse(
        success=True,
        data={"linked_count": len(paper_ids), "paper_ids": paper_ids},
        message=f"Linked {len(paper_ids)} papers to scholar '{scholar.name}'",
    )


@router.post("/enrich-all", response_model=ApiResponse)
@limiter.limit("2/minute")
async def enrich_all_scholars(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Enrich all scholars with Google Scholar data.

    Convenience endpoint for batch enrichment. For production use,
    prefer the Temporal ScholarRefreshWorkflow via POST /scholars/refresh.
    Rate-limited to 2 requests per minute.
    """
    result = await db.execute(select(Scholar))
    scholars = list(result.scalars().all())

    enricher = GoogleScholarEnricher()
    enriched = 0
    failed = 0
    skipped = 0

    for scholar in scholars:
        if scholar.google_scholar_id:
            skipped += 1
            continue
        try:
            updated = await enricher.enrich_scholar(scholar, db)
            if updated.google_scholar_id:
                enriched += 1
            else:
                failed += 1
        except Exception as exc:
            logger.warning("Enrichment failed for '%s': %s", scholar.name, exc)
            failed += 1

    return ApiResponse(
        success=True,
        data={"enriched": enriched, "failed": failed, "skipped": skipped},
        message=f"Batch enrichment complete: {enriched} enriched, {failed} failed, {skipped} skipped",
    )


@router.post("/refresh", response_model=ApiResponse)
async def start_refresh_workflow(
    request: Request,
) -> ApiResponse:
    """Start a Temporal workflow to refresh all scholar profiles.

    Triggers ScholarRefreshWorkflow for batch enrichment and paper linking.
    Returns the workflow ID for tracking.
    """
    try:
        from app.services.temporal_service import start_workflow
        from app.workflows.scholar_refresh import (
            ScholarRefreshInput,
            ScholarRefreshWorkflow,
        )

        import uuid

        workflow_id = f"scholar-refresh-{uuid.uuid4().hex[:8]}"
        await start_workflow(
            workflow_class=ScholarRefreshWorkflow,
            workflow_id=workflow_id,
            args=ScholarRefreshInput(),
        )

        return ApiResponse(
            success=True,
            data={"workflow_id": workflow_id, "status": "started"},
            message="Scholar refresh workflow started",
        )
    except Exception as exc:
        logger.error("Failed to start scholar refresh workflow: %s", exc)
        return ApiResponse(
            success=False,
            error="Workflow service unavailable. Use POST /scholars/enrich-all as fallback.",
        )
