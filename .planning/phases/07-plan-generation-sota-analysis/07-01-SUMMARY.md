# 07-01 Summary: ExperimentPlan Model, SOTA Identifier, Improvement Analyzer

## Status: COMPLETE

## What Was Built

### Task 1: ExperimentPlan model, schemas, and migration
- **ExperimentPlan model** (`backend/app/models/experiment_plan.py`): SQLAlchemy model with 18 fields covering plan content (title, hypothesis, method_description, baselines, metrics, datasets, technical_roadmap, code_skeleton), feasibility scoring, entry context (entry_type, source_paper_id, source_gap_index), data strategy, and status tracking.
- **Migration 007** (`backend/alembic/versions/007_create_experiment_plans_table.py`): Creates `experiment_plans` table with indexes on user_id and task_id.
- **Pydantic schemas** (`backend/app/schemas/plan.py`): 10 schema types -- PlanGenerationInput, SOTAMethod, SOTAResult, ImprovementOpportunity, FeasibilityScore (with is_feasible property), DatasetRecommendation, PlanGenerationContext, ExperimentPlanResponse, ExperimentPlanUpdate.
- **Updated models/__init__.py**: ExperimentPlan added to exports.

### Task 2: Prompt templates, SOTA identifier, improvement analyzer
- **Prompt templates** (`backend/app/services/plan_generation/prompts.py`): 5 prompt builders covering the full pipeline -- build_sota_prompt, build_improvement_prompt, build_plan_generation_prompt, build_reflection_prompt (AI-Scientist reflection pattern), build_feasibility_prompt (Haiku-targeted).
- **SOTA identifier** (`backend/app/services/plan_generation/sota_identifier.py`): aggregate_methods_by_metric (pure), search_hf_benchmarks (async, HfApi via asyncio.to_thread), identify_sota (main entry, corpus + HF Hub + LLM).
- **Improvement analyzer** (`backend/app/services/plan_generation/improvement_analyzer.py`): get_top_papers (pure), analyze_improvements (LLM-powered gap-to-improvement), create_plan_context (three entry point dispatcher: direction/paper/gap).

## Dependencies Added
- `huggingface_hub` via `uv add`

## Key Design Decisions
- No DB FK constraint on task_id (matches project pattern for DeepResearchTask references)
- Immutable patterns throughout: all pure functions return new objects, no mutation of inputs
- Three-entry-point dispatcher in create_plan_context enables PLAN-08 requirement
- Prompts are bilingual-aware and strictly JSON-output-only
- HF Hub search is non-fatal with graceful fallback

## Verification
- All model and schema imports verified
- All service imports verified
- Pure functions tested with mock data (aggregate_methods_by_metric, get_top_papers)
- Prompt builders verified to return correct list[dict] format
