"""Tests for the HuggingFace dataset recommender (Phase 7).

Covers keyword extraction, deduplication/ranking, and the
async recommend_datasets function with mocked HF Hub.
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.schemas.plan import DatasetRecommendation
from app.services.plan_generation.dataset_recommender import (
    deduplicate_and_rank,
    extract_search_keywords,
    recommend_datasets,
)


# ─── extract_search_keywords ──────────────────────────────────────────────


def test_extract_keywords_english():
    """Extracts meaningful keywords from English direction."""
    keywords = extract_search_keywords(
        "transformer-based approaches for natural language understanding"
    )
    assert len(keywords) <= 3
    assert all(isinstance(k, str) for k in keywords)
    # Stop words like "for", "based" should be filtered
    assert "for" not in keywords
    assert "based" not in keywords


def test_extract_keywords_chinese():
    """Extracts keywords from Chinese direction, filtering stop words."""
    keywords = extract_search_keywords("基于深度学习的图像分类研究")
    assert len(keywords) <= 3
    # Chinese stop words should be filtered
    assert "基于" not in keywords
    assert "研究" not in keywords


def test_extract_keywords_short_tokens_filtered():
    """Tokens shorter than 2 characters are filtered."""
    keywords = extract_search_keywords("a b c deep learning")
    assert "a" not in keywords
    assert "b" not in keywords


def test_extract_keywords_deduplication():
    """Duplicate tokens are deduplicated."""
    keywords = extract_search_keywords("transformer transformer attention")
    assert keywords.count("transformer") <= 1


def test_extract_keywords_sorted_by_length():
    """Keywords are sorted by length descending (more specific first)."""
    keywords = extract_search_keywords("NLP classification transformers")
    if len(keywords) >= 2:
        assert len(keywords[0]) >= len(keywords[1])


def test_extract_keywords_empty():
    """Empty direction returns empty list."""
    keywords = extract_search_keywords("")
    assert keywords == []


def test_extract_keywords_all_stop_words():
    """Direction with only stop words returns empty list."""
    keywords = extract_search_keywords("the is a of in for")
    assert keywords == []


def test_extract_keywords_max_three():
    """Returns at most 3 keywords."""
    keywords = extract_search_keywords(
        "transformer attention mechanism encoder decoder pretraining finetuning"
    )
    assert len(keywords) <= 3


# ─── deduplicate_and_rank ──────────────────────────────────────────────────


def test_deduplicate_basic():
    """Deduplicates by name and keeps highest download count."""
    recs = [
        DatasetRecommendation(name="ds1", url="u1", downloads=100),
        DatasetRecommendation(name="ds1", url="u1", downloads=200),  # duplicate
        DatasetRecommendation(name="ds2", url="u2", downloads=50),
    ]

    result = deduplicate_and_rank(recs, limit=10)

    assert len(result) == 2
    names = [r.name for r in result]
    assert "ds1" in names
    assert "ds2" in names


def test_deduplicate_sorted_by_downloads():
    """Results are sorted by downloads descending."""
    recs = [
        DatasetRecommendation(name="low", url="u", downloads=10),
        DatasetRecommendation(name="high", url="u", downloads=1000),
        DatasetRecommendation(name="mid", url="u", downloads=500),
    ]

    result = deduplicate_and_rank(recs, limit=10)

    assert result[0].name == "high"
    assert result[1].name == "mid"
    assert result[2].name == "low"


def test_deduplicate_respects_limit():
    """Result is capped at the specified limit."""
    recs = [
        DatasetRecommendation(name=f"ds{i}", url=f"u{i}", downloads=i)
        for i in range(10)
    ]

    result = deduplicate_and_rank(recs, limit=3)
    assert len(result) == 3


def test_deduplicate_empty():
    """Empty input returns empty result."""
    result = deduplicate_and_rank([], limit=5)
    assert result == []


# ─── recommend_datasets ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_recommend_datasets_own_data_returns_empty():
    """own_data strategy returns empty list (no HF search needed)."""
    result = await recommend_datasets(
        direction="NLP",
        plan_datasets=[],
        data_strategy="own_data",
    )
    assert result == []


@pytest.mark.asyncio
@patch("app.services.plan_generation.dataset_recommender._search_hf_datasets")
async def test_recommend_datasets_success(mock_search):
    """Returns deduplicated, ranked datasets from HF Hub."""
    mock_search.return_value = [
        DatasetRecommendation(name="glue", url="u1", downloads=50000),
        DatasetRecommendation(name="squad", url="u2", downloads=30000),
    ]

    result = await recommend_datasets(
        direction="NLP transformers",
        plan_datasets=["custom_ds"],
        data_strategy="open_source",
    )

    assert len(result) == 2
    assert result[0].name == "glue"  # Higher downloads first


@pytest.mark.asyncio
@patch("app.services.plan_generation.dataset_recommender._search_hf_datasets")
async def test_recommend_datasets_hf_error(mock_search):
    """Returns empty list on HF Hub error."""
    mock_search.side_effect = Exception("Network error")

    result = await recommend_datasets(
        direction="NLP",
        plan_datasets=[],
        data_strategy="open_source",
    )

    assert result == []


@pytest.mark.asyncio
@patch("app.services.plan_generation.dataset_recommender._search_hf_datasets")
async def test_recommend_datasets_includes_plan_keywords(mock_search):
    """Plan dataset names are included as search terms."""
    mock_search.return_value = []

    await recommend_datasets(
        direction="NLP",
        plan_datasets=["custom_dataset"],
        data_strategy="hybrid",
    )

    # Verify keywords passed to _search_hf_datasets include plan dataset names
    call_args = mock_search.call_args
    keywords = call_args[0][0]  # First positional arg
    assert "custom_dataset" in keywords


@pytest.mark.asyncio
@patch("app.services.plan_generation.dataset_recommender._search_hf_datasets")
async def test_recommend_datasets_limit(mock_search):
    """Respects the limit parameter."""
    mock_search.return_value = [
        DatasetRecommendation(name=f"ds{i}", url=f"u{i}", downloads=1000 - i)
        for i in range(20)
    ]

    result = await recommend_datasets(
        direction="NLP",
        plan_datasets=[],
        data_strategy="open_source",
        limit=5,
    )

    assert len(result) <= 5
