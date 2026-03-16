"""Researcher profile REST API endpoints.

Provides CRUD operations and profile enrichment for researcher
profiles in the community collaboration system.
"""

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.researcher_profile import ResearcherProfile
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.profile import (
    ResearcherProfileCreate,
    ResearcherProfilePublic,
    ResearcherProfileResponse,
    ResearcherProfileUpdate,
)
from app.services.community.profile_enricher import enrich_profile

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/", response_model=ApiResponse[ResearcherProfileResponse], status_code=201)
async def create_profile(
    data: ResearcherProfileCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Create a researcher profile for the current user.

    Kicks off background enrichment from OpenAlex.
    Returns 409 if user already has a profile.
    """
    # Check if profile already exists
    existing = await db.execute(
        select(ResearcherProfile).where(ResearcherProfile.user_id == user.id)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Profile already exists for this user",
        )

    profile = ResearcherProfile(
        user_id=user.id,
        display_name=data.display_name,
        institution=data.institution,
        title=data.title,
        research_directions=data.research_directions,
        expertise_tags=data.expertise_tags,
        enrichment_status="pending",
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    # Kick off background enrichment
    asyncio.create_task(_enrich_background(profile.id))

    return ApiResponse(
        success=True,
        data=ResearcherProfileResponse.model_validate(profile),
        message="Profile created. Enrichment in progress.",
    )


@router.get("/me", response_model=ApiResponse[ResearcherProfileResponse])
async def get_my_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Get the current user's researcher profile."""
    result = await db.execute(
        select(ResearcherProfile).where(ResearcherProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profile found. Create one first.",
        )

    return ApiResponse(
        success=True,
        data=ResearcherProfileResponse.model_validate(profile),
    )


@router.patch("/me", response_model=ApiResponse[ResearcherProfileResponse])
async def update_my_profile(
    data: ResearcherProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Update the current user's researcher profile.

    Re-triggers enrichment if research_directions or institution change.
    """
    result = await db.execute(
        select(ResearcherProfile).where(ResearcherProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profile found. Create one first.",
        )

    # Track if enrichment-relevant fields changed
    re_enrich = False
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        if field in ("research_directions", "institution") and getattr(profile, field) != value:
            re_enrich = True
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)

    # Re-trigger enrichment if relevant fields changed
    if re_enrich:
        asyncio.create_task(_enrich_background(profile.id))

    return ApiResponse(
        success=True,
        data=ResearcherProfileResponse.model_validate(profile),
        message="Profile updated." + (" Enrichment re-triggered." if re_enrich else ""),
    )


@router.get("/{profile_id}", response_model=ApiResponse[ResearcherProfilePublic])
async def get_public_profile(
    profile_id: str,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Get a public researcher profile by ID (no auth required)."""
    result = await db.execute(
        select(ResearcherProfile).where(ResearcherProfile.id == profile_id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )

    return ApiResponse(
        success=True,
        data=ResearcherProfilePublic.model_validate(profile),
    )


@router.post("/me/enrich", response_model=ApiResponse[ResearcherProfileResponse])
async def trigger_enrichment(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Manually trigger profile enrichment from OpenAlex."""
    result = await db.execute(
        select(ResearcherProfile).where(ResearcherProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profile found. Create one first.",
        )

    enriched = await enrich_profile(db, profile.id)
    return ApiResponse(
        success=True,
        data=ResearcherProfileResponse.model_validate(enriched),
        message=f"Enrichment status: {enriched.enrichment_status}",
    )


async def _enrich_background(profile_id: str) -> None:
    """Run profile enrichment in background with its own DB session."""
    from app.database import get_session_factory

    factory = get_session_factory()
    async with factory() as session:
        try:
            await enrich_profile(session, profile_id)
            logger.info("Background enrichment completed for profile %s", profile_id)
        except Exception as exc:
            logger.error("Background enrichment failed for %s: %s", profile_id, exc)
