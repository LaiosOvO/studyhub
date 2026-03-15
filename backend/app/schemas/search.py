"""Search request and response schemas for the paper search API."""

from enum import Enum

from pydantic import BaseModel, Field

from app.schemas.paper import PaperResult, PaperSource


class SearchType(str, Enum):
    """Types of academic paper searches."""

    KEYWORD = "keyword"
    DOI = "doi"
    TITLE = "title"
    AUTHOR = "author"


class SearchRequest(BaseModel):
    """Incoming search parameters."""

    query: str = Field(..., min_length=1, max_length=500)
    search_type: SearchType = SearchType.KEYWORD
    limit: int = Field(default=25, ge=1, le=100)
    sources: list[PaperSource] | None = None


class SearchResponse(BaseModel):
    """Aggregated search results from multiple sources."""

    papers: list[PaperResult] = Field(default_factory=list)
    total: int = 0
    sources_queried: list[PaperSource] = Field(default_factory=list)
    sources_failed: list[PaperSource] = Field(default_factory=list)
    from_cache: bool = False
