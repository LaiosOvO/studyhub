"""Scholar-paper linking with fuzzy CJK-aware name matching.

Links scholars to papers by comparing author names with support
for both Chinese (exact after normalization) and English (fuzzy ratio)
matching strategies.

CJK detection logic mirrors the paper deduplicator module
(inlined to avoid import chain through browser-dependent packages).
"""

import logging
import unicodedata

from rapidfuzz import fuzz
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.paper import Paper
from app.models.scholar import Scholar

logger = logging.getLogger(__name__)

def _is_cjk_char(char: str) -> bool:
    """Check if a character is CJK (Chinese/Japanese/Korean)."""
    cp = ord(char)
    return (
        (0x4E00 <= cp <= 0x9FFF)
        or (0x3400 <= cp <= 0x4DBF)
        or (0x20000 <= cp <= 0x2A6DF)
        or (0x2A700 <= cp <= 0x2B73F)
        or (0x2B740 <= cp <= 0x2B81F)
        or (0xF900 <= cp <= 0xFAFF)
        or (0x2F800 <= cp <= 0x2FA1F)
    )


def _has_cjk(text: str) -> bool:
    """Check if text contains any CJK characters."""
    return any(_is_cjk_char(c) for c in text)


# Default fuzzy matching threshold for English names
_DEFAULT_THRESHOLD = 80.0

# Maximum papers to scan for linking (ordered by year DESC)
_MAX_PAPERS_SCAN = 1000


def normalize_author_name(name: str) -> str:
    """Normalize an author name for matching.

    - Unicode NFKC normalization
    - Strip whitespace
    - CJK names: remove spaces between characters
    - English names: lowercase, collapse spaces

    Args:
        name: Raw author name string.

    Returns:
        Normalized name string.
    """
    normalized = unicodedata.normalize("NFKC", name).strip()

    if _has_cjk(normalized):
        # Chinese names: remove all spaces (e.g., "葛 均 波" -> "葛均波")
        return normalized.replace(" ", "")

    # English names: lowercase and collapse spaces
    return " ".join(normalized.lower().split())


def fuzzy_name_match(
    name_a: str, name_b: str, threshold: float = _DEFAULT_THRESHOLD
) -> bool:
    """Check if two author names match with CJK-aware logic.

    For CJK names: exact match after normalization (Chinese names are
    short; fuzzy matching would produce false positives). Also tries
    reversed surname+given order.

    For English names: rapidfuzz ratio > threshold.

    For mixed CJK/English: tries both normalized forms.

    Args:
        name_a: First name.
        name_b: Second name.
        threshold: Minimum fuzzy ratio for English names (default 80.0).

    Returns:
        True if names match, False otherwise.
    """
    norm_a = normalize_author_name(name_a)
    norm_b = normalize_author_name(name_b)

    # Short-circuit: exact match after normalization
    if norm_a == norm_b:
        return True

    is_cjk_a = _has_cjk(norm_a)
    is_cjk_b = _has_cjk(norm_b)

    if is_cjk_a and is_cjk_b:
        # CJK-CJK: exact match only (already checked above)
        # Also try reversed order for 2-3 char names
        if len(norm_a) <= 4 and len(norm_b) <= 4:
            # Try surname-given vs given-surname
            if len(norm_a) >= 2 and norm_a[1:] + norm_a[0] == norm_b:
                return True
            if len(norm_b) >= 2 and norm_b[1:] + norm_b[0] == norm_a:
                return True
        return False

    if not is_cjk_a and not is_cjk_b:
        # English-English: fuzzy ratio
        return fuzz.ratio(norm_a, norm_b) >= threshold

    # Mixed CJK/English: no match possible
    return False


async def link_scholar_papers(
    scholar: Scholar, db: AsyncSession
) -> list[str]:
    """Find papers authored by a scholar via name matching.

    Scans papers (limited to most recent _MAX_PAPERS_SCAN) and checks
    if any author name matches the scholar's name or English name.

    Args:
        scholar: Scholar model instance.
        db: Async database session.

    Returns:
        List of matched paper IDs.
    """
    # Query recent papers
    query = (
        select(Paper)
        .order_by(Paper.year.desc().nulls_last())
        .limit(_MAX_PAPERS_SCAN)
    )
    result = await db.execute(query)
    papers = list(result.scalars().all())

    matched_ids: list[str] = []

    for paper in papers:
        authors = paper.authors or []
        for author_name in authors:
            if not isinstance(author_name, str):
                continue

            # Check against primary name
            if fuzzy_name_match(author_name, scholar.name):
                matched_ids.append(paper.id)
                break

            # Check against English name
            if scholar.name_en and fuzzy_name_match(
                author_name, scholar.name_en
            ):
                matched_ids.append(paper.id)
                break

    logger.info(
        "Linked %d papers to scholar '%s'", len(matched_ids), scholar.name
    )
    return matched_ids
