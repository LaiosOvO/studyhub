"""Scholar Pydantic schemas for API request/response validation.

Provides schemas for scholar CRUD operations, scrape requests,
and list responses with pagination support.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class ScholarBase(BaseModel):
    """Base scholar fields shared across create and response schemas."""

    name: str = Field(..., min_length=1, max_length=100)
    institution: str = Field(..., min_length=1, max_length=300)
    title: list[str] = Field(default_factory=list)
    rank: str | None = None
    birth_year: int | None = None
    research_fields: list[str] = Field(default_factory=list)
    honors: list[str] = Field(default_factory=list)
    education: dict | None = None
    note: str | None = None


class ScholarCreate(ScholarBase):
    """Schema for creating or upserting a scholar record."""

    name_en: str | None = None
    source_urls: list[dict] = Field(default_factory=list)


class ScholarUpdate(BaseModel):
    """Schema for partial scholar updates. All fields optional."""

    name: str | None = Field(None, min_length=1, max_length=100)
    name_en: str | None = None
    institution: str | None = Field(None, min_length=1, max_length=300)
    title: list[str] | None = None
    rank: str | None = None
    birth_year: int | None = None
    research_fields: list[str] | None = None
    honors: list[str] | None = None
    education: dict | None = None
    note: str | None = None
    source_urls: list[dict] | None = None


class ScholarResponse(ScholarBase):
    """Scholar response with all stored fields including computed data."""

    id: str
    name_en: str | None = None
    h_index: int | None = None
    total_citations: int | None = None
    source_urls: list[dict] = Field(default_factory=list)
    google_scholar_id: str | None = None
    linked_paper_ids: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ScholarListResponse(BaseModel):
    """Paginated list of scholars."""

    scholars: list[ScholarResponse]
    total: int


class ScholarScrapeRequest(BaseModel):
    """Request body for triggering a Baidu Baike scrape."""

    name: str = Field(..., min_length=1, max_length=100)
    baike_url: str | None = None
