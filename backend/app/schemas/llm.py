"""Pydantic schemas for LLM Gateway requests and responses."""

from pydantic import BaseModel, Field


class LLMRequest(BaseModel):
    """Request body for LLM completion endpoint."""

    messages: list[dict] = Field(
        ...,
        description="List of message dicts with 'role' and 'content' keys",
        min_length=1,
    )
    model: str | None = Field(
        default=None,
        description="Model override; uses default from settings if omitted",
    )
    max_tokens: int = Field(
        default=4096,
        ge=1,
        le=32768,
        description="Maximum tokens in completion response",
    )


class UsageInfo(BaseModel):
    """Token usage and cost breakdown for a single LLM call."""

    prompt_tokens: int
    completion_tokens: int
    total_cost: float


class LLMResponse(BaseModel):
    """Response from LLM completion endpoint."""

    content: str
    model: str
    usage: UsageInfo


class ModelUsage(BaseModel):
    """Per-model usage aggregation."""

    model: str
    request_count: int
    total_cost: float
    total_prompt_tokens: int
    total_completion_tokens: int


class UserUsageResponse(BaseModel):
    """Aggregated usage statistics for a user."""

    total_cost: float
    request_count: int
    breakdown: list[ModelUsage]
