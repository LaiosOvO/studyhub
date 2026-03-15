"""Temporal client wrapper for workflow orchestration.

Provides a cached Temporal client connection and a helper
to start workflows from API endpoints.
"""

import logging

from temporalio.client import Client, WorkflowHandle

from app.config import get_settings

logger = logging.getLogger(__name__)

_client: Client | None = None

TASK_QUEUE = "studyhub-main"


async def get_temporal_client() -> Client:
    """Return a cached Temporal client, connecting on first call.

    Returns:
        Connected Temporal client instance.
    """
    global _client  # noqa: PLW0603
    if _client is None:
        settings = get_settings()
        logger.info(
            "Connecting to Temporal at %s (namespace=%s)",
            settings.temporal_host,
            settings.temporal_namespace,
        )
        _client = await Client.connect(
            settings.temporal_host,
            namespace=settings.temporal_namespace,
        )
    return _client


async def reset_client() -> None:
    """Reset the cached client (for testing or reconnection)."""
    global _client  # noqa: PLW0603
    _client = None


async def start_workflow(
    workflow_class,
    workflow_id: str,
    args,
    task_queue: str = TASK_QUEUE,
) -> WorkflowHandle:
    """Start a Temporal workflow and return its handle.

    Args:
        workflow_class: The workflow class decorated with @workflow.defn.
        workflow_id: Unique identifier for this workflow execution.
        args: Arguments to pass to the workflow's run method.
        task_queue: Task queue name (defaults to studyhub-main).

    Returns:
        WorkflowHandle for querying or signaling the workflow.
    """
    client = await get_temporal_client()
    handle = await client.start_workflow(
        workflow_class.run,
        args,
        id=workflow_id,
        task_queue=task_queue,
    )
    logger.info("Started workflow %s (id=%s)", workflow_class.__name__, workflow_id)
    return handle
