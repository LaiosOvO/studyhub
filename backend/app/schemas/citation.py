"""Citation network schemas for graph expansion and query responses.

Defines models for citation edges, expansion requests/responses,
and the in-memory citation graph structure used by the BFS engine.
"""

from pydantic import BaseModel, Field

from app.schemas.paper import PaperResult


class CitationEdge(BaseModel):
    """A single citation relationship with metadata from Semantic Scholar."""

    citing_paper: PaperResult
    is_influential: bool = False
    intents: list[str] = Field(default_factory=list)


class CitationExpansionRequest(BaseModel):
    """Request parameters for BFS citation expansion."""

    seed_paper_ids: list[str] = Field(min_length=1, max_length=10)
    max_depth: int = Field(default=2, ge=1, le=3)
    budget_per_level: int = Field(default=50, ge=1, le=200)
    total_budget: int = Field(default=200, ge=1, le=1000)


class CitationExpansionResponse(BaseModel):
    """Response from a citation expansion operation."""

    papers: list[PaperResult] = Field(default_factory=list)
    edges: list[dict] = Field(default_factory=list)
    total_discovered: int = 0
    budget_exhausted: bool = False
    depth_reached: int = 0


class CitationGraph(BaseModel):
    """In-memory citation graph built by the BFS expansion engine.

    Papers keyed by S2 paper ID for O(1) dedup lookups.
    Edges stored as (citing_id, cited_id) tuples.
    """

    papers: dict[str, PaperResult] = Field(default_factory=dict)
    edges: list[tuple[str, str]] = Field(default_factory=list)
    seed_ids: list[str] = Field(default_factory=list)
