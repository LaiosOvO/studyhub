"""GROBID REST API client for PDF-to-TEI XML conversion.

Sends PDF bytes to the GROBID processFulltextDocument endpoint
and returns raw TEI XML. Includes retry logic for timeouts.
"""

import logging

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_fixed

logger = logging.getLogger(__name__)

PROCESS_ENDPOINT = "/api/processFulltextDocument"
ISALIVE_ENDPOINT = "/api/isalive"


class GrobidClient:
    """Client for the GROBID PDF parsing service."""

    def __init__(self, grobid_url: str = "http://localhost:8070") -> None:
        self._base_url = grobid_url.rstrip("/")
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=10.0),
        )

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_fixed(5),
        retry=retry_if_exception_type(httpx.TimeoutException),
    )
    async def process_pdf(self, pdf_bytes: bytes) -> str:
        """Send PDF bytes to GROBID and return TEI XML string.

        Args:
            pdf_bytes: Raw PDF file content.

        Returns:
            TEI XML string from GROBID's fulltext processing.

        Raises:
            httpx.HTTPStatusError: If GROBID returns an error status.
            httpx.TimeoutException: If request times out after retries.
        """
        response = await self._client.post(
            f"{self._base_url}{PROCESS_ENDPOINT}",
            files={"input": ("paper.pdf", pdf_bytes, "application/pdf")},
            data={
                "consolidateHeader": "1",
                "consolidateCitations": "1",
            },
        )
        response.raise_for_status()
        return response.text

    async def is_alive(self) -> bool:
        """Check if GROBID service is running."""
        try:
            response = await self._client.get(
                f"{self._base_url}{ISALIVE_ENDPOINT}",
                timeout=5.0,
            )
            return response.status_code == 200
        except (httpx.HTTPError, httpx.TimeoutException):
            return False

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()
