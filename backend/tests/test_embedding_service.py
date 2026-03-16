"""Tests for the 2D embedding service (Phase 5/6).

Covers TF-IDF vectorization, UMAP/PCA reduction, KMeans clustering,
coordinate normalization, and edge cases (empty, single, large inputs).
"""

import numpy as np
import pytest

from app.services.deep_research.embedding_service import (
    _extract_cluster_label,
    _reduce_to_2d,
    compute_2d_positions,
)


# Diverse paper corpus for tests that run through full TF-IDF + UMAP pipeline.
# Needs enough vocabulary diversity and sample count for UMAP to succeed.
_DIVERSE_PAPERS = [
    {"paper_id": "p1", "title": "Transformer architectures for neural machine translation using self-attention mechanisms", "abstract": "We propose a sequence-to-sequence model using multi-head attention for parallel computation"},
    {"paper_id": "p2", "title": "Convolutional neural networks for image classification and object detection", "abstract": "Deep residual learning with skip connections achieves state-of-the-art visual recognition"},
    {"paper_id": "p3", "title": "Graph neural networks for molecular property prediction in drug discovery", "abstract": "Message passing architectures aggregate neighborhood features on chemical compound graphs"},
    {"paper_id": "p4", "title": "Reinforcement learning for robotic manipulation and locomotion control", "abstract": "Policy gradient methods combined with reward shaping enable dexterous grasping tasks"},
    {"paper_id": "p5", "title": "Generative adversarial networks for photorealistic image synthesis", "abstract": "Discriminator and generator compete in a minimax optimization for high-fidelity generation"},
    {"paper_id": "p6", "title": "Federated learning for privacy-preserving distributed model training", "abstract": "Aggregating local gradients across devices without sharing raw patient medical data"},
    {"paper_id": "p7", "title": "Diffusion probabilistic models for text-conditioned image generation", "abstract": "Denoising score matching with classifier-free guidance produces diverse visual outputs"},
]


# ─── _reduce_to_2d ─────────────────────────────────────────────────────────


def test_reduce_to_2d_returns_correct_shape():
    """Reduction produces (n_samples, 2) output."""
    vectors = np.random.rand(10, 50)
    result = _reduce_to_2d(vectors)
    assert result.shape == (10, 2)


def test_reduce_to_2d_small_input():
    """Reduction works with minimum viable input (5 samples)."""
    vectors = np.random.rand(5, 10)
    result = _reduce_to_2d(vectors)
    assert result.shape == (5, 2)


# ─── _extract_cluster_label ────────────────────────────────────────────────


def test_extract_cluster_label_returns_term():
    """Returns the highest mean TF-IDF term for the cluster."""
    # 3 samples, 3 features. Cluster 0 = first two rows
    tfidf = np.array([
        [0.9, 0.1, 0.0],
        [0.8, 0.2, 0.0],
        [0.0, 0.1, 0.9],
    ])
    features = ["alpha", "beta", "gamma"]
    labels = np.array([0, 0, 1])

    label = _extract_cluster_label(tfidf, features, labels, 0)
    assert label == "alpha"


def test_extract_cluster_label_empty_cluster():
    """Returns fallback label when cluster has no samples."""
    tfidf = np.array([[0.5, 0.5]])
    features = ["a", "b"]
    labels = np.array([0])

    label = _extract_cluster_label(tfidf, features, labels, 99)
    assert label == "Cluster 99"


def test_extract_cluster_label_zero_tfidf():
    """Returns fallback when all TF-IDF values are zero."""
    tfidf = np.array([[0.0, 0.0]])
    features = ["a", "b"]
    labels = np.array([0])

    label = _extract_cluster_label(tfidf, features, labels, 0)
    assert label == "Cluster 0"


# ─── compute_2d_positions ──────────────────────────────────────────────────


def test_compute_2d_positions_empty_input():
    """Empty paper list returns empty result."""
    result = compute_2d_positions([])
    assert result == []


def test_compute_2d_positions_single_paper():
    """Single paper returns fixed (0, 0) position with 'single' cluster."""
    papers = [{"paper_id": "p1", "title": "Single Paper"}]
    result = compute_2d_positions(papers)

    assert len(result) == 1
    assert result[0]["paper_id"] == "p1"
    assert result[0]["x"] == 0.0
    assert result[0]["y"] == 0.0
    assert result[0]["cluster_id"] == 0
    assert result[0]["cluster_label"] == "single"


def test_compute_2d_positions_multiple_papers():
    """Multiple papers get 2D coordinates and cluster assignments."""
    topics = [
        ("Transformer architectures for machine translation", "Neural machine translation using self-attention"),
        ("Convolutional neural networks for image classification", "Deep learning applied to visual recognition tasks"),
        ("Recurrent networks for sequence modeling", "Long short-term memory networks for temporal sequences"),
        ("Graph neural networks for molecular prediction", "Message passing architectures for chemical compounds"),
        ("Reinforcement learning for robotic manipulation", "Policy gradient methods applied to dexterous grasping"),
    ]
    papers = [
        {"paper_id": f"p{i}", "title": t, "abstract": a}
        for i, (t, a) in enumerate(topics)
    ]
    result = compute_2d_positions(papers)

    assert len(result) == 5
    for item in result:
        assert "paper_id" in item
        assert isinstance(item["x"], float)
        assert isinstance(item["y"], float)
        assert isinstance(item["cluster_id"], int)
        assert isinstance(item["cluster_label"], str)


def test_compute_2d_positions_coordinates_in_range():
    """Normalized coordinates fall within [-50, 50] range."""
    papers = [
        {
            "paper_id": f"p{i}",
            "title": f"Deep learning for {['NLP', 'vision', 'audio', 'RL', 'graphs'][i % 5]}",
            "abstract": f"We propose a novel {'transformer' if i % 2 == 0 else 'CNN'} approach.",
        }
        for i in range(10)
    ]
    result = compute_2d_positions(papers)

    for item in result:
        assert -50.0 <= item["x"] <= 50.0
        assert -50.0 <= item["y"] <= 50.0


def test_compute_2d_positions_preserves_paper_ids():
    """Paper IDs are preserved in the output."""
    result = compute_2d_positions(_DIVERSE_PAPERS)
    ids = {item["paper_id"] for item in result}
    expected = {p["paper_id"] for p in _DIVERSE_PAPERS}
    assert ids == expected


def test_compute_2d_positions_missing_abstract():
    """Papers without abstracts still get positioned (title-only)."""
    papers = [{**p, "abstract": ""} for p in _DIVERSE_PAPERS]
    result = compute_2d_positions(papers)
    assert len(result) == len(_DIVERSE_PAPERS)
    # Should not crash and should produce valid coordinates
    for item in result:
        assert isinstance(item["x"], float)
        assert isinstance(item["y"], float)


def test_compute_2d_positions_missing_paper_id():
    """Papers without paper_id field get empty string."""
    papers = [{k: v for k, v in p.items() if k != "paper_id"} for p in _DIVERSE_PAPERS]
    result = compute_2d_positions(papers)
    assert len(result) == len(_DIVERSE_PAPERS)
    for item in result:
        assert item["paper_id"] == ""


def test_compute_2d_positions_returns_new_list():
    """Output is a new list (immutability check)."""
    result = compute_2d_positions(_DIVERSE_PAPERS)
    assert result is not _DIVERSE_PAPERS
