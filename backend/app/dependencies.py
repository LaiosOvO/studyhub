"""Shared FastAPI dependencies for injection into route handlers."""

from collections.abc import AsyncGenerator
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from valkey.asyncio import Valkey

from app.config import get_settings
from app.database import get_db_session
from app.models.user import User
from app.services.auth_service import decode_token, get_user_by_id

# HTTP Bearer scheme for JWT access tokens
_bearer_scheme = HTTPBearer(auto_error=False)

# Valkey client singleton (lazy-initialized)
_valkey_client: Valkey | None = None


async def get_valkey() -> Valkey:
    """Return a shared async Valkey client for token blacklisting."""
    global _valkey_client
    if _valkey_client is None:
        settings = get_settings()
        _valkey_client = Valkey.from_url(settings.valkey_url, decode_responses=True)
    return _valkey_client


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session."""
    async for session in get_db_session():
        yield session


async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(_bearer_scheme),
    ],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Extract and verify JWT access token, returning the current user.

    Raises 401 if token is missing, invalid, expired, or user not found.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_token(credentials.credentials)
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await get_user_by_id(session, payload["sub"])
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user
