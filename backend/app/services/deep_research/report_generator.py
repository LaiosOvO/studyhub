"""Literature review report generation with STORM-style inline citations.

Generates each section via LLM with numbered source references [1][2],
then merges all sections with a unified reference list.

Falls back to Jinja2 template rendering if LLM generation fails.

Reference: STORM (Stanford) inline citation pipeline, gpt-researcher output.
"""

import logging
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deep_research import DeepResearchTask
from app.models.paper import Paper
from app.services.deep_research.analyzer import PaperAnalysis
from app.services.deep_research.gap_detector import GapResult, TrendResult
from app.services.deep_research.prompts import (
    build_overview_prompt,
    build_section_prompt,
)
from app.services.llm_service import llm_completion

logger = logging.getLogger(__name__)

_TEMPLATE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "templates"


# ─── Reference Helpers ─────────────────────────────────────────────────────


def _format_author_str(authors: list[str]) -> str:
    """Format author list: first 3 + et al."""
    if not authors:
        return "Unknown"
    result = ", ".join(authors[:3])
    if len(authors) > 3:
        result += " et al."
    return result


def _build_numbered_sources(
    papers: list[Paper],
    analyses: dict[str, PaperAnalysis],
    language: str,
) -> tuple[str, list[dict]]:
    """Build numbered source text for LLM prompts and a parallel reference list.

    Returns (numbered_text, references) where references[i] corresponds to [i+1].
    """
    lines: list[str] = []
    references: list[dict] = []

    for idx, paper in enumerate(papers, 1):
        analysis = analyses.get(paper.id)
        tldr = ""
        if analysis:
            tldr = (analysis.tldr_zh if language == "zh" else analysis.tldr_en) or analysis.tldr_en or analysis.tldr_zh
        methods_str = ", ".join(analysis.methods) if analysis and analysis.methods else ""

        snippet = tldr[:200] if tldr else (paper.abstract or "")[:200]
        line = f"[{idx}] {paper.title} ({paper.year or 'n.d.'})"
        if methods_str:
            line += f" — Methods: {methods_str}"
        line += f": {snippet}"
        lines.append(line)

        references.append({
            "idx": idx,
            "title": paper.title,
            "authors": _format_author_str(paper.authors),
            "year": paper.year,
            "venue": paper.venue or "",
        })

    return "\n".join(lines), references


def _remap_citations(text: str, local_to_global: dict[int, int]) -> str:
    """Remap local citation numbers to global numbers.

    Handles [1], [2, 5], and [1][3] patterns.
    """
    def replace_bracket(match: re.Match) -> str:
        inner = match.group(1)
        # Handle comma-separated: [2, 5]
        parts = [p.strip() for p in inner.split(",")]
        remapped = []
        for part in parts:
            try:
                local_idx = int(part)
                global_idx = local_to_global.get(local_idx, local_idx)
                remapped.append(str(global_idx))
            except ValueError:
                remapped.append(part)
        return "[" + ", ".join(remapped) + "]"

    return re.sub(r"\[(\d+(?:\s*,\s*\d+)*)\]", replace_bracket, text)


def _collect_used_refs(text: str) -> set[int]:
    """Extract all citation numbers used in the text."""
    used: set[int] = set()
    for match in re.finditer(r"\[(\d+(?:\s*,\s*\d+)*)\]", text):
        for part in match.group(1).split(","):
            try:
                used.add(int(part.strip()))
            except ValueError:
                pass
    return used


# ─── Section Generators ───────────────────────────────────────────────────


async def _generate_section(
    session: AsyncSession,
    user_id: str,
    section_title: str,
    direction: str,
    numbered_sources: str,
    language: str,
    extra_context: str = "",
) -> str:
    """Generate a single report section via LLM with inline citations."""
    messages = build_section_prompt(
        section_title=section_title,
        direction=direction,
        numbered_sources=numbered_sources,
        language=language,
        extra_context=extra_context,
    )
    response = await llm_completion(
        session=session,
        user_id=user_id,
        messages=messages,
        max_tokens=2048,
        request_type="report_section",
    )
    return response.content


async def _generate_overview(
    session: AsyncSession,
    user_id: str,
    direction: str,
    paper_count: int,
    method_count: int,
    numbered_sources: str,
    language: str,
) -> str:
    """Generate the overview/introduction section via LLM."""
    messages = build_overview_prompt(
        direction=direction,
        paper_count=paper_count,
        method_count=method_count,
        numbered_sources=numbered_sources,
        language=language,
    )
    response = await llm_completion(
        session=session,
        user_id=user_id,
        messages=messages,
        max_tokens=1500,
        request_type="report_overview",
    )
    return response.content


# ─── Main Generator ───────────────────────────────────────────────────────


async def generate_literature_review(
    task: DeepResearchTask,
    analyses: list[PaperAnalysis],
    gaps: GapResult,
    trends: TrendResult,
    papers: list[Paper],
    language: str = "zh",
    session: AsyncSession | None = None,
    user_id: str | None = None,
) -> str:
    """Generate a Markdown literature review with inline citations.

    When session and user_id are provided, uses LLM to generate analytical
    prose with [1][2] inline citations (STORM-style).
    Falls back to Jinja2 template when LLM is unavailable.

    All inputs are read-only. Returns rendered Markdown string.
    """
    # Fallback to Jinja2 if no LLM access
    if session is None or user_id is None:
        logger.info("No session/user_id — falling back to Jinja2 template")
        return await _generate_jinja2_fallback(task, analyses, gaps, trends, papers, language)

    try:
        return await _generate_inline_report(
            task, analyses, gaps, trends, papers, language, session, user_id,
        )
    except Exception:
        logger.exception("LLM report generation failed, falling back to Jinja2")
        return await _generate_jinja2_fallback(task, analyses, gaps, trends, papers, language)


async def _generate_inline_report(
    task: DeepResearchTask,
    analyses: list[PaperAnalysis],
    gaps: GapResult,
    trends: TrendResult,
    papers: list[Paper],
    language: str,
    session: AsyncSession,
    user_id: str,
) -> str:
    """Generate report with LLM-powered inline citations."""
    direction = task.research_direction
    analysis_map = {a.paper_id: a for a in analyses}

    # Sort papers by quality score for consistent numbering
    sorted_papers = sorted(papers, key=lambda p: p.quality_score or 0.0, reverse=True)

    # Build numbered sources (all papers get a number)
    numbered_sources, all_refs = _build_numbered_sources(sorted_papers, analysis_map, language)

    # Top papers subset for overview (up to 15)
    top_papers = sorted_papers[:15]
    top_sources, _ = _build_numbered_sources(top_papers, analysis_map, language)

    # Method frequency
    method_counter: Counter = Counter()
    for analysis in analyses:
        for method in analysis.methods:
            method_counter[method] += 1

    # ── Generate sections in parallel (STORM pattern) ────────────────
    zh = language == "zh"

    # Prepare extra context for each section
    key_papers_context = ""
    for idx, p in enumerate(top_papers[:10], 1):
        a = analysis_map.get(p.id)
        if a and a.detailed_methodology:
            key_papers_context += f"[{idx}] methodology: {a.detailed_methodology[:300]}\n"
        if a and a.key_contributions:
            key_papers_context += f"[{idx}] contributions: {', '.join(a.key_contributions[:3])}\n"

    gaps_context = ""
    if gaps and gaps.gaps:
        gaps_context = "Identified research gaps:\n"
        for g in gaps.gaps:
            gaps_context += f"- {g.description} (evidence: {g.evidence}, impact: {g.potential_impact})\n"
        if gaps.underexplored:
            gaps_context += "\nUnderexplored combinations:\n"
            for u in gaps.underexplored:
                gaps_context += f"- {u.combination}: {u.why_promising}\n"

    trends_context = ""
    if trends and (trends.ascending_methods or trends.emerging_topics):
        trends_context = "Temporal trends:\n"
        if trends.ascending_methods:
            trends_context += "Ascending: " + ", ".join(
                f"{t.method} ({t.evidence})" for t in trends.ascending_methods
            ) + "\n"
        if trends.declining_methods:
            trends_context += "Declining: " + ", ".join(
                f"{t.method} ({t.evidence})" for t in trends.declining_methods
            ) + "\n"
        if trends.emerging_topics:
            trends_context += "Emerging: " + ", ".join(
                f"{t.topic} ({t.evidence})" for t in trends.emerging_topics
            ) + "\n"

    # Launch all sections in parallel via asyncio.gather
    import asyncio

    tasks: list[asyncio.Task] = []

    # Always generate overview + methods
    tasks.append(asyncio.ensure_future(_generate_overview(
        session, user_id, direction, len(papers), len(method_counter),
        top_sources, language,
    )))
    tasks.append(asyncio.ensure_future(_generate_section(
        session, user_id,
        "核心方法与关键论文" if zh else "Core Methods and Key Papers",
        direction, numbered_sources, language,
        extra_context=key_papers_context,
    )))

    # Conditionally generate gaps + trends
    has_gaps = bool(gaps_context)
    has_trends = bool(trends_context)

    if has_gaps:
        tasks.append(asyncio.ensure_future(_generate_section(
            session, user_id,
            "研究空白与待探索方向" if zh else "Research Gaps and Opportunities",
            direction, numbered_sources, language,
            extra_context=gaps_context,
        )))
    if has_trends:
        tasks.append(asyncio.ensure_future(_generate_section(
            session, user_id,
            "研究趋势" if zh else "Research Trends",
            direction, numbered_sources, language,
            extra_context=trends_context,
        )))

    results = await asyncio.gather(*tasks)

    # Unpack results
    overview_text = results[0]
    methods_text = results[1]
    result_idx = 2
    gaps_text = results[result_idx] if has_gaps else ""
    if has_gaps:
        result_idx += 1
    trends_text = results[result_idx] if has_trends else ""

    # ── Collect used references and renumber ────────────────────────────
    all_section_text = "\n".join([overview_text, methods_text, gaps_text, trends_text])
    used_indices = _collect_used_refs(all_section_text)

    # Build compact reference list (only cited papers)
    cited_refs = [r for r in all_refs if r["idx"] in used_indices]
    if not cited_refs:
        # If no citations detected, include all refs
        cited_refs = all_refs

    # ── Assemble final report ──────────────────────────────────────────
    header = (
        f"# {'文献综述' if zh else 'Literature Review'}: {direction}\n\n"
        f"**{'生成日期' if zh else 'Generated'}:** {datetime.utcnow().strftime('%Y-%m-%d')}\n"
        f"**{'论文数量' if zh else 'Papers analyzed'}:** {len(papers)} {'篇' if zh else ''}\n\n"
        f"---\n"
    )

    sections = [header]

    sections.append(f"\n## {'概述' if zh else 'Overview'}\n\n{overview_text}\n")
    sections.append(f"\n---\n\n## {'核心方法与关键论文' if zh else 'Core Methods and Key Papers'}\n\n{methods_text}\n")

    if gaps_text:
        sections.append(f"\n---\n\n## {'研究空白与待探索方向' if zh else 'Research Gaps and Opportunities'}\n\n{gaps_text}\n")

    if trends_text:
        sections.append(f"\n---\n\n## {'研究趋势' if zh else 'Research Trends'}\n\n{trends_text}\n")

    # Method frequency table
    if method_counter:
        method_header = "方法" if zh else "Method"
        count_header = "论文数量" if zh else "Paper Count"
        table = f"\n---\n\n## {'方法概览' if zh else 'Methodology Landscape'}\n\n"
        table += f"| {method_header} | {count_header} |\n|--------|-------------|\n"
        for method, count in method_counter.most_common(15):
            table += f"| {method} | {count} |\n"
        sections.append(table)

    # References
    ref_header = "参考文献" if zh else "References"
    ref_section = f"\n---\n\n## {ref_header}\n\n"
    for ref in cited_refs:
        ref_section += (
            f"{ref['idx']}. {ref['authors']}. \"{ref['title']}\" "
            f"({ref['year'] or 'n.d.'}). {ref['venue']}\n"
        )
    sections.append(ref_section)

    # Footer
    footer = (
        "\n---\n\n"
        + ("*本综述由 StudyHub Deep Research Engine 自动生成*" if zh
           else "*Generated by StudyHub Deep Research Engine*")
    )
    sections.append(footer)

    rendered = "\n".join(sections)
    logger.info(
        "Generated inline-citation report: %d chars, %d refs cited, language=%s",
        len(rendered), len(cited_refs), language,
    )
    return rendered


# ─── Jinja2 Fallback ──────────────────────────────────────────────────────


async def _generate_jinja2_fallback(
    task: DeepResearchTask,
    analyses: list[PaperAnalysis],
    gaps: GapResult,
    trends: TrendResult,
    papers: list[Paper],
    language: str,
) -> str:
    """Original Jinja2 template rendering (no inline citations)."""
    env = Environment(
        loader=FileSystemLoader(str(_TEMPLATE_DIR)),
        autoescape=False,
    )
    template = env.get_template("literature_review.md.j2")

    analysis_map = {a.paper_id: a for a in analyses}
    method_counter: Counter = Counter()
    dataset_counter: Counter = Counter()

    for analysis in analyses:
        for method in analysis.methods:
            method_counter[method] += 1
        for dataset in analysis.datasets:
            dataset_counter[dataset] += 1

    sorted_papers = sorted(papers, key=lambda p: p.quality_score or 0.0, reverse=True)[:10]
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

    references = []
    for p in papers:
        references.append({
            "title": p.title,
            "authors": _format_author_str(p.authors),
            "year": p.year,
            "venue": p.venue or "",
        })

    source_set: set[str] = set()
    for p in papers:
        if p.sources:
            for s in p.sources:
                source_set.add(s if isinstance(s, str) else str(s))

    context = {
        "language": language,
        "direction": task.research_direction,
        "generated_date": datetime.utcnow().strftime("%Y-%m-%d"),
        "paper_count": len(papers),
        "method_count": len(method_counter),
        "dataset_count": len(dataset_counter),
        "sources": sorted(source_set) if source_set else ["Multiple academic databases"],
        "top_papers": top_papers,
        "method_summary": method_counter.most_common(15),
        "gaps": gaps.model_dump() if gaps else None,
        "trends": trends.model_dump() if trends else None,
        "references": references,
    }

    rendered = template.render(**context)
    logger.info("Generated Jinja2 fallback report: %d chars, language=%s", len(rendered), language)
    return rendered
