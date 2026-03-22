"""Unified paper schema for multi-source academic paper search.

All source clients normalize their responses to PaperResult,
enabling consistent deduplication and downstream processing.
"""

from enum import Enum

from pydantic import BaseModel, Field


class PaperSource(str, Enum):
    """Academic paper data sources."""

    OPENALEX = "openalex"
    SEMANTIC_SCHOLAR = "semantic_scholar"
    PUBMED = "pubmed"
    ARXIV = "arxiv"
    CNKI = "cnki"
    WANFANG = "wanfang"


class PaperResult(BaseModel):
    """Unified paper representation across all sources.

    Every source client maps its raw API response to this schema.
    Fields not available from a given source remain None/default.
    """

    # ─── Identity ──────────────────────────────────────────────────────
    doi: str | None = None
    openalex_id: str | None = None
    s2_id: str | None = None
    pmid: str | None = None
    arxiv_id: str | None = None
    cnki_id: str | None = None
    wanfang_id: str | None = None

    # ─── Metadata ──────────────────────────────────────────────────────
    title: str
    abstract: str | None = None
    authors: list[str] = Field(default_factory=list)
    year: int | None = None
    venue: str | None = None
    language: str | None = None

    # ─── Metrics ───────────────────────────────────────────────────────
    citation_count: int = 0
    pdf_url: str | None = None
    is_open_access: bool = False

    # ─── Provenance ────────────────────────────────────────────────────
    sources: list[PaperSource] = Field(default_factory=list)


class PaperCreate(PaperResult):
    """Extended paper schema for database persistence.

    Adds fields for parsed PDF content and object storage references.
    """

    parsed_content: dict | None = None
    pdf_storage_key: str | None = None


class PaperSyncRequest(BaseModel):
    """Batch paper sync request from client to server."""

    papers: list[PaperResult] = Field(..., max_length=200)
    research_task_id: str | None = None


class PaperSyncResult(BaseModel):
    """Result of a single paper sync operation."""

    title: str
    server_id: str
    created: bool


class PaperSyncResponse(BaseModel):
    """Response for batch paper sync."""

    synced: int = 0
    created: int = 0
    updated: int = 0
    results: list[PaperSyncResult] = Field(default_factory=list)
