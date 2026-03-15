"""Pydantic schemas for plan generation pipeline I/O.

Covers all data types for SOTA identification, improvement analysis,
feasibility scoring, and experiment plan CRUD.

Reference: AI-Scientist idea generation JSON format.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# ─── Type Aliases ──────────────────────────────────────────────────────────

DataStrategy = Literal["open_source", "own_data", "hybrid"]
EntryType = Literal["direction", "paper", "gap"]


# ─── Input ─────────────────────────────────────────────────────────────────


class PlanGenerationInput(BaseModel):
    """User-facing input for plan generation request."""

    task_id: str
    entry_type: EntryType
    source_paper_id: str | None = None
    source_gap_index: int | None = None
    data_strategy: DataStrategy = "open_source"
    num_plans: int = Field(default=3, ge=1, le=5)


# ─── SOTA Types ────────────────────────────────────────────────────────────


class SOTAMethod(BaseModel):
    """A single state-of-the-art method with its benchmark result."""

    method: str
    metric: str
    value: str
    paper_title: str
    confidence: Literal["high", "medium", "low"] = "medium"


class SOTAResult(BaseModel):
    """Aggregated SOTA identification results."""

    sota_methods: list[SOTAMethod] = []
    standard_baselines: list[dict] = []
    evaluation_metrics: list[str] = []
    benchmark_datasets: list[dict] = []


# ─── Improvement Types ─────────────────────────────────────────────────────


class ImprovementOpportunity(BaseModel):
    """A gap-derived improvement opportunity for experiment design."""

    gap_description: str
    improvement_type: str
    suggested_approach: str
    estimated_difficulty: int = Field(ge=1, le=5)
    related_gap_index: int | None = None


# ─── Feasibility ───────────────────────────────────────────────────────────


class FeasibilityScore(BaseModel):
    """Multi-dimensional feasibility assessment for a plan."""

    compute_requirements: int = Field(ge=1, le=5)
    data_availability: int = Field(ge=1, le=5)
    expected_improvement: int = Field(ge=1, le=5)
    difficulty: int = Field(ge=1, le=5)
    overall: float
    explanation: str

    @property
    def is_feasible(self) -> bool:
        """A plan is considered feasible if overall score >= 2.5."""
        return self.overall >= 2.5


# ─── Dataset Recommendation ───────────────────────────────────────────────


class DatasetRecommendation(BaseModel):
    """A dataset recommendation from HuggingFace Hub or corpus."""

    name: str
    url: str
    downloads: int = 0
    tags: list[str] = []
    license: str | None = None
    relevance_score: float = 0.0


# ─── Generation Context ───────────────────────────────────────────────────


class PlanGenerationContext(BaseModel):
    """Full context assembled for plan generation LLM calls."""

    direction: str
    sota: SOTAResult | None = None
    gaps: list[dict] = []
    trends: dict | None = None
    top_papers: list[dict] = []
    focus_paper: dict | None = None
    focus_gap: dict | None = None
    improvements: list[ImprovementOpportunity] = []


# ─── Response / CRUD ──────────────────────────────────────────────────────


class ExperimentPlanResponse(BaseModel):
    """API response schema for an experiment plan."""

    model_config = {"from_attributes": True}

    id: str
    user_id: str
    task_id: str
    entry_type: str
    source_paper_id: str | None = None
    source_gap_index: int | None = None
    title: str
    hypothesis: str
    method_description: str
    baselines: list[dict] = []
    metrics: list[str] = []
    datasets: list[dict] = []
    technical_roadmap: list[dict] = []
    code_skeleton: str | None = None
    feasibility: dict | None = None
    data_strategy: str = "open_source"
    status: str = "draft"
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ExperimentPlanUpdate(BaseModel):
    """Partial update schema for user edits to a plan."""

    title: str | None = None
    hypothesis: str | None = None
    method_description: str | None = None
    baselines: list[dict] | None = None
    metrics: list[str] | None = None
    datasets: list[dict] | None = None
    technical_roadmap: list[dict] | None = None
    code_skeleton: str | None = None
    data_strategy: DataStrategy | None = None
    status: Literal["draft", "approved"] | None = None
