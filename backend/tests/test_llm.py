"""Tests for the LLM Gateway service and router.

All tests mock litellm.acompletion and litellm.completion_cost
so no real API calls are made.
"""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from app.models.llm_usage import LLMUsage
from app.schemas.llm import (
    LLMRequest,
    LLMResponse,
    ModelUsage,
    UsageInfo,
    UserUsageResponse,
)
from app.services.llm_service import get_user_usage, llm_completion


def _make_litellm_response(
    content: str = "Hello!",
    model: str = "claude-sonnet-4-20250514",
    prompt_tokens: int = 10,
    completion_tokens: int = 5,
):
    """Build a mock litellm response object."""
    message = SimpleNamespace(content=content)
    choice = SimpleNamespace(message=message)
    usage = SimpleNamespace(
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
    )
    return SimpleNamespace(
        choices=[choice],
        usage=usage,
        model=model,
    )


class TestLLMCompletion:
    """Tests for llm_completion service function."""

    @pytest.mark.asyncio
    async def test_successful_completion(self, sample_user_id, sample_messages):
        """LLM service calls litellm and records usage."""
        mock_response = _make_litellm_response()
        session = AsyncMock()

        with (
            patch("app.services.llm_service.litellm") as mock_litellm,
        ):
            mock_litellm.acompletion = AsyncMock(return_value=mock_response)
            mock_litellm.completion_cost = MagicMock(return_value=0.0003)

            result = await llm_completion(
                session=session,
                user_id=sample_user_id,
                messages=sample_messages,
            )

        assert isinstance(result, LLMResponse)
        assert result.content == "Hello!"
        assert result.model == "claude-sonnet-4-20250514"
        assert result.usage.prompt_tokens == 10
        assert result.usage.completion_tokens == 5
        assert result.usage.total_cost == 0.0003

        # Verify usage record was added to session
        session.add.assert_called_once()
        added_record = session.add.call_args[0][0]
        assert isinstance(added_record, LLMUsage)
        assert added_record.user_id == sample_user_id
        assert added_record.prompt_tokens == 10
        session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_cost_tracking_records_created(
        self, sample_user_id, sample_messages
    ):
        """Each LLM call creates a cost tracking record."""
        mock_response = _make_litellm_response(
            prompt_tokens=100,
            completion_tokens=50,
        )
        session = AsyncMock()

        with patch("app.services.llm_service.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=mock_response)
            mock_litellm.completion_cost = MagicMock(return_value=0.005)

            await llm_completion(
                session=session,
                user_id=sample_user_id,
                messages=sample_messages,
                request_type="summary",
            )

        added_record = session.add.call_args[0][0]
        assert added_record.total_cost == 0.005
        assert added_record.request_type == "summary"
        assert added_record.prompt_tokens == 100
        assert added_record.completion_tokens == 50

    @pytest.mark.asyncio
    async def test_fallback_triggered_on_primary_failure(
        self, sample_user_id, sample_messages
    ):
        """When primary model fails, fallback model is used."""
        primary_error = Exception("Primary model unavailable")
        fallback_response = _make_litellm_response(
            content="Fallback response",
            model="gpt-4o",
        )
        session = AsyncMock()

        with patch("app.services.llm_service.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(
                side_effect=[primary_error, fallback_response]
            )
            mock_litellm.completion_cost = MagicMock(return_value=0.001)

            result = await llm_completion(
                session=session,
                user_id=sample_user_id,
                messages=sample_messages,
            )

        assert result.content == "Fallback response"
        assert result.model == "gpt-4o"
        assert mock_litellm.acompletion.await_count == 2

    @pytest.mark.asyncio
    async def test_both_models_fail_raises(
        self, sample_user_id, sample_messages
    ):
        """When both primary and fallback fail, exception propagates."""
        session = AsyncMock()

        with patch("app.services.llm_service.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(
                side_effect=Exception("All models down")
            )

            with pytest.raises(Exception, match="All models down"):
                await llm_completion(
                    session=session,
                    user_id=sample_user_id,
                    messages=sample_messages,
                )

    @pytest.mark.asyncio
    async def test_custom_model_override(
        self, sample_user_id, sample_messages
    ):
        """Custom model parameter overrides default."""
        mock_response = _make_litellm_response(model="gpt-4o-mini")
        session = AsyncMock()

        with patch("app.services.llm_service.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=mock_response)
            mock_litellm.completion_cost = MagicMock(return_value=0.0001)

            await llm_completion(
                session=session,
                user_id=sample_user_id,
                messages=sample_messages,
                model="gpt-4o-mini",
            )

        call_kwargs = mock_litellm.acompletion.call_args[1]
        assert call_kwargs["model"] == "gpt-4o-mini"


class TestUserUsage:
    """Tests for get_user_usage aggregation."""

    @pytest.mark.asyncio
    async def test_empty_usage(self, sample_user_id):
        """User with no usage returns zero totals."""
        session = AsyncMock()
        mock_result = MagicMock()
        mock_result.all.return_value = []
        session.execute = AsyncMock(return_value=mock_result)

        result = await get_user_usage(session, sample_user_id)

        assert isinstance(result, UserUsageResponse)
        assert result.total_cost == 0
        assert result.request_count == 0
        assert result.breakdown == []

    @pytest.mark.asyncio
    async def test_usage_aggregation(self, sample_user_id):
        """Usage is aggregated per model correctly."""
        session = AsyncMock()
        mock_result = MagicMock()
        mock_result.all.return_value = [
            SimpleNamespace(
                model="claude-sonnet-4-20250514",
                request_count=5,
                total_cost=0.05,
                total_prompt_tokens=500,
                total_completion_tokens=250,
            ),
            SimpleNamespace(
                model="gpt-4o",
                request_count=3,
                total_cost=0.03,
                total_prompt_tokens=300,
                total_completion_tokens=150,
            ),
        ]
        session.execute = AsyncMock(return_value=mock_result)

        result = await get_user_usage(session, sample_user_id)

        assert result.total_cost == pytest.approx(0.08)
        assert result.request_count == 8
        assert len(result.breakdown) == 2
        assert result.breakdown[0].model == "claude-sonnet-4-20250514"
        assert result.breakdown[1].model == "gpt-4o"


class TestLLMSchemas:
    """Tests for Pydantic schema validation."""

    def test_llm_request_valid(self):
        """Valid LLM request is accepted."""
        req = LLMRequest(
            messages=[{"role": "user", "content": "Hello"}],
        )
        assert len(req.messages) == 1
        assert req.max_tokens == 4096
        assert req.model is None

    def test_llm_request_empty_messages_rejected(self):
        """Empty messages list is rejected."""
        with pytest.raises(Exception):
            LLMRequest(messages=[])

    def test_llm_request_max_tokens_bounds(self):
        """max_tokens must be within bounds."""
        with pytest.raises(Exception):
            LLMRequest(
                messages=[{"role": "user", "content": "Hi"}],
                max_tokens=0,
            )
        with pytest.raises(Exception):
            LLMRequest(
                messages=[{"role": "user", "content": "Hi"}],
                max_tokens=100000,
            )

    def test_usage_info_serialization(self):
        """UsageInfo round-trips through dict."""
        info = UsageInfo(
            prompt_tokens=10,
            completion_tokens=5,
            total_cost=0.001,
        )
        data = info.model_dump()
        assert data["prompt_tokens"] == 10
        restored = UsageInfo(**data)
        assert restored == info


class TestRateLimiting:
    """Tests for rate limiting on the LLM endpoint."""

    def test_limiter_configured(self):
        """Verify the limiter is instantiated in the router module."""
        from app.routers.llm import limiter

        assert limiter is not None

    def test_router_has_completion_endpoint(self):
        """Router includes the /completion endpoint."""
        from app.routers.llm import router

        routes = [r.path for r in router.routes]
        assert any("/completion" in r for r in routes)

    def test_router_has_usage_endpoint(self):
        """Router includes the /usage endpoint."""
        from app.routers.llm import router

        routes = [r.path for r in router.routes]
        assert any("/usage" in r for r in routes)
