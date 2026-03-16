"""Tests for OpenAlex profile enricher.

All OpenAlex (pyalex) and DB calls are mocked.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.community.profile_enricher import (
    _search_openalex_author_sync,
    enrich_from_openalex,
)


# ─── _search_openalex_author_sync ──────────────────────────────────────────


def test_search_openalex_not_found():
    """Returns None when no author found."""
    with patch("app.services.community.profile_enricher.Authors") as mock_authors:
        mock_authors.return_value.search.return_value.get.return_value = []
        result = _search_openalex_author_sync("Unknown Author", None)
    assert result is None


def test_search_openalex_success():
    """Returns enriched data dict on success."""
    mock_author = {
        "id": "https://openalex.org/A12345",
        "display_name": "Alice Zhang",
        "summary_stats": {"h_index": 15},
        "cited_by_count": 500,
        "works_count": 42,
        "topics": [{"display_name": "NLP"}, {"display_name": "Deep Learning"}],
        "last_known_institutions": [],
    }

    with patch("app.services.community.profile_enricher.Authors") as mock_authors:
        mock_authors.return_value.search.return_value.get.return_value = [mock_author]
        with patch("app.services.community.profile_enricher.Works") as mock_works:
            mock_works_instance = MagicMock()
            mock_works_instance.filter.return_value.sort.return_value.__getitem__ = MagicMock(
                return_value=[]
            )
            mock_works.return_value = mock_works_instance

            result = _search_openalex_author_sync("Alice Zhang", None)

    assert result is not None
    assert result["openalex_id"] == "A12345"
    assert result["display_name"] == "Alice Zhang"
    assert result["h_index"] == 15
    assert result["cited_by_count"] == 500
    assert "NLP" in result["topics"]


def test_search_openalex_with_institution_match():
    """Prefers author matching the given institution."""
    author_mit = {
        "id": "https://openalex.org/A111",
        "display_name": "Alice Zhang",
        "summary_stats": {"h_index": 20},
        "cited_by_count": 800,
        "works_count": 50,
        "topics": [],
        "last_known_institutions": [{"display_name": "MIT"}],
    }
    author_stanford = {
        "id": "https://openalex.org/A222",
        "display_name": "Alice Zhang",
        "summary_stats": {"h_index": 10},
        "cited_by_count": 200,
        "works_count": 20,
        "topics": [],
        "last_known_institutions": [{"display_name": "Stanford University"}],
    }

    with patch("app.services.community.profile_enricher.Authors") as mock_authors:
        mock_authors.return_value.search.return_value.get.return_value = [
            author_stanford, author_mit
        ]
        with patch("app.services.community.profile_enricher.Works") as mock_works:
            mock_works_instance = MagicMock()
            mock_works_instance.filter.return_value.sort.return_value.__getitem__ = MagicMock(
                return_value=[]
            )
            mock_works.return_value = mock_works_instance

            result = _search_openalex_author_sync("Alice Zhang", "MIT")

    assert result is not None
    assert result["openalex_id"] == "A111"


def test_search_openalex_exception():
    """Returns None on API exception."""
    with patch("app.services.community.profile_enricher.Authors") as mock_authors:
        mock_authors.return_value.search.side_effect = Exception("API error")
        result = _search_openalex_author_sync("Test", None)
    assert result is None


# ─── enrich_from_openalex (async wrapper) ──────────────────────────────────


@pytest.mark.asyncio
async def test_enrich_from_openalex_delegates():
    """Async wrapper delegates to sync function."""
    with patch(
        "app.services.community.profile_enricher._search_openalex_author_sync",
        return_value={"openalex_id": "A1", "h_index": 5},
    ):
        result = await enrich_from_openalex("Test Author", "MIT")

    assert result is not None
    assert result["openalex_id"] == "A1"


@pytest.mark.asyncio
async def test_enrich_from_openalex_none():
    """Returns None when sync function returns None."""
    with patch(
        "app.services.community.profile_enricher._search_openalex_author_sync",
        return_value=None,
    ):
        result = await enrich_from_openalex("Unknown", None)

    assert result is None
