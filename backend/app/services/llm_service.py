"""Unified LLM Gateway with provider abstraction, cost tracking, and fallback.

Uses LiteLLM for multi-provider support (Anthropic, OpenAI, etc.).
Every request is tracked in the llm_usage table for cost monitoring.
"""

import logging

import litellm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select

from app.config import get_settings
from app.models.llm_usage import LLMUsage
from app.schemas.llm import (
    LLMResponse,
    ModelUsage,
    UsageInfo,
    UserUsageResponse,
)

logger = logging.getLogger(__name__)


async def llm_completion(
    session: AsyncSession,
    user_id: str,
    messages: list[dict],
    model: str | None = None,
    max_tokens: int = 4096,
    request_type: str = "chat",
) -> LLMResponse:
    """Execute an LLM completion with automatic fallback and cost tracking.

    Attempts the primary model first. On any failure, falls back to the
    configured secondary model. Records token usage and cost regardless
    of which model served the request.

    Args:
        session: Database session for recording usage.
        user_id: ID of the requesting user.
        messages: Chat messages in OpenAI format.
        model: Optional model override.
        max_tokens: Maximum completion tokens.
        request_type: Category tag for usage tracking.

    Returns:
        LLMResponse with content, model used, and usage info.

    Raises:
        Exception: If both primary and fallback models fail.
    """
    settings = get_settings()
    primary_model = model or settings.default_llm_model
    fallback_model = settings.llm_fallback_model
    used_model = primary_model

    try:
        response = await litellm.acompletion(
            model=primary_model,
            messages=messages,
            max_tokens=max_tokens,
        )
    except Exception as primary_error:
        logger.warning(
            "Primary model %s failed: %s. Falling back to %s.",
            primary_model,
            primary_error,
            fallback_model,
        )
        used_model = fallback_model
        response = await litellm.acompletion(
            model=fallback_model,
            messages=messages,
            max_tokens=max_tokens,
        )

    cost = litellm.completion_cost(completion_response=response)
    usage = response.usage

    usage_record = LLMUsage(
        user_id=user_id,
        model=used_model,
        prompt_tokens=usage.prompt_tokens,
        completion_tokens=usage.completion_tokens,
        total_cost=cost,
        request_type=request_type,
    )
    session.add(usage_record)
    await session.commit()

    return LLMResponse(
        content=response.choices[0].message.content,
        model=used_model,
        usage=UsageInfo(
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
            total_cost=cost,
        ),
    )


async def get_user_usage(
    session: AsyncSession,
    user_id: str,
) -> UserUsageResponse:
    """Get aggregated LLM usage statistics for a user.

    Returns total cost, request count, and per-model breakdown.
    """
    # Per-model breakdown
    breakdown_query = (
        select(
            LLMUsage.model,
            func.count().label("request_count"),
            func.sum(LLMUsage.total_cost).label("total_cost"),
            func.sum(LLMUsage.prompt_tokens).label("total_prompt_tokens"),
            func.sum(LLMUsage.completion_tokens).label("total_completion_tokens"),
        )
        .where(LLMUsage.user_id == user_id)
        .group_by(LLMUsage.model)
    )

    result = await session.execute(breakdown_query)
    rows = result.all()

    breakdown = [
        ModelUsage(
            model=row.model,
            request_count=row.request_count,
            total_cost=float(row.total_cost or 0),
            total_prompt_tokens=int(row.total_prompt_tokens or 0),
            total_completion_tokens=int(row.total_completion_tokens or 0),
        )
        for row in rows
    ]

    total_cost = sum(m.total_cost for m in breakdown)
    request_count = sum(m.request_count for m in breakdown)

    return UserUsageResponse(
        total_cost=total_cost,
        request_count=request_count,
        breakdown=breakdown,
    )
