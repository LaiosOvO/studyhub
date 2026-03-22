"""Authentication business logic.

Handles password hashing, JWT token creation/verification,
user registration, login, refresh token rotation, and logout.

Uses Argon2 via pwdlib -- more secure than bcrypt, FastAPI-recommended.
pwdlib supports bcrypt verification for future migration compatibility.
"""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import update as sql_update

from app.config import get_settings
from app.models.invite_code import InviteCode
from app.models.researcher_profile import ResearcherProfile
from app.models.user import User
from app.schemas.auth import TokenResponse

# Password hasher using Argon2 (default in pwdlib)
_password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2."""
    return _password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Verify a plaintext password against a hash."""
    return _password_hash.verify(password, hashed)


def create_access_token(user_id: str) -> str:
    """Create a short-lived JWT access token (15 min default)."""
    settings = get_settings()
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc)
        + timedelta(minutes=settings.access_token_expire_minutes),
        "type": "access",
        "jti": str(uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: str) -> str:
    """Create a long-lived JWT refresh token (7 days default).

    Each refresh token has a unique JTI for rotation tracking.
    """
    settings = get_settings()
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc)
        + timedelta(days=settings.refresh_token_expire_days),
        "type": "refresh",
        "jti": str(uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_tokens(user_id: str) -> TokenResponse:
    """Create an access + refresh token pair."""
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


def decode_token(token: str) -> dict:
    """Decode and verify a JWT token. Raises jwt.PyJWTError on failure."""
    settings = get_settings()
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
    )


async def validate_invite_code(session: AsyncSession, code: str) -> InviteCode:
    """Validate an invite code. Raises ValueError if invalid."""
    result = await session.execute(
        select(InviteCode).where(InviteCode.code == code)
    )
    invite = result.scalar_one_or_none()
    if invite is None:
        raise ValueError("无效的内测码")
    if not invite.is_valid():
        raise ValueError("内测码已失效或已用完")
    return invite


async def register_user(
    session: AsyncSession,
    email: str,
    password: str,
    full_name: str,
    invite_code: str = "",
    institution: str | None = None,
    major: str | None = None,
    advisor: str | None = None,
    role: str | None = None,
    research_directions: list[str] | None = None,
) -> User:
    """Register a new user with invite code validation.

    Creates User + ResearcherProfile in one transaction.
    Raises ValueError if email exists or invite code is invalid.
    """
    # Validate invite code
    invite = await validate_invite_code(session, invite_code)

    # Check email uniqueness
    result = await session.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()
    if existing is not None:
        raise ValueError("该邮箱已被注册")

    # Create user
    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
    )
    session.add(user)
    await session.flush()  # Get user.id before creating profile

    # Create researcher profile with academic info
    expertise = []
    if major:
        expertise.append(major)
    if advisor:
        expertise.append(f"导师: {advisor}")

    profile = ResearcherProfile(
        user_id=user.id,
        display_name=full_name,
        institution=institution,
        title=role,
        research_directions=research_directions or [],
        expertise_tags=expertise,
    )
    session.add(profile)

    # Atomic increment of invite code usage (prevents race condition)
    await session.execute(
        sql_update(InviteCode)
        .where(InviteCode.id == invite.id)
        .values(current_uses=InviteCode.current_uses + 1)
    )

    await session.commit()
    await session.refresh(user)
    return user


async def authenticate_user(
    session: AsyncSession,
    email: str,
    password: str,
) -> User | None:
    """Authenticate user by email and password.

    Returns User if credentials are valid, None otherwise.
    """
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


async def get_user_by_id(session: AsyncSession, user_id: str) -> User | None:
    """Look up a user by their ID."""
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def refresh_access_token(
    refresh_token: str,
    session: AsyncSession,
    valkey_client=None,
) -> TokenResponse:
    """Verify refresh token, rotate it, and issue new token pair.

    If valkey_client is provided, checks the token blacklist and
    blacklists the old refresh token after rotation.

    Raises ValueError on invalid or blacklisted tokens.
    """
    try:
        payload = decode_token(refresh_token)
    except jwt.PyJWTError as exc:
        raise ValueError("Invalid refresh token") from exc

    if payload.get("type") != "refresh":
        raise ValueError("Token is not a refresh token")

    jti = payload.get("jti", "")

    # Check blacklist if Valkey is available
    if valkey_client is not None:
        is_blacklisted = await valkey_client.get(f"blacklist:{jti}")
        if is_blacklisted:
            raise ValueError("Refresh token has been revoked")

    # Verify the user still exists
    user = await get_user_by_id(session, payload["sub"])
    if user is None:
        raise ValueError("User not found")

    # Blacklist the old refresh token
    if valkey_client is not None:
        remaining_seconds = max(
            0,
            int(payload["exp"] - datetime.now(timezone.utc).timestamp()),
        )
        await valkey_client.set(
            f"blacklist:{jti}",
            "1",
            ex=remaining_seconds if remaining_seconds > 0 else 1,
        )

    return create_tokens(user.id)


async def logout_user(
    refresh_token: str,
    valkey_client=None,
) -> None:
    """Blacklist a refresh token to invalidate the session.

    If valkey_client is None, logout is a no-op (token will expire naturally).
    """
    try:
        payload = decode_token(refresh_token)
    except jwt.PyJWTError:
        return  # Already invalid, nothing to blacklist

    jti = payload.get("jti", "")

    if valkey_client is not None:
        remaining_seconds = max(
            0,
            int(payload["exp"] - datetime.now(timezone.utc).timestamp()),
        )
        await valkey_client.set(
            f"blacklist:{jti}",
            "1",
            ex=remaining_seconds if remaining_seconds > 0 else 1,
        )
