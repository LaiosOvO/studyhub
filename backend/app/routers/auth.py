"""Authentication API endpoints.

Provides register, login, refresh, logout, and user profile routes.
All responses use the ApiResponse envelope for consistent client handling.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.schemas.common import ApiResponse
from app.services.auth_service import (
    authenticate_user,
    create_tokens,
    logout_user,
    refresh_access_token,
    register_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=ApiResponse[UserResponse],
    status_code=status.HTTP_201_CREATED,
)
async def register(
    body: RegisterRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[UserResponse]:
    """Register a new user with email and password."""
    try:
        user = await register_user(
            session=session,
            email=body.email,
            password=body.password,
            full_name=body.full_name,
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    return ApiResponse(
        success=True,
        data=UserResponse.model_validate(user),
        message="Registration successful",
    )


@router.post("/login", response_model=ApiResponse[TokenResponse])
async def login(
    body: LoginRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[TokenResponse]:
    """Authenticate user and return JWT token pair."""
    user = await authenticate_user(
        session=session,
        email=body.email,
        password=body.password,
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    tokens = create_tokens(user.id)
    return ApiResponse(
        success=True,
        data=tokens,
        message="Login successful",
    )


@router.post("/refresh", response_model=ApiResponse[TokenResponse])
async def refresh(
    body: RefreshRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[TokenResponse]:
    """Refresh access token using a valid refresh token.

    Implements token rotation: the old refresh token is invalidated
    and a new token pair is issued.
    """
    try:
        tokens = await refresh_access_token(
            refresh_token=body.refresh_token,
            session=session,
            valkey_client=None,  # Valkey integration added when service is available
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    return ApiResponse(
        success=True,
        data=tokens,
        message="Token refreshed",
    )


@router.post("/logout", response_model=ApiResponse)
async def logout(
    body: RefreshRequest,
    _current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse:
    """Log out by invalidating the refresh token.

    Requires a valid access token in the Authorization header
    and the refresh token in the request body.
    """
    await logout_user(
        refresh_token=body.refresh_token,
        valkey_client=None,  # Valkey integration added when service is available
    )
    return ApiResponse(
        success=True,
        message="Logged out successfully",
    )


@router.get("/me", response_model=ApiResponse[UserResponse])
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[UserResponse]:
    """Return the currently authenticated user's profile."""
    return ApiResponse(
        success=True,
        data=UserResponse.model_validate(current_user),
    )
