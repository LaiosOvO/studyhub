"""Tests for experiment report generator.

Covers markdown_to_pdf and generate_experiment_report.
LLM and WeasyPrint calls are mocked.

Note: weasyprint requires system-level libs (gobject/pango).
We mock the weasyprint module before importing the service.
"""

import sys
from unittest.mock import AsyncMock, MagicMock, patch

# Mock weasyprint before importing the module (requires system libs)
_mock_weasyprint = MagicMock()
sys.modules.setdefault("weasyprint", _mock_weasyprint)

import pytest
from pathlib import Path

from app.services.experiment.report_generator import (
    markdown_to_pdf,
    _llm_generate,
)


# ─── markdown_to_pdf ────────────────────────────────────────────────────────


def test_markdown_to_pdf_returns_bytes(tmp_path: Path):
    """Converts markdown to PDF bytes."""
    md = "# Test Report\n\nHello world."
    with patch("app.services.experiment.report_generator.weasyprint") as mock_wp:
        mock_wp.HTML.return_value.write_pdf.return_value = b"%PDF-1.4 fake"
        result = markdown_to_pdf(md, tmp_path)
    assert isinstance(result, bytes)
    assert len(result) > 0


def test_markdown_to_pdf_with_tables(tmp_path: Path):
    """Handles markdown tables correctly."""
    md = "| Col1 | Col2 |\n|------|------|\n| A | B |"
    with patch("app.services.experiment.report_generator.weasyprint") as mock_wp:
        mock_wp.HTML.return_value.write_pdf.return_value = b"%PDF"
        result = markdown_to_pdf(md, tmp_path)
    assert isinstance(result, bytes)


def test_markdown_to_pdf_weasyprint_failure(tmp_path: Path):
    """Returns empty bytes on WeasyPrint failure."""
    md = "# Broken"
    with patch("app.services.experiment.report_generator.weasyprint") as mock_wp:
        mock_wp.HTML.return_value.write_pdf.side_effect = Exception("rendering failed")
        result = markdown_to_pdf(md, tmp_path)
    assert result == b""


def test_markdown_to_pdf_image_replacement(tmp_path: Path):
    """Replaces image src paths with file:// URLs."""
    # Create a fake image
    (tmp_path / "curve.png").write_bytes(b"PNG")
    md = '![Training Curve](curve.png)'

    with patch("app.services.experiment.report_generator.weasyprint") as mock_wp:
        mock_wp.HTML.return_value.write_pdf.return_value = b"%PDF"
        markdown_to_pdf(md, tmp_path)
        # Verify HTML was created (weasyprint.HTML was called)
        mock_wp.HTML.assert_called_once()


# ─── _llm_generate ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_llm_generate_with_session():
    """Returns LLM response content when session provided."""
    mock_session = MagicMock()
    mock_response = MagicMock()
    mock_response.content = "Generated abstract text"

    with patch(
        "app.services.llm_service.llm_completion",
        new_callable=AsyncMock,
        return_value=mock_response,
    ):
        result = await _llm_generate("test prompt", mock_session, "user-1", "en")

    assert result == "Generated abstract text"


@pytest.mark.asyncio
async def test_llm_generate_fallback_on_error():
    """Returns fallback message on LLM failure."""
    mock_session = MagicMock()

    with patch(
        "app.services.llm_service.llm_completion",
        new_callable=AsyncMock,
        side_effect=Exception("API error"),
    ):
        result = await _llm_generate("prompt", mock_session, "user-1", "en")

    assert "manually" in result.lower()


@pytest.mark.asyncio
async def test_llm_generate_fallback_chinese():
    """Returns Chinese fallback when language is zh."""
    result = await _llm_generate("prompt", session=None, language="zh")
    assert "手动" in result


@pytest.mark.asyncio
async def test_llm_generate_no_session():
    """Returns fallback when no session provided."""
    result = await _llm_generate("prompt", session=None, language="en")
    assert "manually" in result.lower()


# ─── generate_experiment_report (integration-level) ─────────────────────────


@pytest.mark.asyncio
async def test_generate_experiment_report_structure():
    """Returns (markdown_string, pdf_bytes) tuple."""
    from app.services.experiment.report_generator import generate_experiment_report

    mock_run = MagicMock()
    mock_run.rounds = [
        {"round": 0, "status": "baseline", "metric_value": 1.0},
        {"round": 1, "status": "keep", "metric_value": 0.8},
    ]
    mock_run.best_metric_name = "val_loss"
    mock_run.best_metric_value = 0.8
    mock_run.baseline_metric_value = 1.0
    mock_run.status = "completed"

    mock_plan = MagicMock()
    mock_plan.title = "Test Experiment"
    mock_plan.hypothesis = "Hypothesis A"
    mock_plan.method_description = "Method B"
    mock_plan.baselines = []

    with (
        patch(
            "app.services.experiment.report_generator._llm_generate",
            new_callable=AsyncMock,
            return_value="Generated text",
        ),
        patch(
            "app.services.experiment.report_generator.weasyprint"
        ) as mock_wp,
        patch(
            "app.services.experiment.report_generator.Environment"
        ) as mock_env,
    ):
        mock_wp.HTML.return_value.write_pdf.return_value = b"%PDF-fake"
        mock_template = MagicMock()
        mock_template.render.return_value = "# Report\nContent"
        mock_env.return_value.get_template.return_value = mock_template

        md_content, pdf_bytes = await generate_experiment_report(
            mock_run, mock_plan, language="en"
        )

    assert isinstance(md_content, str)
    assert isinstance(pdf_bytes, bytes)
