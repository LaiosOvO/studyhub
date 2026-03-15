---
phase: 02-paper-search-ingestion
plan: 01
status: completed
started: "2026-03-15"
completed: "2026-03-15"
duration_minutes: 25
---

# Plan 02-01 Summary: Multi-Source Paper Search Pipeline

## What Was Built

- **Unified paper schema** (`PaperResult`, `PaperSource`, `PaperCreate`) normalizing responses from all 4 sources
- **Search schemas** (`SearchRequest`, `SearchResponse`, `SearchType`) with query/type/limit/sources params
- **4 source clients** (all inheriting `BasePaperClient`):
  - `OpenAlexClient`: pyalex via `asyncio.to_thread`, API key support
  - `SemanticScholarClient`: httpx async to S2 Graph API v1, x-api-key header
  - `PubMedClient`: two-step esearch+efetch with XML parsing
  - `ArxivClient`: Atom XML with 1 req/3 sec rate limit via Semaphore
- **Three-tier deduplicator**: DOI exact match -> normalized title+year -> fuzzy match (rapidfuzz ratio > 90), with CJK support
- **Fan-out aggregator**: `asyncio.gather` with `return_exceptions=True`, per-source semaphores, graceful failure isolation
- **Paper SQLAlchemy model** with UUID PK, all source IDs indexed, parsed_content JSONB
- **Alembic migration** 003_create_papers_table
- **GET /search/papers** endpoint with rate limiting (30/min)
- **Config settings**: openalex_api_key, s2_api_key, pubmed_api_key, grobid_url

## Key Decisions

- Used pyalex (sync) with `asyncio.to_thread` for OpenAlex instead of raw httpx -- pyalex handles pagination and polite pool
- arXiv rate limit enforced globally via module-level `asyncio.Semaphore(1)` + 3s sleep
- Deduplicator returns new PaperResult objects on merge (immutable pattern)
- Paper model uses JSON columns for authors and sources (not normalized tables) -- simpler for MVP

## Test Results

20 tests covering: schema validation, dedup (DOI/title/fuzzy/CJK/merge), client instantiation, aggregator (all succeed/one fails/DOI/author search), endpoint (success/missing query)

## Files Created/Modified

- `backend/app/schemas/paper.py` (new)
- `backend/app/schemas/search.py` (new)
- `backend/app/services/paper_search/*.py` (6 new files)
- `backend/app/models/paper.py` (new)
- `backend/app/models/__init__.py` (modified)
- `backend/app/routers/search.py` (new)
- `backend/app/config.py` (modified)
- `backend/app/main.py` (modified)
- `backend/alembic/versions/003_create_papers_table.py` (new)
- `backend/tests/test_paper_search.py` (new)
