"""ExperimentPlan SQLAlchemy model for plan generation pipeline.

Stores generated experiment plans including hypothesis, methodology,
baselines, metrics, datasets, and feasibility scoring.

Reference: AI-Scientist idea generation + reflection pattern.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ExperimentPlan(Base):
    """A generated experiment plan linked to a DeepResearchTask."""

    __tablename__ = "experiment_plans"

    # ─── Primary Key ───────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: uuid.uuid4().hex
    )

    # ─── Ownership & Linkage ───────────────────────────────────────────
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    task_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)

    # ─── Entry Context ─────────────────────────────────────────────────
    entry_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="direction"
    )
    source_paper_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True
    )
    source_gap_index: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )

    # ─── Plan Content ──────────────────────────────────────────────────
    title: Mapped[str] = mapped_column(Text, nullable=False)
    hypothesis: Mapped[str] = mapped_column(Text, nullable=False)
    method_description: Mapped[str] = mapped_column(Text, nullable=False)
    baselines: Mapped[list] = mapped_column(JSON, default=list)
    metrics: Mapped[list] = mapped_column(JSON, default=list)
    datasets: Mapped[list] = mapped_column(JSON, default=list)
    technical_roadmap: Mapped[list] = mapped_column(JSON, default=list)
    code_skeleton: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ─── Feasibility & Strategy ────────────────────────────────────────
    feasibility: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    data_strategy: Mapped[str] = mapped_column(
        String(20), nullable=False, default="open_source"
    )

    # ─── Status ────────────────────────────────────────────────────────
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft"
    )

    # ─── Timestamps ────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
