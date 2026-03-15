"""Tiered LLM analysis for Deep Research paper corpus.

Two-pass architecture:
1. Haiku screens ALL papers on abstracts (TLDR, methods, paper type)
2. Sonnet deep-analyzes top-N quality-scored papers with full text

All functions are pure async -- no mutation of input objects.

Reference: AI-Scientist analysis patterns, gpt-researcher tiered analysis.
"""

import json
import logging

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.paper import Paper
from app.services.deep_research.prompts import (
    build_deep_analysis_prompt,
    build_relationship_prompt,
    build_tldr_prompt,
)
from app.services.llm_service import llm_completion

logger = logging.getLogger(__name__)

# ─── Analysis Models ───────────────────────────────────────────────────────


class PaperAnalysis(BaseModel):
    """Structured analysis result for a single paper."""

    paper_id: str
    tldr_en: str = ""
    tldr_zh: str = ""
    methods: list[str] = []
    datasets: list[str] = []
    key_metrics: dict = {}
    paper_type: str = "unknown"
    detailed_methodology: str | None = None
    key_contributions: list[str] | None = None
    limitations: list[str] | None = None


class RelationshipResult(BaseModel):
    """Classification result for a paper pair's relationship."""

    paper_a_id: str
    paper_b_id: str
    relationship: str = "unrelated"
    confidence: float = 0.0
    explanation: str = ""


# ─── Per-Paper Analysis ───────────────────────────────────────────────────


async def screen_paper(
    paper: Paper,
    session: AsyncSession,
    user_id: str,
) -> PaperAnalysis:
    """Screen a paper using Haiku on abstract for TLDR and basic classification.

    Returns PaperAnalysis with empty fields on parse failure (graceful fallback).
    """
    messages = build_tldr_prompt(
        title=paper.title,
        abstract=paper.abstract,
        year=paper.year,
        venue=paper.venue,
    )

    try:
        response = await llm_completion(
            session=session,
            user_id=user_id,
            messages=messages,
            model="claude-haiku-4-20250514",
            max_tokens=512,
            request_type="deep_research_screening",
        )
        data = json.loads(response.content)

        return PaperAnalysis(
            paper_id=paper.id,
            tldr_en=data.get("tldr_en", ""),
            tldr_zh=data.get("tldr_zh", ""),
            methods=data.get("methods", []),
            datasets=data.get("datasets", []),
            key_metrics=data.get("key_metrics", {}),
            paper_type=data.get("paper_type", "unknown"),
        )
    except (json.JSONDecodeError, Exception) as exc:
        logger.warning("Screening failed for paper %s: %s", paper.id, exc)
        return PaperAnalysis(paper_id=paper.id, paper_type="unknown")


async def deep_analyze_paper(
    paper: Paper,
    session: AsyncSession,
    user_id: str,
) -> dict:
    """Deep-analyze a paper using Sonnet on full parsed content.

    Returns dict with detailed_methodology, key_contributions, limitations.
    Returns empty dict on failure.
    """
    parsed_text = None
    if paper.parsed_content and isinstance(paper.parsed_content, dict):
        # Combine parsed sections into text
        sections = paper.parsed_content.get("sections", [])
        if sections:
            parsed_text = "\n\n".join(
                f"## {s.get('heading', '')}\n{s.get('text', '')}"
                for s in sections
            )

    messages = build_deep_analysis_prompt(
        title=paper.title,
        abstract=paper.abstract,
        parsed_content=parsed_text,
    )

    try:
        response = await llm_completion(
            session=session,
            user_id=user_id,
            messages=messages,
            model=None,  # Default Sonnet
            max_tokens=2048,
            request_type="deep_research_analysis",
        )
        return json.loads(response.content)
    except (json.JSONDecodeError, Exception) as exc:
        logger.warning("Deep analysis failed for paper %s: %s", paper.id, exc)
        return {}


# ─── Tiered Analysis Pipeline ─────────────────────────────────────────────


async def analyze_papers_tiered(
    papers: list[Paper],
    session: AsyncSession,
    user_id: str,
    top_n: int = 20,
    cost_ceiling: float = 10.0,
) -> list[PaperAnalysis]:
    """Two-pass tiered analysis of a paper corpus.

    Pass 1: Haiku screens ALL papers on abstracts (cheap, fast).
    Pass 2: Sonnet deep-analyzes top-N papers with parsed content.

    Tracks cumulative cost and aborts if ceiling exceeded.
    All inputs are read-only -- returns new PaperAnalysis objects.
    """
    analyses: list[PaperAnalysis] = []
    cumulative_cost = 0.0

    # Pass 1: Abstract screening with Haiku
    logger.info("Pass 1: Screening %d papers with Haiku", len(papers))
    for paper in papers:
        if cumulative_cost >= cost_ceiling:
            logger.warning(
                "Cost ceiling $%.2f reached after screening %d/%d papers",
                cost_ceiling,
                len(analyses),
                len(papers),
            )
            break

        analysis = await screen_paper(paper, session, user_id)
        analyses.append(analysis)

        # Estimate cost: ~$0.01 per Haiku screening call
        cumulative_cost += 0.01

    # Pass 2: Deep analysis with Sonnet on top-N papers
    papers_with_quality = sorted(
        papers,
        key=lambda p: p.quality_score or 0.0,
        reverse=True,
    )
    top_papers = [
        p for p in papers_with_quality[:top_n]
        if p.parsed_content is not None
    ]

    logger.info("Pass 2: Deep analyzing %d top papers with Sonnet", len(top_papers))
    analysis_map = {a.paper_id: a for a in analyses}

    for paper in top_papers:
        if cumulative_cost >= cost_ceiling:
            logger.warning("Cost ceiling reached during deep analysis")
            break

        deep_result = await deep_analyze_paper(paper, session, user_id)

        if deep_result and paper.id in analysis_map:
            # Merge deep analysis into screening result (immutable)
            existing = analysis_map[paper.id]
            updated = PaperAnalysis(
                paper_id=existing.paper_id,
                tldr_en=existing.tldr_en,
                tldr_zh=existing.tldr_zh,
                methods=existing.methods,
                datasets=existing.datasets,
                key_metrics=existing.key_metrics,
                paper_type=existing.paper_type,
                detailed_methodology=deep_result.get("detailed_methodology"),
                key_contributions=deep_result.get("key_contributions"),
                limitations=deep_result.get("limitations"),
            )
            analysis_map[paper.id] = updated

        # Estimate cost: ~$0.10 per Sonnet deep analysis call
        cumulative_cost += 0.10

    # Return updated analyses preserving order
    result = [analysis_map.get(a.paper_id, a) for a in analyses]

    logger.info(
        "Analysis complete: %d screened, %d deep-analyzed, est. cost $%.2f",
        len(analyses),
        len(top_papers),
        cumulative_cost,
    )

    return result


# ─── Relationship Classification ──────────────────────────────────────────


async def classify_relationships(
    paper_pairs: list[tuple[Paper, Paper]],
    session: AsyncSession,
    user_id: str,
) -> list[RelationshipResult]:
    """Classify relationships for citation-connected paper pairs.

    Only processes pairs where both papers have abstracts.
    Uses Haiku for cost efficiency (relationship classification is simpler).
    """
    results: list[RelationshipResult] = []

    for paper_a, paper_b in paper_pairs:
        # Skip pairs without abstracts
        if not paper_a.abstract or not paper_b.abstract:
            continue

        messages = build_relationship_prompt(
            title_a=paper_a.title,
            abstract_a=paper_a.abstract,
            title_b=paper_b.title,
            abstract_b=paper_b.abstract,
        )

        try:
            response = await llm_completion(
                session=session,
                user_id=user_id,
                messages=messages,
                model="claude-haiku-4-20250514",
                max_tokens=256,
                request_type="deep_research_classification",
            )
            data = json.loads(response.content)

            results.append(RelationshipResult(
                paper_a_id=paper_a.id,
                paper_b_id=paper_b.id,
                relationship=data.get("relationship", "unrelated"),
                confidence=float(data.get("confidence", 0.0)),
                explanation=data.get("explanation", ""),
            ))
        except (json.JSONDecodeError, Exception) as exc:
            logger.warning(
                "Relationship classification failed for %s -> %s: %s",
                paper_a.id,
                paper_b.id,
                exc,
            )
            results.append(RelationshipResult(
                paper_a_id=paper_a.id,
                paper_b_id=paper_b.id,
            ))

    logger.info("Classified %d paper relationships", len(results))
    return results
