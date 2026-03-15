"""Temporal workflow for plan generation pipeline.

Orchestrates SOTA analysis, improvement identification, plan generation
with reflection, feasibility scoring, and dataset recommendation as
a durable Temporal workflow with progress tracking.

Reference: DeepResearchWorkflow pattern, AI-Scientist pipeline.
"""

from dataclasses import dataclass
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy


@dataclass
class PlanGenerationWorkflowInput:
    """Serializable input for the Plan Generation workflow.

    Temporal requires dataclasses (not Pydantic) for workflow I/O.
    All fields are primitive types for JSON serialization.
    """

    task_id: str
    user_id: str
    entry_type: str = "direction"
    source_paper_id: str | None = None
    source_gap_index: int | None = None
    data_strategy: str = "open_source"
    num_plans: int = 3


@dataclass
class PlanGenerationWorkflowResult:
    """Output of the Plan Generation workflow."""

    task_id: str
    plan_ids: list[str] | None = None
    status: str = "completed"
    total_cost: float = 0.0


_DEFAULT_RETRY = RetryPolicy(maximum_attempts=3)
_PLAN_GENERATION_TIMEOUT = timedelta(minutes=20)


@workflow.defn
class PlanGenerationWorkflow:
    """Plan generation pipeline as a durable Temporal workflow.

    Single activity internally orchestrates the multi-step LLM pipeline:
    SOTA -> improvements -> plan generation (with reflection) ->
    feasibility scoring -> dataset recommendation -> DB persistence.

    Progress is exposed via a Temporal query for real-time tracking.
    """

    def __init__(self) -> None:
        self._progress: dict = {
            "phase": "pending",
            "plans_generated": 0,
            "total_plans": 0,
            "current_activity": "",
            "error": None,
        }

    @workflow.query
    def get_progress(self) -> dict:
        """Return current pipeline progress for status polling."""
        return dict(self._progress)

    def _update_progress(self, **kwargs) -> None:
        """Create updated progress dict (immutable pattern)."""
        self._progress = {**self._progress, **kwargs}

    @workflow.run
    async def run(
        self, input: PlanGenerationWorkflowInput
    ) -> PlanGenerationWorkflowResult:
        """Execute the plan generation pipeline.

        Delegates to a single activity that performs all steps.
        The activity creates its own DB session (isolation pattern).
        """
        import json

        try:
            # ─── Stage 1: Generate Plans (all-in-one activity) ────────
            self._update_progress(
                phase="generating",
                current_activity="Analyzing SOTA and generating experiment plans",
                total_plans=input.num_plans,
            )

            activity_input = json.dumps({
                "task_id": input.task_id,
                "user_id": input.user_id,
                "entry_type": input.entry_type,
                "source_paper_id": input.source_paper_id,
                "source_gap_index": input.source_gap_index,
                "data_strategy": input.data_strategy,
                "num_plans": input.num_plans,
            })

            result_json = await workflow.execute_activity(
                "generate_plans_activity",
                activity_input,
                start_to_close_timeout=_PLAN_GENERATION_TIMEOUT,
                retry_policy=_DEFAULT_RETRY,
            )
            result = json.loads(result_json)

            plan_ids = result.get("plan_ids", [])
            total_cost = result.get("total_cost", 0.0)

            # ─── Complete ─────────────────────────────────────────────
            self._update_progress(
                phase="completed",
                current_activity="Plan generation complete",
                plans_generated=len(plan_ids),
            )

            return PlanGenerationWorkflowResult(
                task_id=input.task_id,
                plan_ids=plan_ids,
                status="completed",
                total_cost=total_cost,
            )

        except Exception as exc:
            self._update_progress(
                phase="failed",
                current_activity="Pipeline error",
                error=str(exc),
            )
            return PlanGenerationWorkflowResult(
                task_id=input.task_id,
                plan_ids=None,
                status="failed",
                total_cost=0.0,
            )
