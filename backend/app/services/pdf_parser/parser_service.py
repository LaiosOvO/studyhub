"""PDF parsing orchestration service.

Coordinates: download PDF -> send to GROBID -> map sections -> store.
Handles both URL-based and direct byte upload parsing flows.

TODO: In Phase 5, move parsing to a Temporal workflow for async processing.
"""

import logging

import httpx
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.paper import Paper

from .grobid_client import GrobidClient
from .section_mapper import build_structured_content, parse_tei_to_sections

logger = logging.getLogger(__name__)


class ParserService:
    """Orchestrates PDF download, parsing, and storage."""

    def __init__(
        self,
        grobid_client: GrobidClient,
        http_client: httpx.AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        self._grobid = grobid_client
        self._http = http_client
        self._db = db_session

    async def parse_paper(self, paper_id: str, pdf_url: str) -> dict:
        """Download PDF from URL, parse it, and store structured content.

        Args:
            paper_id: ID of the paper record in the database.
            pdf_url: URL to download the PDF from.

        Returns:
            Structured content dict on success, or error dict on failure.
        """
        # Step 1: Download PDF
        try:
            response = await self._http.get(pdf_url, timeout=60.0, follow_redirects=True)
            response.raise_for_status()
            pdf_bytes = response.content
        except (httpx.HTTPError, httpx.TimeoutException) as exc:
            logger.error("PDF download failed for %s: %s", paper_id, exc)
            return {"error": "download_failed", "detail": str(exc)}

        return await self._parse_and_store(paper_id, pdf_bytes)

    async def parse_paper_from_bytes(self, paper_id: str, pdf_bytes: bytes) -> dict:
        """Parse PDF from raw bytes and store structured content.

        Args:
            paper_id: ID of the paper record in the database.
            pdf_bytes: Raw PDF file content.

        Returns:
            Structured content dict on success, or error dict on failure.
        """
        return await self._parse_and_store(paper_id, pdf_bytes)

    async def _parse_and_store(self, paper_id: str, pdf_bytes: bytes) -> dict:
        """Core parse pipeline: GROBID -> map sections -> store."""
        # Step 2: Send to GROBID
        try:
            tei_xml = await self._grobid.process_pdf(pdf_bytes)
        except (httpx.HTTPError, httpx.TimeoutException) as exc:
            logger.error("GROBID parsing failed for %s: %s", paper_id, exc)
            return {"error": "parsing_failed", "detail": str(exc)}

        # Step 3: Parse TEI XML into structured sections
        parsed = parse_tei_to_sections(tei_xml)
        structured = build_structured_content(parsed)

        # Step 4: Store parsed content in database
        try:
            stmt = (
                update(Paper)
                .where(Paper.id == paper_id)
                .values(parsed_content=structured)
            )
            await self._db.execute(stmt)
            await self._db.commit()
        except Exception as exc:
            logger.warning("DB update failed for %s, returning content anyway: %s", paper_id, exc)

        # Step 5: Optionally store raw PDF in SeaweedFS
        await self._try_store_pdf(paper_id, pdf_bytes)

        return structured

    async def _try_store_pdf(self, paper_id: str, pdf_bytes: bytes) -> None:
        """Attempt to upload raw PDF to SeaweedFS. Non-fatal on failure."""
        settings = get_settings()
        storage_key = f"papers/{paper_id}/paper.pdf"
        try:
            response = await self._http.put(
                f"{settings.seaweedfs_s3_endpoint}/{storage_key}",
                content=pdf_bytes,
                headers={"Content-Type": "application/pdf"},
                timeout=30.0,
            )
            if response.status_code in (200, 201):
                stmt = (
                    update(Paper)
                    .where(Paper.id == paper_id)
                    .values(pdf_storage_key=storage_key)
                )
                await self._db.execute(stmt)
                await self._db.commit()
                logger.info("PDF stored in SeaweedFS: %s", storage_key)
            else:
                logger.warning("SeaweedFS upload returned %s", response.status_code)
        except (httpx.HTTPError, httpx.TimeoutException) as exc:
            logger.warning("SeaweedFS unavailable, skipping PDF storage: %s", exc)
