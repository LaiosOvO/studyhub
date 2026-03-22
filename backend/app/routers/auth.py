"""Authentication API endpoints.

Provides register, login, refresh, logout, user profile, and paper upload routes.
All responses use the ApiResponse envelope for consistent client handling.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, get_valkey
from app.models.researcher_profile import ResearcherProfile
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

logger = logging.getLogger(__name__)

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
            invite_code=body.invite_code,
            institution=body.institution,
            major=body.major,
            advisor=body.advisor,
            role=body.role,
            research_directions=body.research_directions,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
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
    valkey_client: Annotated[object, Depends(get_valkey)],
) -> ApiResponse[TokenResponse]:
    """Refresh access token using a valid refresh token.

    Implements token rotation: the old refresh token is invalidated
    and a new token pair is issued.
    """
    try:
        tokens = await refresh_access_token(
            refresh_token=body.refresh_token,
            session=session,
            valkey_client=valkey_client,
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
    valkey_client: Annotated[object, Depends(get_valkey)],
) -> ApiResponse:
    """Log out by invalidating the refresh token.

    Requires a valid access token in the Authorization header
    and the refresh token in the request body.
    """
    await logout_user(
        refresh_token=body.refresh_token,
        valkey_client=valkey_client,
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


@router.post("/upload-papers", response_model=ApiResponse)
async def upload_papers(
    files: list[UploadFile] = File(...),
    session: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
) -> ApiResponse:
    """Upload user's own papers (PDF/MD) to extract research domains.

    Parses uploaded files and updates the user's researcher profile
    with extracted research directions and expertise tags.
    """
    MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB per file
    ALLOWED_TYPES = {"application/pdf", "text/markdown", "text/plain"}
    ALLOWED_EXTENSIONS = {".pdf", ".md", ".txt", ".markdown"}

    extracted_keywords: list[str] = []
    paper_titles: list[str] = []

    for file in files:
        # Validate file type
        ext = "." + (file.filename or "").rsplit(".", 1)[-1].lower() if file.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的文件格式: {file.filename}，支持 PDF、MD、TXT",
            )

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"文件过大: {file.filename}（最大 20MB）")

        if ext == ".pdf":
            keywords, title = _extract_from_pdf(content)
        else:
            keywords, title = _extract_from_text(content.decode("utf-8", errors="ignore"))

        extracted_keywords.extend(keywords)
        if title:
            paper_titles.append(title)

    # Deduplicate and limit keywords
    unique_keywords = list(dict.fromkeys(extracted_keywords))[:20]

    # Update researcher profile
    result = await session.execute(
        select(ResearcherProfile).where(ResearcherProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if profile:
        # Merge with existing directions
        existing = set(profile.research_directions or [])
        merged = list(existing | set(unique_keywords))[:30]
        profile.research_directions = merged

        # Add paper titles to publications
        existing_pubs = list(profile.publications or [])
        for title in paper_titles:
            existing_pubs.append({"type": "self_upload", "title": title})
        profile.publications = existing_pubs

        session.add(profile)
        await session.commit()

    return ApiResponse(
        success=True,
        data={
            "extracted_keywords": unique_keywords,
            "paper_titles": paper_titles,
            "total_files": len(files),
        },
        message=f"解析了 {len(files)} 个文件，提取了 {len(unique_keywords)} 个研究方向关键词",
    )


def _extract_from_pdf(content: bytes) -> tuple[list[str], str]:
    """Extract keywords and title from PDF content.

    Uses a simple heuristic: extract text, find keywords from common
    academic sections (Abstract, Keywords, Introduction).
    """
    try:
        import fitz  # PyMuPDF

        doc = fitz.open(stream=content, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return _extract_keywords_from_text(text)
    except ImportError:
        logger.warning("PyMuPDF not available, falling back to basic extraction")
        return [], ""
    except Exception as exc:
        logger.warning("PDF extraction failed: %s", exc)
        return [], ""


def _extract_from_text(content: str) -> tuple[list[str], str]:
    """Extract keywords and title from markdown/text content."""
    return _extract_keywords_from_text(content)


def _extract_keywords_from_text(text: str) -> tuple[list[str], str]:
    """Extract research keywords from academic text.

    Looks for explicit keyword sections, then falls back to
    analyzing headings and frequent technical terms.
    """
    import re

    lines = text.split("\n")
    keywords: list[str] = []
    title = ""

    # Try to find title (first non-empty line or # heading)
    for line in lines[:20]:
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            title = stripped[:200]
            break
        if stripped.startswith("# "):
            title = stripped[2:].strip()[:200]
            break

    # Look for explicit Keywords/关键词 section
    keyword_pattern = re.compile(
        r"(?:keywords?|关键词|key\s*words?)\s*[：:]\s*(.+)",
        re.IGNORECASE,
    )
    for line in lines:
        m = keyword_pattern.search(line)
        if m:
            raw = m.group(1)
            # Split by comma, semicolon, or Chinese punctuation
            parts = re.split(r"[,;，；、]", raw)
            keywords.extend(p.strip() for p in parts if 2 <= len(p.strip()) <= 50)

    # If no explicit keywords, extract from headings
    if not keywords:
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("## ") or stripped.startswith("### "):
                heading = re.sub(r"^#+\s*", "", stripped).strip()
                if 2 <= len(heading) <= 60:
                    keywords.append(heading)

    return keywords[:15], title
