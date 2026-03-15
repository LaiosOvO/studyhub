---
phase: 05-deep-research-engine
plan: 01
subsystem: api
tags: [temporal, websocket, fastapi, postgresql, asyncio]

requires:
  - phase: 04-citation-network-quality-scoring
    provides: Neo4j client, citation expansion engine, quality scorer
  - phase: 02-paper-search-ingestion
    provides: Search aggregator, paper model, search schemas
provides:
  - DeepResearchTask model and Alembic migration
  - Temporal workflow with 7-stage pipeline and query-based progress
  - REST endpoints for task CRUD (POST/GET /deep-research/tasks)
  - WebSocket endpoint for real-time progress streaming
  - Pipeline activities (search, expand, score real; analyze/classify/gaps/report placeholders)
affects: [05-02, 05-03, 05-04, 06-paper-map-visualization]

tech-stack:
  added: []
  patterns: [temporal-workflow-query-progress, websocket-jwt-auth, json-string-activity-io]

key-files:
  created:
    - backend/app/models/deep_research.py
    - backend/app/schemas/deep_research.py
    - backend/app/routers/deep_research.py
    - backend/alembic/versions/006_create_deep_research_tasks_table.py
  modified:
    - backend/app/workflows/deep_research.py
    - backend/app/workflows/activities.py
    - backend/app/main.py
    - backend/app/models/__init__.py

key-decisions:
  - "Temporal workflow query (not signal) for progress -- enables pull-based WebSocket polling"
  - "JSON string I/O for all activities -- Temporal payload serialization constraint"
  - "Activity isolation pattern -- each activity creates own DB session and HTTP client"
  - "Placeholder activities for Plans 02/03 -- enables full pipeline testing before real implementations"
  - "Removed Phase 1 inline workflow routes from main.py -- replaced by proper deep_research router"

patterns-established:
  - "WebSocket JWT auth via query parameter: token verified with same decode_token logic as REST"
  - "Activity JSON I/O: all Temporal activities accept/return JSON strings for serialization safety"
  - "Placeholder-first pipeline: full workflow skeleton with placeholders, replaced incrementally"

requirements-completed: [DEEP-01, DEEP-02, DEEP-03, DEEP-04, DEEP-05]

duration: 12min
completed: 2026-03-16
---

# Plan 05-01: Deep Research Workflow Summary

**Temporal workflow orchestrating search/expand/score/analyze pipeline with WebSocket progress streaming and REST task management**

## Performance

- **Duration:** 12 min
- **Tasks:** 2
- **Files created:** 4
- **Files modified:** 4

## Accomplishments
- DeepResearchTask model with workflow tracking, gaps/trends/report storage
- 7-stage Temporal pipeline: search -> expand -> score -> analyze -> classify -> detect_gaps -> generate_report
- REST endpoints: POST (create task + start workflow), GET list (paginated), GET detail (ownership-checked)
- WebSocket /ws/deep-research/{workflow_id} with JWT auth and 3s progress polling
- Pipeline activities with real search/expand/score implementations and Plan 02/03 placeholders

## Task Commits

1. **Task 1: DeepResearchTask model, schemas, migration** - `8cfb514` (feat)
2. **Task 2: Temporal workflow, activities, router, main.py** - `0256670` (feat)

## Files Created/Modified
- `backend/app/models/deep_research.py` - DeepResearchTask SQLAlchemy model
- `backend/app/schemas/deep_research.py` - Input, progress, result, task response schemas
- `backend/alembic/versions/006_create_deep_research_tasks_table.py` - Migration
- `backend/app/routers/deep_research.py` - REST + WebSocket endpoints
- `backend/app/workflows/deep_research.py` - Full pipeline workflow replacing Phase 1 placeholder
- `backend/app/workflows/activities.py` - 7 activity definitions (3 real, 4 placeholder)
- `backend/app/main.py` - Router registration, removed inline workflow routes

## Decisions Made
- Used Temporal workflow query (not signal) for progress tracking -- pull-based, simpler for WebSocket polling
- All activities use JSON string I/O to satisfy Temporal serialization requirements
- Removed Phase 1 inline workflow routes from main.py in favor of proper router module
- WebSocket authenticates via query param `token` (WebSocket API doesn't support Authorization headers)

## Deviations from Plan
- Plan specified migration filename as `005_deep_research_task.py` but 005 was already taken by scholars table; used `006_create_deep_research_tasks_table.py`
- Added placeholder activities for Plans 02/03 in this plan to complete the full pipeline skeleton

## Issues Encountered
None

## Next Phase Readiness
- Plan 02 (AI analysis) replaces `analyze_papers_activity` and `classify_relationships_activity` placeholders
- Plan 03 (gaps/report) replaces `detect_gaps_activity` and `generate_report_activity` placeholders
- Plan 04 (refinement) adds new endpoints to the existing deep_research router

---
*Phase: 05-deep-research-engine*
*Completed: 2026-03-16*
