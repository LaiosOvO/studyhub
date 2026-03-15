"""Abstract base class for academic paper source clients.

All source clients inherit from BasePaperClient and implement
the three search methods: keywords, DOI, and author.
"""

import logging
from abc import ABC, abstractmethod

import httpx

from app.schemas.paper import PaperResult

logger = logging.getLogger(__name__)


class BasePaperClient(ABC):
    """Base class for academic paper source clients.

    Each client wraps a shared httpx.AsyncClient for connection pooling
    and implements source-specific API calls with response normalization.
    """

    def __init__(self, http_client: httpx.AsyncClient) -> None:
        self._client = http_client

    @abstractmethod
    async def search_keywords(
        self, query: str, limit: int = 25
    ) -> list[PaperResult]:
        """Search papers by keyword query."""
        ...

    @abstractmethod
    async def search_doi(self, doi: str) -> PaperResult | None:
        """Look up a specific paper by DOI."""
        ...

    @abstractmethod
    async def search_author(
        self, author: str, limit: int = 25
    ) -> list[PaperResult]:
        """Search papers by author name."""
        ...
