"""Tests for Temporal workflow infrastructure.

Unit tests mock the Temporal client. Integration tests (marked with
@pytest.mark.integration) require a running Temporal server.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.workflows.activities import placeholder_search
from app.workflows.deep_research import (
    DeepResearchInput,
    DeepResearchResult,
    DeepResearchWorkflow,
)


class TestDeepResearchDataclasses:
    """Tests for workflow input/output dataclasses."""

    def test_input_defaults(self):
        """DeepResearchInput has sensible defaults."""
        inp = DeepResearchInput(
            user_id="user-1",
            research_direction="quantum computing",
        )
        assert inp.depth == 2
        assert inp.max_papers == 100
        assert inp.user_id == "user-1"
        assert inp.research_direction == "quantum computing"

    def test_input_custom_values(self):
        """DeepResearchInput accepts custom depth and max_papers."""
        inp = DeepResearchInput(
            user_id="user-2",
            research_direction="ML fairness",
            depth=4,
            max_papers=500,
        )
        assert inp.depth == 4
        assert inp.max_papers == 500

    def test_result_fields(self):
        """DeepResearchResult stores status, count, and message."""
        result = DeepResearchResult(
            status="completed",
            papers_found=42,
            message="Done",
        )
        assert result.status == "completed"
        assert result.papers_found == 42
        assert result.message == "Done"


class TestDeepResearchWorkflow:
    """Tests for the DeepResearchWorkflow class."""

    def test_workflow_can_be_instantiated(self):
        """Workflow class can be created without errors."""
        wf = DeepResearchWorkflow()
        assert wf is not None

    def test_workflow_has_run_method(self):
        """Workflow exposes a run method."""
        assert hasattr(DeepResearchWorkflow, "run")
        assert callable(DeepResearchWorkflow.run)

    def test_workflow_is_decorated(self):
        """Workflow class has Temporal workflow metadata."""
        # temporalio sets __temporal_workflow_definition on decorated classes
        assert hasattr(DeepResearchWorkflow, "__temporal_workflow_definition")


class TestPlaceholderActivity:
    """Tests for the placeholder_search activity."""

    @pytest.mark.asyncio
    async def test_placeholder_returns_dict(self):
        """Placeholder activity returns expected structure."""
        result = await placeholder_search("graph neural networks")
        assert isinstance(result, dict)
        assert result["status"] == "placeholder"
        assert result["direction"] == "graph neural networks"

    @pytest.mark.asyncio
    async def test_placeholder_echoes_direction(self):
        """Activity echoes back the research direction."""
        result = await placeholder_search("protein folding")
        assert result["direction"] == "protein folding"

    def test_activity_is_decorated(self):
        """Activity function has Temporal activity metadata."""
        assert hasattr(placeholder_search, "__temporal_activity_definition")


class TestTemporalService:
    """Tests for the temporal_service module."""

    @pytest.mark.asyncio
    async def test_get_temporal_client_connects(self):
        """get_temporal_client calls Client.connect on first invocation."""
        from app.services import temporal_service

        # Reset any cached client
        await temporal_service.reset_client()

        mock_client = MagicMock()

        with patch(
            "app.services.temporal_service.Client.connect",
            new_callable=AsyncMock,
            return_value=mock_client,
        ) as mock_connect:
            client = await temporal_service.get_temporal_client()

            assert client is mock_client
            mock_connect.assert_awaited_once()

        # Cleanup
        await temporal_service.reset_client()

    @pytest.mark.asyncio
    async def test_get_temporal_client_caches(self):
        """Subsequent calls return the same cached client."""
        from app.services import temporal_service

        await temporal_service.reset_client()

        mock_client = MagicMock()

        with patch(
            "app.services.temporal_service.Client.connect",
            new_callable=AsyncMock,
            return_value=mock_client,
        ) as mock_connect:
            client1 = await temporal_service.get_temporal_client()
            client2 = await temporal_service.get_temporal_client()

            assert client1 is client2
            assert mock_connect.await_count == 1

        await temporal_service.reset_client()

    @pytest.mark.asyncio
    async def test_reset_client_clears_cache(self):
        """reset_client clears the cached client."""
        from app.services import temporal_service

        await temporal_service.reset_client()

        mock_client = MagicMock()

        with patch(
            "app.services.temporal_service.Client.connect",
            new_callable=AsyncMock,
            return_value=mock_client,
        ):
            await temporal_service.get_temporal_client()
            await temporal_service.reset_client()

            # After reset, next call should reconnect
            await temporal_service.get_temporal_client()

        await temporal_service.reset_client()

    @pytest.mark.asyncio
    async def test_start_workflow_calls_client(self):
        """start_workflow delegates to client.start_workflow."""
        from app.services import temporal_service

        await temporal_service.reset_client()

        mock_handle = MagicMock()
        mock_client = MagicMock()
        mock_client.start_workflow = AsyncMock(return_value=mock_handle)

        with patch(
            "app.services.temporal_service.Client.connect",
            new_callable=AsyncMock,
            return_value=mock_client,
        ):
            handle = await temporal_service.start_workflow(
                workflow_class=DeepResearchWorkflow,
                workflow_id="test-wf-1",
                args=DeepResearchInput(
                    user_id="user-1",
                    research_direction="test",
                ),
            )

            assert handle is mock_handle
            mock_client.start_workflow.assert_awaited_once()

        await temporal_service.reset_client()


class TestWorkerModule:
    """Tests for the worker module imports."""

    def test_worker_module_importable(self):
        """Worker module can be imported without errors."""
        from app import worker

        assert hasattr(worker, "run_worker")
        assert callable(worker.run_worker)

    def test_worker_registers_workflows(self):
        """Worker module imports the expected workflow class."""
        from app.worker import DeepResearchWorkflow as WF

        assert WF is DeepResearchWorkflow

    def test_worker_registers_activities(self):
        """Worker module imports the expected activity."""
        from app.worker import placeholder_search as ps

        assert ps is placeholder_search


class TestWorkflowEndpoint:
    """Tests for the /workflows/deep-research endpoint."""

    def test_start_research_request_validation(self):
        """StartDeepResearchRequest validates input."""
        from app.main import StartDeepResearchRequest

        req = StartDeepResearchRequest(
            research_direction="quantum computing",
        )
        assert req.depth == 2
        assert req.max_papers == 100

    def test_start_research_request_rejects_empty(self):
        """Empty research direction is rejected."""
        from app.main import StartDeepResearchRequest

        with pytest.raises(Exception):
            StartDeepResearchRequest(research_direction="")

    def test_workflow_endpoint_exists(self):
        """The /workflows/deep-research endpoint is registered."""
        from app.main import app

        routes = [r.path for r in app.routes]
        assert "/workflows/deep-research" in routes
