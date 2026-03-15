"""Quality scoring schemas for composite paper evaluation.

Defines models for quality score breakdown, configurable weights,
and top-papers responses.
"""

import math

from pydantic import BaseModel, Field, model_validator

from app.schemas.paper import PaperResult


class QualityWeights(BaseModel):
    """Configurable weights for composite quality score components.

    Weights must sum to 1.0 (with 0.01 tolerance).
    """

    citations: float = 0.35
    velocity: float = 0.25
    impact_factor: float = 0.20
    h_index: float = 0.20

    @model_validator(mode="after")
    def validate_weights_sum(self) -> "QualityWeights":
        total = self.citations + self.velocity + self.impact_factor + self.h_index
        if abs(total - 1.0) > 0.01:
            msg = f"Weights must sum to 1.0 (got {total:.4f})"
            raise ValueError(msg)
        return self


class QualityBreakdown(BaseModel):
    """Detailed quality score breakdown showing each component."""

    score: float = Field(ge=0.0, le=1.0, description="Composite score (0-1)")
    citations_norm: float = Field(ge=0.0, le=1.0)
    velocity_norm: float = Field(ge=0.0, le=1.0)
    impact_factor_norm: float = Field(ge=0.0, le=1.0)
    h_index_norm: float = Field(ge=0.0, le=1.0)
    components_available: int = Field(
        ge=0, le=4, description="Number of components with data"
    )


class PaperWithQuality(PaperResult):
    """Paper result extended with quality score breakdown."""

    quality: QualityBreakdown | None = None


class TopPapersRequest(BaseModel):
    """Request for top-N papers by quality score."""

    paper_ids: list[str] | None = None
    n: int = Field(default=10, ge=1, le=100)
    direction: str | None = None


class TopPapersResponse(BaseModel):
    """Response containing top-ranked papers with quality scores."""

    papers: list[PaperWithQuality] = Field(default_factory=list)
    total_scored: int = 0
