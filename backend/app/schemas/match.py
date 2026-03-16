"""Pydantic schemas for researcher matching results.

Provides MatchSignalBreakdown and MatchResult for the
multi-signal matching algorithm output.
"""

from pydantic import BaseModel

from app.schemas.profile import ResearcherProfilePublic


class MatchSignalBreakdown(BaseModel):
    """Individual signal scores for a match recommendation."""

    complementarity: float = 0.0
    co_citation: float = 0.0
    adjacency: float = 0.0
    institutional: float = 0.0


class MatchResult(BaseModel):
    """Complete match recommendation with profile, score, and explanation."""

    profile: ResearcherProfilePublic
    overall_score: float = 0.0
    breakdown: MatchSignalBreakdown
    explanation: str | None = None
