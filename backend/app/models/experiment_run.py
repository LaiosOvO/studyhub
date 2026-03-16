"""ExperimentRun SQLAlchemy model for experiment execution tracking.

Stores experiment run state including plan reference, status,
rounds history, metrics, GPU config, and stopping conditions.

Reference: autoresearch experiment tracking pattern.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ExperimentRun(Base):
    """A single experiment execution linked to an ExperimentPlan."""

    __tablename__ = "experiment_runs"

    # ─── Primary Key ───────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: uuid.uuid4().hex
    )

    # ─── Ownership & Linkage ───────────────────────────────────────────
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    plan_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)

    # ─── Execution Status ──────────────────────────────────────────────
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )

    # ─── Environment Configuration ─────────────────────────────────────
    workspace_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    docker_image: Mapped[str | None] = mapped_column(String(255), nullable=True)
    gpu_device: Mapped[int] = mapped_column(Integer, default=0)

    # ─── Iteration Control ─────────────────────────────────────────────
    current_round: Mapped[int] = mapped_column(Integer, default=0)
    max_rounds: Mapped[int] = mapped_column(Integer, default=20)
    consecutive_no_improve_limit: Mapped[int] = mapped_column(Integer, default=5)
    time_budget_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ─── Metrics Tracking ──────────────────────────────────────────────
    best_metric_name: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    best_metric_value: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )
    baseline_metric_value: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )

    # ─── Rounds History & Config ───────────────────────────────────────
    rounds: Mapped[list] = mapped_column(JSON, default=list)
    config: Mapped[dict] = mapped_column(JSON, default=dict)

    # ─── Timestamps ────────────────────────────────────────────────────
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
