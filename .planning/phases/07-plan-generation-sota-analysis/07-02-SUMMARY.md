---
phase: 07-plan-generation-sota-analysis
plan: 02
status: done
---

# Plan 07-02 Summary: Plan Generator, Feasibility Scoring, and REST API

## What was built

### Task 1: Plan generator, feasibility scorer, and dataset recommender services

1. **`backend/app/services/plan_generation/plan_generator.py`**
   - `generate_experiment_plans()`: AI-Scientist-style generation with multi-round reflection
   - For each plan: initial generation (Sonnet) -> reflection loop (2-3 rounds) -> final draft
   - Reflection terminates early on "I am done" signal (AI-Scientist pattern)
   - Pure formatting helpers: `_format_sota_summary`, `_format_gaps_summary`, `_format_improvements_summary`, `_format_entry_context`
   - Robust JSON parsing with markdown fence handling
   - Graceful failure: logs warning and continues if a single plan fails

2. **`backend/app/services/plan_generation/feasibility_scorer.py`**
   - `score_feasibility()`: Single-plan scoring via Haiku (cost-efficient)
   - `score_plans_batch()`: Sequential batch scoring
   - Four dimensions: compute_requirements, data_availability, expected_improvement, difficulty
   - Overall score: weighted average with inverted compute/difficulty (higher = more feasible)
   - Returns safe default score on any failure

3. **`backend/app/services/plan_generation/dataset_recommender.py`**
   - `recommend_datasets()`: HF Hub search via `asyncio.to_thread` (non-blocking)
   - `extract_search_keywords()`: Bilingual keyword extraction (EN + ZH stop words)
   - `deduplicate_and_rank()`: Deduplication by name, ranked by downloads
   - Respects data_strategy: "own_data" returns empty, "hybrid" includes HF results
   - Non-fatal: returns empty list on any HfApi error

### Task 2: Temporal workflow, activities, REST endpoints, and router registration

1. **`backend/app/workflows/plan_generation.py`**
   - `PlanGenerationWorkflow`: Temporal workflow with progress query
   - Dataclass I/O: `PlanGenerationWorkflowInput`, `PlanGenerationWorkflowResult`
   - Single activity (`generate_plans_activity`) with 20-minute timeout
   - Progress phases: pending -> generating -> completed/failed

2. **`backend/app/workflows/activities.py`** (updated)
   - `generate_plans_activity()`: All-in-one activity orchestrating the full pipeline
   - Steps: load task -> build context -> generate plans -> score feasibility -> recommend datasets -> persist ExperimentPlan records
   - Activity isolation: creates own DB session
   - Merges HF dataset recommendations into plan datasets (avoiding duplicates)

3. **`backend/app/routers/plans.py`**
   - `POST /generate` (202): Start plan generation workflow via Temporal
   - `GET /` : List plans (paginated, filterable by task_id and status)
   - `GET /{plan_id}`: Get single plan with ownership check
   - `PATCH /{plan_id}`: Update draft plan fields
   - `DELETE /{plan_id}` (204): Delete draft plan
   - `POST /{plan_id}/approve`: Change status from draft to approved
   - All endpoints enforce ownership and status checks

4. **`backend/app/main.py`** (updated)
   - Registered plans_router at `/api/v1/plans`

## Key patterns used
- AI-Scientist reflection: generate -> reflect -> refine (2-3 rounds, early "I am done" exit)
- Haiku for feasibility scoring (cost control)
- Sonnet for plan generation and reflection (quality)
- asyncio.to_thread for HF Hub API (non-blocking)
- Temporal workflow with JSON string I/O (isolation pattern)
- Immutable data patterns throughout (no mutation)

## References
- AI-Scientist `generate_ideas.py`: reflection loop and "I am done" pattern
- MLE-agent: plan structure and dataset discovery
- DeepResearchWorkflow: Temporal workflow pattern
- deep_research router: REST endpoint patterns
