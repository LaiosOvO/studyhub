---
phase: 07-plan-generation-sota-analysis
verified: 2026-03-16T18:30:00Z
status: gaps_found
score: 4/5 must-haves verified
gaps:
  - truth: "System generates experiment plans with hypothesis, method, baselines, metrics, datasets, technical roadmap, and code skeleton"
    status: partial
    reason: "Code skeleton generator exists as orphaned service -- never called during plan generation pipeline. Plans always have code_skeleton=None."
    artifacts:
      - path: "backend/app/services/plan_generation/code_skeleton.py"
        issue: "Defined but never imported or called from generate_plans_activity or anywhere else"
      - path: "backend/app/workflows/activities.py"
        issue: "generate_plans_activity does not call generate_code_skeleton -- missing integration step"
    missing:
      - "Add generate_code_skeleton call in generate_plans_activity (after plan draft generation, before DB persistence)"
      - "Store generated code_skeleton string in ExperimentPlan record"
---

# Phase 7: Plan Generation & SOTA Analysis Verification Report

**Phase Goal:** Users can generate actionable experiment plans from AI-identified research gaps, complete with hypotheses, baselines, datasets, and code skeletons
**Verified:** 2026-03-16T18:30:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | System identifies current SOTA methods and metrics for a given research direction | VERIFIED | `sota_identifier.py` aggregates methods from paper corpus, queries HF Hub, calls LLM with `build_sota_prompt` to produce `SOTAResult` with methods, baselines, metrics, datasets |
| 2 | System generates experiment plans with hypothesis, method, baselines, metrics, datasets, technical roadmap, and code skeleton | PARTIAL | Plan generator produces all fields except code skeleton. `code_skeleton.py` exists but is orphaned -- never called from the Temporal activity pipeline. Plans persist with `code_skeleton=None`. |
| 3 | Each plan includes feasibility scoring (compute requirements, data availability, expected improvement, difficulty) | VERIFIED | `feasibility_scorer.py` scores via Haiku with 4 dimensions, weighted overall formula, safe defaults on failure. Called from `generate_plans_activity` via `score_plans_batch`. |
| 4 | User can choose data strategy (open-source first, own data, hybrid) and see recommended datasets with download links | VERIFIED | `dataset_recommender.py` respects data_strategy ("own_data" returns empty, others search HF Hub). Datasets include download URLs. `PlanGenerationInput.data_strategy` flows through to activity. |
| 5 | User can view and modify generated plans before execution, with plans generated from three entry points (direction, paper improvement, AI-discovered gap) | VERIFIED | Plans list page with card grid, detail/editor page with full structured form (hypothesis, method, baselines, metrics, datasets, roadmap, data strategy all editable). Three entry points handled by `create_plan_context` dispatcher. Save/Approve/Delete with confirmation dialogs. |

**Score:** 4/5 truths verified (1 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/experiment_plan.py` | ExperimentPlan SQLAlchemy model | VERIFIED | 72 lines, 18 fields, all required columns present, imports Base from app.database |
| `backend/app/schemas/plan.py` | Pydantic schemas for plan I/O | VERIFIED | 161 lines, 10+ schema types, FeasibilityScore.is_feasible property, from_attributes config |
| `backend/app/services/plan_generation/sota_identifier.py` | SOTA identification | VERIFIED | 234 lines, corpus analysis + HF Hub + LLM. Pure function `aggregate_methods_by_metric`, async `identify_sota` |
| `backend/app/services/plan_generation/improvement_analyzer.py` | Gap-to-improvement mapping | VERIFIED | 242 lines, three entry point dispatcher, LLM-powered analysis, pure helpers |
| `backend/app/services/plan_generation/prompts.py` | All 5 LLM prompt templates | VERIFIED | 193 lines, all 5 builders present, bilingual-aware, JSON-only output instructions |
| `backend/app/services/plan_generation/plan_generator.py` | AI-Scientist reflection loop | VERIFIED | 287 lines, multi-round generate-reflect-refine with "I am done" early termination, robust JSON parsing |
| `backend/app/services/plan_generation/feasibility_scorer.py` | Multi-dimensional scoring | VERIFIED | 193 lines, Haiku model, weighted overall formula, default scores on failure |
| `backend/app/services/plan_generation/dataset_recommender.py` | HF Hub dataset search | VERIFIED | 209 lines, bilingual keyword extraction, deduplication, data_strategy-aware |
| `backend/app/services/plan_generation/code_skeleton.py` | Code skeleton generation | ORPHANED | 176 lines, substantive implementation with LLM + Jinja2, but never imported or called from any other module |
| `backend/templates/code_skeleton.py.j2` | Jinja2 template | ORPHANED | 63 lines, well-structured template with conditional guards, but not used in pipeline |
| `backend/app/workflows/plan_generation.py` | Temporal workflow | VERIFIED | 143 lines, dataclass I/O, progress query, 20-min timeout, retry policy |
| `backend/app/workflows/activities.py` | generate_plans_activity | VERIFIED | Activity orchestrates full pipeline: load task, build context, generate plans, score feasibility, recommend datasets, persist. 808 lines total file. |
| `backend/app/routers/plans.py` | REST endpoints | VERIFIED | 277 lines, 6 endpoints (generate, list, get, update, delete, approve), ownership checks, status guards |
| `backend/alembic/versions/007_create_experiment_plans_table.py` | Migration | VERIFIED | Creates table with all columns, indexes on user_id and task_id, downgrade drops |
| `apps/web/src/lib/api/plans.ts` | TypeScript API client | VERIFIED | 183 lines, typed interfaces (readonly), all 6 API functions, uses apiFetch wrapper |
| `apps/web/src/app/[locale]/plans/page.tsx` | Plan list page | VERIFIED | 202 lines, card grid, status filter, feasibility badges (color-coded), entry type badges, empty state |
| `apps/web/src/app/[locale]/plans/[planId]/page.tsx` | Plan detail/editor page | VERIFIED | 827 lines, structured form with all fields, confirmation dialogs, save/approve/delete, disabled when non-draft |
| `apps/web/messages/en.json` | English translations | VERIFIED | 48 translation keys under "plans" namespace |
| `apps/web/messages/zh-CN.json` | Chinese translations | VERIFIED | Complete Chinese translations matching all English keys |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `sota_identifier.py` | `deep_research/gap_detector.py` | imports GapResult (indirect via improvement_analyzer) | WIRED | `improvement_analyzer.py` imports `GapResult` from `app.services.deep_research.gap_detector` |
| `plan_generator.py` | `prompts.py` | imports build_plan_generation_prompt, build_reflection_prompt | WIRED | Line 22-23 confirms imports |
| `plan_generation.py` (workflow) | `activities.py` | execute_activity("generate_plans_activity") | WIRED | Line 106-111 in workflow, activity defined at line 642 in activities.py |
| `routers/plans.py` | `temporal_service.py` | start_workflow | WIRED | Line 28 imports start_workflow, line 84 calls it |
| `main.py` | `routers/plans.py` | include_router | WIRED | Line 21 imports, line 120 registers at /api/v1/plans |
| `models/__init__.py` | `experiment_plan.py` | import ExperimentPlan | WIRED | Line 5 in __init__.py |
| `plans.ts` (API client) | `/api/v1/plans` | fetch calls | WIRED | All 6 functions make fetch calls to /api/v1/plans endpoints |
| `plans/[planId]/page.tsx` | `lib/api/plans.ts` | imports | WIRED | Line 7-15 imports fetchPlan, updatePlan, approvePlan, deletePlan |
| `code_skeleton.py` | pipeline | should be called from generate_plans_activity | NOT WIRED | `generate_code_skeleton` is never imported or called anywhere outside its own file |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PLAN-01 | 07-01 | System identifies current SOTA methods and metrics | SATISFIED | `sota_identifier.py` with corpus analysis + HF Hub + LLM |
| PLAN-02 | 07-01 | System analyzes improvement opportunities | SATISFIED | `improvement_analyzer.py` analyze_improvements with LLM |
| PLAN-03 | 07-02 | System generates plans with all required fields | PARTIAL | All fields except code_skeleton (orphaned service) |
| PLAN-04 | 07-02 | Each plan includes feasibility scoring | SATISFIED | `feasibility_scorer.py` with 4 dimensions + overall |
| PLAN-05 | 07-02 | User can choose data strategy | SATISFIED | Data strategy flows through input to dataset_recommender |
| PLAN-06 | 07-02 | System recommends open-source datasets with download links | SATISFIED | `dataset_recommender.py` with HF Hub URLs |
| PLAN-07 | 07-03 | User can view and modify generated plans | SATISFIED | Full editor UI with structured form and save functionality |
| PLAN-08 | 07-01 | Plans from three entry points | SATISFIED | `create_plan_context` dispatches on direction/paper/gap |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/templates/code_skeleton.py.j2` | 27,39,42,49,57,62 | TODO comments (raise NotImplementedError) | Info | Expected in template -- these are scaffolding for generated experiment code |
| `backend/app/services/plan_generation/code_skeleton.py` | N/A | Orphaned module | Warning | Service exists but is never called, resulting in code_skeleton always being None |

### Human Verification Required

### 1. End-to-End Plan Generation Flow

**Test:** Start backend and frontend, complete a Deep Research task, then POST to /api/v1/plans/generate with a valid task_id. Wait for workflow completion.
**Expected:** Plans appear in the plan list with titles, hypotheses, feasibility scores, and dataset recommendations populated from LLM output and HF Hub.
**Why human:** Requires running services (Temporal, PostgreSQL, LLM API) and verifying LLM output quality.

### 2. Plan Editing and Approval

**Test:** Navigate to a generated plan, modify the hypothesis and baselines, save, then approve.
**Expected:** Changes persist after save, status changes to "approved" after confirmation, form fields become disabled.
**Why human:** Visual interaction and state transition verification.

### 3. Bilingual UI

**Test:** Switch locale between English and Chinese on the plans pages.
**Expected:** All labels, buttons, status badges, and empty states render in the correct language.
**Why human:** Visual verification of translation completeness and correctness.

### Gaps Summary

There is one gap blocking full goal achievement:

**Code skeleton generation is orphaned.** The `code_skeleton.py` service and `code_skeleton.py.j2` Jinja2 template exist and are substantive implementations (176 lines + 63 lines), but `generate_code_skeleton` is never called from `generate_plans_activity` in `activities.py`. As a result, all generated plans will have `code_skeleton = None`, and the frontend will always show "Code skeleton not yet generated." This affects success criterion #2 which explicitly requires "code skeleton" as part of generated plans, and partially blocks requirement PLAN-03.

The fix is straightforward: add a call to `generate_code_skeleton` in the `generate_plans_activity` function between plan draft generation and DB persistence, then store the result in the `ExperimentPlan.code_skeleton` field.

---

_Verified: 2026-03-16T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
