"""Multi-signal researcher matching engine.

Computes complementarity-based matching between researchers using
TF-IDF keyword analysis, co-citation networks, research adjacency,
and institutional proximity.
"""

import logging
import math

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

# ─── Match Signal Weights ──────────────────────────────────────────────────
MATCH_WEIGHTS: dict[str, float] = {
    "complementarity": 0.40,
    "co_citation": 0.25,
    "adjacency": 0.20,
    "institutional": 0.15,
}


def compute_complementarity(keywords_a: list[str], keywords_b: list[str]) -> float:
    """Compute complementarity score using TF-IDF bell curve.

    Peaks at ~0.35 similarity (complementary expertise) rather than
    high similarity (overlapping expertise).

    Returns float 0-1.
    """
    if not keywords_a or not keywords_b:
        return 0.3  # Neutral fallback

    doc_a = " ".join(keywords_a)
    doc_b = " ".join(keywords_b)

    try:
        vectorizer = TfidfVectorizer()
        tfidf_matrix = vectorizer.fit_transform([doc_a, doc_b])
        raw_sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
    except ValueError:
        return 0.3

    # Bell curve peaking at 0.35 similarity
    score = math.exp(-((raw_sim - 0.35) ** 2) / (2 * 0.15 ** 2))
    return float(score)


def compute_adjacency(directions_a: list[str], directions_b: list[str]) -> float:
    """Compute research adjacency via Jaccard coefficient.

    Optimal: some overlap (~30%) but not full overlap.

    Returns float 0-1.
    """
    if not directions_a or not directions_b:
        return 0.0

    set_a = {d.lower().strip() for d in directions_a}
    set_b = {d.lower().strip() for d in directions_b}

    union = set_a | set_b
    if not union:
        return 0.0

    jaccard = len(set_a & set_b) / len(union)
    # Peaks at ~30% overlap
    score = 1.0 - abs(jaccard - 0.3) / 0.7
    return max(0.0, min(1.0, score))


def compute_institutional_proximity(
    inst_a: str | None, inst_b: str | None
) -> float:
    """Compute institutional proximity via fuzzy string matching.

    Returns float 0-1.
    """
    if not inst_a or not inst_b:
        return 0.0

    if inst_a.lower().strip() == inst_b.lower().strip():
        return 1.0

    try:
        from rapidfuzz import fuzz
        return fuzz.ratio(inst_a, inst_b) / 100.0
    except ImportError:
        # Fallback: simple containment check
        a_lower = inst_a.lower()
        b_lower = inst_b.lower()
        if a_lower in b_lower or b_lower in a_lower:
            return 0.7
        return 0.0


async def compute_co_citation(
    profile_a_papers: list[str],
    profile_b_papers: list[str],
    neo4j_client,
) -> float:
    """Compute co-citation score via shared citation neighbors in Neo4j.

    Returns float 0-1. Non-fatal if Neo4j unavailable.
    """
    if not profile_a_papers or not profile_b_papers or neo4j_client is None:
        return 0.0

    try:
        query = (
            "MATCH (a:Paper)-[:CITES]-(shared:Paper)-[:CITES]-(b:Paper) "
            "WHERE a.id IN $a_ids AND b.id IN $b_ids "
            "RETURN count(DISTINCT shared) AS overlap"
        )
        results = await neo4j_client.execute_read(
            query, {"a_ids": profile_a_papers, "b_ids": profile_b_papers}
        )
        overlap = results[0]["overlap"] if results else 0
        return min(overlap / 10.0, 1.0)
    except Exception as exc:
        logger.warning("Co-citation query failed: %s", exc)
        return 0.0


def compute_match_score(signals: dict[str, float]) -> float:
    """Compute weighted match score from individual signals.

    Returns float 0-1.
    """
    return sum(
        signals.get(signal, 0.0) * weight
        for signal, weight in MATCH_WEIGHTS.items()
    )


async def find_matches(
    profile,
    candidates: list,
    neo4j_client=None,
    top_n: int = 20,
) -> list[dict]:
    """Find best matching researchers for a given profile.

    Computes cheap signals first and only evaluates co-citation
    for candidates scoring > 0.3 on cheap signals.

    Returns list of dicts sorted by overall_score descending.
    """
    profile_keywords = list(profile.expertise_tags or []) + list(
        profile.research_keywords or []
    )
    profile_directions = list(profile.research_directions or [])
    profile_papers = [
        p.get("doi", "") for p in (profile.publications or []) if p.get("doi")
    ]

    scored: list[dict] = []

    for candidate in candidates:
        # Skip self
        if candidate.user_id == profile.user_id:
            continue

        cand_keywords = list(candidate.expertise_tags or []) + list(
            candidate.research_keywords or []
        )
        cand_directions = list(candidate.research_directions or [])

        # Cheap signals
        complementarity = compute_complementarity(profile_keywords, cand_keywords)
        adjacency = compute_adjacency(profile_directions, cand_directions)
        institutional = compute_institutional_proximity(
            profile.institution, candidate.institution
        )

        # Quick score (without co-citation)
        quick_signals = {
            "complementarity": complementarity,
            "co_citation": 0.0,
            "adjacency": adjacency,
            "institutional": institutional,
        }
        quick_score = compute_match_score(quick_signals)

        # Only compute co-citation for promising candidates
        co_citation = 0.0
        if quick_score > 0.3 and neo4j_client is not None:
            cand_papers = [
                p.get("doi", "")
                for p in (candidate.publications or [])
                if p.get("doi")
            ]
            co_citation = await compute_co_citation(
                profile_papers, cand_papers, neo4j_client
            )

        signals = {
            "complementarity": complementarity,
            "co_citation": co_citation,
            "adjacency": adjacency,
            "institutional": institutional,
        }
        overall_score = compute_match_score(signals)

        scored.append({
            "profile_id": candidate.id,
            "profile": candidate,
            "overall_score": overall_score,
            "breakdown": signals,
        })

    # Sort by score descending, take top N
    sorted_matches = sorted(scored, key=lambda x: x["overall_score"], reverse=True)
    return sorted_matches[:top_n]
