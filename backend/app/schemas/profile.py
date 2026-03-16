"""Pydantic schemas for researcher profile CRUD operations.

Provides Create, Update, Response, and Public variants
for the ResearcherProfile model.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class ResearcherProfileCreate(BaseModel):
    """Input schema for creating a researcher profile."""

    display_name: str = Field(..., min_length=1, max_length=255)
    institution: str | None = None
    title: str | None = None
    research_directions: list[str] = Field(default_factory=list)
    expertise_tags: list[str] = Field(default_factory=list)


class ResearcherProfileUpdate(BaseModel):
    """Partial update schema for researcher profile. All fields optional."""

    display_name: str | None = Field(None, min_length=1, max_length=255)
    institution: str | None = None
    title: str | None = None
    research_directions: list[str] | None = None
    expertise_tags: list[str] | None = None


class ResearcherProfileResponse(BaseModel):
    """Full researcher profile response for the profile owner."""

    model_config = {"from_attributes": True}

    id: str
    user_id: str
    display_name: str
    institution: str | None = None
    title: str | None = None
    research_directions: list[str] = Field(default_factory=list)
    expertise_tags: list[str] = Field(default_factory=list)
    h_index: int | None = None
    total_citations: int | None = None
    publication_count: int | None = None
    publications: list = Field(default_factory=list)
    co_authors: list = Field(default_factory=list)
    research_keywords: list = Field(default_factory=list)
    openalex_author_id: str | None = None
    scholar_id: str | None = None
    enrichment_status: str = "pending"
    enriched_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ResearcherProfilePublic(BaseModel):
    """Public-facing researcher profile (excludes internal fields)."""

    model_config = {"from_attributes": True}

    id: str
    display_name: str
    institution: str | None = None
    title: str | None = None
    research_directions: list[str] = Field(default_factory=list)
    expertise_tags: list[str] = Field(default_factory=list)
    h_index: int | None = None
    total_citations: int | None = None
    publication_count: int | None = None
    publications: list = Field(default_factory=list)
    co_authors: list = Field(default_factory=list)
    research_keywords: list = Field(default_factory=list)
