"""Need-to-profile matching scorer.

Scores how well a viewer's expertise matches a research need's
required skills and research direction.
"""

import logging

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)


def score_need_match(
    viewer_expertise: list[str], need_required_skills: list[str]
) -> float:
    """Score how well viewer's expertise matches the need's required skills.

    Uses TF-IDF cosine similarity (high similarity = good match for needs,
    unlike complementarity matching which prefers moderate overlap).

    Returns float 0-1.
    """
    if not viewer_expertise or not need_required_skills:
        return 0.0

    doc_viewer = " ".join(viewer_expertise)
    doc_need = " ".join(need_required_skills)

    try:
        vectorizer = TfidfVectorizer()
        tfidf_matrix = vectorizer.fit_transform([doc_viewer, doc_need])
        return float(cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0])
    except ValueError:
        return 0.0


def score_direction_match(
    viewer_directions: list[str], need_direction: str | None
) -> float:
    """Score whether viewer's research directions match the need's direction.

    Uses fuzzy matching (rapidfuzz ratio >= 70).

    Returns 1.0 if match found, 0.0 otherwise.
    """
    if not need_direction or not viewer_directions:
        return 0.0

    try:
        from rapidfuzz import fuzz

        need_lower = need_direction.lower().strip()
        for direction in viewer_directions:
            if fuzz.ratio(direction.lower().strip(), need_lower) >= 70:
                return 1.0
        return 0.0
    except ImportError:
        # Fallback: exact containment check
        need_lower = need_direction.lower().strip()
        for direction in viewer_directions:
            if need_lower in direction.lower() or direction.lower() in need_lower:
                return 1.0
        return 0.0


def compute_need_relevance(viewer_profile, need) -> float:
    """Compute overall relevance score between a viewer and a need.

    Weighted: 70% skill match + 30% direction match.

    Returns float 0-1.
    """
    viewer_skills = list(viewer_profile.expertise_tags or []) + list(
        viewer_profile.research_directions or []
    )
    need_skills = list(need.required_skills or [])

    skill_score = score_need_match(viewer_skills, need_skills)
    direction_score = score_direction_match(
        list(viewer_profile.research_directions or []),
        need.research_direction,
    )

    return 0.7 * skill_score + 0.3 * direction_score
