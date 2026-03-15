"""Pydantic schemas for reading list CRUD operations."""

from datetime import datetime

from pydantic import BaseModel, Field


class ReadingListCreate(BaseModel):
    """Schema for creating a new reading list."""

    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    paper_ids: list[str] = Field(default_factory=list)


class ReadingListUpdate(BaseModel):
    """Schema for updating an existing reading list."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    paper_ids: list[str] | None = None


class ReadingListResponse(BaseModel):
    """Schema for reading list API responses."""

    model_config = {"from_attributes": True}

    id: str
    user_id: str
    name: str
    description: str | None
    paper_ids: list[str]
    created_at: datetime
    updated_at: datetime


class AddPaperRequest(BaseModel):
    """Schema for adding a paper to a reading list."""

    paper_id: str = Field(..., min_length=1)


class RemovePaperRequest(BaseModel):
    """Schema for removing a paper from a reading list."""

    paper_id: str = Field(..., min_length=1)
