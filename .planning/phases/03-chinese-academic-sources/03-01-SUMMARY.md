---
phase: 03-chinese-academic-sources
plan: 01
subsystem: paper-search
tags: [patchright, playwright, beautifulsoup, lxml, cnki, browser-automation, scraping]

requires:
  - phase: 02-paper-search-ingestion
    provides: BasePaperClient ABC, PaperResult schema, deduplicator, aggregator
provides:
  - BrowserPool for shared Playwright browser contexts with cookie persistence
  - CnkiClient implementing BasePaperClient for CNKI search
  - PaperSource.CNKI and PaperSource.WANFANG enum values
  - cnki_id and wanfang_id fields on PaperResult
  - SourceStatus enum and SourceReport model for per-source status reporting
  - CnkiCaptchaError for CAPTCHA detection
affects: [03-02, aggregator, search-api, paper-deduplication]

tech-stack:
  added: [patchright, beautifulsoup4, lxml]
  patterns: [browser-pool-context-manager, stealth-scraping, css-selector-constants, captcha-detection]

key-files:
  created:
    - backend/app/services/paper_search/browser_pool.py
    - backend/app/services/paper_search/cnki_client.py
    - backend/tests/test_cnki_client.py
  modified:
    - backend/app/schemas/paper.py
    - backend/app/schemas/search.py
    - backend/app/services/paper_search/deduplicator.py
    - backend/pyproject.toml

key-decisions:
  - "CSS selectors as module-level constants (not hardcoded) for easy CNKI DOM maintenance"
  - "Patchright over playwright-stealth for deeper CDP detection patching"
  - "In-memory cookie store (Valkey persistence deferred to future enhancement)"
  - "CAPTCHA detection raises specific exception for caller-level graceful handling"

patterns-established:
  - "BrowserPool: async context manager with semaphore-gated contexts and per-domain cookie persistence"
  - "Scraper client: extends BasePaperClient, uses BrowserPool instead of httpx for JS-rendered pages"
  - "Selector constants: primary + fallback CSS selector dicts at module level"

requirements-completed: [CNKI-01, CNKI-03, CNKI-04]

duration: 8min
completed: 2026-03-15
---

# Phase 3 Plan 1: BrowserPool, CNKI Scraper, and Schema Extensions Summary

**Stealth browser pool with patchright for CNKI scraping, plus PaperSource/PaperResult extensions for Chinese academic sources**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-15T14:52:00Z
- **Completed:** 2026-03-15T15:00:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- BrowserPool manages patchright browser contexts with semaphore-gated concurrency and per-domain cookie persistence
- CnkiClient implements BasePaperClient with browser-based search, configurable CSS selectors, and CAPTCHA detection
- PaperSource enum extended with CNKI and WANFANG; PaperResult has cnki_id and wanfang_id fields
- SourceStatus enum and SourceReport model added to search schemas for per-source status reporting
- Deduplicator merges cnki_id and wanfang_id across sources
- 15 tests covering parse logic (primary + fallback selectors), CAPTCHA detection, and client structure

## Task Commits

1. **Task 1: Schema extensions and BrowserPool** - `cf3724e` (feat)
2. **Task 2: CNKI scraper client with tests** - `cf3724e` (combined in single commit)

## Files Created/Modified
- `backend/app/services/paper_search/browser_pool.py` - Reusable Playwright context pool with cookie persistence
- `backend/app/services/paper_search/cnki_client.py` - CNKI scraper with configurable selectors and CAPTCHA detection
- `backend/tests/test_cnki_client.py` - 15 tests for CNKI parsing, CAPTCHA, instantiation
- `backend/app/schemas/paper.py` - Added CNKI/WANFANG to PaperSource, cnki_id/wanfang_id to PaperResult
- `backend/app/schemas/search.py` - Added SourceStatus enum, SourceReport model, source_reports field
- `backend/app/services/paper_search/deduplicator.py` - Merge cnki_id/wanfang_id in _merge_papers
- `backend/pyproject.toml` - Added patchright, beautifulsoup4, lxml dependencies

## Decisions Made
- CSS selectors as module-level constants with fallback dicts -- CNKI changes DOM frequently
- Patchright over playwright-stealth for deeper CDP Runtime.enable detection patching
- In-memory cookie store (dict) -- Valkey persistence deferred as future enhancement
- CnkiCaptchaError is a specific exception rather than generic error -- allows aggregator to classify as CAPTCHA_BLOCKED

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Sandbox restrictions prevented running `uv sync` and `pytest` directly. Dependencies added to pyproject.toml manually. User must run `uv sync` and `pytest` to verify.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- BrowserPool and CnkiClient ready for Plan 03-02 (Wanfang client + aggregator integration)
- All interfaces from Plan 03-01 are available for Plan 03-02 to consume

---
*Phase: 03-chinese-academic-sources*
*Completed: 2026-03-15*
