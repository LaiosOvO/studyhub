"""Researcher matching REST API endpoints.

Provides match recommendations with LLM-generated explanations
and Valkey caching for performance.
"""

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, get_valkey
from app.models.researcher_profile import ResearcherProfile
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.match import MatchResult, MatchSignalBreakdown
from app.schemas.profile import ResearcherProfilePublic
from app.services.community.match_explainer import generate_explanation
from app.services.community.matching_engine import find_matches

logger = logging.getLogger(__name__)

router = APIRouter()

CACHE_TTL = 3600  # 1 hour


@router.get("/recommendations", response_model=ApiResponse[list[MatchResult]])
async def get_recommendations(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Get match recommendations for the current user.

    Caches results in Valkey for 1 hour. Top 5 matches include
    LLM-generated explanations; matches 6-20 have explanation=None.
    """
    # Get current user's profile
    result = await db.execute(
        select(ResearcherProfile).where(ResearcherProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Create a profile first to get recommendations.",
        )

    # Check Valkey cache
    valkey = None
    try:
        valkey = await get_valkey()
        cached = await valkey.get(f"matches:{user.id}")
        if cached:
            cached_data = json.loads(cached)
            return ApiResponse(success=True, data=cached_data)
    except Exception as exc:
        logger.warning("Valkey cache read failed: %s", exc)

    # Fetch all candidate profiles (limit 500 for v1)
    candidates_result = await db.execute(
        select(ResearcherProfile).limit(500)
    )
    candidates = list(candidates_result.scalars().all())

    # Get Neo4j client (optional)
    neo4j_client = getattr(request.app.state, "neo4j", None)

    # Compute matches
    raw_matches = await find_matches(
        profile, candidates, neo4j_client=neo4j_client, top_n=20
    )

    # Build match results
    my_public = ResearcherProfilePublic.model_validate(profile)
    match_results: list[MatchResult] = []

    # Generate explanations for top 5 — only if score > 0.3 (worth explaining)
    top_worthy = [m for m in raw_matches[:5] if m["overall_score"] > 0.3]
    explanation_tasks = []
    for match_data in top_worthy:
        cand_public = ResearcherProfilePublic.model_validate(match_data["profile"])
        breakdown = MatchSignalBreakdown(**match_data["breakdown"])
        explanation_tasks.append(
            generate_explanation(db, user.id, my_public, cand_public, breakdown)
        )

    explanations = await asyncio.gather(*explanation_tasks, return_exceptions=True) if explanation_tasks else []

    for i, match_data in enumerate(raw_matches):
        cand_public = ResearcherProfilePublic.model_validate(match_data["profile"])
        breakdown = MatchSignalBreakdown(**match_data["breakdown"])

        explanation = None
        # Map explanation index: only top_worthy matches have explanations
        worthy_idx = next(
            (j for j, m in enumerate(top_worthy) if m["profile"].id == match_data["profile"].id),
            None,
        )
        if worthy_idx is not None and worthy_idx < len(explanations) and not isinstance(explanations[worthy_idx], Exception):
            explanation = explanations[worthy_idx]

        match_results.append(
            MatchResult(
                profile=cand_public,
                overall_score=match_data["overall_score"],
                breakdown=breakdown,
                explanation=explanation,
            )
        )

    # Cache results
    if valkey is not None:
        try:
            cache_data = [m.model_dump(mode="json") for m in match_results]
            await valkey.set(
                f"matches:{user.id}",
                json.dumps(cache_data),
                ex=CACHE_TTL,
            )
        except Exception as exc:
            logger.warning("Valkey cache write failed: %s", exc)

    return ApiResponse(success=True, data=match_results)


@router.get(
    "/recommendations/{profile_id}/explain",
    response_model=ApiResponse[dict],
)
async def get_match_explanation(
    profile_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Generate explanation for a specific match pair."""
    # Get current user's profile
    my_result = await db.execute(
        select(ResearcherProfile).where(ResearcherProfile.user_id == user.id)
    )
    my_profile = my_result.scalar_one_or_none()
    if my_profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Create a profile first.",
        )

    # Get target profile
    target_result = await db.execute(
        select(ResearcherProfile).where(ResearcherProfile.id == profile_id)
    )
    target_profile = target_result.scalar_one_or_none()
    if target_profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target profile not found.",
        )

    my_public = ResearcherProfilePublic.model_validate(my_profile)
    target_public = ResearcherProfilePublic.model_validate(target_profile)

    # Compute breakdown for this pair
    from app.services.community.matching_engine import (
        compute_adjacency,
        compute_complementarity,
        compute_institutional_proximity,
    )

    my_keywords = list(my_profile.expertise_tags or []) + list(
        my_profile.research_keywords or []
    )
    target_keywords = list(target_profile.expertise_tags or []) + list(
        target_profile.research_keywords or []
    )

    breakdown = MatchSignalBreakdown(
        complementarity=compute_complementarity(my_keywords, target_keywords),
        co_citation=0.0,
        adjacency=compute_adjacency(
            list(my_profile.research_directions or []),
            list(target_profile.research_directions or []),
        ),
        institutional=compute_institutional_proximity(
            my_profile.institution, target_profile.institution
        ),
    )

    explanation = await generate_explanation(
        db, user.id, my_public, target_public, breakdown
    )

    return ApiResponse(success=True, data={"explanation": explanation})
