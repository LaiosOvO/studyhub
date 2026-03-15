"""Deep Research Temporal workflow with pipeline activities and progress tracking.

Orchestrates the full research pipeline: search -> expand -> score -> analyze
-> classify -> detect_gaps -> generate_report. Progress is queryable via
Temporal workflow queries for real-time WebSocket streaming.

Reference: gpt-researcher async pipeline, AI-Scientist research flow.
"""

from dataclasses import dataclass, field
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy


@dataclass
class DeepResearchWorkflowInput:
    """Serializable input for the Deep Research workflow.

    Temporal requires dataclasses (not Pydantic) for workflow I/O.
    All fields are primitive types for JSON serialization.
    """

    task_id: str
    user_id: str
    research_direction: str
    entry_type: str = "direction"
    depth: int = 2
    max_papers: int = 100
    sources: list[str] | None = None
    year_from: int | None = None
    year_to: int | None = None
    languages: list[str] | None = None


@dataclass
class DeepResearchWorkflowResult:
    """Output of the Deep Research workflow."""

    task_id: str
    status: str
    papers_found: int = 0
    papers_analyzed: int = 0
    total_cost: float = 0.0


_DEFAULT_RETRY = RetryPolicy(maximum_attempts=3)
_PIPELINE_TIMEOUT = timedelta(minutes=5)
_ANALYSIS_TIMEOUT = timedelta(minutes=15)
_GAPS_TIMEOUT = timedelta(minutes=10)


@workflow.defn
class DeepResearchWorkflow:
    """Multi-stage deep research pipeline as a durable Temporal workflow.

    Pipeline stages: search -> expand -> score -> (analyze -> classify
    -> detect_gaps -> generate_report added in Plans 02/03).

    Progress is exposed via a Temporal query for WebSocket streaming.
    """

    def __init__(self) -> None:
        self._progress: dict = {
            "phase": "pending",
            "papers_found": 0,
            "papers_analyzed": 0,
            "total_papers": 0,
            "current_activity": "",
            "eta_seconds": None,
            "error": None,
        }

    @workflow.query
    def get_progress(self) -> dict:
        """Return current pipeline progress for WebSocket streaming."""
        return dict(self._progress)

    def _update_progress(self, **kwargs) -> None:
        """Create updated progress dict (immutable pattern)."""
        self._progress = {**self._progress, **kwargs}

    @workflow.run
    async def run(
        self, input: DeepResearchWorkflowInput
    ) -> DeepResearchWorkflowResult:
        """Execute the deep research pipeline.

        Each stage calls a Temporal activity with JSON string I/O.
        Progress is updated between stages for WebSocket streaming.
        """
        import json

        papers_found = 0
        papers_analyzed = 0
        total_cost = 0.0

        try:
            # ─── Stage 1: Search ───────────────────────────────────────
            self._update_progress(
                phase="searching",
                current_activity="Searching academic sources",
            )

            search_params = json.dumps({
                "query": input.research_direction,
                "search_type": "keyword",
                "limit": input.max_papers,
                "sources": input.sources,
                "user_id": input.user_id,
                "task_id": input.task_id,
            })

            search_result_json = await workflow.execute_activity(
                "search_papers_activity",
                search_params,
                start_to_close_timeout=_PIPELINE_TIMEOUT,
                retry_policy=_DEFAULT_RETRY,
            )
            search_result = json.loads(search_result_json)
            papers_found = search_result.get("count", 0)
            paper_ids = search_result.get("paper_ids", [])

            self._update_progress(
                papers_found=papers_found,
                total_papers=papers_found,
            )

            # ─── Stage 2: Citation Expansion ───────────────────────────
            self._update_progress(
                phase="expanding",
                current_activity="Expanding citation network",
            )

            expand_params = json.dumps({
                "paper_ids": paper_ids[:20],
                "depth": input.depth,
                "budget_per_level": 50,
                "total_budget": min(input.max_papers, 200),
            })

            expand_result_json = await workflow.execute_activity(
                "expand_citations_activity",
                expand_params,
                start_to_close_timeout=_PIPELINE_TIMEOUT,
                retry_policy=_DEFAULT_RETRY,
            )
            expand_result = json.loads(expand_result_json)
            papers_found += expand_result.get("node_count", 0)

            self._update_progress(papers_found=papers_found)

            # ─── Stage 3: Quality Scoring ──────────────────────────────
            self._update_progress(
                phase="scoring",
                current_activity="Computing quality scores",
            )

            score_params = json.dumps({
                "paper_ids": paper_ids,
                "task_id": input.task_id,
            })

            score_result_json = await workflow.execute_activity(
                "score_papers_activity",
                score_params,
                start_to_close_timeout=_PIPELINE_TIMEOUT,
                retry_policy=_DEFAULT_RETRY,
            )
            score_result = json.loads(score_result_json)

            # ─── Stage 4: AI Analysis (Plan 02) ───────────────────────
            self._update_progress(
                phase="analyzing",
                current_activity="Analyzing papers with AI",
            )

            analyze_params = json.dumps({
                "paper_ids": paper_ids,
                "user_id": input.user_id,
                "task_id": input.task_id,
                "top_n": 20,
                "cost_ceiling": 10.0,
            })

            analyze_result_json = await workflow.execute_activity(
                "analyze_papers_activity",
                analyze_params,
                start_to_close_timeout=_ANALYSIS_TIMEOUT,
                retry_policy=_DEFAULT_RETRY,
            )
            analyze_result = json.loads(analyze_result_json)
            papers_analyzed = analyze_result.get("analyzed_count", 0)
            total_cost += analyze_result.get("total_cost", 0.0)

            self._update_progress(papers_analyzed=papers_analyzed)

            # ─── Stage 5: Relationship Classification (Plan 02) ────────
            self._update_progress(
                phase="classifying",
                current_activity="Classifying paper relationships",
            )

            classify_params = json.dumps({
                "task_id": input.task_id,
                "user_id": input.user_id,
            })

            classify_result_json = await workflow.execute_activity(
                "classify_relationships_activity",
                classify_params,
                start_to_close_timeout=_ANALYSIS_TIMEOUT,
                retry_policy=_DEFAULT_RETRY,
            )

            # ─── Stage 6: Gap Detection (Plan 03) ─────────────────────
            self._update_progress(
                phase="detecting_gaps",
                current_activity="Identifying research gaps and trends",
            )

            gaps_params = json.dumps({
                "task_id": input.task_id,
                "user_id": input.user_id,
                "direction": input.research_direction,
            })

            gaps_result_json = await workflow.execute_activity(
                "detect_gaps_activity",
                gaps_params,
                start_to_close_timeout=_GAPS_TIMEOUT,
                retry_policy=_DEFAULT_RETRY,
            )

            # ─── Stage 7: Report Generation (Plan 03) ─────────────────
            self._update_progress(
                phase="generating_report",
                current_activity="Generating literature review",
            )

            report_params = json.dumps({
                "task_id": input.task_id,
                "user_id": input.user_id,
                "language": "zh" if input.languages and "zh" in input.languages else "en",
            })

            report_result_json = await workflow.execute_activity(
                "generate_report_activity",
                report_params,
                start_to_close_timeout=_PIPELINE_TIMEOUT,
                retry_policy=_DEFAULT_RETRY,
            )

            # ─── Complete ──────────────────────────────────────────────
            self._update_progress(
                phase="completed",
                current_activity="Research complete",
            )

            return DeepResearchWorkflowResult(
                task_id=input.task_id,
                status="completed",
                papers_found=papers_found,
                papers_analyzed=papers_analyzed,
                total_cost=total_cost,
            )

        except Exception as exc:
            self._update_progress(
                phase="failed",
                current_activity="Pipeline error",
                error=str(exc),
            )
            return DeepResearchWorkflowResult(
                task_id=input.task_id,
                status="failed",
                papers_found=papers_found,
                papers_analyzed=papers_analyzed,
                total_cost=total_cost,
            )
