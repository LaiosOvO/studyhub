---
phase: 09-experiment-dashboard-reports
plan: 03
subsystem: api, ui, reporting
tags: [matplotlib, weasyprint, jinja2, pdf, react-markdown, llm]

requires:
  - phase: 09-experiment-dashboard-reports
    provides: ExperimentDashboard, experiment API client, Valkey pub/sub sync
provides:
  - matplotlib chart generators (training curve, comparison, improvement)
  - Bilingual Jinja2 experiment report template
  - WeasyPrint PDF generation with CJK font support
  - Report REST endpoints (get, download pdf, generate)
  - Auto-trigger report on experiment completion
  - ReportViewer frontend with react-markdown and PDF download
affects: []

tech-stack:
  added: [weasyprint, markdown, matplotlib, Pillow, react-markdown]
  patterns: [background-report-generation, jinja2-bilingual-template]

key-files:
  created:
    - backend/app/services/experiment/chart_generator.py
    - backend/app/services/experiment/report_generator.py
    - backend/templates/experiment_report.md.j2
    - apps/web/src/components/experiments/ReportViewer.tsx
    - apps/web/src/app/[locale]/(auth)/experiments/[runId]/report/page.tsx
  modified:
    - backend/pyproject.toml
    - backend/app/routers/experiments.py
    - backend/app/schemas/experiment.py
    - apps/web/src/lib/api/experiments.ts

key-decisions:
  - "Haiku model for abstract/conclusion LLM generation -- cost-efficient for summary text"
  - "PDF stored as base64 in ExperimentRun.config -- lightweight for MVP, SeaweedFS later"
  - "Background asyncio.create_task for report gen on completion -- non-blocking sync endpoint"

patterns-established:
  - "Background report generation on status transition to completed"
  - "react-markdown for safe Markdown rendering (no dangerouslySetInnerHTML)"

requirements-completed: [REPT-01, REPT-02, REPT-03, REPT-04]

duration: 8min
completed: 2026-03-16
---

# Phase 9 Plan 03: Auto-generated Experiment Reports Summary

**Matplotlib chart generators, Jinja2 bilingual report template, WeasyPrint PDF with CJK fonts, auto-trigger on completion, and react-markdown ReportViewer with PDF download**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-16T03:21:00Z
- **Completed:** 2026-03-16T03:29:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- chart_generator with training curve, comparison, and improvement PNG generation
- Bilingual Jinja2 report template with abstract, methodology, results, charts, conclusion
- report_generator pipeline: charts -> LLM abstract/conclusion -> Jinja2 render -> WeasyPrint PDF
- Auto-trigger report generation on experiment completion via asyncio background task
- REST endpoints: GET report (markdown/pdf), POST generate, GET pdf download
- ReportViewer with react-markdown rendering, generate button, and PDF blob download
- Report page accessible at /experiments/{runId}/report

## Task Commits

1. **Task 1: Chart generators and Jinja2 template** - `0fd8880` (feat)
2. **Task 2: Report generator, endpoints, and ReportViewer** - `d115dc3` (feat)

## Files Created/Modified
- `backend/app/services/experiment/chart_generator.py` - matplotlib PNG generators
- `backend/app/services/experiment/report_generator.py` - Full report pipeline
- `backend/templates/experiment_report.md.j2` - Bilingual report template
- `backend/app/routers/experiments.py` - Report endpoints and auto-trigger
- `backend/app/schemas/experiment.py` - ExperimentReportResponse schema
- `backend/pyproject.toml` - weasyprint, markdown, matplotlib, Pillow deps
- `apps/web/src/lib/api/experiments.ts` - Report API functions
- `apps/web/src/components/experiments/ReportViewer.tsx` - Markdown viewer + PDF download
- `apps/web/src/app/[locale]/(auth)/experiments/[runId]/report/page.tsx` - Report page

## Decisions Made
- Haiku model for LLM text generation in reports (cost-efficient)
- PDF stored as base64 in config (SeaweedFS for large files deferred)
- Background task for report generation (non-blocking sync endpoint)
- react-markdown for safe client-side rendering

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 9 complete: dashboard, queue management, iteration comparison, and auto-generated reports
- Ready for phase verification

---
*Phase: 09-experiment-dashboard-reports*
*Completed: 2026-03-16*
