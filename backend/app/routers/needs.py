"""Research needs marketplace REST API endpoints.

Provides CRUD operations with Meilisearch indexing and
need-to-profile relevance scoring.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.research_need import ResearchNeed
from app.models.researcher_profile import ResearcherProfile
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.need import (
    ResearchNeedCreate,
    ResearchNeedResponse,
    ResearchNeedUpdate,
    ResearchNeedWithScore,
)
from app.services.community.need_matcher import compute_need_relevance

logger = logging.getLogger(__name__)

router = APIRouter()

MEILI_INDEX = "research_needs"


async def _ensure_meili_index(request: Request) -> None:
    """Ensure Meilisearch index exists for research needs (idempotent)."""
    ms = getattr(request.app.state, "meilisearch", None)
    if ms is None:
        return
    try:
        await ms.create_index(
            MEILI_INDEX,
            primary_key="id",
            searchable_attributes=["title", "description", "required_skills", "research_direction", "tags"],
            filterable_attributes=["tags", "research_direction", "status"],
        )
    except Exception as exc:
        logger.warning("Meilisearch index setup failed: %s", exc)


async def _index_need(request: Request, need: ResearchNeed) -> None:
    """Index a need in Meilisearch (non-fatal)."""
    ms = getattr(request.app.state, "meilisearch", None)
    if ms is None:
        return
    try:
        doc = {
            "id": need.id,
            "title": need.title,
            "description": need.description,
            "required_skills": need.required_skills,
            "research_direction": need.research_direction,
            "tags": need.tags,
            "status": need.status,
        }
        await ms.add_documents(MEILI_INDEX, [doc])
    except Exception as exc:
        logger.warning("Meilisearch indexing failed for need %s: %s", need.id, exc)


async def _remove_from_index(request: Request, need_id: str) -> None:
    """Remove a need from Meilisearch (non-fatal)."""
    ms = getattr(request.app.state, "meilisearch", None)
    if ms is None:
        return
    try:
        await ms.client.index(MEILI_INDEX).delete_document(need_id)
    except Exception as exc:
        logger.warning("Meilisearch removal failed for need %s: %s", need_id, exc)


@router.post("/", response_model=ApiResponse[ResearchNeedResponse], status_code=201)
async def create_need(
    data: ResearchNeedCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Create a new research need and index it in Meilisearch."""
    await _ensure_meili_index(request)

    need = ResearchNeed(
        user_id=user.id,
        title=data.title,
        description=data.description,
        required_skills=list(data.required_skills),
        research_direction=data.research_direction,
        tags=list(data.tags),
    )
    db.add(need)
    await db.commit()
    await db.refresh(need)

    await _index_need(request, need)

    return ApiResponse(
        success=True,
        data=ResearchNeedResponse.model_validate(need),
        message="Research need published.",
    )


@router.get("/", response_model=ApiResponse[list[ResearchNeedWithScore]])
async def list_needs(
    request: Request,
    q: str | None = Query(None, description="Search query"),
    tags: str | None = Query(None, description="Comma-separated tag filter"),
    research_direction: str | None = Query(None),
    need_status: str = Query("open", alias="status"),
    sort_by: str = Query("recent", regex="^(relevance|recent)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Browse research needs with optional search, filters, and relevance sorting."""
    # Try Meilisearch first if search query provided
    meili_ids: list[str] | None = None
    if q:
        ms = getattr(request.app.state, "meilisearch", None)
        if ms is not None:
            try:
                meili_filter = f'status = "{need_status}"' if need_status else None
                results = await ms.search(MEILI_INDEX, q, filter=meili_filter, limit=100)
                meili_ids = [hit["id"] for hit in results.get("hits", [])]
            except Exception as exc:
                logger.warning("Meilisearch search failed, falling back to DB: %s", exc)

    # Build DB query
    query = select(ResearchNeed)

    if meili_ids is not None:
        if not meili_ids:
            return ApiResponse(success=True, data=[])
        query = query.where(ResearchNeed.id.in_(meili_ids))
    else:
        if need_status:
            query = query.where(ResearchNeed.status == need_status)
        if q:
            query = query.where(
                ResearchNeed.title.ilike(f"%{q}%")
                | ResearchNeed.description.ilike(f"%{q}%")
            )

    if tags:
        for tag in tags.split(","):
            tag = tag.strip()
            if tag:
                query = query.where(
                    ResearchNeed.tags.cast(str).ilike(f"%{tag}%")
                )

    if research_direction:
        query = query.where(
            ResearchNeed.research_direction.ilike(f"%{research_direction}%")
        )

    query = query.order_by(ResearchNeed.created_at.desc())
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    needs = list(result.scalars().all())

    # Get viewer profile for relevance scoring
    viewer_profile = None
    if sort_by == "relevance":
        profile_result = await db.execute(
            select(ResearcherProfile).where(
                ResearcherProfile.user_id == user.id
            )
        )
        viewer_profile = profile_result.scalar_one_or_none()

    # Build response with scores
    scored_needs: list[ResearchNeedWithScore] = []
    for need in needs:
        match_score = 0.0
        if viewer_profile is not None:
            match_score = compute_need_relevance(viewer_profile, need)

        need_data = ResearchNeedResponse.model_validate(need)
        scored_needs.append(
            ResearchNeedWithScore(
                **need_data.model_dump(),
                match_score=match_score,
            )
        )

    # Sort by relevance if requested
    if sort_by == "relevance" and viewer_profile is not None:
        scored_needs = sorted(
            scored_needs, key=lambda n: n.match_score, reverse=True
        )

    return ApiResponse(success=True, data=scored_needs)


@router.get("/{need_id}", response_model=ApiResponse[ResearchNeedResponse])
async def get_need(
    need_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Get a single research need."""
    result = await db.execute(
        select(ResearchNeed).where(ResearchNeed.id == need_id)
    )
    need = result.scalar_one_or_none()
    if need is None:
        raise HTTPException(status_code=404, detail="Need not found")

    return ApiResponse(
        success=True,
        data=ResearchNeedResponse.model_validate(need),
    )


@router.patch("/{need_id}", response_model=ApiResponse[ResearchNeedResponse])
async def update_need(
    need_id: str,
    data: ResearchNeedUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Update a research need. Owner only."""
    result = await db.execute(
        select(ResearchNeed).where(ResearchNeed.id == need_id)
    )
    need = result.scalar_one_or_none()
    if need is None:
        raise HTTPException(status_code=404, detail="Need not found")
    if need.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not the owner of this need")

    update_fields = data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(need, field, value)

    await db.commit()
    await db.refresh(need)

    await _index_need(request, need)

    return ApiResponse(
        success=True,
        data=ResearchNeedResponse.model_validate(need),
    )


@router.delete("/{need_id}", response_model=ApiResponse[dict])
async def delete_need(
    need_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Delete a research need. Owner only."""
    result = await db.execute(
        select(ResearchNeed).where(ResearchNeed.id == need_id)
    )
    need = result.scalar_one_or_none()
    if need is None:
        raise HTTPException(status_code=404, detail="Need not found")
    if need.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not the owner of this need")

    await db.delete(need)
    await db.commit()

    await _remove_from_index(request, need_id)

    return ApiResponse(success=True, data={"deleted": need_id})


@router.post("/{need_id}/close", response_model=ApiResponse[ResearchNeedResponse])
async def close_need(
    need_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Close a research need. Owner only."""
    result = await db.execute(
        select(ResearchNeed).where(ResearchNeed.id == need_id)
    )
    need = result.scalar_one_or_none()
    if need is None:
        raise HTTPException(status_code=404, detail="Need not found")
    if need.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not the owner of this need")

    need.status = "closed"
    await db.commit()
    await db.refresh(need)

    await _index_need(request, need)

    return ApiResponse(
        success=True,
        data=ResearchNeedResponse.model_validate(need),
    )
