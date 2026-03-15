"""Meilisearch index configuration for the papers index.

Defines filterable, sortable, searchable attributes and ranking rules.
Must be applied before any documents are indexed (Pitfall 4 from research).
"""

import logging

from meilisearch_python_sdk import AsyncClient

logger = logging.getLogger(__name__)

PAPERS_INDEX_NAME = "papers"

FILTERABLE_ATTRIBUTES = [
    "year",
    "citation_count",
    "venue",
    "language",
    "sources",
    "is_open_access",
]

SORTABLE_ATTRIBUTES = [
    "citation_count",
    "year",
]

SEARCHABLE_ATTRIBUTES = [
    "title",
    "abstract",
    "authors",
    "venue",
    "doi",
]

RANKING_RULES = [
    "words",
    "typo",
    "proximity",
    "attribute",
    "sort",
    "exactness",
]


async def setup_papers_index(ms_client: AsyncClient) -> None:
    """Create and configure the papers index in Meilisearch.

    Sets filterable, sortable, searchable attributes and ranking rules.
    This MUST be called before any document insertion.
    """
    try:
        index = ms_client.index(PAPERS_INDEX_NAME)

        # Create index if it doesn't exist
        try:
            await ms_client.create_index(
                PAPERS_INDEX_NAME,
                primary_key="id",
            )
            logger.info("Created Meilisearch index: %s", PAPERS_INDEX_NAME)
        except Exception:
            # Index may already exist
            logger.debug("Index %s already exists", PAPERS_INDEX_NAME)

        # Configure attributes (idempotent operations)
        await index.update_filterable_attributes(FILTERABLE_ATTRIBUTES)
        await index.update_sortable_attributes(SORTABLE_ATTRIBUTES)
        await index.update_searchable_attributes(SEARCHABLE_ATTRIBUTES)
        await index.update_ranking_rules(RANKING_RULES)

        logger.info("Meilisearch papers index configured successfully")
    except Exception as exc:
        logger.error("Failed to configure Meilisearch index: %s", exc)
        raise
