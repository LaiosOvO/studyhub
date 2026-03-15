"""Literature review Markdown report generation via Jinja2.

Composes structured analysis results (papers, gaps, trends) into a
bilingual Markdown report using a Jinja2 template.

Reference: gpt-researcher report generation, deep-research output formatting.
"""

import logging
from collections import Counter
from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from app.models.deep_research import DeepResearchTask
from app.models.paper import Paper
from app.services.deep_research.analyzer import PaperAnalysis
from app.services.deep_research.gap_detector import GapResult, TrendResult

logger = logging.getLogger(__name__)

# Template directory relative to backend/
_TEMPLATE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "templates"


async def generate_literature_review(
    task: DeepResearchTask,
    analyses: list[PaperAnalysis],
    gaps: GapResult,
    trends: TrendResult,
    papers: list[Paper],
    language: str = "zh",
) -> str:
    """Render a Markdown literature review from structured analysis data.

    Uses Jinja2 template with bilingual support (zh/en).
    All inputs are read-only. Returns rendered Markdown string.
    """
    env = Environment(
        loader=FileSystemLoader(str(_TEMPLATE_DIR)),
        autoescape=False,  # Output is Markdown, not HTML
    )
    template = env.get_template("literature_review.md.j2")

    # Build paper_id -> analysis map
    analysis_map = {a.paper_id: a for a in analyses}

    # Build paper_id -> paper map
    paper_map = {p.id: p for p in papers}

    # Top papers by quality score (up to 10)
    sorted_papers = sorted(
        papers,
        key=lambda p: p.quality_score or 0.0,
        reverse=True,
    )[:10]

    top_papers = []
    for p in sorted_papers:
        analysis = analysis_map.get(p.id)
        top_papers.append({
            "title": p.title,
            "year": p.year,
            "tldr_en": analysis.tldr_en if analysis else "",
            "tldr_zh": analysis.tldr_zh if analysis else "",
            "methods": analysis.methods if analysis else [],
        })

    # Method frequency summary
    method_counter: Counter = Counter()
    for analysis in analyses:
        for method in analysis.methods:
            method_counter[method] += 1
    method_summary = method_counter.most_common(15)

    # Dataset count
    dataset_counter: Counter = Counter()
    for analysis in analyses:
        for dataset in analysis.datasets:
            dataset_counter[dataset] += 1

    # References list
    references = []
    for p in papers:
        authors_str = ", ".join(p.authors[:3]) if p.authors else "Unknown"
        if len(p.authors) > 3:
            authors_str += " et al."
        references.append({
            "title": p.title,
            "authors": authors_str,
            "year": p.year,
            "venue": p.venue or "",
        })

    # Determine sources used
    source_set: set[str] = set()
    for p in papers:
        if p.sources:
            for s in p.sources:
                source_set.add(s if isinstance(s, str) else str(s))

    # Render template
    context = {
        "language": language,
        "direction": task.research_direction,
        "generated_date": datetime.utcnow().strftime("%Y-%m-%d"),
        "paper_count": len(papers),
        "method_count": len(method_counter),
        "dataset_count": len(dataset_counter),
        "sources": sorted(source_set) if source_set else ["Multiple academic databases"],
        "top_papers": top_papers,
        "method_summary": method_summary,
        "gaps": gaps.model_dump() if gaps else None,
        "trends": trends.model_dump() if trends else None,
        "references": references,
    }

    rendered = template.render(**context)

    logger.info(
        "Generated literature review: %d chars, language=%s",
        len(rendered),
        language,
    )

    return rendered
