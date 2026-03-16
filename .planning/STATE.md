---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-03-16T03:34:55.163Z"
progress:
  total_phases: 10
  completed_phases: 9
  total_plans: 32
  completed_plans: 31
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** Input a research direction -> get a complete paper landscape with AI-identified gaps -> generate and auto-execute experiment plans that improve on existing work.
**Current focus:** Phase 05: Deep Research Engine (completed)

## Current Position

Phase: 05 of 10 (Deep Research Engine)
Plan: 4 of 4 in current phase (all completed)
Status: Phase 05 Complete
Last activity: 2026-03-16 -- Completed all 4 plans in Phase 05

Progress: [██████░░░░] 55%

## Performance Metrics

**Velocity:**
- Total plans completed: 18
- Average duration: 10min
- Total execution time: 3.3 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | 45min | 11min |
| 02 | 3 | 40min | 13min |
| 03 | 2 | 16min | 8min |
| 04 | 3 | 37min | 12min |
| 03.1 | 2 | 22min | 11min |
| 05 | 4 | 35min | 9min |

**Recent Trend:**
- Last 3 plans: 05-02 (10min), 05-03 (8min), 05-04 (5min)
- Trend: accelerating

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Stack confirmed as FastAPI + Next.js + Tauri + Neo4j + Temporal + PostgreSQL + Meilisearch + Valkey + SeaweedFS (MinIO replaced, ClickHouse deferred)
- [Roadmap]: CNKI/Wanfang separated into own phase due to anti-scraping complexity
- [Roadmap]: Phases 3/4 can parallelize (both depend on Phase 2); Phases 6/7 can parallelize (both depend on Phase 5)
- [01-01]: Separate PostgreSQL instance for Temporal (temporal-db on port 5433) to isolate schema
- [01-01]: Hatchling as build backend for backend pyproject.toml
- [01-04]: LiteLLM as unified LLM provider abstraction (Anthropic, OpenAI, etc.)
- [01-04]: Fallback chain pattern for LLM calls (primary fails -> try secondary)
- [01-04]: Temporal client connection non-fatal at startup (app runs without Temporal)
- [01-02]: Argon2 via pwdlib for password hashing (more secure than bcrypt, FastAPI-recommended)
- [01-02]: App factory pattern (create_app) for testability and clean initialization
- [01-02]: In-memory SQLite via aiosqlite for test database
- [01-03]: Access token in memory (not localStorage) for XSS protection
- [02-01]: pyalex (sync) with asyncio.to_thread for OpenAlex -- handles pagination and polite pool
- [02-01]: arXiv rate limit via module-level Semaphore(1) + 3s sleep
- [02-01]: Deduplicator returns new objects on merge (immutable pattern)
- [02-01]: Paper model uses JSON columns for authors/sources (not normalized tables)
- [02-02]: Index-on-search pattern for Meilisearch (fills gradually, no bulk import)
- [02-02]: Abstract truncated to 500 chars in Meilisearch, full in PostgreSQL
- [02-02]: Meilisearch failure graceful -- falls back to aggregator-only mode
- [02-03]: Raw httpx to GROBID (not grobid-client-python) -- simpler, fewer deps
- [02-03]: Section classification via keyword matching (not ML) -- sufficient for structured papers
- [02-03]: SeaweedFS upload non-fatal -- logs warning if unavailable
- [02-03]: Parsing synchronous in request (TODO: Temporal workflow in Phase 5)
- [03-01]: Patchright over playwright-stealth for deeper CDP detection patching
- [03-01]: CSS selectors as module-level constants with fallback dicts for CNKI/Wanfang DOM maintenance
- [03-01]: In-memory cookie store for BrowserPool (Valkey persistence deferred)
- [03-01]: CnkiCaptchaError as specific exception for aggregator error classification
- [03-02]: Per-source timeouts: 30s for browser-based (CNKI/Wanfang), 10s for API sources
- [03-02]: browser_pool parameter optional in aggregator -- None means API-only (backward compatible)
- [03-02]: Error classification maps exceptions to SourceStatus (CAPTCHA_BLOCKED, RATE_LIMITED, UNAVAILABLE, ERROR)
- [04-01]: Neo4j async driver with transaction functions for all queries
- [04-01]: BFS with priority selection by citation count at each level
- [04-01]: asyncio.Semaphore(1) for S2 rate limiting within expansion
- [04-01]: Neo4j startup non-fatal (same pattern as Meilisearch)
- [04-02]: RELATED_TO edges separate from CITES in Neo4j (different relationship types)
- [04-02]: Similarity discovery non-fatal in expand endpoints
- [04-03]: Log-scaled normalization for citations (log10/4.0) for power-law distribution
- [04-03]: Citation velocity = citations / (current_year - pub_year + 1)
- [04-03]: Pure compute_quality_score function with no side effects
- [04-03]: OpenAlex lookups via asyncio.to_thread (pyalex is sync)
- [03.1-01]: CSS selector fallback pattern reused from CNKI/Wanfang for Baike scraper
- [03.1-01]: PostgreSQL ON CONFLICT for idempotent scholar upserts
- [03.1-01]: ecg_ai_relevance stored in note field (not separate column)
- [03.1-02]: Inlined _has_cjk in paper_linker to avoid patchright import chain
- [03.1-02]: scholarly via asyncio.to_thread (same pattern as pyalex)
- [03.1-02]: CJK name matching: exact only (too short for fuzzy); English: rapidfuzz ratio >= 80
- [03.1-02]: Temporal activities create own DB sessions (isolation pattern)
- [05-01]: Temporal workflow query (not signal) for progress -- enables pull-based WebSocket polling
- [05-01]: JSON string I/O for all activities -- Temporal payload serialization constraint
- [05-01]: Activity isolation pattern -- each activity creates own DB session and HTTP client
- [05-01]: WebSocket JWT auth via query parameter token
- [05-02]: Haiku for screening and classification, Sonnet for deep analysis -- cost efficiency
- [05-02]: Per-paper analyses stored in DeepResearchTask.config['paper_analyses'] -- avoids migration
- [05-02]: Only classify citation-connected pairs (Neo4j CITES edges) -- O(edges) not O(n^2)
- [05-03]: Sonnet for gap detection (corpus reasoning), Haiku for trend detection (pattern matching)
- [05-03]: Jinja2 FileSystemLoader for bilingual Markdown report templates
- [05-04]: Refinement stores filter settings in task.config for reproducibility
- [05-04]: Manual expansion reuses expand_citations directly (no new activity needed)

### Roadmap Evolution

- Phase 03.1 inserted after Phase 3: Scholar Profile Harvesting (INSERTED) -- build scholar profile DB from Baidu Baike + Google Scholar with ECG domain seed data

### Pending Todos

None yet.

### Blockers/Concerns

- CNKI/Wanfang scrapers implemented but need live testing with `uv sync` + `python -m patchright install chromium` (sandbox blocked during Phase 3 execution)
- Neo4j package needs `uv sync` to install (added to pyproject.toml but not installed in env during Phase 4 execution)
- Tauri-to-web sync protocol needs design research (Phase 8)
- Researcher matching has no benchmark -- will need user feedback loops (Phase 10)

## Session Continuity

Last session: 2026-03-16
Stopped at: Completed Phase 05 (Deep Research Engine)
Resume file: None
