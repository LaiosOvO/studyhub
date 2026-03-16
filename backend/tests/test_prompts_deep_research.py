"""Tests for Deep Research LLM prompt builders (Phase 5).

Verifies prompt structure, XML tag safety, truncation behavior,
and correct OpenAI message format.
"""

import pytest

from app.services.deep_research.prompts import (
    build_deep_analysis_prompt,
    build_gap_detection_prompt,
    build_relationship_prompt,
    build_tldr_prompt,
    build_trend_interpretation_prompt,
)


# ─── build_tldr_prompt ─────────────────────────────────────────────────────


def test_tldr_prompt_structure():
    """TLDR prompt returns a single user message with XML-tagged paper content."""
    messages = build_tldr_prompt(
        title="Attention Is All You Need",
        abstract="We propose the Transformer architecture...",
        year=2017,
        venue="NeurIPS",
    )

    assert len(messages) == 1
    assert messages[0]["role"] == "user"
    assert "<title>Attention Is All You Need</title>" in messages[0]["content"]
    assert "<year>2017</year>" in messages[0]["content"]
    assert "JSON" in messages[0]["content"]


def test_tldr_prompt_truncates_abstract():
    """Abstract is truncated to 1000 characters."""
    long_abstract = "x" * 2000
    messages = build_tldr_prompt(
        title="Title",
        abstract=long_abstract,
        year=2024,
        venue=None,
    )

    content = messages[0]["content"]
    # The truncated abstract should be 1000 chars
    assert "x" * 1001 not in content


def test_tldr_prompt_null_fields():
    """Handles None abstract, year, venue gracefully."""
    messages = build_tldr_prompt(
        title="Title",
        abstract=None,
        year=None,
        venue=None,
    )

    content = messages[0]["content"]
    assert "<year>unknown</year>" in content
    assert "<venue>unknown</venue>" in content


# ─── build_deep_analysis_prompt ────────────────────────────────────────────


def test_deep_analysis_prompt_with_parsed_content():
    """Deep analysis prompt includes parsed content when available."""
    messages = build_deep_analysis_prompt(
        title="Test Paper",
        abstract="Abstract text",
        parsed_content="Full parsed text here",
    )

    assert len(messages) == 1
    content = messages[0]["content"]
    assert "Full parsed text here" in content


def test_deep_analysis_prompt_fallback_to_abstract():
    """Falls back to abstract when parsed content is None."""
    messages = build_deep_analysis_prompt(
        title="Test Paper",
        abstract="Abstract only",
        parsed_content=None,
    )

    content = messages[0]["content"]
    assert "Abstract only" in content


def test_deep_analysis_prompt_truncation():
    """Content is truncated to 4000 characters."""
    long_content = "a" * 5000
    messages = build_deep_analysis_prompt(
        title="Title",
        abstract=None,
        parsed_content=long_content,
    )

    content = messages[0]["content"]
    assert "a" * 4001 not in content


# ─── build_relationship_prompt ─────────────────────────────────────────────


def test_relationship_prompt_structure():
    """Relationship prompt uses XML tags for both papers."""
    messages = build_relationship_prompt(
        title_a="Paper A",
        abstract_a="Abstract A",
        title_b="Paper B",
        abstract_b="Abstract B",
    )

    content = messages[0]["content"]
    assert "<paper_a>" in content
    assert "<paper_b>" in content
    assert "improvement" in content  # Lists relationship types
    assert "JSON" in content


def test_relationship_prompt_truncates_abstracts():
    """Both abstracts are truncated to 500 characters."""
    long_abstract = "y" * 1000
    messages = build_relationship_prompt(
        title_a="A",
        abstract_a=long_abstract,
        title_b="B",
        abstract_b=long_abstract,
    )

    content = messages[0]["content"]
    assert "y" * 501 not in content


# ─── build_gap_detection_prompt ────────────────────────────────────────────


def test_gap_detection_prompt_includes_context():
    """Gap detection prompt contains direction, summary, and frequencies."""
    messages = build_gap_detection_prompt(
        direction="graph neural networks",
        paper_count=42,
        corpus_summary="Methods: GCN (10), GAT (8)",
        method_frequencies="2023: GCN (5)\n2024: GAT (8)",
    )

    content = messages[0]["content"]
    assert "graph neural networks" in content
    assert "42" in content
    assert "GCN" in content
    assert "JSON" in content


# ─── build_trend_interpretation_prompt ─────────────────────────────────────


def test_trend_prompt_includes_counts():
    """Trend prompt includes method-year counts and direction."""
    messages = build_trend_interpretation_prompt(
        direction="computer vision",
        method_year_counts="2022: ResNet (5)\n2023: ViT (10)",
    )

    content = messages[0]["content"]
    assert "computer vision" in content
    assert "ResNet" in content
    assert "ViT" in content
