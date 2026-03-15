"""Three-tier paper deduplication across multiple sources.

Tier 1: Exact DOI match (normalized lowercase, stripped)
Tier 2: Normalized title + year exact match
Tier 3: Fuzzy title match using rapidfuzz (ratio > 90)

Handles both English and Chinese (CJK) titles appropriately.
"""

import re
import unicodedata

from rapidfuzz import fuzz

from app.schemas.paper import PaperResult


def _is_cjk_char(char: str) -> bool:
    """Check if a character is a CJK (Chinese/Japanese/Korean) character."""
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


def _normalize_title(title: str) -> str:
    """Normalize a title for deduplication comparison.

    Lowercases, strips whitespace, removes punctuation, and
    normalizes Unicode characters.
    """
    # Normalize Unicode
    normalized = unicodedata.normalize("NFKC", title)
    # Lowercase
    normalized = normalized.lower()
    # Remove punctuation (keep letters, numbers, spaces, and CJK chars)
    normalized = re.sub(r"[^\w\s]", "", normalized)
    # Collapse whitespace
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def _fuzzy_match(title_a: str, title_b: str) -> float:
    """Compute fuzzy similarity between two titles.

    For CJK titles, uses character-level comparison.
    For others, uses standard token ratio.
    """
    norm_a = _normalize_title(title_a)
    norm_b = _normalize_title(title_b)

    if _has_cjk(norm_a) or _has_cjk(norm_b):
        # Character-level comparison for CJK
        return fuzz.ratio(norm_a, norm_b)

    return fuzz.ratio(norm_a, norm_b)


def _merge_papers(existing: PaperResult, new: PaperResult) -> PaperResult:
    """Merge two paper records, preferring non-None fields from the richer record.

    Returns a new PaperResult (immutable pattern).
    """
    merged_sources = list(set(existing.sources + new.sources))

    return PaperResult(
        doi=existing.doi or new.doi,
        openalex_id=existing.openalex_id or new.openalex_id,
        s2_id=existing.s2_id or new.s2_id,
        pmid=existing.pmid or new.pmid,
        arxiv_id=existing.arxiv_id or new.arxiv_id,
        title=existing.title if len(existing.title) >= len(new.title) else new.title,
        abstract=existing.abstract or new.abstract,
        authors=existing.authors if existing.authors else new.authors,
        year=existing.year or new.year,
        venue=existing.venue or new.venue,
        language=existing.language or new.language,
        citation_count=max(existing.citation_count, new.citation_count),
        pdf_url=existing.pdf_url or new.pdf_url,
        is_open_access=existing.is_open_access or new.is_open_access,
        sources=merged_sources,
    )


def deduplicate(papers: list[PaperResult]) -> list[PaperResult]:
    """Deduplicate papers using three-tier matching.

    Returns a new list of unique papers with merged source information.
    """
    seen_dois: dict[str, int] = {}  # normalized DOI -> index in unique
    seen_titles: dict[str, int] = {}  # normalized title+year -> index in unique
    unique: list[PaperResult] = []

    for paper in papers:
        # Tier 1: Exact DOI match
        if paper.doi:
            normalized_doi = paper.doi.lower().strip()
            if normalized_doi in seen_dois:
                idx = seen_dois[normalized_doi]
                unique[idx] = _merge_papers(unique[idx], paper)
                continue
            # Don't add to seen_dois yet; check other tiers first

        # Tier 2: Normalized title + year exact match
        title_key = _normalize_title(paper.title) + str(paper.year or "")
        if title_key in seen_titles:
            idx = seen_titles[title_key]
            unique[idx] = _merge_papers(unique[idx], paper)
            # Also register DOI if available
            if paper.doi:
                seen_dois[paper.doi.lower().strip()] = idx
            continue

        # Tier 3: Fuzzy title match against existing papers
        matched = False
        for i, existing in enumerate(unique):
            if _fuzzy_match(paper.title, existing.title) > 90:
                unique[i] = _merge_papers(existing, paper)
                # Register identifiers for the merged paper
                if paper.doi:
                    seen_dois[paper.doi.lower().strip()] = i
                matched = True
                break

        if not matched:
            idx = len(unique)
            unique.append(paper)
            seen_titles[title_key] = idx
            if paper.doi:
                seen_dois[paper.doi.lower().strip()] = idx

    return unique
