"""LLM Gateway API endpoints.

Provides completion, usage-tracking, and proxy endpoints with rate limiting.
All endpoints require authentication.
"""

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.rate_limit import limiter
from app.schemas.llm import LLMRequest, LLMResponse, UserUsageResponse
from app.services.llm_service import get_user_usage, llm_completion

router = APIRouter(prefix="/llm", tags=["llm"])


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


class LLMModelsRequest(BaseModel):
    """Request body for the models list endpoint."""
    api_base: str
    api_key: str


@router.post("/models")
@limiter.limit("10/minute")
async def list_models(request: Request, body: LLMModelsRequest):
    """Proxy models list request to get model info (max tokens, etc.)."""
    base = body.api_base.rstrip("/")
    url = f"{base}/models" if base.endswith("/v1") else f"{base}/v1/models"

    headers = {"Authorization": f"Bearer {body.api_key}"}

    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0)) as client:
        resp = await client.get(url, headers=headers)
        return resp.json()


class LLMProxyRequest(BaseModel):
    """Request body for the LLM proxy endpoint."""
    api_base: str
    api_key: str
    model: str
    messages: list[dict]
    temperature: float = 0.3
    max_tokens: int = 4096
    stream: bool = False


@router.post("/proxy")
@limiter.limit("30/minute")
async def proxy_llm(request: Request, body: LLMProxyRequest):
    """Proxy LLM requests to avoid browser CORS issues.

    The frontend sends user-configured API credentials; this endpoint
    forwards the request to the target LLM API and returns the response.
    """
    base = body.api_base.rstrip("/")
    url = f"{base}/chat/completions" if base.endswith("/v1") else f"{base}/v1/chat/completions"

    payload = {
        "model": body.model,
        "messages": body.messages,
        "temperature": body.temperature,
        "max_tokens": body.max_tokens,
        "stream": body.stream,
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {body.api_key}",
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=10.0)) as client:
        if body.stream:
            resp = await client.send(
                client.build_request("POST", url, json=payload, headers=headers),
                stream=True,
            )
            return StreamingResponse(
                resp.aiter_bytes(),
                status_code=resp.status_code,
                media_type=resp.headers.get("content-type", "text/event-stream"),
            )

        resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code != 200:
            from fastapi.responses import JSONResponse
            try:
                err_body = resp.json()
            except Exception:
                err_body = {"error": resp.text or f"HTTP {resp.status_code}"}
            return JSONResponse(content=err_body, status_code=resp.status_code)
        try:
            return resp.json()
        except Exception:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                content={"error": f"Empty response from LLM API ({resp.status_code})"},
                status_code=502,
            )


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
