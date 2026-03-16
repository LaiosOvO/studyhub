---
phase: 08-experiment-execution-engine
plan: 01a
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/models/experiment_run.py
  - backend/app/models/__init__.py
  - backend/app/schemas/experiment.py
  - backend/alembic/versions/008_create_experiment_runs_table.py
  - backend/app/routers/experiments.py
  - backend/app/main.py
autonomous: true
requirements:
  - EXPR-01

must_haves:
  truths:
    - "ExperimentRun model persists experiment state (plan_id, status, rounds, metrics) in PostgreSQL"
    - "REST API supports CRUD for experiment runs with ownership checks"
  artifacts:
    - path: "backend/app/models/experiment_run.py"
      provides: "ExperimentRun SQLAlchemy model"
      contains: "class ExperimentRun"
    - path: "backend/app/schemas/experiment.py"
      provides: "Experiment run Pydantic schemas"
      exports: ["ExperimentRunCreate", "ExperimentRunResponse", "ExperimentRunUpdate"]
    - path: "backend/app/routers/experiments.py"
      provides: "Experiment REST + WebSocket endpoints"
      exports: ["router"]
  key_links:
    - from: "backend/app/routers/experiments.py"
      to: "backend/app/models/experiment_run.py"
      via: "SQLAlchemy async session"
      pattern: "ExperimentRun"
    - from: "backend/app/main.py"
      to: "backend/app/routers/experiments.py"
      via: "router registration"
      pattern: "experiments_router"
---

<objective>
Create the ExperimentRun backend model, schemas, migration, and REST API for experiment tracking.

Purpose: Establish the data model for tracking experiment execution that all subsequent plans build upon.
Output: ExperimentRun model + migration, experiment CRUD API with sync and WebSocket endpoints.
</objective>

<execution_context>
@/Users/admin/.claude/get-shit-done/workflows/execute-plan.md
@/Users/admin/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/08-experiment-execution-engine/08-RESEARCH.md

<interfaces>
From backend/app/models/experiment_plan.py (Phase 7 -- plan that gets executed):
```python
class ExperimentPlan(Base):
    __tablename__ = "experiment_plans"
    id: Mapped[str]  # hex UUID
    user_id: Mapped[str]
    task_id: Mapped[str]
    title: Mapped[str]
    hypothesis: Mapped[str]
    method_description: Mapped[str]
    baselines: Mapped[list]  # JSON
    metrics: Mapped[list]  # JSON
    datasets: Mapped[list]  # JSON
    technical_roadmap: Mapped[list]  # JSON
    code_skeleton: Mapped[str | None]
    feasibility: Mapped[dict | None]  # JSON
    data_strategy: Mapped[str]  # "open_source" | "own_data" | "hybrid"
    status: Mapped[str]  # "draft" | "approved" | "executing" | "completed"
```

From backend/app/schemas/plan.py:
```python
DataStrategy = Literal["open_source", "own_data", "hybrid"]
EntryType = Literal["direction", "paper", "gap"]
class ExperimentPlanResponse(BaseModel): ...  # Full plan response with all fields
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: ExperimentRun model, schemas, and migration</name>
  <files>
    backend/app/models/experiment_run.py
    backend/app/models/__init__.py
    backend/app/schemas/experiment.py
    backend/alembic/versions/008_create_experiment_runs_table.py
  </files>
  <action>
    **ExperimentRun model** (`backend/app/models/experiment_run.py`):
    Create SQLAlchemy model with fields:
    - `id`: String(36), primary key, default uuid4().hex
    - `user_id`: String(36), not null, indexed
    - `plan_id`: String(36), not null, indexed (links to ExperimentPlan)
    - `status`: String(20), not null, default "pending" (pending | setting_up | baseline | running | paused | completed | failed | cancelled)
    - `workspace_path`: Text, nullable (local filesystem path on desktop)
    - `docker_image`: String(255), nullable
    - `gpu_device`: Integer, default 0
    - `current_round`: Integer, default 0
    - `max_rounds`: Integer, default 20
    - `consecutive_no_improve_limit`: Integer, default 5
    - `time_budget_minutes`: Integer, nullable
    - `best_metric_name`: String(100), nullable
    - `best_metric_value`: Float, nullable
    - `baseline_metric_value`: Float, nullable
    - `rounds`: JSON, default list (array of {round, status, metric_value, description, git_sha, duration_seconds})
    - `config`: JSON, default dict (arbitrary config including user_guidance, stopping_conditions)
    - `started_at`: DateTime(timezone=True), nullable
    - `completed_at`: DateTime(timezone=True), nullable
    - `created_at`: DateTime(timezone=True), server_default=func.now()
    - `updated_at`: DateTime(timezone=True), nullable

    Add ExperimentRun to `models/__init__.py` exports.

    **Schemas** (`backend/app/schemas/experiment.py`):
    - `ExperimentRunCreate`: plan_id (str), gpu_device (int=0), max_rounds (int=20), consecutive_no_improve_limit (int=5), time_budget_minutes (int|None), docker_image (str|None)
    - `ExperimentRunResponse`: All model fields mapped to Pydantic, datetime as ISO strings
    - `ExperimentRunUpdate`: Optional fields for status, config, user_guidance
    - `ExperimentRoundResult`: round (int), status (str), metric_value (float|None), description (str), git_sha (str|None), duration_seconds (float|None)
    - `GpuMetrics`: gpu_utilization_pct (float), memory_used_mb (int), memory_total_mb (int), temperature_c (int), power_watts (float), name (str)
    - `ExperimentSyncPayload`: run_id (str), status (str), current_round (int), best_metric_value (float|None), gpu_metrics (GpuMetrics|None), latest_round (ExperimentRoundResult|None)

    **Migration** (`008_create_experiment_runs_table.py`):
    Standard Alembic migration creating experiment_runs table with indexes on user_id and plan_id.
  </action>
  <verify>
    <automated>cd /Users/admin/ai/self-dev/study-community/backend && python -c "
from app.models.experiment_run import ExperimentRun
from app.schemas.experiment import ExperimentRunCreate, ExperimentRunResponse, ExperimentSyncPayload, GpuMetrics, ExperimentRoundResult

# Behavioral: verify model has required columns
cols = {c.name for c in ExperimentRun.__table__.columns}
required = {'id', 'user_id', 'plan_id', 'status', 'current_round', 'max_rounds', 'rounds', 'config'}
missing = required - cols
assert not missing, f'Missing columns: {missing}'

# Behavioral: verify schema validation
run = ExperimentRunCreate(plan_id='test123')
assert run.max_rounds == 20, 'Default max_rounds should be 20'
assert run.gpu_device == 0, 'Default gpu_device should be 0'

print('All imports and behavioral checks OK')
"</automated>
  </verify>
  <done>ExperimentRun model with 18+ fields created, migration written, 6 Pydantic schemas defined with validated defaults</done>
</task>

<task type="auto">
  <name>Task 2: Experiment REST API and router registration</name>
  <files>
    backend/app/routers/experiments.py
    backend/app/main.py
  </files>
  <action>
    **REST API** (`backend/app/routers/experiments.py`):
    - `POST /` (201): Create experiment run from ExperimentRunCreate, validate plan ownership and approved status, set plan status to "executing"
    - `GET /` : List runs for current user, paginated, filterable by plan_id and status
    - `GET /{run_id}`: Get run with ownership check
    - `PATCH /{run_id}`: Update run (status transitions, config). Only allow valid transitions (e.g., running->paused, paused->running, running->cancelled)
    - `DELETE /{run_id}` (204): Delete run (only pending/failed/cancelled)
    - `POST /{run_id}/sync`: Accept ExperimentSyncPayload from desktop agent (authenticated), update run state -- this is how the Tauri app pushes status to the web platform
    - `GET /ws/{run_id}`: WebSocket endpoint streaming experiment status to web frontend (reuse JWT auth query param pattern from Phase 5)

    Register `experiments_router` at `/api/v1/experiments` in `main.py`.

    Follow existing patterns:
    - ApiResponse envelope for all responses
    - get_current_user dependency for auth
    - Async SQLAlchemy session via get_db
    - Ownership checks on all endpoints
  </action>
  <verify>
    <automated>cd /Users/admin/ai/self-dev/study-community/backend && python -c "
from app.routers.experiments import router

# Behavioral: verify router has expected routes
routes = [r.path for r in router.routes]
assert '/' in routes or '' in routes, 'Missing root route'
assert '/{run_id}' in routes, 'Missing get-by-id route'
assert '/{run_id}/sync' in routes, 'Missing sync route'
print(f'Router has {len(routes)} routes, all checks OK')
"</automated>
  </verify>
  <done>6 REST endpoints + 1 WebSocket defined, router registered in main.py</done>
</task>

</tasks>

<verification>
1. Backend: `python -c "from app.models.experiment_run import ExperimentRun"` succeeds
2. Backend: `python -c "from app.routers.experiments import router"` succeeds
3. ExperimentRun has all required columns (behavioral check)
4. ExperimentRunCreate defaults validate correctly (behavioral check)
5. Router has expected route paths (behavioral check)
</verification>

<success_criteria>
- ExperimentRun model with all fields persists experiment state
- REST API has CRUD + sync + WebSocket endpoints for experiments
- Schemas enforce correct defaults and types
- Router registered at /api/v1/experiments
</success_criteria>

<output>
After completion, create `.planning/phases/08-experiment-execution-engine/08-01a-SUMMARY.md`
</output>
