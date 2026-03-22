"""ExperimentMetric model for normalized time-series metric storage.

Replaces the JSON blob `rounds` column for efficient per-metric queries,
cross-run comparisons, and training curve rendering.

Reference: MLflow metric storage pattern, Aim context namespacing.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ExperimentMetric(Base):
    """A single metric data point within an experiment run."""

    __tablename__ = "experiment_metrics"
    __table_args__ = (
        UniqueConstraint("run_id", "key", "step", "context", name="uq_metric_run_key_step_ctx"),
    )

    # ─── Primary Key ───────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: uuid.uuid4().hex
    )

    # ─── Foreign Key ───────────────────────────────────────────────────
    run_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True
    )

    # ─── Metric Data ───────────────────────────────────────────────────
    key: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    step: Mapped[int] = mapped_column(Integer, nullable=False)

    # ─── Context Namespace (Aim pattern) ───────────────────────────────
    # e.g. {"subset": "train"} or {"subset": "val", "fold": 3}
    context: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")

    # ─── Timestamp ─────────────────────────────────────────────────────
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
