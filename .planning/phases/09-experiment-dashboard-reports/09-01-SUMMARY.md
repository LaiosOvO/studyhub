---
phase: 09-experiment-dashboard-reports
plan: 01
subsystem: ui, api
tags: [valkey, pubsub, websocket, recharts, zustand, next-intl]

requires:
  - phase: 08-experiment-execution-engine
    provides: ExperimentRun model, sync endpoint, WebSocket endpoint
provides:
  - Valkey pub/sub integration for instant WebSocket push
  - queue_position column on ExperimentRun
  - Frontend experiment API client with typed interfaces
  - Zustand store for experiment dashboard state
  - ProgressSummary, TrainingCurveChart, ExperimentDashboard components
  - Experiment list and detail pages with real-time updates
affects: [09-02, 09-03]

tech-stack:
  added: [recharts, valkey.asyncio]
  patterns: [valkey-pubsub-websocket, zustand-experiment-store]

key-files:
  created:
    - backend/alembic/versions/010_add_queue_position_to_experiment_runs.py
    - apps/web/src/lib/api/experiments.ts
    - apps/web/src/stores/experiment-store.ts
    - apps/web/src/components/experiments/ProgressSummary.tsx
    - apps/web/src/components/experiments/TrainingCurveChart.tsx
    - apps/web/src/components/experiments/ExperimentDashboard.tsx
    - apps/web/src/app/[locale]/(auth)/experiments/page.tsx
    - apps/web/src/app/[locale]/(auth)/experiments/[runId]/page.tsx
  modified:
    - backend/app/models/experiment_run.py
    - backend/app/routers/experiments.py
    - backend/app/schemas/experiment.py
    - apps/web/messages/en.json
    - apps/web/messages/zh-CN.json

key-decisions:
  - "Valkey pub/sub with polling fallback -- WebSocket subscribes to Valkey channel for instant push, falls back to 2s polling if Valkey unavailable"
  - "Recharts LineChart with color-coded dots by round status (keep=green, crash=red, discard=orange)"
  - "WebSocket connection managed via useEffect with cleanup on unmount or terminal state"

patterns-established:
  - "Valkey pub/sub pattern: sync endpoint publishes, WebSocket subscribes"
  - "Experiment API client pattern: typed interfaces with readonly fields"

requirements-completed: [DASH-01, DASH-02, DASH-05]

duration: 8min
completed: 2026-03-16
---

# Phase 9 Plan 01: Real-time Experiment Dashboard Summary

**Valkey pub/sub WebSocket push replacing 2s polling, Recharts training curves, and Zustand-powered experiment dashboard with list and detail pages**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-16T03:07:01Z
- **Completed:** 2026-03-16T03:15:00Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Sync endpoint publishes to Valkey pub/sub channel for instant WebSocket push
- WebSocket subscribes to Valkey channel with automatic polling fallback
- queue_position column added to ExperimentRun with Alembic migration
- Frontend experiment API client with fully typed readonly interfaces
- ProgressSummary renders 4 stat cards (round, metric, improvement, status)
- TrainingCurveChart renders Recharts LineChart with color-coded status dots
- Experiment list page with status filters and run cards
- Single experiment page with WebSocket real-time updates

## Task Commits

1. **Task 1: Valkey pub/sub, WebSocket, queue_position migration** - `dbb3c20` (feat)
2. **Task 2: Frontend dashboard components and pages** - `c8cef35` (feat)

## Files Created/Modified
- `backend/app/models/experiment_run.py` - Added queue_position column
- `backend/alembic/versions/010_add_queue_position_to_experiment_runs.py` - Migration
- `backend/app/routers/experiments.py` - Valkey pub/sub in sync, subscriber WebSocket
- `backend/app/schemas/experiment.py` - queue_position in response schema
- `apps/web/src/lib/api/experiments.ts` - Typed API client
- `apps/web/src/stores/experiment-store.ts` - Zustand store
- `apps/web/src/components/experiments/ProgressSummary.tsx` - Stat cards
- `apps/web/src/components/experiments/TrainingCurveChart.tsx` - Recharts chart
- `apps/web/src/components/experiments/ExperimentDashboard.tsx` - Layout component
- `apps/web/src/app/[locale]/(auth)/experiments/page.tsx` - List page
- `apps/web/src/app/[locale]/(auth)/experiments/[runId]/page.tsx` - Detail page
- `apps/web/messages/en.json` - English experiment i18n keys
- `apps/web/messages/zh-CN.json` - Chinese experiment i18n keys

## Decisions Made
- Valkey pub/sub with polling fallback for WebSocket -- ensures dashboard works even if Valkey is down
- Recharts with 'use client' directive (not dynamic import) -- simpler, works well with Next.js client components
- WebSocket connects only for non-terminal states -- saves resources for completed experiments

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Dashboard foundation ready for Plan 09-02 (iteration table, queue management)
- Dashboard foundation ready for Plan 09-03 (report integration)

---
*Phase: 09-experiment-dashboard-reports*
*Completed: 2026-03-16*
