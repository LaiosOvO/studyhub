---
phase: 01-infrastructure-auth-foundation
plan: 04
subsystem: infra
tags: [litellm, llm-gateway, cost-tracking, temporal, workflow, deep-research, rate-limiting, slowapi]

requires:
  - phase: 01-01
    provides: Docker Compose stack, async SQLAlchemy, Pydantic Settings
provides:
  - Unified LLM Gateway with litellm provider abstraction and model fallback
  - Per-request cost tracking in llm_usage table
  - Rate-limited LLM API endpoints (completion + usage stats)
  - Temporal worker with DeepResearchWorkflow template
  - Workflow trigger endpoint POST /workflows/deep-research
affects: [02-data-models, 05-deep-research, 06-experiments, all-llm-consumers]

tech-stack:
  added: [litellm, slowapi, temporalio]
  patterns: [llm-fallback-chain, cost-tracking-per-request, temporal-workflow-template, temporal-client-caching]

key-files:
  created:
    - backend/app/services/llm_service.py
    - backend/app/routers/llm.py
    - backend/app/models/llm_usage.py
    - backend/app/schemas/llm.py
    - backend/app/services/temporal_service.py
    - backend/app/workflows/__init__.py
    - backend/app/workflows/deep_research.py
    - backend/app/workflows/activities.py
    - backend/app/worker.py
    - backend/app/main.py
    - backend/alembic/versions/002_create_llm_usage_table.py
    - backend/tests/test_llm.py
    - backend/tests/test_temporal.py
  modified:
    - backend/app/models/__init__.py

key-decisions:
  - "LiteLLM as unified provider abstraction: single interface for Anthropic, OpenAI, and future providers"
  - "Fallback chain pattern: primary model failure triggers automatic switch to configured fallback model"
  - "Temporal client connection non-fatal at startup: app runs without Temporal, workflow endpoints return 503"
  - "Rate limiting via slowapi at 10 requests/minute per IP on LLM completion endpoint"

patterns-established:
  - "LLM fallback: try primary model, catch any exception, retry with fallback model"
  - "Cost tracking: litellm.completion_cost() for automatic cost calculation per request"
  - "Temporal client caching: module-level singleton with reset_client() for testing"
  - "Workflow endpoint pattern: generate unique workflow_id, start_workflow, return ID to caller"
  - "API response envelope: {success, data, error} consistent across endpoints"

requirements-completed: [INFRA-03, INFRA-06]

duration: 9min
completed: 2026-03-15
---

# Phase 1 Plan 4: LLM Gateway & Temporal Workflows Summary

**LLM Gateway with litellm provider abstraction, automatic model fallback, per-request cost tracking, plus Temporal worker with DeepResearchWorkflow template**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-15T08:08:08Z
- **Completed:** 2026-03-15T08:17:29Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Unified LLM service wrapping litellm with automatic primary-to-fallback model switching
- Per-request cost tracking recording prompt tokens, completion tokens, and USD cost in llm_usage table
- Rate-limited API endpoints for LLM completion (10/min) and usage stats aggregation
- Temporal worker entry point with DeepResearchWorkflow template and placeholder activity
- Workflow trigger endpoint at POST /workflows/deep-research with input validation
- 33 unit tests covering both LLM and Temporal functionality (all passing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Build LLM Gateway service with cost tracking and fallback** - `2191ade` (feat)
2. **Task 2: Set up Temporal worker with Deep Research workflow template** - `2077ac6` (feat)

## Files Created/Modified
- `backend/app/services/llm_service.py` - Unified LLM interface with fallback and cost tracking
- `backend/app/routers/llm.py` - Rate-limited /completion and /usage endpoints
- `backend/app/models/llm_usage.py` - SQLAlchemy model for token usage and cost records
- `backend/app/schemas/llm.py` - Pydantic schemas for LLM request/response validation
- `backend/app/services/temporal_service.py` - Cached Temporal client wrapper
- `backend/app/workflows/deep_research.py` - DeepResearchWorkflow with Temporal decorators
- `backend/app/workflows/activities.py` - Placeholder search activity for Phase 5
- `backend/app/worker.py` - Temporal worker entry point registering workflows and activities
- `backend/app/main.py` - FastAPI app with LLM router, Temporal lifespan, workflow endpoint
- `backend/alembic/versions/002_create_llm_usage_table.py` - Migration for cost tracking table
- `backend/tests/test_llm.py` - 14 tests for LLM service, schemas, routing, rate limiting
- `backend/tests/test_temporal.py` - 19 tests for workflows, activities, service, worker
- `backend/app/models/__init__.py` - Updated to export LLMUsage model

## Decisions Made
- LiteLLM as unified provider abstraction: single interface for Anthropic, OpenAI, and any future providers via litellm's model routing
- Fallback chain pattern: primary model failure automatically triggers secondary model attempt before raising
- Temporal client connection is non-fatal at startup: app continues running if Temporal is unavailable, workflow endpoints return HTTP 503
- Rate limiting at 10 requests/minute per IP using slowapi on the LLM completion endpoint

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing slowapi dependency**
- **Found during:** Task 1 (LLM router tests)
- **Issue:** slowapi listed in pyproject.toml but not installed in current Python environment
- **Fix:** Installed slowapi via pip
- **Files modified:** None (runtime dependency only)
- **Verification:** All 14 LLM tests pass including router import tests
- **Committed in:** 2191ade (Task 1 commit)

**2. [Rule 1 - Bug] Fixed route path assertions in tests**
- **Found during:** Task 1 (LLM router tests)
- **Issue:** Router routes include prefix (/llm/completion), test asserted bare path (/completion)
- **Fix:** Changed assertions to use `any("/completion" in r for r in routes)` pattern
- **Files modified:** backend/tests/test_llm.py
- **Verification:** All router tests pass
- **Committed in:** 2191ade (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for test correctness. No scope creep.

## Issues Encountered
- Plan 02 running in parallel modified models/__init__.py and schemas/__init__.py during execution. Adapted by extending the existing models/__init__.py to include LLMUsage export alongside User.

## User Setup Required
LLM endpoints require API keys configured in environment:
- `ANTHROPIC_API_KEY` - from https://console.anthropic.com/settings/keys
- `OPENAI_API_KEY` - from https://platform.openai.com/api-keys
- Temporal server must be running for workflow endpoints (Docker Compose stack provides this)

## Next Phase Readiness
- LLM Gateway ready for all AI-powered features (Deep Research, analysis, plan generation)
- Cost tracking infrastructure ready for usage monitoring and budget controls
- Temporal workflow template ready for Phase 5 expansion (real paper search pipeline)
- Worker entry point ready to register additional workflows from future phases

## Self-Check: PASSED

All 14 created files verified present. Both task commits (2191ade, 2077ac6) verified in git log.

---
*Phase: 01-infrastructure-auth-foundation*
*Completed: 2026-03-15*
