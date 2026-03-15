"""Seed data importer for scholar profiles.

Reads ecg_scholars.json and upserts scholars into the database.
Uses PostgreSQL ON CONFLICT for idempotent imports.

Immutable pattern: creates new objects, never mutates input data.
"""

import json
import logging
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scholar import Scholar
from app.schemas.scholar import ScholarResponse

logger = logging.getLogger(__name__)

# Default seed file path (relative to project root)
_DEFAULT_SEED_PATH = "data/seed/ecg_scholars.json"


async def import_seed_scholars(
    db: AsyncSession,
    seed_path: str = _DEFAULT_SEED_PATH,
) -> list[ScholarResponse]:
    """Import scholars from seed JSON file with upsert semantics.

    Reads the seed file, maps each entry to Scholar model fields,
    and performs INSERT ... ON CONFLICT (name, institution) DO UPDATE.

    Args:
        db: Async database session.
        seed_path: Path to the seed JSON file.

    Returns:
        List of ScholarResponse for all imported/updated scholars.
    """
    path = Path(seed_path)
    if not path.exists():
        logger.error("Seed file not found: %s", seed_path)
        return []

    raw = json.loads(path.read_text(encoding="utf-8"))
    scholar_entries = raw.get("scholars", [])

    if not scholar_entries:
        logger.warning("No scholars found in seed file: %s", seed_path)
        return []

    imported_ids: list[str] = []

    for entry in scholar_entries:
        # Build source_urls from baike_url
        source_urls = []
        baike_url = entry.get("baike_url")
        if baike_url:
            source_urls = [{"source": "baike", "url": baike_url}]

        # Build note combining existing note and ecg_ai_relevance
        note_parts = []
        if entry.get("note"):
            note_parts.append(entry["note"])
        if entry.get("ecg_ai_relevance"):
            note_parts.append(f"ECG/AI relevance: {entry['ecg_ai_relevance']}")
        note = "; ".join(note_parts) if note_parts else None

        # Prepare values for upsert (immutable: build new dict)
        values = {
            "name": entry["name"],
            "institution": entry["institution"],
            "title": entry.get("title", []),
            "rank": entry.get("rank"),
            "birth_year": entry.get("birth_year"),
            "research_fields": entry.get("research_fields", []),
            "honors": entry.get("honors", []),
            "education": entry.get("education"),
            "source_urls": source_urls,
            "note": note,
        }

        # PostgreSQL upsert: INSERT ... ON CONFLICT DO UPDATE
        stmt = pg_insert(Scholar).values(**values)
        stmt = stmt.on_conflict_do_update(
            constraint="uq_scholar_name_institution",
            set_={
                "title": stmt.excluded.title,
                "rank": stmt.excluded.rank,
                "birth_year": stmt.excluded.birth_year,
                "research_fields": stmt.excluded.research_fields,
                "honors": stmt.excluded.honors,
                "education": stmt.excluded.education,
                "source_urls": stmt.excluded.source_urls,
                "note": stmt.excluded.note,
            },
        ).returning(Scholar.id)

        result = await db.execute(stmt)
        scholar_id = result.scalar_one()
        imported_ids.append(scholar_id)

    await db.commit()

    # Re-query all imported scholars for response
    result = await db.execute(
        select(Scholar).where(Scholar.id.in_(imported_ids))
    )
    scholars = list(result.scalars().all())

    logger.info("Imported %d scholars from seed file", len(scholars))
    return [ScholarResponse.model_validate(s) for s in scholars]
