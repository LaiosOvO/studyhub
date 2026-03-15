"""HuggingFace Hub dataset search and recommendation.

Searches HF Hub for datasets relevant to a research direction,
deduplicates results, and ranks by download count.

Reference: MLE-agent dataset discovery patterns.
"""

import asyncio
import logging
import re

from app.schemas.plan import DatasetRecommendation

logger = logging.getLogger(__name__)

# Common English stop words to filter from search keywords
_STOP_WORDS = frozenset({
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "must",
    "in", "on", "at", "to", "for", "of", "with", "by", "from", "up",
    "about", "into", "through", "during", "before", "after", "above",
    "below", "between", "out", "off", "over", "under", "again",
    "and", "but", "or", "nor", "not", "so", "yet", "both", "either",
    "neither", "each", "every", "all", "any", "few", "more", "most",
    "other", "some", "such", "no", "only", "own", "same", "than",
    "too", "very", "just", "because", "as", "until", "while",
    "this", "that", "these", "those", "it", "its",
    "based", "using", "method", "approach", "study", "research",
    "new", "novel", "improved", "via", "towards",
})

# Common Chinese stop words / function words
_STOP_WORDS_ZH = frozenset({
    "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都", "一",
    "个", "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有",
    "看", "好", "自己", "这", "他", "她", "它", "们", "那", "些", "什么",
    "用", "与", "及", "对", "中", "从", "但", "而", "且", "或", "所",
    "基于", "通过", "方法", "研究", "使用", "提出",
})


def extract_search_keywords(direction: str) -> list[str]:
    """Extract meaningful search terms from a research direction string.

    Handles both English and Chinese directions.
    Removes common stop words and short tokens.
    Returns top 3 terms by length (longer = more specific).

    Args:
        direction: Research direction string (English or Chinese).

    Returns:
        List of up to 3 search keywords.
    """
    # Split on whitespace and common punctuation
    tokens = re.split(r"[\s,;:()（）、，；：]+", direction)

    # Filter out stop words and short tokens
    filtered: list[str] = []
    for token in tokens:
        lower = token.lower().strip()
        if not lower:
            continue
        if lower in _STOP_WORDS:
            continue
        if token in _STOP_WORDS_ZH:
            continue
        if len(lower) < 2:
            continue
        filtered = [*filtered, lower]

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for term in filtered:
        if term not in seen:
            seen = {*seen, term}
            unique = [*unique, term]

    # Sort by length descending (longer terms tend to be more specific)
    sorted_terms = sorted(unique, key=len, reverse=True)
    return sorted_terms[:3]


def deduplicate_and_rank(
    results: list[DatasetRecommendation],
    limit: int,
) -> list[DatasetRecommendation]:
    """Deduplicate dataset recommendations by name and rank by downloads.

    Args:
        results: List of dataset recommendations (may contain duplicates).
        limit: Maximum number of results to return.

    Returns:
        Deduplicated list sorted by downloads descending, capped at limit.
    """
    seen: set[str] = set()
    unique: list[DatasetRecommendation] = []

    for rec in results:
        if rec.name not in seen:
            seen = {*seen, rec.name}
            unique = [*unique, rec]

    # Sort by downloads descending (immutable)
    ranked = sorted(unique, key=lambda r: r.downloads, reverse=True)
    return ranked[:limit]


async def recommend_datasets(
    direction: str,
    plan_datasets: list[str],
    data_strategy: str,
    limit: int = 10,
) -> list[DatasetRecommendation]:
    """Search HuggingFace Hub for relevant datasets.

    Uses asyncio.to_thread since HfApi is synchronous.
    Non-fatal: returns empty list on any HfApi error.

    Args:
        direction: Research direction for keyword extraction.
        plan_datasets: Dataset names mentioned in the plan.
        data_strategy: One of "open_source", "own_data", "hybrid".
        limit: Maximum datasets to return.

    Returns:
        List of DatasetRecommendation sorted by downloads.
        Empty list if data_strategy is "own_data" or on any error.
    """
    if data_strategy == "own_data":
        return []

    keywords = extract_search_keywords(direction)

    # Also include plan-mentioned dataset names as search terms
    for ds_name in plan_datasets[:2]:
        cleaned = ds_name.strip().lower()
        if cleaned and cleaned not in keywords:
            keywords = [*keywords, cleaned]

    if not keywords:
        return []

    try:
        all_results = await _search_hf_datasets(keywords, limit_per_keyword=limit)
        return deduplicate_and_rank(all_results, limit)
    except Exception as exc:
        logger.warning("Dataset recommendation failed: %s", exc)
        return []


async def _search_hf_datasets(
    keywords: list[str],
    limit_per_keyword: int = 10,
) -> list[DatasetRecommendation]:
    """Search HF Hub for each keyword and collect results.

    Uses asyncio.to_thread to avoid blocking the event loop.
    """
    from huggingface_hub import HfApi

    def _search_sync() -> list[DatasetRecommendation]:
        api = HfApi()
        collected: list[DatasetRecommendation] = []

        for keyword in keywords:
            try:
                datasets = list(
                    api.list_datasets(
                        search=keyword,
                        sort="downloads",
                        direction=-1,
                        limit=limit_per_keyword,
                    )
                )

                for ds in datasets:
                    tags = getattr(ds, "tags", []) or []
                    license_tag = next(
                        (
                            t.split(":")[-1]
                            for t in tags
                            if t.startswith("license:")
                        ),
                        None,
                    )
                    downloads = getattr(ds, "downloads", 0) or 0

                    rec = DatasetRecommendation(
                        name=ds.id,
                        url=f"https://huggingface.co/datasets/{ds.id}",
                        downloads=downloads,
                        tags=list(tags[:5]),
                        license=license_tag,
                        relevance_score=min(1.0, downloads / 10000) if downloads else 0.0,
                    )
                    collected = [*collected, rec]

            except Exception as exc:
                logger.warning("HF Hub search for '%s' failed: %s", keyword, exc)
                continue

        return collected

    return await asyncio.to_thread(_search_sync)
