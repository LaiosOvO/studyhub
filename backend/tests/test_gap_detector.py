"""Tests for the gap detector and trend analysis (Phase 5).

Covers pure corpus summarization functions and LLM-powered
gap/trend detection with mocked LLM calls.
"""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.services.deep_research.analyzer import PaperAnalysis
from app.services.deep_research.gap_detector import (
    GapItem,
    GapResult,
    MissingEvalItem,
    TrendItem,
    TrendResult,
    UnexploredItem,
    build_corpus_summary,
    build_method_frequencies,
    detect_gaps,
    detect_trends,
)


def _make_analysis(**overrides):
    """Create a PaperAnalysis with sensible defaults."""
    defaults = {
        "paper_id": "p1",
        "tldr_en": "Summary",
        "methods": ["transformer"],
        "datasets": ["GLUE"],
        "key_metrics": {"accuracy": "92%"},
        "paper_type": "empirical",
    }
    return PaperAnalysis(**{**defaults, **overrides})


def _make_paper(**overrides):
    """Create a mock Paper object."""
    defaults = {"id": "p1", "year": 2024, "title": "Test", "abstract": "Abstract"}
    return SimpleNamespace(**{**defaults, **overrides})


# ─── Result Models ──────────────────────────────────────────────────────────


def test_gap_item_defaults():
    """GapItem uses sensible defaults."""
    item = GapItem()
    assert item.description == ""
    assert item.potential_impact == "medium"


def test_gap_result_empty():
    """Empty GapResult is valid."""
    result = GapResult()
    assert result.gaps == []
    assert result.underexplored == []
    assert result.missing_evaluations == []


def test_trend_result_empty():
    """Empty TrendResult is valid."""
    result = TrendResult()
    assert result.ascending_methods == []
    assert result.declining_methods == []
    assert result.emerging_topics == []
    assert result.stable_methods == []


# ─── build_corpus_summary ──────────────────────────────────────────────────


def test_build_corpus_summary_basic():
    """Corpus summary includes paper count, methods, datasets."""
    analyses = [
        _make_analysis(paper_id="p1", methods=["CNN", "RNN"], datasets=["ImageNet"]),
        _make_analysis(paper_id="p2", methods=["CNN"], datasets=["COCO"]),
    ]

    summary = build_corpus_summary(analyses)

    assert "Total papers analyzed: 2" in summary
    assert "CNN" in summary
    assert "ImageNet" in summary


def test_build_corpus_summary_empty():
    """Empty analysis list produces minimal summary."""
    summary = build_corpus_summary([])
    assert "Total papers analyzed: 0" in summary


def test_build_corpus_summary_truncation():
    """Summary is truncated to 3000 characters."""
    # Generate many analyses to exceed 3000 chars
    analyses = [
        _make_analysis(
            paper_id=f"p{i}",
            methods=[f"method_with_long_name_{i}_{j}" for j in range(10)],
        )
        for i in range(50)
    ]

    summary = build_corpus_summary(analyses)
    assert len(summary) <= 3000


def test_build_corpus_summary_paper_types():
    """Summary includes paper type distribution."""
    analyses = [
        _make_analysis(paper_id="p1", paper_type="empirical"),
        _make_analysis(paper_id="p2", paper_type="survey"),
        _make_analysis(paper_id="p3", paper_type="empirical"),
    ]

    summary = build_corpus_summary(analyses)

    assert "empirical" in summary
    assert "survey" in summary


# ─── build_method_frequencies ──────────────────────────────────────────────


def test_build_method_frequencies_basic():
    """Method frequencies group by year correctly."""
    analyses = [
        _make_analysis(paper_id="p1", methods=["CNN"]),
        _make_analysis(paper_id="p2", methods=["transformer"]),
    ]
    papers = [
        _make_paper(id="p1", year=2023),
        _make_paper(id="p2", year=2024),
    ]

    result = build_method_frequencies(analyses, papers)

    assert "2023" in result
    assert "CNN" in result
    assert "2024" in result
    assert "transformer" in result


def test_build_method_frequencies_no_years():
    """Returns fallback when no papers have year data."""
    analyses = [_make_analysis(paper_id="p1", methods=["CNN"])]
    papers = [_make_paper(id="p1", year=None)]

    result = build_method_frequencies(analyses, papers)

    assert result == "No temporal data available"


def test_build_method_frequencies_no_methods():
    """Papers with no methods produce no year entries."""
    analyses = [_make_analysis(paper_id="p1", methods=[])]
    papers = [_make_paper(id="p1", year=2024)]

    result = build_method_frequencies(analyses, papers)

    assert result == "No temporal data available"


# ─── detect_gaps ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.services.deep_research.gap_detector.llm_completion")
async def test_detect_gaps_success(mock_llm):
    """detect_gaps returns populated GapResult from LLM response."""
    mock_llm.return_value = SimpleNamespace(content=json.dumps({
        "gaps": [
            {"description": "Lack of multimodal approaches", "evidence": "Only 2/50 papers", "potential_impact": "high"},
        ],
        "underexplored": [
            {"combination": "transformer + graph neural network", "why_promising": "Complementary strengths"},
        ],
        "missing_evaluations": [
            {"method": "BERT", "missing": "SQuAD v2 evaluation"},
        ],
    }))

    analyses = [_make_analysis()]
    papers = [_make_paper()]
    session = AsyncMock()

    result = await detect_gaps(analyses, papers, "NLP transformers", session, "user-1")

    assert isinstance(result, GapResult)
    assert len(result.gaps) == 1
    assert result.gaps[0].potential_impact == "high"
    assert len(result.underexplored) == 1
    assert len(result.missing_evaluations) == 1


@pytest.mark.asyncio
@patch("app.services.deep_research.gap_detector.llm_completion")
async def test_detect_gaps_llm_failure(mock_llm):
    """detect_gaps returns empty GapResult on LLM failure."""
    mock_llm.side_effect = Exception("LLM down")

    analyses = [_make_analysis()]
    papers = [_make_paper()]
    session = AsyncMock()

    result = await detect_gaps(analyses, papers, "NLP", session, "user-1")

    assert isinstance(result, GapResult)
    assert result.gaps == []


# ─── detect_trends ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.services.deep_research.gap_detector.llm_completion")
async def test_detect_trends_success(mock_llm):
    """detect_trends returns TrendResult with ascending/declining methods."""
    mock_llm.return_value = SimpleNamespace(content=json.dumps({
        "ascending_methods": [{"method": "transformer", "evidence": "Growing from 2 to 20 papers"}],
        "declining_methods": [{"method": "LSTM", "evidence": "Declined from 15 to 3"}],
        "emerging_topics": [{"topic": "SSM", "evidence": "First appeared 2024"}],
        "stable_methods": [{"method": "CNN", "evidence": "Consistent 10 papers/year"}],
    }))

    analyses = [_make_analysis(paper_id="p1", methods=["transformer"])]
    papers = [_make_paper(id="p1", year=2024)]
    session = AsyncMock()

    result = await detect_trends(analyses, papers, "ML", session, "user-1")

    assert isinstance(result, TrendResult)
    assert len(result.ascending_methods) == 1
    assert result.ascending_methods[0].method == "transformer"
    assert len(result.declining_methods) == 1
    assert len(result.emerging_topics) == 1


@pytest.mark.asyncio
async def test_detect_trends_no_temporal_data():
    """detect_trends returns empty TrendResult when no temporal data exists."""
    analyses = [_make_analysis(paper_id="p1", methods=["CNN"])]
    papers = [_make_paper(id="p1", year=None)]
    session = AsyncMock()

    result = await detect_trends(analyses, papers, "ML", session, "user-1")

    assert isinstance(result, TrendResult)
    assert result.ascending_methods == []


@pytest.mark.asyncio
@patch("app.services.deep_research.gap_detector.llm_completion")
async def test_detect_trends_llm_failure(mock_llm):
    """detect_trends returns empty TrendResult on LLM failure."""
    mock_llm.side_effect = Exception("timeout")

    analyses = [_make_analysis(paper_id="p1", methods=["CNN"])]
    papers = [_make_paper(id="p1", year=2024)]
    session = AsyncMock()

    result = await detect_trends(analyses, papers, "ML", session, "user-1")

    assert isinstance(result, TrendResult)
    assert result.ascending_methods == []
