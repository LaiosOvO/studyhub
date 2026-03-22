"""Built-in tools available to the agent runtime.

Each tool is a function that takes arguments and returns a ToolResult.
Tools have access to the database session and deep research task data.
"""

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deep_research import DeepResearchTask
from app.models.paper import Paper
from app.services.agent.types import ToolDefinition, ToolResult

logger = logging.getLogger(__name__)


# ── Tool Registry ────────────────────────────────────────────────────────────

TOOL_DEFINITIONS: list[ToolDefinition] = [
    ToolDefinition(
        name="get_research_summary",
        description="获取深度研究任务的摘要信息，包括研究方向、发现论文数、分析论文数、研究空白和趋势。",
        parameters={"task_id": "string (required)"},
    ),
    ToolDefinition(
        name="get_papers",
        description="获取深度研究发现的论文列表，支持排序和筛选。返回标题、作者、年份、摘要、引用数等。",
        parameters={
            "task_id": "string (required)",
            "sort_by": "string (citations|year|quality_score, default: quality_score)",
            "limit": "integer (default: 20)",
            "min_quality": "float (0-10, default: 0)",
        },
    ),
    ToolDefinition(
        name="get_paper_analyses",
        description="获取论文的 AI 深度分析结果，包括方法、数据集、贡献、局限性。",
        parameters={"task_id": "string (required)", "paper_ids": "list[string] (optional, default: all)"},
    ),
    ToolDefinition(
        name="get_gaps_and_trends",
        description="获取研究空白（gaps）和方法趋势（trends）分析结果。",
        parameters={"task_id": "string (required)"},
    ),
    ToolDefinition(
        name="get_existing_report",
        description="获取深度研究已生成的文献综述报告（Markdown 格式）。",
        parameters={"task_id": "string (required)"},
    ),
    ToolDefinition(
        name="write_section",
        description="将生成的内容写入输出文档的指定章节。返回确认信息。",
        parameters={
            "section_title": "string (required)",
            "content": "string (required, markdown formatted)",
            "section_order": "integer (required, 1-based)",
        },
    ),
]


async def execute_tool(
    tool_name: str,
    args: dict[str, Any],
    session: AsyncSession,
    context: dict[str, Any],
) -> ToolResult:
    """Execute a tool by name with given arguments.

    Args:
        tool_name: Name of the tool to execute.
        args: Tool arguments.
        session: Database session.
        context: Runtime context (task_id, output_sections, etc.)

    Returns:
        ToolResult with success status and output.
    """
    handler = _TOOL_HANDLERS.get(tool_name)
    if not handler:
        return ToolResult(success=False, output=f"Unknown tool: {tool_name}")

    try:
        return await handler(args, session, context)
    except Exception as e:
        logger.exception("Tool %s failed: %s", tool_name, e)
        return ToolResult(success=False, output=f"Tool error: {e}")


# ── Tool Implementations ─────────────────────────────────────────────────────

async def _get_research_summary(
    args: dict, session: AsyncSession, context: dict,
) -> ToolResult:
    task_id = args.get("task_id") or context.get("task_id")
    if not task_id:
        return ToolResult(success=False, output="task_id is required")

    task = await session.get(DeepResearchTask, task_id)
    if not task:
        return ToolResult(success=False, output=f"Task {task_id} not found")

    gaps = task.gaps or {}
    trends = task.trends or {}
    config = task.config or {}

    summary = {
        "research_direction": task.research_direction,
        "status": task.status,
        "papers_found": task.papers_found,
        "papers_analyzed": task.papers_analyzed,
        "total_cost": task.total_cost,
        "gap_count": len(gaps.get("gaps", [])),
        "trend_count": len(trends.get("ascending_methods", [])) + len(trends.get("declining_methods", [])),
        "sources_used": config.get("sources", []),
        "year_range": f"{config.get('year_from', '?')}–{config.get('year_to', '?')}",
    }

    return ToolResult(success=True, output=_format_dict(summary), data=summary)


async def _get_papers(
    args: dict, session: AsyncSession, context: dict,
) -> ToolResult:
    task_id = args.get("task_id") or context.get("task_id")
    if not task_id:
        return ToolResult(success=False, output="task_id is required")

    sort_by = args.get("sort_by", "quality_score")
    limit = min(int(args.get("limit", 20)), 100)
    min_quality = float(args.get("min_quality", 0))

    sort_col = {
        "citations": Paper.citation_count.desc(),
        "year": Paper.year.desc(),
        "quality_score": Paper.quality_score.desc(),
    }.get(sort_by, Paper.quality_score.desc())

    # Papers linked to this task via config or search results
    task = await session.get(DeepResearchTask, task_id)
    if not task:
        return ToolResult(success=False, output=f"Task {task_id} not found")

    # Get paper IDs from task config
    config = task.config or {}
    paper_analyses = config.get("paper_analyses", {})
    paper_ids = list(paper_analyses.keys())

    if not paper_ids:
        return ToolResult(success=True, output="No papers found for this task.", data={"papers": []})

    stmt = (
        select(Paper)
        .where(Paper.id.in_(paper_ids))
        .where(Paper.quality_score >= min_quality)
        .order_by(sort_col)
        .limit(limit)
    )
    result = await session.execute(stmt)
    papers = result.scalars().all()

    paper_list = []
    for p in papers:
        paper_list.append({
            "id": p.id,
            "title": p.title,
            "authors": (p.authors or "").split("; ")[:3],
            "year": p.year,
            "venue": p.venue,
            "citations": p.citation_count,
            "quality_score": p.quality_score,
            "abstract": (p.abstract or "")[:300],
        })

    output = f"Found {len(paper_list)} papers (sorted by {sort_by}):\n\n"
    for i, p in enumerate(paper_list, 1):
        output += f"{i}. [{p['year']}] {p['title']} — {', '.join(p['authors'])} (citations: {p['citations']}, quality: {p['quality_score']})\n"

    return ToolResult(success=True, output=output, data={"papers": paper_list})


async def _get_paper_analyses(
    args: dict, session: AsyncSession, context: dict,
) -> ToolResult:
    task_id = args.get("task_id") or context.get("task_id")
    if not task_id:
        return ToolResult(success=False, output="task_id is required")

    task = await session.get(DeepResearchTask, task_id)
    if not task:
        return ToolResult(success=False, output=f"Task {task_id} not found")

    config = task.config or {}
    analyses = config.get("paper_analyses", {})

    paper_ids = args.get("paper_ids")
    if paper_ids:
        analyses = {k: v for k, v in analyses.items() if k in paper_ids}

    if not analyses:
        return ToolResult(success=True, output="No analyses available.", data={"analyses": {}})

    output = f"Analyses for {len(analyses)} papers:\n\n"
    for pid, analysis in list(analyses.items())[:20]:
        output += f"## {analysis.get('tldr_en', 'N/A')}\n"
        output += f"  Methods: {', '.join(analysis.get('methods', []))}\n"
        output += f"  Datasets: {', '.join(analysis.get('datasets', []))}\n"
        output += f"  Type: {analysis.get('paper_type', '?')}\n"
        contribs = analysis.get("key_contributions", [])
        if contribs:
            output += f"  Contributions: {'; '.join(contribs[:3])}\n"
        output += "\n"

    return ToolResult(success=True, output=output, data={"analyses": analyses})


async def _get_gaps_and_trends(
    args: dict, session: AsyncSession, context: dict,
) -> ToolResult:
    task_id = args.get("task_id") or context.get("task_id")
    if not task_id:
        return ToolResult(success=False, output="task_id is required")

    task = await session.get(DeepResearchTask, task_id)
    if not task:
        return ToolResult(success=False, output=f"Task {task_id} not found")

    gaps = task.gaps or {}
    trends = task.trends or {}

    output = "## Research Gaps\n\n"
    for g in gaps.get("gaps", []):
        output += f"- {g.get('description', 'N/A')} (impact: {g.get('potential_impact', '?')})\n"

    output += "\n## Underexplored Areas\n\n"
    for u in gaps.get("underexplored", []):
        output += f"- {u.get('combination', 'N/A')}: {u.get('why_promising', '')}\n"

    output += "\n## Method Trends\n\n"
    output += "Ascending: " + ", ".join(t.get("method", "") for t in trends.get("ascending_methods", [])) + "\n"
    output += "Declining: " + ", ".join(t.get("method", "") for t in trends.get("declining_methods", [])) + "\n"
    output += "Emerging: " + ", ".join(t.get("topic", "") for t in trends.get("emerging_topics", [])) + "\n"

    return ToolResult(
        success=True,
        output=output,
        data={"gaps": gaps, "trends": trends},
    )


async def _get_existing_report(
    args: dict, session: AsyncSession, context: dict,
) -> ToolResult:
    task_id = args.get("task_id") or context.get("task_id")
    if not task_id:
        return ToolResult(success=False, output="task_id is required")

    task = await session.get(DeepResearchTask, task_id)
    if not task:
        return ToolResult(success=False, output=f"Task {task_id} not found")

    report = task.report_markdown
    if not report:
        return ToolResult(success=True, output="No report generated yet.")

    # Truncate if too long for context
    if len(report) > 8000:
        report = report[:8000] + "\n\n... [truncated, total length: " + str(len(report)) + " chars]"

    return ToolResult(success=True, output=report)


async def _write_section(
    args: dict, _session: AsyncSession, context: dict,
) -> ToolResult:
    title = args.get("section_title", "")
    content = args.get("content", "")
    order = int(args.get("section_order", 0))

    if not title or not content:
        return ToolResult(success=False, output="section_title and content are required")

    # Append to output_sections in context
    sections: list[dict] = context.setdefault("output_sections", [])
    sections.append({"title": title, "content": content, "order": order})

    return ToolResult(
        success=True,
        output=f"Section '{title}' (order {order}) written successfully ({len(content)} chars).",
    )


def _format_dict(d: dict) -> str:
    """Format a dict as readable key-value pairs."""
    lines = []
    for k, v in d.items():
        lines.append(f"  {k}: {v}")
    return "\n".join(lines)


# ── Handler Registry ──────────────────────────────────────────────────────────

_TOOL_HANDLERS = {
    "get_research_summary": _get_research_summary,
    "get_papers": _get_papers,
    "get_paper_analyses": _get_paper_analyses,
    "get_gaps_and_trends": _get_gaps_and_trends,
    "get_existing_report": _get_existing_report,
    "write_section": _write_section,
}
