"""Composite quality scoring algorithm for academic papers.

Computes a normalized score (0-1) from four components:
- Citation count (log-scaled)
- Citation velocity (citations per year)
- Journal impact factor (from OpenAlex)
- Author H-index (from OpenAlex)

Pure scoring function has no side effects. Async helpers fetch
metadata from OpenAlex and persist scores to Neo4j.

Reference: AI-Scientist paper evaluation patterns.
"""

import asyncio
import logging
import math
from datetime import datetime

from app.schemas.paper import PaperResult
from app.schemas.quality import PaperWithQuality, QualityBreakdown, QualityWeights
from app.services.citation_network.neo4j_client import Neo4jClient

logger = logging.getLogger(__name__)

DEFAULT_WEIGHTS = QualityWeights()
CURRENT_YEAR = datetime.now().year


def compute_quality_score(
    citation_count: int,
    year: int | None,
    impact_factor: float | None,
    h_index: int | None,
    weights: QualityWeights | None = None,
) -> QualityBreakdown:
    """Compute composite quality score from paper metrics.

    Pure function: no side effects, no API calls.

    Normalization:
    - Citations: min(log10(count+1)/4.0, 1.0) -- caps at 10k citations
    - Velocity: min(velocity/50.0, 1.0) -- caps at 50 citations/year
    - Impact factor: min(IF/20.0, 1.0) -- caps at IF=20
    - H-index: min(h/80.0, 1.0) -- caps at h=80

    Args:
        citation_count: Total citation count.
        year: Publication year (for velocity calculation).
        impact_factor: Journal impact factor (from OpenAlex).
        h_index: Author H-index (from OpenAlex).
        weights: Optional custom weights.

    Returns:
        QualityBreakdown with normalized components and composite score.
    """
    w = weights or DEFAULT_WEIGHTS

    # Normalize citations (log scale, cap at 1.0)
    citations_norm = min(math.log10(citation_count + 1) / 4.0, 1.0)

    # Calculate and normalize velocity
    if year is not None and year < CURRENT_YEAR:
        years_since = CURRENT_YEAR - year + 1
        velocity = citation_count / years_since
    else:
        velocity = float(citation_count)
    velocity_norm = min(velocity / 50.0, 1.0)

    # Normalize impact factor
    if_value = impact_factor if impact_factor is not None else 0.0
    impact_factor_norm = min(if_value / 20.0, 1.0)

    # Normalize H-index
    h_value = h_index if h_index is not None else 0
    h_index_norm = min(h_value / 80.0, 1.0)

    # Count available components
    components_available = 0
    if citation_count > 0:
        components_available += 1  # citations
        components_available += 1  # velocity (always available if citations)
    if impact_factor is not None:
        components_available += 1
    if h_index is not None:
        components_available += 1

    # Weighted sum
    score = (
        w.citations * citations_norm
        + w.velocity * velocity_norm
        + w.impact_factor * impact_factor_norm
        + w.h_index * h_index_norm
    )

    return QualityBreakdown(
        score=round(min(score, 1.0), 4),
        citations_norm=round(citations_norm, 4),
        velocity_norm=round(velocity_norm, 4),
        impact_factor_norm=round(impact_factor_norm, 4),
        h_index_norm=round(h_index_norm, 4),
        components_available=components_available,
    )


async def get_author_h_index(author_name: str) -> int | None:
    """Fetch author H-index from OpenAlex via pyalex.

    Returns None on any error (graceful degradation).
    """
    try:
        import pyalex

        result = await asyncio.to_thread(
            lambda: pyalex.Authors().search(author_name).get(per_page=1)
        )
        if result and len(result) > 0:
            author = result[0]
            summary = author.get("summary_stats") or {}
            return summary.get("h_index")
    except Exception as exc:
        logger.warning("Failed to fetch H-index for '%s': %s", author_name, exc)
    return None


async def get_journal_impact(venue: str) -> float | None:
    """Fetch journal impact factor (2yr mean citedness) from OpenAlex via pyalex.

    Returns None on any error (graceful degradation).
    """
    try:
        import pyalex

        result = await asyncio.to_thread(
            lambda: pyalex.Sources().search(venue).get(per_page=1)
        )
        if result and len(result) > 0:
            source = result[0]
            summary = source.get("summary_stats") or {}
            return summary.get("2yr_mean_citedness")
    except Exception as exc:
        logger.warning("Failed to fetch impact factor for '%s': %s", venue, exc)
    return None


async def score_paper(paper: PaperResult) -> QualityBreakdown:
    """Score a single paper, fetching h_index and impact_factor from OpenAlex.

    Uses asyncio.gather for parallel lookups.
    """
    tasks = []

    # Fetch H-index for first author
    if paper.authors:
        tasks.append(get_author_h_index(paper.authors[0]))
    else:
        tasks.append(asyncio.coroutine(lambda: None)() if False else _return_none())

    # Fetch impact factor for venue
    if paper.venue:
        tasks.append(get_journal_impact(paper.venue))
    else:
        tasks.append(_return_none())

    h_index, impact_factor = await asyncio.gather(*tasks)

    return compute_quality_score(
        citation_count=paper.citation_count,
        year=paper.year,
        impact_factor=impact_factor,
        h_index=h_index,
    )


async def _return_none():
    """Async helper that returns None (for gather with optional tasks)."""
    return None


async def score_papers_batch(
    papers: list[PaperResult],
    neo4j_client: Neo4jClient | None = None,
) -> list[PaperWithQuality]:
    """Score multiple papers and optionally persist scores to Neo4j.

    Uses fast local scoring (citation count + year) for the batch,
    skipping per-paper OpenAlex lookups to avoid rate limiting.
    Individual paper lookups via score_paper() are still available
    for single-paper detail views.

    Args:
        papers: Papers to score.
        neo4j_client: Optional Neo4j client for score persistence.

    Returns:
        List of PaperWithQuality with computed scores.
    """
    results: list[PaperWithQuality] = []

    for paper in papers:
        # Fast scoring without external API calls
        breakdown = compute_quality_score(
            citation_count=paper.citation_count,
            year=paper.year,
            impact_factor=None,
            h_index=None,
        )
        paper_with_quality = PaperWithQuality(
            **paper.model_dump(),
            quality=breakdown,
        )
        results.append(paper_with_quality)

    # Persist scores to Neo4j if client provided
    if neo4j_client and results:
        updates = [
            {"s2_id": p.s2_id, "score": p.quality.score}
            for p in results
            if p.s2_id and p.quality
        ]
        if updates:
            await neo4j_client.update_quality_scores(updates)

    return results


async def get_top_papers(neo4j_client: Neo4jClient, n: int = 10) -> list[dict]:
    """Retrieve top-N papers by quality score from Neo4j.

    Args:
        neo4j_client: Neo4j client.
        n: Number of top papers to return.

    Returns:
        List of paper dicts from Neo4j sorted by quality_score desc.
    """
    return await neo4j_client.get_top_papers_by_quality(n)
