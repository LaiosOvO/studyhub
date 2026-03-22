"""Paper parsing and sync API endpoints.

Provides endpoints to trigger PDF parsing for existing papers,
upload PDFs for ad-hoc parsing, and sync papers from desktop clients.
"""

import logging
import uuid

import httpx
from fastapi import APIRouter, Depends, Request, UploadFile
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import get_current_user, get_db
from app.models.paper import Paper
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.paper import (
    PaperResult,
    PaperSyncRequest,
    PaperSyncResponse,
    PaperSyncResult,
)
from app.services.paper_search.deduplicator import _normalize_title
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


@router.post("/sync", response_model=ApiResponse)
async def sync_papers(
    body: PaperSyncRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ApiResponse:
    """Batch upsert papers from desktop client to server.

    Deduplicates by DOI first, then by normalized title+year.
    Returns server-side paper IDs for each synced paper.

    Reference: LabClaw citation-management dedup strategy.
    """
    if not body.papers:
        return ApiResponse(
            success=True,
            data=PaperSyncResponse().model_dump(),
            message="No papers to sync",
        )

    created_count = 0
    updated_count = 0
    results: list[PaperSyncResult] = []

    for paper_in in body.papers:
        existing = await _find_existing_paper(db, paper_in)

        if existing is not None:
            _merge_into_existing(existing, paper_in)
            updated_count += 1
            results.append(
                PaperSyncResult(
                    title=existing.title,
                    server_id=existing.id,
                    created=False,
                )
            )
        else:
            new_paper = Paper(
                id=str(uuid.uuid4()),
                doi=paper_in.doi,
                openalex_id=paper_in.openalex_id,
                s2_id=paper_in.s2_id,
                pmid=paper_in.pmid,
                arxiv_id=paper_in.arxiv_id,
                title=paper_in.title,
                abstract=paper_in.abstract,
                authors=paper_in.authors,
                year=paper_in.year,
                venue=paper_in.venue,
                language=paper_in.language,
                citation_count=paper_in.citation_count,
                pdf_url=paper_in.pdf_url,
                is_open_access=paper_in.is_open_access,
                sources=[s.value for s in paper_in.sources],
            )
            db.add(new_paper)
            created_count += 1
            results.append(
                PaperSyncResult(
                    title=new_paper.title,
                    server_id=new_paper.id,
                    created=True,
                )
            )

    await db.commit()

    response = PaperSyncResponse(
        synced=len(results),
        created=created_count,
        updated=updated_count,
        results=results,
    )

    logger.info(
        "User %s synced %d papers (created=%d, updated=%d)",
        user.id,
        len(results),
        created_count,
        updated_count,
    )

    return ApiResponse(
        success=True,
        data=response.model_dump(),
        message=f"Synced {len(results)} papers",
    )


async def _find_existing_paper(
    db: AsyncSession, paper: PaperResult
) -> Paper | None:
    """Find existing paper by DOI or normalized title+year."""
    # Tier 1: DOI match
    if paper.doi:
        normalized_doi = paper.doi.lower().strip()
        result = await db.execute(
            select(Paper).where(Paper.doi == normalized_doi).limit(1)
        )
        existing = result.scalar_one_or_none()
        if existing is not None:
            return existing

    # Tier 2: Title + year match
    norm_title = _normalize_title(paper.title)
    result = await db.execute(select(Paper).where(Paper.year == paper.year))
    candidates = result.scalars().all()
    for candidate in candidates:
        if _normalize_title(candidate.title) == norm_title:
            return candidate

    return None


def _merge_into_existing(existing: Paper, incoming: PaperResult) -> None:
    """Merge incoming paper data into existing record (fill blanks)."""
    if not existing.doi and incoming.doi:
        existing.doi = incoming.doi
    if not existing.openalex_id and incoming.openalex_id:
        existing.openalex_id = incoming.openalex_id
    if not existing.s2_id and incoming.s2_id:
        existing.s2_id = incoming.s2_id
    if not existing.pmid and incoming.pmid:
        existing.pmid = incoming.pmid
    if not existing.arxiv_id and incoming.arxiv_id:
        existing.arxiv_id = incoming.arxiv_id
    if not existing.abstract and incoming.abstract:
        existing.abstract = incoming.abstract
    if not existing.venue and incoming.venue:
        existing.venue = incoming.venue
    if not existing.pdf_url and incoming.pdf_url:
        existing.pdf_url = incoming.pdf_url
    if incoming.citation_count > (existing.citation_count or 0):
        existing.citation_count = incoming.citation_count
    if not existing.is_open_access and incoming.is_open_access:
        existing.is_open_access = True

    # Merge sources
    existing_sources = set(existing.sources or [])
    new_sources = {s.value for s in incoming.sources}
    merged = list(existing_sources | new_sources)
    if merged != existing.sources:
        existing.sources = merged
