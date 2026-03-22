"""Agent Run and Agent Log models for the Agent Runtime.

An AgentRun tracks a single agent execution session (e.g., generating a
literature review from deep research results). AgentLog records every
event emitted during execution for full auditability.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AgentRun(Base):
    """A single agent execution session."""

    __tablename__ = "agent_runs"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)

    # What triggered the run
    skill_name = Column(String(128), nullable=False)  # e.g., "literature_review"
    task_id = Column(String(36), nullable=True, index=True)  # deep_research_task FK

    # Execution state
    status = Column(
        String(24),
        nullable=False,
        default="pending",
    )  # pending | planning | awaiting_approval | executing | completed | failed | cancelled

    # Plan produced by LLM (JSON)
    plan = Column(JSONB, nullable=True)  # {goal, steps: [{id, description, tool, args}]}

    # Input context passed to the agent
    input_context = Column(JSONB, nullable=True)  # skill-specific context blob

    # Output
    output_artifact = Column(Text, nullable=True)  # generated document (markdown)
    output_format = Column(String(16), nullable=True)  # md | docx | pdf

    # Cost tracking
    total_cost = Column(Float, nullable=False, default=0.0)
    total_steps = Column(Integer, nullable=False, default=0)

    # Timestamps
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Error info
    error = Column(Text, nullable=True)

    __table_args__ = (
        Index("ix_agent_runs_user_status", "user_id", "status"),
    )


class AgentLog(Base):
    """Immutable event log for an agent run.

    Every event emitted during agent execution is recorded here:
    plan, step_start, step_done, tool_call, tool_result, text, error.
    """

    __tablename__ = "agent_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(36), ForeignKey("agent_runs.id"), nullable=False, index=True)

    # Event type: plan | step_start | step_done | tool_call | tool_result | text | error | user_action
    event_type = Column(String(32), nullable=False)

    # Step number within the plan (null for plan-level events)
    step_number = Column(Integer, nullable=True)

    # Event payload
    data = Column(JSONB, nullable=True)

    # Human-readable summary
    message = Column(Text, nullable=True)

    # Timing
    timestamp = Column(DateTime, nullable=False, default=_utcnow)

    __table_args__ = (
        Index("ix_agent_logs_run_ts", "run_id", "timestamp"),
    )
