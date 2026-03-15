"""LLM Gateway API endpoints.

Provides completion and usage-tracking endpoints with rate limiting.
All endpoints require authentication.
"""

from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.schemas.llm import LLMRequest, LLMResponse, UserUsageResponse
from app.services.llm_service import get_user_usage, llm_completion

router = APIRouter(prefix="/llm", tags=["llm"])

limiter = Limiter(key_func=get_remote_address)


def _get_current_user_id(request: Request) -> str:
    """Extract authenticated user ID from request state.

    Expects auth middleware or dependency to set request.state.user_id.
    Plan 02 will provide the real auth dependency; this is a minimal
    bridge that raises 401 when user_id is missing.
    """
    user_id = getattr(request.state, "user_id", None)
    if user_id is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return user_id


@router.post("/completion", response_model=dict)
@limiter.limit("10/minute")
async def create_completion(
    request: Request,
    body: LLMRequest,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Generate an LLM completion.

    Rate limited to 10 requests per minute per IP.
    Requires authentication (user_id in request state).
    """
    user_id = _get_current_user_id(request)
    result: LLMResponse = await llm_completion(
        session=session,
        user_id=user_id,
        messages=body.messages,
        model=body.model,
        max_tokens=body.max_tokens,
        request_type="chat",
    )
    return {
        "success": True,
        "data": result.model_dump(),
        "error": None,
    }


@router.get("/usage", response_model=dict)
async def get_usage(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Get LLM usage statistics for the current user."""
    user_id = _get_current_user_id(request)
    result: UserUsageResponse = await get_user_usage(
        session=session,
        user_id=user_id,
    )
    return {
        "success": True,
        "data": result.model_dump(),
        "error": None,
    }
