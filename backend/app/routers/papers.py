"""Paper parsing API endpoints.

Provides endpoints to trigger PDF parsing for existing papers
and to upload PDFs for ad-hoc parsing.

TODO: In Phase 5, move parsing to Temporal workflow for async processing.
Currently runs synchronously in the request (30-120s for large PDFs).
"""

import logging
import uuid

import httpx
from fastapi import APIRouter, Depends, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import get_db
from app.models.paper import Paper
from app.schemas.common import ApiResponse
from app.services.pdf_parser.grobid_client import GrobidClient
from app.services.pdf_parser.parser_service import ParserService

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_parser_service(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ParserService:
    """Create a ParserService with injected dependencies."""
    settings = get_settings()
    grobid_client = GrobidClient(grobid_url=settings.grobid_url)
    http_client = request.app.state.http_client
    return ParserService(
        grobid_client=grobid_client,
        http_client=http_client,
        db_session=db,
    )


@router.post("/{paper_id}/parse", response_model=ApiResponse)
async def parse_paper(
    paper_id: str,
    db: AsyncSession = Depends(get_db),
    parser: ParserService = Depends(_get_parser_service),
) -> ApiResponse:
    """Trigger PDF parsing for an existing paper.

    The paper must exist in the database and have a pdf_url.
    Returns a summary of the parsed sections.
    """
    # Find the paper
    result = await db.execute(select(Paper).where(Paper.id == paper_id))
    paper = result.scalar_one_or_none()

    if paper is None:
        return ApiResponse(success=False, error="Paper not found")

    if not paper.pdf_url:
        return ApiResponse(success=False, error="Paper has no PDF URL")

    # Parse the paper
    structured = await parser.parse_paper(paper_id, paper.pdf_url)

    if "error" in structured:
        return ApiResponse(
            success=False,
            error=structured.get("detail", "Parsing failed"),
        )

    return ApiResponse(
        success=True,
        data={
            "title": structured.get("title", ""),
            "section_count": len(structured.get("full_sections", [])),
            "reference_count": len(structured.get("references", [])),
        },
        message="Paper parsed successfully",
    )


@router.post("/parse-upload", response_model=ApiResponse)
async def parse_upload(
    file: UploadFile,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse:
    """Upload a PDF and parse it into structured sections.

    Creates a paper record (or reuses existing) and returns
    the full structured content.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return ApiResponse(success=False, error="File must be a PDF")

    pdf_bytes = await file.read()
    if not pdf_bytes:
        return ApiResponse(success=False, error="Empty file")

    # Create a paper record for the upload
    paper_id = str(uuid.uuid4())
    paper = Paper(
        id=paper_id,
        title=file.filename.rsplit(".", 1)[0],
        sources=[],
    )
    db.add(paper)
    await db.commit()

    # Parse the PDF
    settings = get_settings()
    grobid_client = GrobidClient(grobid_url=settings.grobid_url)
    http_client = request.app.state.http_client
    parser = ParserService(
        grobid_client=grobid_client,
        http_client=http_client,
        db_session=db,
    )

    structured = await parser.parse_paper_from_bytes(paper_id, pdf_bytes)

    if "error" in structured:
        return ApiResponse(
            success=False,
            error=structured.get("detail", "Parsing failed"),
        )

    return ApiResponse(
        success=True,
        data=structured,
        message="PDF parsed successfully",
    )
