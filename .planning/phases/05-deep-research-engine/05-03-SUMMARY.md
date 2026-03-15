---
phase: 05-deep-research-engine
plan: 03
subsystem: api
tags: [llm, jinja2, gap-detection, trends, report-generation]

requires:
  - phase: 05-deep-research-engine
    provides: PaperAnalysis data, analyzer service, Temporal pipeline
provides:
  - Gap detection with corpus-level LLM analysis
  - Method trend detection (ascending/declining) via year-grouped frequencies
  - Bilingual Markdown literature review via Jinja2 template
  - Real detect_gaps_activity and generate_report_activity
affects: [06-paper-map-visualization, 07-plan-generation]

tech-stack:
  added: [jinja2]
  patterns: [corpus-level-aggregation, bilingual-jinja2-template]

key-files:
  created:
    - backend/app/services/deep_research/gap_detector.py
    - backend/app/services/deep_research/report_generator.py
    - backend/templates/literature_review.md.j2
  modified:
    - backend/app/services/deep_research/prompts.py
    - backend/app/workflows/activities.py

key-decisions:
  - "Sonnet for gap detection (requires corpus-level reasoning), Haiku for trend detection (simpler)"
  - "Jinja2 with FileSystemLoader for template rendering -- handles bilingual conditionals cleanly"
  - "GapResult/TrendResult as Pydantic models stored in task.gaps/task.trends JSON columns"

patterns-established:
  - "Corpus summarization via Counter aggregation of methods/datasets from PaperAnalysis list"
  - "Bilingual Jinja2 template: language=='zh' conditionals for Chinese/English sections"

requirements-completed: [ANAL-03, ANAL-04, DEEP-08]

duration: 8min
completed: 2026-03-16
---

# Plan 05-03: Gap Detection and Literature Review Summary

**Corpus-level gap/trend detection and bilingual Jinja2 Markdown literature review generation**

## Performance

- **Duration:** 8 min
- **Tasks:** 2
- **Files created:** 3
- **Files modified:** 2

## Accomplishments
- Gap detection with structured GapResult (gaps, underexplored combinations, missing evaluations)
- Trend detection with year-grouped method frequency analysis
- Bilingual Markdown literature review template with sections for key papers, methods, gaps, trends
- All 7 Temporal pipeline activities now have real implementations

## Task Commits

1. **Task 1: Gap detector, report generator, template** - `dc48001` (feat)
2. **Task 2: Wire activities into pipeline** - `d9ed60f` (feat)

## Files Created/Modified
- `backend/app/services/deep_research/gap_detector.py` - GapResult, TrendResult, detect_gaps, detect_trends
- `backend/app/services/deep_research/report_generator.py` - Jinja2 report renderer
- `backend/templates/literature_review.md.j2` - Bilingual literature review template
- `backend/app/services/deep_research/prompts.py` - Added gap and trend prompt builders
- `backend/app/workflows/activities.py` - Real gap/report activities

## Decisions Made
- Sonnet for gap detection (quality reasoning), Haiku for trend detection (pattern matching)
- Jinja2 FileSystemLoader resolves templates relative to backend/templates/
- Report stores gaps/trends in task JSON columns, report_markdown in Text column

## Deviations from Plan
None

## Issues Encountered
None

---
*Phase: 05-deep-research-engine*
*Completed: 2026-03-16*
