"""Tests for need-to-profile matching scorer.

Covers score_need_match, score_direction_match, and
compute_need_relevance. Pure functions with TF-IDF and fuzzy matching.
"""

import pytest
from unittest.mock import MagicMock

from app.services.community.need_matcher import (
    compute_need_relevance,
    score_direction_match,
    score_need_match,
)


# ─── score_need_match ───────────────────────────────────────────────────────


def test_score_need_match_identical():
    """Identical skills produce high similarity."""
    skills = ["deep learning", "NLP", "transformer"]
    score = score_need_match(skills, skills)
    assert score > 0.9


def test_score_need_match_partial_overlap():
    """Partial overlap produces moderate score."""
    viewer = ["deep learning", "NLP", "transformer"]
    need = ["deep learning", "computer vision"]
    score = score_need_match(viewer, need)
    assert 0.0 < score < 1.0


def test_score_need_match_no_overlap():
    """No shared terms produce low score."""
    viewer = ["biology", "genetics"]
    need = ["philosophy", "ethics"]
    score = score_need_match(viewer, need)
    assert score < 0.3


def test_score_need_match_empty_viewer():
    """Empty viewer expertise returns 0."""
    assert score_need_match([], ["NLP"]) == 0.0


def test_score_need_match_empty_need():
    """Empty need skills returns 0."""
    assert score_need_match(["NLP"], []) == 0.0


def test_score_need_match_both_empty():
    """Both empty returns 0."""
    assert score_need_match([], []) == 0.0


# ─── score_direction_match ──────────────────────────────────────────────────


def test_direction_match_exact():
    """Exact match returns 1.0."""
    score = score_direction_match(["NLP", "Computer Vision"], "NLP")
    assert score == 1.0


def test_direction_match_case_insensitive():
    """Matching is case-insensitive."""
    score = score_direction_match(["natural language processing"], "Natural Language Processing")
    assert score == 1.0


def test_direction_match_no_match():
    """No matching direction returns 0.0."""
    score = score_direction_match(["NLP"], "Robotics")
    assert score == 0.0


def test_direction_match_none_direction():
    """None need_direction returns 0.0."""
    assert score_direction_match(["NLP"], None) == 0.0


def test_direction_match_empty_viewer():
    """Empty viewer directions returns 0.0."""
    assert score_direction_match([], "NLP") == 0.0


# ─── compute_need_relevance ────────────────────────────────────────────────


def test_need_relevance_weighted():
    """Overall score is 70% skill + 30% direction."""
    viewer = MagicMock()
    viewer.expertise_tags = ["NLP", "deep learning"]
    viewer.research_directions = ["NLP"]

    need = MagicMock()
    need.required_skills = ["NLP", "deep learning"]
    need.research_direction = "NLP"

    score = compute_need_relevance(viewer, need)
    assert 0.0 <= score <= 1.0
    # Should be relatively high since skills and direction match
    assert score > 0.5


def test_need_relevance_no_skills():
    """Returns low score when no expertise matches."""
    viewer = MagicMock()
    viewer.expertise_tags = []
    viewer.research_directions = []

    need = MagicMock()
    need.required_skills = ["NLP"]
    need.research_direction = "NLP"

    score = compute_need_relevance(viewer, need)
    assert score == 0.0


def test_need_relevance_direction_only():
    """Direction match contributes 30% even without skill match."""
    viewer = MagicMock()
    viewer.expertise_tags = ["biology"]
    viewer.research_directions = ["NLP"]

    need = MagicMock()
    need.required_skills = ["deep learning"]
    need.research_direction = "NLP"

    score = compute_need_relevance(viewer, need)
    # Skill match ~0 but direction match = 1.0, so score ~ 0.3
    assert score >= 0.2
