---
phase: 05-deep-research-engine
plan: 04
subsystem: api
tags: [fastapi, refinement, expansion, citation-network]

requires:
  - phase: 05-deep-research-engine
    provides: DeepResearchTask, deep_research router, citation expansion engine
provides:
  - Refinement endpoint with filter-based partial re-analysis
  - Manual expansion endpoint reusing citation expansion engine
  - Report retrieval endpoint returning Markdown content
affects: [06-paper-map-visualization]

tech-stack:
  added: []
  patterns: [filter-then-reanalyze, manual-graph-expansion]

key-files:
  created: []
  modified:
    - backend/app/schemas/deep_research.py
    - backend/app/routers/deep_research.py

key-decisions:
  - "Refinement stores filter settings in task.config for reproducibility"
  - "Manual expansion reuses expand_citations directly (no new activity needed)"
  - "Report endpoint returns text/markdown content type via PlainTextResponse"

patterns-established:
  - "Filter-then-reanalyze: apply immutable filters, optionally start new workflow"
  - "Status-gated endpoints: 409 Conflict when task status doesn't allow operation"

requirements-completed: [DEEP-06, DEEP-07]

duration: 5min
completed: 2026-03-16
---

# Plan 05-04: Result Refinement and Expansion Summary

**REST endpoints for filter-based refinement, manual graph expansion, and Markdown report retrieval**

## Performance

- **Duration:** 5 min
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- POST /refine endpoint with method/type/year filters and optional re-analysis
- POST /expand endpoint reusing citation expansion for targeted graph growth
- GET /report endpoint returning Markdown literature review
- All endpoints enforce ownership and status validation

## Task Commits

1. **Task 1: Refinement and expansion endpoints** - `5b815ef` (feat)

## Files Created/Modified
- `backend/app/schemas/deep_research.py` - RefineRequest, ExpandAreaRequest, response schemas
- `backend/app/routers/deep_research.py` - Three new endpoints added

## Decisions Made
- Refinement stores filter config for reproducibility
- Manual expansion goes directly to expansion engine (no Temporal workflow needed for synchronous operation)
- Report returned as text/markdown content type

## Deviations from Plan
None

## Issues Encountered
None

---
*Phase: 05-deep-research-engine*
*Completed: 2026-03-16*
