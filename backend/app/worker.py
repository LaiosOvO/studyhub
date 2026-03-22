"""Temporal worker entry point.

Connects to Temporal server and registers all workflows and activities.
Run directly: python -m app.worker
"""

import asyncio
import logging

from temporalio.client import Client
from temporalio.worker import Worker

from app.config import get_settings
from app.services.temporal_service import TASK_QUEUE
from app.workflows.activities import (
    analyze_papers_activity,
    classify_relationships_activity,
    detect_gaps_activity,
    expand_citations_activity,
    fail_task_activity,
    generate_plans_activity,
    generate_report_activity,
    placeholder_search,
    score_papers_activity,
    search_papers_activity,
)
from app.workflows.deep_research import DeepResearchWorkflow
from app.workflows.plan_generation import PlanGenerationWorkflow
from app.workflows.scholar_refresh import (
    ScholarRefreshWorkflow,
    enrich_scholar_activity,
    get_all_scholar_ids,
    link_scholar_papers_activity,
)

logger = logging.getLogger(__name__)


async def run_worker() -> None:
    """Connect to Temporal and run the worker until interrupted.

    Registers all known workflows and activities, then blocks
    listening on the studyhub-main task queue.
    """
    settings = get_settings()
    logger.info(
        "Connecting worker to Temporal at %s (namespace=%s)",
        settings.temporal_host,
        settings.temporal_namespace,
    )

    client = await Client.connect(
        settings.temporal_host,
        namespace=settings.temporal_namespace,
    )

    worker = Worker(
        client,
        task_queue=TASK_QUEUE,
        workflows=[DeepResearchWorkflow, PlanGenerationWorkflow, ScholarRefreshWorkflow],
        activities=[
            placeholder_search,
            search_papers_activity,
            expand_citations_activity,
            score_papers_activity,
            analyze_papers_activity,
            classify_relationships_activity,
            detect_gaps_activity,
            generate_report_activity,
            generate_plans_activity,
            fail_task_activity,
            enrich_scholar_activity,
            link_scholar_papers_activity,
            get_all_scholar_ids,
        ],
    )

    logger.info("Worker started, listening on task queue: %s", TASK_QUEUE)
    await worker.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_worker())
