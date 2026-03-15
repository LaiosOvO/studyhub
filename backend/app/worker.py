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
from app.workflows.activities import placeholder_search
from app.workflows.deep_research import DeepResearchWorkflow

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
        workflows=[DeepResearchWorkflow],
        activities=[placeholder_search],
    )

    logger.info("Worker started, listening on task queue: %s", TASK_QUEUE)
    await worker.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_worker())
