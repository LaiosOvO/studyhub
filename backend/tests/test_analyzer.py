"""Tests for the tiered LLM analyzer (Phase 5).

Covers paper screening, deep analysis, tiered pipeline,
and relationship classification with mocked LLM calls.
"""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.deep_research.analyzer import (
    PaperAnalysis,
    RelationshipResult,
    classify_relationships,
    deep_analyze_paper,
    screen_paper,
    analyze_papers_tiered,
)


def _make_paper(**overrides):
    """Create a mock Paper object with sensible defaults."""
    defaults = {
        "id": "paper-001",
        "title": "Test Paper Title",
        "abstract": "This paper proposes a novel transformer approach.",
        "year": 2024,
        "venue": "NeurIPS",
        "authors": ["Author A", "Author B"],
        "quality_score": 0.8,
        "parsed_content": None,
        "sources": ["openalex"],
    }
    merged = {**defaults, **overrides}
    return SimpleNamespace(**merged)


def _mock_llm_response(content_dict: dict):
    """Create a mock LLMResponse with JSON content."""
    return SimpleNamespace(content=json.dumps(content_dict))


# ─── PaperAnalysis Model ───────────────────────────────────────────────────


def test_paper_analysis_defaults():
    """PaperAnalysis uses sensible defaults for missing fields."""
    analysis = PaperAnalysis(paper_id="p1")
    assert analysis.paper_id == "p1"
    assert analysis.tldr_en == ""
    assert analysis.methods == []
    assert analysis.paper_type == "unknown"
    assert analysis.detailed_methodology is None


def test_paper_analysis_full():
    """PaperAnalysis accepts all fields."""
    analysis = PaperAnalysis(
        paper_id="p2",
        tldr_en="A novel approach",
        tldr_zh="一种新方法",
        methods=["transformer", "attention"],
        datasets=["ImageNet"],
        key_metrics={"accuracy": "95%"},
        paper_type="empirical",
        detailed_methodology="We used...",
        key_contributions=["Contribution 1"],
        limitations=["Limitation 1"],
    )
    assert analysis.methods == ["transformer", "attention"]
    assert analysis.key_metrics == {"accuracy": "95%"}


# ─── screen_paper ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.services.deep_research.analyzer.llm_completion")
async def test_screen_paper_success(mock_llm):
    """screen_paper returns PaperAnalysis with parsed LLM response."""
    mock_llm.return_value = _mock_llm_response({
        "tldr_en": "A study on transformers",
        "tldr_zh": "关于变压器的研究",
        "methods": ["transformer"],
        "datasets": ["GLUE"],
        "key_metrics": {"accuracy": "92%"},
        "paper_type": "empirical",
    })

    paper = _make_paper()
    session = AsyncMock()

    result = await screen_paper(paper, session, "user-1")

    assert isinstance(result, PaperAnalysis)
    assert result.paper_id == "paper-001"
    assert result.tldr_en == "A study on transformers"
    assert result.methods == ["transformer"]
    assert result.paper_type == "empirical"


@pytest.mark.asyncio
@patch("app.services.deep_research.analyzer.llm_completion")
async def test_screen_paper_llm_failure(mock_llm):
    """screen_paper returns fallback PaperAnalysis on LLM error."""
    mock_llm.side_effect = Exception("LLM unavailable")

    paper = _make_paper()
    session = AsyncMock()

    result = await screen_paper(paper, session, "user-1")

    assert isinstance(result, PaperAnalysis)
    assert result.paper_id == "paper-001"
    assert result.paper_type == "unknown"
    assert result.tldr_en == ""


@pytest.mark.asyncio
@patch("app.services.deep_research.analyzer.llm_completion")
async def test_screen_paper_invalid_json(mock_llm):
    """screen_paper handles invalid JSON response gracefully."""
    mock_llm.return_value = SimpleNamespace(content="not json at all")

    paper = _make_paper()
    session = AsyncMock()

    result = await screen_paper(paper, session, "user-1")

    assert result.paper_type == "unknown"


# ─── deep_analyze_paper ───────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.services.deep_research.analyzer.llm_completion")
async def test_deep_analyze_paper_success(mock_llm):
    """deep_analyze_paper returns dict with methodology, contributions, limitations."""
    mock_llm.return_value = _mock_llm_response({
        "detailed_methodology": "We propose a two-stage...",
        "key_contributions": ["Novel architecture", "Better efficiency"],
        "limitations": ["Requires large dataset"],
    })

    paper = _make_paper(parsed_content={
        "sections": [{"heading": "Method", "text": "Our approach..."}]
    })
    session = AsyncMock()

    result = await deep_analyze_paper(paper, session, "user-1")

    assert result["detailed_methodology"] == "We propose a two-stage..."
    assert len(result["key_contributions"]) == 2


@pytest.mark.asyncio
@patch("app.services.deep_research.analyzer.llm_completion")
async def test_deep_analyze_paper_failure(mock_llm):
    """deep_analyze_paper returns empty dict on failure."""
    mock_llm.side_effect = Exception("timeout")

    paper = _make_paper()
    session = AsyncMock()

    result = await deep_analyze_paper(paper, session, "user-1")

    assert result == {}


@pytest.mark.asyncio
@patch("app.services.deep_research.analyzer.llm_completion")
async def test_deep_analyze_paper_no_parsed_content(mock_llm):
    """deep_analyze_paper falls back to abstract when no parsed content."""
    mock_llm.return_value = _mock_llm_response({
        "detailed_methodology": "Abstract-based analysis",
        "key_contributions": [],
        "limitations": [],
    })

    paper = _make_paper(parsed_content=None)
    session = AsyncMock()

    result = await deep_analyze_paper(paper, session, "user-1")

    assert "detailed_methodology" in result
    # Verify prompt was built (LLM was called)
    mock_llm.assert_called_once()


# ─── analyze_papers_tiered ─────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.services.deep_research.analyzer.deep_analyze_paper")
@patch("app.services.deep_research.analyzer.screen_paper")
async def test_analyze_papers_tiered_full_pipeline(mock_screen, mock_deep):
    """Tiered analysis screens all papers and deep-analyzes top-N."""
    mock_screen.return_value = PaperAnalysis(
        paper_id="p1", tldr_en="summary", methods=["CNN"], paper_type="empirical"
    )
    mock_deep.return_value = {
        "detailed_methodology": "Deep analysis result",
        "key_contributions": ["C1"],
        "limitations": ["L1"],
    }

    papers = [
        _make_paper(id="p1", quality_score=0.9, parsed_content={"sections": []}),
        _make_paper(id="p2", quality_score=0.5, parsed_content=None),
    ]
    session = AsyncMock()

    results = await analyze_papers_tiered(papers, session, "user-1", top_n=1)

    assert len(results) == 2
    assert mock_screen.call_count == 2
    # Only paper with parsed_content and top quality gets deep analysis
    assert mock_deep.call_count == 1


@pytest.mark.asyncio
@patch("app.services.deep_research.analyzer.screen_paper")
async def test_analyze_papers_tiered_cost_ceiling(mock_screen):
    """Tiered analysis respects cost ceiling."""
    mock_screen.return_value = PaperAnalysis(paper_id="px", paper_type="unknown")

    papers = [_make_paper(id=f"p{i}") for i in range(200)]
    session = AsyncMock()

    # Cost ceiling of $0.05 => 5 papers at $0.01 each
    results = await analyze_papers_tiered(
        papers, session, "user-1", top_n=0, cost_ceiling=0.05
    )

    assert len(results) == 5
    assert mock_screen.call_count == 5


@pytest.mark.asyncio
async def test_analyze_papers_tiered_empty_list():
    """Tiered analysis on empty list returns empty results."""
    session = AsyncMock()
    results = await analyze_papers_tiered([], session, "user-1")
    assert results == []


# ─── classify_relationships ────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.services.deep_research.analyzer.llm_completion")
async def test_classify_relationships_success(mock_llm):
    """classify_relationships returns typed RelationshipResult objects."""
    mock_llm.return_value = _mock_llm_response({
        "relationship": "improvement",
        "confidence": 0.85,
        "explanation": "Paper B improves on A's method",
    })

    paper_a = _make_paper(id="pa", abstract="Method A abstract")
    paper_b = _make_paper(id="pb", abstract="Method B abstract")
    session = AsyncMock()

    results = await classify_relationships(
        [(paper_a, paper_b)], session, "user-1"
    )

    assert len(results) == 1
    assert results[0].relationship == "improvement"
    assert results[0].confidence == 0.85
    assert results[0].paper_a_id == "pa"


@pytest.mark.asyncio
@patch("app.services.deep_research.analyzer.llm_completion")
async def test_classify_relationships_skips_no_abstract(mock_llm):
    """Pairs without abstracts are skipped."""
    paper_a = _make_paper(id="pa", abstract=None)
    paper_b = _make_paper(id="pb", abstract="Has abstract")
    session = AsyncMock()

    results = await classify_relationships(
        [(paper_a, paper_b)], session, "user-1"
    )

    assert len(results) == 0
    mock_llm.assert_not_called()


@pytest.mark.asyncio
@patch("app.services.deep_research.analyzer.llm_completion")
async def test_classify_relationships_llm_error(mock_llm):
    """LLM failure produces fallback RelationshipResult."""
    mock_llm.side_effect = Exception("timeout")

    paper_a = _make_paper(id="pa", abstract="Abstract A")
    paper_b = _make_paper(id="pb", abstract="Abstract B")
    session = AsyncMock()

    results = await classify_relationships(
        [(paper_a, paper_b)], session, "user-1"
    )

    assert len(results) == 1
    assert results[0].relationship == "unrelated"
    assert results[0].confidence == 0.0


def test_relationship_result_defaults():
    """RelationshipResult has sensible defaults."""
    result = RelationshipResult(paper_a_id="a", paper_b_id="b")
    assert result.relationship == "unrelated"
    assert result.confidence == 0.0
    assert result.explanation == ""
