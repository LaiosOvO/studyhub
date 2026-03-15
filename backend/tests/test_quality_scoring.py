"""Tests for quality scoring: pure algorithm, OpenAlex lookups, batch scoring, and endpoints.

All tests use mocks -- NO real API or database calls.
"""

import math
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas.paper import PaperResult, PaperSource
from app.schemas.quality import PaperWithQuality, QualityBreakdown, QualityWeights


# ─── Helpers ─────────────────────────────────────────────────────────


def _make_paper(
    s2_id: str = "p1",
    title: str = "Test Paper",
    citation_count: int = 100,
    year: int = 2020,
    venue: str = "NeurIPS",
    authors: list[str] | None = None,
) -> PaperResult:
    return PaperResult(
        s2_id=s2_id,
        title=title,
        citation_count=citation_count,
        year=year,
        venue=venue,
        authors=authors or ["Author A"],
        sources=[PaperSource.SEMANTIC_SCHOLAR],
    )


# ─── Pure Scoring Tests ──────────────────────────────────────────────


class TestComputeQualityScore:
    def test_basic_score(self):
        """Paper with 1000 citations, 2020 year, IF=10, h=40 -> score between 0.5-0.8."""
        from app.services.citation_network.quality_scorer import compute_quality_score

        breakdown = compute_quality_score(
            citation_count=1000, year=2020, impact_factor=10.0, h_index=40
        )
        assert 0.5 <= breakdown.score <= 0.8
        assert breakdown.components_available == 4

    def test_zero_citations(self):
        """Zero citations -> citations_norm = 0."""
        from app.services.citation_network.quality_scorer import compute_quality_score

        breakdown = compute_quality_score(
            citation_count=0, year=2020, impact_factor=5.0, h_index=20
        )
        assert breakdown.citations_norm == 0.0
        assert breakdown.velocity_norm == 0.0
        # Score still computed from IF and h_index
        assert breakdown.score > 0.0
        assert breakdown.components_available == 2  # only IF and h_index

    def test_missing_if_and_h(self):
        """Missing impact_factor and h_index -> only 2 components."""
        from app.services.citation_network.quality_scorer import compute_quality_score

        breakdown = compute_quality_score(
            citation_count=500, year=2020, impact_factor=None, h_index=None
        )
        assert breakdown.components_available == 2
        assert breakdown.impact_factor_norm == 0.0
        assert breakdown.h_index_norm == 0.0
        assert breakdown.score > 0.0

    def test_high_citations_capped(self):
        """100000 citations -> citations_norm capped at 1.0."""
        from app.services.citation_network.quality_scorer import compute_quality_score

        breakdown = compute_quality_score(
            citation_count=100000, year=2020, impact_factor=None, h_index=None
        )
        assert breakdown.citations_norm == 1.0

    def test_custom_weights(self):
        """Custom weights produce different score than defaults."""
        from app.services.citation_network.quality_scorer import compute_quality_score

        default_breakdown = compute_quality_score(
            citation_count=500, year=2020, impact_factor=10.0, h_index=30
        )
        custom_weights = QualityWeights(
            citations=0.6, velocity=0.2, impact_factor=0.1, h_index=0.1
        )
        custom_breakdown = compute_quality_score(
            citation_count=500, year=2020, impact_factor=10.0, h_index=30,
            weights=custom_weights,
        )
        # Same components but different weights -> different score
        assert default_breakdown.score != custom_breakdown.score

    def test_velocity_calculation(self):
        """Paper from 2020 with 100 citations in 2026 -> velocity ~14.3."""
        from app.services.citation_network.quality_scorer import (
            CURRENT_YEAR,
            compute_quality_score,
        )

        breakdown = compute_quality_score(
            citation_count=100, year=2020, impact_factor=None, h_index=None
        )
        # velocity = 100 / (2026 - 2020 + 1) = 100/7 ~= 14.3
        expected_years = CURRENT_YEAR - 2020 + 1
        expected_velocity = 100.0 / expected_years
        expected_norm = min(expected_velocity / 50.0, 1.0)
        assert abs(breakdown.velocity_norm - round(expected_norm, 4)) < 0.01

    def test_weights_validation_sum_not_one(self):
        """QualityWeights where sum != 1.0 raises ValidationError."""
        with pytest.raises(Exception):
            QualityWeights(citations=0.5, velocity=0.5, impact_factor=0.5, h_index=0.5)


# ─── OpenAlex Lookup Tests ───────────────────────────────────────────


class TestOpenAlexLookups:
    @pytest.mark.asyncio
    async def test_get_author_h_index_success(self):
        """Mock pyalex returning h_index=25."""
        from app.services.citation_network.quality_scorer import get_author_h_index

        mock_result = [{"summary_stats": {"h_index": 25}}]
        with patch("app.services.citation_network.quality_scorer.asyncio") as mock_asyncio:
            mock_asyncio.to_thread = AsyncMock(return_value=mock_result)
            result = await get_author_h_index("John Doe")
            assert result == 25

    @pytest.mark.asyncio
    async def test_get_author_h_index_not_found(self):
        """Mock empty results -> returns None."""
        from app.services.citation_network.quality_scorer import get_author_h_index

        with patch("app.services.citation_network.quality_scorer.asyncio") as mock_asyncio:
            mock_asyncio.to_thread = AsyncMock(return_value=[])
            result = await get_author_h_index("Unknown Author")
            assert result is None

    @pytest.mark.asyncio
    async def test_get_journal_impact_success(self):
        """Mock pyalex returning 2yr_mean_citedness=5.2."""
        from app.services.citation_network.quality_scorer import get_journal_impact

        mock_result = [{"summary_stats": {"2yr_mean_citedness": 5.2}}]
        with patch("app.services.citation_network.quality_scorer.asyncio") as mock_asyncio:
            mock_asyncio.to_thread = AsyncMock(return_value=mock_result)
            result = await get_journal_impact("Nature")
            assert result == 5.2

    @pytest.mark.asyncio
    async def test_get_journal_impact_error(self):
        """Mock exception -> returns None gracefully."""
        from app.services.citation_network.quality_scorer import get_journal_impact

        with patch("app.services.citation_network.quality_scorer.asyncio") as mock_asyncio:
            mock_asyncio.to_thread = AsyncMock(side_effect=Exception("API error"))
            result = await get_journal_impact("Bad Journal")
            assert result is None


# ─── Batch Scoring Tests ─────────────────────────────────────────────


class TestBatchScoring:
    @pytest.mark.asyncio
    async def test_score_papers_batch(self):
        """Score 3 papers and verify PaperWithQuality returned."""
        from app.services.citation_network.quality_scorer import score_papers_batch

        papers = [_make_paper(f"p{i}", citation_count=100 * (i + 1)) for i in range(3)]

        with patch(
            "app.services.citation_network.quality_scorer.score_paper",
            new_callable=AsyncMock,
            return_value=QualityBreakdown(
                score=0.6, citations_norm=0.5, velocity_norm=0.4,
                impact_factor_norm=0.3, h_index_norm=0.2, components_available=4,
            ),
        ):
            results = await score_papers_batch(papers)
            assert len(results) == 3
            assert all(isinstance(r, PaperWithQuality) for r in results)
            assert all(r.quality is not None for r in results)

    @pytest.mark.asyncio
    async def test_score_papers_batch_updates_neo4j(self):
        """Verify neo4j_client called with quality scores."""
        from app.services.citation_network.quality_scorer import score_papers_batch

        papers = [_make_paper("p1", citation_count=100)]
        mock_neo4j = AsyncMock()

        with patch(
            "app.services.citation_network.quality_scorer.score_paper",
            new_callable=AsyncMock,
            return_value=QualityBreakdown(
                score=0.7, citations_norm=0.5, velocity_norm=0.4,
                impact_factor_norm=0.3, h_index_norm=0.2, components_available=4,
            ),
        ):
            await score_papers_batch(papers, neo4j_client=mock_neo4j)
            mock_neo4j.update_quality_scores.assert_called_once()
            call_args = mock_neo4j.update_quality_scores.call_args[0][0]
            assert len(call_args) == 1
            assert call_args[0]["s2_id"] == "p1"
            assert call_args[0]["score"] == 0.7

    @pytest.mark.asyncio
    async def test_get_top_papers(self):
        """Mock neo4j returning top papers sorted by score."""
        from app.services.citation_network.quality_scorer import get_top_papers

        mock_neo4j = AsyncMock()
        mock_neo4j.get_top_papers_by_quality = AsyncMock(
            return_value=[
                {"paper": {"s2_id": "p1", "quality_score": 0.9, "title": "Top Paper"}},
                {"paper": {"s2_id": "p2", "quality_score": 0.8, "title": "Second Paper"}},
            ]
        )

        result = await get_top_papers(mock_neo4j, n=5)
        assert len(result) == 2
        mock_neo4j.get_top_papers_by_quality.assert_called_once_with(5)


# ─── Endpoint Tests ──────────────────────────────────────────────────


class TestQualityEndpoints:
    @pytest.mark.asyncio
    async def test_score_endpoint(self):
        """POST /citations/score with paper IDs."""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from app.routers.citations import router

        app = FastAPI()
        app.include_router(router, prefix="/citations")
        app.state.neo4j = AsyncMock()
        app.state.http_client = AsyncMock()

        mock_results = [
            PaperWithQuality(
                s2_id="p1", title="Paper 1",
                quality=QualityBreakdown(
                    score=0.6, citations_norm=0.5, velocity_norm=0.4,
                    impact_factor_norm=0.3, h_index_norm=0.2, components_available=4,
                ),
            )
        ]

        with patch(
            "app.routers.citations.get_settings",
            return_value=MagicMock(s2_api_key=""),
        ), patch(
            "app.services.citation_network.quality_scorer.score_papers_batch",
            new_callable=AsyncMock,
            return_value=mock_results,
        ):
            client = TestClient(app)
            response = client.post("/citations/score", json=["p1"])
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_top_papers_endpoint(self):
        """GET /citations/top-papers?n=5."""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from app.routers.citations import router

        app = FastAPI()
        app.include_router(router, prefix="/citations")
        mock_neo4j = AsyncMock()
        mock_neo4j.get_top_papers_by_quality = AsyncMock(return_value=[])
        app.state.neo4j = mock_neo4j
        app.state.http_client = AsyncMock()

        client = TestClient(app)
        response = client.get("/citations/top-papers?n=5")
        assert response.status_code == 200
        data = response.json()
        assert "papers" in data
        assert "total_scored" in data

    @pytest.mark.asyncio
    async def test_paper_quality_endpoint(self):
        """GET /citations/paper/{id}/quality."""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from app.routers.citations import router

        app = FastAPI()
        app.include_router(router, prefix="/citations")
        app.state.neo4j = AsyncMock()
        app.state.http_client = AsyncMock()

        mock_breakdown = QualityBreakdown(
            score=0.5, citations_norm=0.4, velocity_norm=0.3,
            impact_factor_norm=0.2, h_index_norm=0.1, components_available=2,
        )

        with patch(
            "app.services.citation_network.quality_scorer.score_paper",
            new_callable=AsyncMock,
            return_value=mock_breakdown,
        ):
            client = TestClient(app)
            response = client.get("/citations/paper/p1/quality")
            assert response.status_code == 200
            data = response.json()
            assert data["score"] == 0.5
