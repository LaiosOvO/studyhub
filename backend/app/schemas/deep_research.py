"""Deep Research task schemas for input, progress, and result tracking.

Defines Pydantic models for REST API request/response and WebSocket
progress streaming for the Deep Research pipeline.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.paper import PaperSource


class DeepResearchInput(BaseModel):
    """User-provided parameters to start a Deep Research task."""

    research_direction: str = Field(
        ..., min_length=1, max_length=500,
        description="Research topic, paper title, or author name",
    )
    entry_type: Literal["direction", "paper", "author"] = "direction"
    depth: int = Field(default=2, ge=1, le=3)
    max_papers: int = Field(default=100, ge=10, le=500)
    sources: list[PaperSource] | None = None
    year_from: int | None = None
    year_to: int | None = None
    languages: list[str] | None = Field(default=["en", "zh"])


class DeepResearchProgress(BaseModel):
    """Real-time progress update sent via WebSocket."""

    phase: str
    papers_found: int = 0
    papers_analyzed: int = 0
    total_papers: int = 0
    current_activity: str = ""
    eta_seconds: int | None = None
    error: str | None = None


class DeepResearchResult(BaseModel):
    """Summary result returned when a Deep Research task completes."""

    task_id: str
    status: str
    papers_found: int = 0
    papers_analyzed: int = 0
    total_cost: float = 0.0
    report_url: str | None = None


class DeepResearchTaskResponse(BaseModel):
    """Full task representation for REST API responses."""

    id: str
    user_id: str
    workflow_id: str
    research_direction: str
    entry_type: str
    status: str
    papers_found: int = 0
    papers_analyzed: int = 0
    total_cost: float = 0.0
    created_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


# ─── Refinement and Expansion ─────────────────────────────────────────────


class RefineRequest(BaseModel):
    """Filter adjustments that trigger partial re-analysis."""

    task_id: str
    exclude_methods: list[str] | None = None
    exclude_paper_types: list[str] | None = None
    year_from: int | None = None
    year_to: int | None = None
    reanalyze: bool = True


class ExpandAreaRequest(BaseModel):
    """Manual expansion of specific graph nodes."""

    task_id: str
    paper_ids: list[str] = Field(min_length=1, max_length=10)
    depth: int = Field(default=1, ge=1, le=2)
    budget: int = Field(default=50, ge=10, le=200)


class RefineResponse(BaseModel):
    """Response from a refinement operation."""

    task_id: str
    workflow_id: str | None = None
    filtered_count: int = 0
    message: str = ""


class ExpandAreaResponse(BaseModel):
    """Response from a manual expansion operation."""

    task_id: str
    new_papers: int = 0
    new_edges: int = 0
    message: str = ""
