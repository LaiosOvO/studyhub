"""Pydantic schemas for authentication request/response validation."""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """Registration request with invite code, credentials, and academic info."""

    # Credentials
    email: EmailStr
    password: str = Field(min_length=8, description="Password must be at least 8 characters")
    full_name: str = Field(min_length=1, max_length=255, description="User display name")

    # Invite code (required for beta)
    invite_code: str = Field(min_length=1, max_length=50, description="Beta invite code")

    # Academic info (optional at registration, can be filled later)
    institution: str | None = Field(default=None, max_length=300, description="University or institution")
    major: str | None = Field(default=None, max_length=200, description="Major or department")
    advisor: str | None = Field(default=None, max_length=200, description="Advisor name")
    role: str | None = Field(default=None, max_length=100, description="Role: student, phd, postdoc, professor, researcher")
    research_directions: list[str] | None = Field(default=None, description="Research directions/interests")


class LoginRequest(BaseModel):
    """Login request with email and password."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """JWT token pair returned after login or refresh."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    """Refresh token request to obtain new token pair."""

    refresh_token: str


class UserResponse(BaseModel):
    """User profile data returned in API responses."""

    id: str
    email: str
    full_name: str
    language_preference: str
    created_at: datetime

    model_config = {"from_attributes": True}
