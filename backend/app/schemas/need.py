"""Pydantic schemas for research needs marketplace.

Provides Create, Update, Response, and WithScore variants
for the ResearchNeed model.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class ResearchNeedCreate(BaseModel):
    """Input schema for creating a research need."""

    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    required_skills: list[str] = Field(default_factory=list)
    research_direction: str | None = None
    tags: list[str] = Field(default_factory=list)


class ResearchNeedUpdate(BaseModel):
    """Partial update schema for research need. All fields optional."""

    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    required_skills: list[str] | None = None
    research_direction: str | None = None
    tags: list[str] | None = None
    status: str | None = None


class ResearchNeedResponse(BaseModel):
    """Research need response with all stored fields."""

    model_config = {"from_attributes": True}

    id: str
    user_id: str
    title: str
    description: str
    required_skills: list[str] = Field(default_factory=list)
    research_direction: str | None = None
    tags: list[str] = Field(default_factory=list)
    status: str = "open"
    created_at: datetime
    updated_at: datetime


class ResearchNeedWithScore(ResearchNeedResponse):
    """Research need response with computed match score for the viewer."""

    match_score: float = 0.0
