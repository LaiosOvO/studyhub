"""Pydantic schemas for experiment execution tracking.

Covers ExperimentRun CRUD, round results, GPU metrics,
and desktop-to-web sync payloads.

Reference: autoresearch experiment result format.
"""

from datetime import datetime

from pydantic import BaseModel, Field


# ─── Round & GPU Types ────────────────────────────────────────────────────────


class ExperimentRoundResult(BaseModel):
    """A single iteration result from the experiment loop."""

    round: int
    status: str  # "keep" | "discard" | "crash" | "baseline"
    metric_value: float | None = None
    description: str = ""
    git_sha: str | None = None
    duration_seconds: float | None = None


class GpuMetrics(BaseModel):
    """Real-time GPU metrics collected via pynvml."""

    gpu_utilization_pct: float = 0.0
    memory_used_mb: int = 0
    memory_total_mb: int = 0
    temperature_c: int = 0
    power_watts: float = 0.0
    name: str = "unavailable"


# ─── CRUD Schemas ─────────────────────────────────────────────────────────────


class ExperimentRunCreate(BaseModel):
    """Input schema for creating a new experiment run."""

    plan_id: str
    gpu_device: int = Field(default=0, ge=0)
    max_rounds: int = Field(default=20, ge=1, le=200)
    consecutive_no_improve_limit: int = Field(default=5, ge=1, le=50)
    time_budget_minutes: int | None = Field(default=None, ge=1)
    docker_image: str | None = None


class ExperimentRunResponse(BaseModel):
    """API response schema for an experiment run."""

    model_config = {"from_attributes": True}

    id: str
    user_id: str
    plan_id: str
    status: str
    workspace_path: str | None = None
    docker_image: str | None = None
    gpu_device: int = 0
    current_round: int = 0
    max_rounds: int = 20
    consecutive_no_improve_limit: int = 5
    time_budget_minutes: int | None = None
    best_metric_name: str | None = None
    best_metric_value: float | None = None
    baseline_metric_value: float | None = None
    queue_position: float = 0.0
    rounds: list[dict] = []
    config: dict = {}
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ExperimentRunUpdate(BaseModel):
    """Partial update schema for experiment run state."""

    status: str | None = None
    config: dict | None = None
    user_guidance: str | None = None


# ─── Sync Payload ─────────────────────────────────────────────────────────────


class ExperimentSyncPayload(BaseModel):
    """Payload sent from desktop agent to web backend for state sync."""

    run_id: str
    status: str
    current_round: int = 0
    best_metric_value: float | None = None
    gpu_metrics: GpuMetrics | None = None
    latest_round: ExperimentRoundResult | None = None
