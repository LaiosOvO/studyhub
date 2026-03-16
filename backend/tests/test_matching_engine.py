"""Tests for community matching engine.

Covers complementarity, adjacency, institutional proximity,
co-citation, and overall match scoring.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.community.matching_engine import (
    MATCH_WEIGHTS,
    compute_adjacency,
    compute_co_citation,
    compute_complementarity,
    compute_institutional_proximity,
    compute_match_score,
    find_matches,
)


# ─── compute_complementarity ───────────────────────────────────────────────


def test_complementarity_identical_keywords():
    """Identical keywords produce low complementarity (too similar)."""
    kw = ["deep learning", "NLP", "transformer"]
    score = compute_complementarity(kw, kw)
    # Similarity ~1.0, bell curve peaks at 0.35, so score should be low
    assert score < 0.5


def test_complementarity_moderate_overlap():
    """Moderate keyword overlap produces high complementarity."""
    kw_a = ["deep learning", "computer vision", "image segmentation"]
    kw_b = ["deep learning", "NLP", "text generation", "transformer"]
    score = compute_complementarity(kw_a, kw_b)
    assert 0.0 <= score <= 1.0


def test_complementarity_no_overlap():
    """No keyword overlap produces moderate score."""
    kw_a = ["biology", "genetics", "genomics"]
    kw_b = ["philosophy", "ethics", "epistemology"]
    score = compute_complementarity(kw_a, kw_b)
    assert 0.0 <= score <= 1.0


def test_complementarity_empty_keywords():
    """Empty keywords return neutral fallback (0.3)."""
    assert compute_complementarity([], ["deep learning"]) == 0.3
    assert compute_complementarity(["NLP"], []) == 0.3
    assert compute_complementarity([], []) == 0.3


# ─── compute_adjacency ─────────────────────────────────────────────────────


def test_adjacency_identical_directions():
    """Full overlap gives lower score (peaks at ~30%)."""
    dirs = ["NLP", "Computer Vision"]
    score = compute_adjacency(dirs, dirs)
    # Jaccard = 1.0, score = 1.0 - |1.0 - 0.3| / 0.7 = 1.0 - 1.0 = 0.0
    assert score == pytest.approx(0.0)


def test_adjacency_partial_overlap():
    """Partial overlap (~30%) gives highest score."""
    dirs_a = ["NLP", "ML", "Deep Learning"]
    dirs_b = ["NLP", "Robotics", "Signal Processing", "Control"]
    # Jaccard = 1/6 ~= 0.17
    score = compute_adjacency(dirs_a, dirs_b)
    assert 0.0 <= score <= 1.0


def test_adjacency_no_overlap():
    """No overlap has some penalty."""
    score = compute_adjacency(["NLP"], ["Robotics"])
    # Jaccard = 0, score = 1 - |0 - 0.3|/0.7 = 1 - 0.43 = 0.57
    assert score == pytest.approx(1.0 - 0.3 / 0.7, abs=0.01)


def test_adjacency_empty_lists():
    """Empty lists return 0."""
    assert compute_adjacency([], ["NLP"]) == 0.0
    assert compute_adjacency(["NLP"], []) == 0.0


def test_adjacency_case_insensitive():
    """Direction matching is case-insensitive."""
    score = compute_adjacency(["NLP", "ML"], ["nlp", "ml"])
    # Full overlap
    assert score == pytest.approx(0.0)


# ─── compute_institutional_proximity ────────────────────────────────────────


def test_institutional_same_institution():
    """Same institution returns 1.0."""
    assert compute_institutional_proximity("MIT", "MIT") == 1.0


def test_institutional_case_insensitive():
    """Matching is case insensitive."""
    assert compute_institutional_proximity("mit", "MIT") == 1.0


def test_institutional_none():
    """None institution returns 0.0."""
    assert compute_institutional_proximity(None, "MIT") == 0.0
    assert compute_institutional_proximity("MIT", None) == 0.0


def test_institutional_empty():
    """Empty strings return 0.0."""
    assert compute_institutional_proximity("", "MIT") == 0.0


def test_institutional_different():
    """Different institutions return low score."""
    score = compute_institutional_proximity("MIT", "Stanford")
    assert 0.0 <= score < 1.0


# ─── compute_co_citation ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_co_citation_no_client():
    """Returns 0.0 when neo4j_client is None."""
    score = await compute_co_citation(["doi1"], ["doi2"], None)
    assert score == 0.0


@pytest.mark.asyncio
async def test_co_citation_empty_papers():
    """Returns 0.0 when paper lists are empty."""
    score = await compute_co_citation([], ["doi1"], MagicMock())
    assert score == 0.0


@pytest.mark.asyncio
async def test_co_citation_with_overlap():
    """Returns capped score based on shared citation neighbors."""
    mock_client = AsyncMock()
    mock_client.execute_read.return_value = [{"overlap": 5}]
    score = await compute_co_citation(["doi1"], ["doi2"], mock_client)
    assert score == pytest.approx(0.5)  # 5/10


@pytest.mark.asyncio
async def test_co_citation_capped_at_one():
    """Score is capped at 1.0."""
    mock_client = AsyncMock()
    mock_client.execute_read.return_value = [{"overlap": 15}]
    score = await compute_co_citation(["doi1"], ["doi2"], mock_client)
    assert score == 1.0


@pytest.mark.asyncio
async def test_co_citation_query_failure():
    """Returns 0.0 on Neo4j query failure."""
    mock_client = AsyncMock()
    mock_client.execute_read.side_effect = Exception("Neo4j down")
    score = await compute_co_citation(["doi1"], ["doi2"], mock_client)
    assert score == 0.0


# ─── compute_match_score ───────────────────────────────────────────────────


def test_match_score_all_ones():
    """All signals at 1.0 should give total weight sum."""
    signals = {k: 1.0 for k in MATCH_WEIGHTS}
    score = compute_match_score(signals)
    assert score == pytest.approx(1.0)


def test_match_score_all_zeros():
    """All signals at 0.0 gives 0."""
    signals = {k: 0.0 for k in MATCH_WEIGHTS}
    assert compute_match_score(signals) == 0.0


def test_match_score_partial():
    """Correctly applies weights."""
    signals = {"complementarity": 0.5, "co_citation": 0.0, "adjacency": 1.0, "institutional": 0.0}
    expected = 0.5 * 0.40 + 0.0 * 0.25 + 1.0 * 0.20 + 0.0 * 0.15
    assert compute_match_score(signals) == pytest.approx(expected)


# ─── find_matches ───────────────────────────────────────────────────────────


def _make_profile(
    user_id: str,
    expertise: list[str] | None = None,
    keywords: list[str] | None = None,
    directions: list[str] | None = None,
    institution: str | None = None,
    publications: list[dict] | None = None,
):
    p = MagicMock()
    p.id = f"profile-{user_id}"
    p.user_id = user_id
    p.expertise_tags = expertise or []
    p.research_keywords = keywords or []
    p.research_directions = directions or []
    p.institution = institution
    p.publications = publications or []
    return p


@pytest.mark.asyncio
async def test_find_matches_excludes_self():
    """Does not match a profile against itself."""
    profile = _make_profile("user-1", expertise=["NLP"])
    candidates = [profile]
    matches = await find_matches(profile, candidates)
    assert len(matches) == 0


@pytest.mark.asyncio
async def test_find_matches_returns_sorted():
    """Results are sorted by overall_score descending."""
    profile = _make_profile("user-1", expertise=["NLP", "deep learning"])
    cand1 = _make_profile("user-2", expertise=["NLP"])
    cand2 = _make_profile("user-3", expertise=["robotics", "control theory"])
    matches = await find_matches(profile, [cand1, cand2])
    assert len(matches) == 2
    assert matches[0]["overall_score"] >= matches[1]["overall_score"]


@pytest.mark.asyncio
async def test_find_matches_top_n():
    """Limits results to top_n."""
    profile = _make_profile("user-1", expertise=["ML"])
    candidates = [_make_profile(f"user-{i}", expertise=["ML"]) for i in range(10)]
    matches = await find_matches(profile, candidates, top_n=3)
    assert len(matches) == 3


@pytest.mark.asyncio
async def test_find_matches_result_structure():
    """Each match has expected fields."""
    profile = _make_profile("user-1", expertise=["NLP"])
    cand = _make_profile("user-2", expertise=["ML"])
    matches = await find_matches(profile, [cand])
    assert len(matches) == 1
    assert "profile_id" in matches[0]
    assert "overall_score" in matches[0]
    assert "breakdown" in matches[0]
    assert "complementarity" in matches[0]["breakdown"]
