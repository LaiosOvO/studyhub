"""Scholar profile REST API endpoints.

Provides CRUD operations, Baidu Baike scraping, and seed import
for researcher profiles. All responses use the ApiResponse envelope.
"""

import logging

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
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
    from sqlalchemy import update

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
