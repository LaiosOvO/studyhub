"""End-to-end experiment report generation pipeline.

Generates structured Markdown reports with embedded matplotlib charts,
then converts to PDF via WeasyPrint with CJK font support.

Reference: Phase 5 literature review report_generator pattern (Jinja2 + FileSystemLoader).
"""

import base64
import logging
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import markdown
import weasyprint
from jinja2 import Environment, FileSystemLoader

from app.services.experiment.chart_generator import (
    generate_comparison_chart_png,
    generate_improvement_chart_png,
    generate_training_curve_png,
)
from app.services.experiment.metrics import summarize_results

logger = logging.getLogger(__name__)

_TEMPLATE_DIR = Path(__file__).resolve().parent.parent.parent / "templates"

# ─── CSS for PDF rendering ───────────────────────────────────────────────────

_PDF_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC&display=swap');

body {
    font-family: 'Noto Sans SC', 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
}

h1 { color: #1a1a2e; border-bottom: 2px solid #4A90D9; padding-bottom: 8px; }
h2 { color: #2c3e50; margin-top: 24px; }
h3 { color: #34495e; }

table {
    border-collapse: collapse;
    width: 100%;
    margin: 16px 0;
}
th, td {
    border: 1px solid #ddd;
    padding: 8px 12px;
    text-align: left;
}
th { background-color: #f5f5f5; font-weight: 600; }
tr:nth-child(even) { background-color: #fafafa; }

img {
    max-width: 100%;
    height: auto;
    margin: 16px 0;
    display: block;
}

code {
    background-color: #f0f0f0;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.9em;
}

hr { border: none; border-top: 1px solid #eee; margin: 24px 0; }

em { color: #666; }
"""


async def generate_experiment_report(
    run,
    plan,
    language: str = "zh",
    session=None,
    user_id: str = "",
) -> tuple[str, bytes]:
    """Generate Markdown + PDF report for a completed experiment.

    Args:
        run: ExperimentRun ORM instance.
        plan: ExperimentPlan ORM instance.
        language: "zh" or "en" for bilingual template.
        session: Optional DB session for LLM calls.
        user_id: Optional user ID for LLM tracking.

    Returns:
        Tuple of (markdown_string, pdf_bytes).
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Generate charts
        generate_training_curve_png(
            run.rounds,
            run.best_metric_name or "metric",
            tmp / "curve.png",
            baseline_value=run.baseline_metric_value,
        )
        generate_comparison_chart_png(
            run.rounds,
            run.best_metric_name or "metric",
            tmp / "comparison.png",
        )
        improvement_path = generate_improvement_chart_png(
            run.rounds,
            run.baseline_metric_value,
            run.best_metric_name or "metric",
            tmp / "improvement.png",
        )

        # Compute summary stats
        summary = summarize_results(run.rounds)

        # Generate abstract and conclusion via LLM
        abstract = await _generate_abstract(
            plan, run, summary, language, session, user_id
        )
        conclusion = await _generate_conclusion(
            plan, run, summary, language, session, user_id
        )

        # Ablation analysis (only if enough varied rounds)
        ablation = ""
        keep_rounds = [r for r in run.rounds if r.get("status") == "keep"]
        if len(keep_rounds) >= 5:
            ablation = await _generate_ablation(
                plan, run, keep_rounds, language, session, user_id
            )

        # Render Jinja2 template
        env = Environment(
            loader=FileSystemLoader(str(_TEMPLATE_DIR)), autoescape=False
        )
        template = env.get_template("experiment_report.md.j2")

        context = {
            "language": language,
            "plan_title": plan.title,
            "generated_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "status": run.status,
            "total_rounds": len(run.rounds),
            "best_metric_name": run.best_metric_name or "metric",
            "best_metric_value": (
                f"{run.best_metric_value:.4f}"
                if run.best_metric_value is not None
                else "N/A"
            ),
            "abstract": abstract,
            "hypothesis": plan.hypothesis,
            "method_description": plan.method_description,
            "baselines": plan.baselines or [],
            "summary": summary,
            "rounds": run.rounds,
            "improvement_chart_exists": improvement_path is not None,
            "ablation": ablation,
            "conclusion": conclusion,
        }

        md_content = template.render(**context)

        # Convert to PDF
        pdf_bytes = markdown_to_pdf(md_content, tmp)

    return md_content, pdf_bytes


def markdown_to_pdf(md_content: str, image_dir: Path) -> bytes:
    """Convert Markdown content to PDF bytes with embedded images.

    Args:
        md_content: Markdown string to convert.
        image_dir: Directory containing referenced images.

    Returns:
        PDF file as bytes.
    """
    # Convert Markdown to HTML
    html_body = markdown.markdown(
        md_content, extensions=["tables", "fenced_code"]
    )

    # Replace relative image paths with file:// URLs
    for img_name in ("curve.png", "comparison.png", "improvement.png"):
        img_path = image_dir / img_name
        if img_path.exists():
            file_url = f"file://{img_path}"
            html_body = html_body.replace(f'src="{img_name}"', f'src="{file_url}"')
            # Also handle markdown-generated img tags
            html_body = html_body.replace(
                f'alt="{img_name.replace(".png", "").replace("_", " ").title()}"',
                f'alt="{img_name}"',
            )

    full_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>{_PDF_CSS}</style>
</head>
<body>
{html_body}
</body>
</html>"""

    try:
        pdf_bytes = weasyprint.HTML(
            string=full_html, base_url=str(image_dir)
        ).write_pdf()
        return pdf_bytes
    except Exception as exc:
        logger.error("WeasyPrint PDF generation failed: %s", exc)
        # Return empty PDF on failure rather than crashing
        return b""


# ─── LLM Text Generation Helpers ─────────────────────────────────────────────


async def _generate_abstract(
    plan, run, summary: dict, language: str, session=None, user_id: str = ""
) -> str:
    """Generate experiment abstract via LLM."""
    improvement = summary.get("improvement_over_baseline", "N/A")
    if language == "zh":
        prompt = (
            f"根据以下实验结果为'{plan.title}'撰写简洁的摘要（200字以内）：\n"
            f"假设：{plan.hypothesis}\n"
            f"最佳指标：{run.best_metric_name}={run.best_metric_value}\n"
            f"基线值：{run.baseline_metric_value}\n"
            f"改进幅度：{improvement}%\n"
            f"总轮次：{summary.get('total_rounds', 0)}"
        )
    else:
        prompt = (
            f"Write a concise abstract (200 words) for experiment '{plan.title}':\n"
            f"Hypothesis: {plan.hypothesis}\n"
            f"Best metric: {run.best_metric_name}={run.best_metric_value}\n"
            f"Baseline: {run.baseline_metric_value}\n"
            f"Improvement: {improvement}%\n"
            f"Total rounds: {summary.get('total_rounds', 0)}"
        )

    return await _llm_generate(prompt, session, user_id, language)


async def _generate_conclusion(
    plan, run, summary: dict, language: str, session=None, user_id: str = ""
) -> str:
    """Generate experiment conclusion via LLM."""
    if language == "zh":
        prompt = (
            f"根据实验'{plan.title}'的结果撰写结论和下一步建议（150字以内）：\n"
            f"保留率：{summary.get('keep_rate', 0)}%\n"
            f"崩溃率：{summary.get('crash_rate', 0)}%\n"
            f"最佳指标：{run.best_metric_value}\n"
            f"基线改进：{summary.get('improvement_over_baseline', 'N/A')}%"
        )
    else:
        prompt = (
            f"Write a conclusion with next steps (150 words) for experiment '{plan.title}':\n"
            f"Keep rate: {summary.get('keep_rate', 0)}%\n"
            f"Crash rate: {summary.get('crash_rate', 0)}%\n"
            f"Best metric: {run.best_metric_value}\n"
            f"Improvement: {summary.get('improvement_over_baseline', 'N/A')}%"
        )

    return await _llm_generate(prompt, session, user_id, language)


async def _generate_ablation(
    plan, run, keep_rounds: list[dict], language: str, session=None, user_id: str = ""
) -> str:
    """Generate ablation analysis if enough data."""
    descriptions = "\n".join(
        f"- Round {r['round']}: {r.get('description', 'N/A')} (metric={r.get('metric_value', 'N/A')})"
        for r in keep_rounds[:10]
    )

    if language == "zh":
        prompt = (
            f"分析以下实验迭代中各变量的贡献（消融分析，200字以内）：\n{descriptions}"
        )
    else:
        prompt = (
            f"Provide an ablation analysis (200 words) of these experiment iterations:\n{descriptions}"
        )

    return await _llm_generate(prompt, session, user_id, language)


async def _llm_generate(
    prompt: str, session=None, user_id: str = "", language: str = "zh"
) -> str:
    """Call LLM with fallback on failure."""
    try:
        if session is not None:
            from app.services.llm_service import llm_completion

            response = await llm_completion(
                session=session,
                user_id=user_id,
                messages=[{"role": "user", "content": prompt}],
                model="claude-haiku-4-20250514",
                max_tokens=1024,
                request_type="experiment_report",
            )
            return response.content
    except Exception as exc:
        logger.warning("LLM generation failed: %s", exc)

    if language == "zh":
        return "自动生成失败，请手动撰写。"
    return "Auto-generation failed. Please write manually."
