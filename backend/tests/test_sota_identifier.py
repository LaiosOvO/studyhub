"""Tests for SOTA identification service (Phase 7).

Covers pure aggregation functions, HF Hub search (mocked),
and LLM-powered SOTA identification.
"""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas.plan import SOTAMethod, SOTAResult
from app.services.plan_generation.sota_identifier import (
    _format_best_metrics,
    _format_top_methods,
    aggregate_methods_by_metric,
    identify_sota,
    search_hf_benchmarks,
)


# ─── aggregate_methods_by_metric ────────────────────────────────────────────


def test_aggregate_methods_basic():
    """Groups methods by their metric names."""
    paper_analyses = {
        "p1": {
            "methods": ["CNN"],
            "key_metrics": {"accuracy": "92%", "f1": "0.89"},
        },
        "p2": {
            "methods": ["transformer"],
            "key_metrics": {"accuracy": "95%"},
        },
    }

    result = aggregate_methods_by_metric(paper_analyses)

    assert "accuracy" in result
    assert "f1" in result
    assert len(result["accuracy"]) == 2
    assert len(result["f1"]) == 1


def test_aggregate_methods_no_methods():
    """Papers without methods get 'unknown' method entries."""
    paper_analyses = {
        "p1": {"methods": [], "key_metrics": {"loss": "0.05"}},
    }

    result = aggregate_methods_by_metric(paper_analyses)

    assert result["loss"][0]["method"] == "unknown"


def test_aggregate_methods_empty():
    """Empty paper_analyses returns empty dict."""
    result = aggregate_methods_by_metric({})
    assert result == {}


def test_aggregate_methods_no_metrics():
    """Papers without key_metrics produce no entries."""
    paper_analyses = {
        "p1": {"methods": ["CNN"], "key_metrics": {}},
    }

    result = aggregate_methods_by_metric(paper_analyses)
    assert result == {}


def test_aggregate_methods_immutability():
    """Input dict is not mutated."""
    paper_analyses = {
        "p1": {"methods": ["CNN"], "key_metrics": {"acc": "90"}},
    }
    original = json.dumps(paper_analyses)

    aggregate_methods_by_metric(paper_analyses)

    assert json.dumps(paper_analyses) == original


# ─── _format_top_methods / _format_best_metrics ────────────────────────────


def test_format_top_methods():
    """Formats metric groups into readable text."""
    metric_groups = {
        "accuracy": [
            {"method": "CNN", "value": "92%", "paper_id": "p1234567890"},
        ],
    }
    result = _format_top_methods(metric_groups)
    assert "accuracy:" in result
    assert "CNN" in result


def test_format_top_methods_empty():
    """Returns fallback when no metric groups exist."""
    result = _format_top_methods({})
    assert result == "No methods with metrics found"


def test_format_best_metrics():
    """Formats best metrics per metric name."""
    metric_groups = {
        "accuracy": [
            {"method": "CNN", "value": "92%", "paper_id": "p1234567890"},
            {"method": "RNN", "value": "88%", "paper_id": "p2345678901"},
        ],
    }
    result = _format_best_metrics(metric_groups)
    assert "accuracy:" in result
    assert "best" in result


def test_format_best_metrics_empty():
    """Returns fallback when no metrics exist."""
    result = _format_best_metrics({})
    assert result == "No metric values found"


# ─── search_hf_benchmarks ──────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.services.plan_generation.sota_identifier.asyncio.to_thread")
async def test_search_hf_benchmarks_success(mock_to_thread):
    """Returns formatted benchmark string from HF Hub results."""
    mock_to_thread.return_value = [
        {
            "id": "glue",
            "downloads": 50000,
            "tags": ["nlp", "benchmark"],
            "license": "mit",
        },
    ]

    result = await search_hf_benchmarks("NLP transformers")

    assert "glue" in result
    assert "50000" in result


@pytest.mark.asyncio
@patch("app.services.plan_generation.sota_identifier.asyncio.to_thread")
async def test_search_hf_benchmarks_empty(mock_to_thread):
    """Returns fallback message when no results found."""
    mock_to_thread.return_value = []

    result = await search_hf_benchmarks("very obscure topic")

    assert result == "No external benchmarks available"


@pytest.mark.asyncio
@patch("app.services.plan_generation.sota_identifier.asyncio.to_thread")
async def test_search_hf_benchmarks_error(mock_to_thread):
    """Returns fallback message on HF Hub error."""
    mock_to_thread.side_effect = Exception("Network error")

    result = await search_hf_benchmarks("NLP")

    assert result == "No external benchmarks available"


# ─── identify_sota ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.services.plan_generation.sota_identifier.search_hf_benchmarks")
@patch("app.services.plan_generation.sota_identifier.llm_completion")
async def test_identify_sota_success(mock_llm, mock_hf):
    """identify_sota returns populated SOTAResult."""
    mock_hf.return_value = "- glue (downloads: 50000)"
    mock_llm.return_value = SimpleNamespace(content=json.dumps({
        "sota_methods": [
            {"method": "GPT-4", "metric": "accuracy", "value": "97%",
             "paper_title": "GPT-4 Technical Report", "confidence": "high"},
        ],
        "standard_baselines": [{"name": "BERT", "description": "Baseline"}],
        "evaluation_metrics": ["accuracy", "f1"],
        "benchmark_datasets": [{"name": "GLUE", "description": "NLU benchmark"}],
    }))

    task = SimpleNamespace(
        config={"paper_analyses": {"p1": {"methods": ["GPT"], "key_metrics": {"acc": "97%"}}}},
        research_direction="NLP transformers",
        user_id="user-1",
    )
    session = AsyncMock()

    result = await identify_sota(task, session)

    assert isinstance(result, SOTAResult)
    assert len(result.sota_methods) == 1
    assert result.sota_methods[0].method == "GPT-4"
    assert len(result.evaluation_metrics) == 2


@pytest.mark.asyncio
@patch("app.services.plan_generation.sota_identifier.search_hf_benchmarks")
@patch("app.services.plan_generation.sota_identifier.llm_completion")
async def test_identify_sota_llm_failure(mock_llm, mock_hf):
    """identify_sota returns empty SOTAResult on LLM failure."""
    mock_hf.return_value = "No benchmarks"
    mock_llm.side_effect = Exception("LLM down")

    task = SimpleNamespace(
        config={},
        research_direction="test",
        user_id="user-1",
    )
    session = AsyncMock()

    result = await identify_sota(task, session)

    assert isinstance(result, SOTAResult)
    assert result.sota_methods == []


@pytest.mark.asyncio
@patch("app.services.plan_generation.sota_identifier.search_hf_benchmarks")
@patch("app.services.plan_generation.sota_identifier.llm_completion")
async def test_identify_sota_empty_config(mock_llm, mock_hf):
    """identify_sota handles empty task config."""
    mock_hf.return_value = "No benchmarks"
    mock_llm.return_value = SimpleNamespace(content=json.dumps({
        "sota_methods": [],
        "standard_baselines": [],
        "evaluation_metrics": [],
        "benchmark_datasets": [],
    }))

    task = SimpleNamespace(
        config=None,
        research_direction="test",
        user_id="user-1",
    )
    session = AsyncMock()

    result = await identify_sota(task, session)

    assert isinstance(result, SOTAResult)
