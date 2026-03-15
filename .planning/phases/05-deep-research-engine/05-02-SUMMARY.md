---
phase: 05-deep-research-engine
plan: 02
subsystem: api
tags: [llm, litellm, haiku, sonnet, analysis, classification, temporal]

requires:
  - phase: 05-deep-research-engine
    provides: DeepResearchTask model, Temporal workflow, pipeline activities
provides:
  - Tiered LLM analyzer (Haiku screening + Sonnet deep analysis)
  - Prompt templates with XML-tag sanitization for TLDR, deep analysis, relationship classification
  - PaperAnalysis and RelationshipResult data models
  - Real analyze_papers_activity and classify_relationships_activity Temporal activities
affects: [05-03, 05-04]

tech-stack:
  added: []
  patterns: [tiered-llm-analysis, cost-ceiling-enforcement, xml-tag-prompt-sanitization]

key-files:
  created:
    - backend/app/services/deep_research/__init__.py
    - backend/app/services/deep_research/prompts.py
    - backend/app/services/deep_research/analyzer.py
  modified:
    - backend/app/workflows/activities.py

key-decisions:
  - "Haiku for screening and classification, Sonnet for deep analysis -- cost efficiency"
  - "Store per-paper analyses in DeepResearchTask.config['paper_analyses'] -- avoids schema migration"
  - "Only classify citation-connected pairs (Neo4j CITES edges) -- O(edges) not O(n^2)"
  - "Cost ceiling enforcement with $0.01/screening + $0.10/deep estimates"

patterns-established:
  - "XML-tag delimiters in prompts: <paper><title>...</title><abstract>...</abstract></paper>"
  - "Tiered LLM analysis: cheap model (Haiku) screens all, expensive model (Sonnet) for top-N"
  - "Immutable merge: deep analysis creates new PaperAnalysis, never mutates screening result"

requirements-completed: [ANAL-01, ANAL-02, ANAL-05, ANAL-06]

duration: 10min
completed: 2026-03-16
---

# Plan 05-02: AI Analysis Pipeline Summary

**Tiered LLM analyzer with Haiku/Sonnet cost-controlled screening, bilingual TLDR, and citation relationship classification**

## Performance

- **Duration:** 10 min
- **Tasks:** 2
- **Files created:** 3
- **Files modified:** 1

## Accomplishments
- Prompt templates with XML-tag delimiters for injection prevention
- Two-pass tiered analysis: Haiku screens abstracts, Sonnet deep-analyzes top-N parsed papers
- Cost ceiling enforcement tracking cumulative spend
- Relationship classification on Neo4j CITES edges with confidence scores

## Task Commits

1. **Task 1: Prompts and analyzer service** - `2309639` (feat)
2. **Task 2: Wire activities into Temporal pipeline** - `d4b689d` (feat)

## Files Created/Modified
- `backend/app/services/deep_research/__init__.py` - Package init
- `backend/app/services/deep_research/prompts.py` - TLDR, deep analysis, relationship prompts
- `backend/app/services/deep_research/analyzer.py` - Tiered analyzer and classifier
- `backend/app/workflows/activities.py` - Real analyze/classify activities replacing placeholders

## Decisions Made
- Haiku for screening ($0.01/paper) and classification, Sonnet for deep analysis ($0.10/paper)
- Per-paper analyses stored in DeepResearchTask.config["paper_analyses"] to avoid migration
- Relationship classification limited to Neo4j CITES edges (O(edges) not O(n^2))

## Deviations from Plan
None - plan executed as specified

## Issues Encountered
None

## Next Phase Readiness
- Plan 03 can build gap detection and report generation using PaperAnalysis data
- Plan 04 can add refinement endpoints using existing task/analysis infrastructure

---
*Phase: 05-deep-research-engine*
*Completed: 2026-03-16*
