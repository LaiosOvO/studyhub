# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** Input a research direction -> get a complete paper landscape with AI-identified gaps -> generate and auto-execute experiment plans that improve on existing work.
**Current focus:** Phase 1: Infrastructure & Auth Foundation

## Current Position

Phase: 1 of 10 (Infrastructure & Auth Foundation)
Plan: 4 of 4 in current phase
Status: Executing
Last activity: 2026-03-15 -- Completed 01-02 FastAPI Auth Gateway

Progress: [████░░░░░░] 8%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 10min
- Total execution time: 0.52 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | 31min | 10min |

**Recent Trend:**
- Last 5 plans: 01-01 (9min), 01-04 (9min), 01-02 (13min)
- Trend: stable

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
- [01-04]: Rate limiting at 10 req/min per IP on LLM completion endpoint
- [01-02]: Argon2 via pwdlib for password hashing (more secure than bcrypt, FastAPI-recommended)
- [01-02]: App factory pattern (create_app) for testability and clean initialization
- [01-02]: Shared slowapi Limiter across all routers instead of per-router instances
- [01-02]: In-memory SQLite via aiosqlite for test database (no PostgreSQL needed in CI)
- [01-02]: Valkey client optional parameter -- auth works without Valkey running

### Pending Todos

None yet.

### Blockers/Concerns

- CNKI/Wanfang anti-scraping strategies need hands-on testing (Phase 3)
- Tauri-to-web sync protocol needs design research (Phase 8)
- Researcher matching has no benchmark -- will need user feedback loops (Phase 10)

## Session Continuity

Last session: 2026-03-15
Stopped at: Completed 01-02-PLAN.md (FastAPI Auth Gateway)
Resume file: None
