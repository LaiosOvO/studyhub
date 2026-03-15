"""Deep Research Temporal workflow template.

Placeholder implementation for Phase 1. The full pipeline
(search -> citation expansion -> quality scoring -> AI analysis)
is implemented in Phase 5.
"""

from dataclasses import dataclass
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy


@dataclass
class DeepResearchInput:
    """Input parameters for the Deep Research workflow."""

    user_id: str
    research_direction: str
    depth: int = 2
    max_papers: int = 100


@dataclass
class DeepResearchResult:
    """Output of the Deep Research workflow."""

    status: str
    papers_found: int
    message: str


@workflow.defn
class DeepResearchWorkflow:
    """Placeholder Deep Research workflow.

    Demonstrates Temporal workflow structure with activities.
    Expanded with real paper search and analysis in Phase 5.
    """

    @workflow.run
    async def run(self, input: DeepResearchInput) -> DeepResearchResult:
        """Execute the deep research pipeline.

        Phase 1: calls a placeholder activity.
        Phase 5: search -> citation expansion -> quality scoring -> AI analysis.
        """
        result = await workflow.execute_activity(
            "placeholder_search",
            input.research_direction,
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        return DeepResearchResult(
            status="completed",
            papers_found=0,
            message=(
                f"Placeholder: would research '{input.research_direction}' "
                f"at depth {input.depth}"
            ),
        )
