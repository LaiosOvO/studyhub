"""2D embedding computation for topic map visualization.

Computes UMAP (or PCA fallback) 2D coordinates from paper text
features (title + abstract) using TF-IDF vectorization and KMeans
clustering. Pure functions with no side effects.

Ref: gpt-researcher scatter visualization approach.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer

logger = logging.getLogger(__name__)


def _reduce_to_2d(vectors: np.ndarray) -> np.ndarray:
    """Reduce high-dimensional TF-IDF vectors to 2D coordinates.

    Tries UMAP first for better cluster separation, falls back
    to PCA if umap-learn is unavailable.
    """
    try:
        from umap import UMAP

        reducer = UMAP(
            n_components=2,
            n_neighbors=min(15, max(2, vectors.shape[0] - 1)),
            min_dist=0.1,
            random_state=42,
        )
        return reducer.fit_transform(vectors)
    except ImportError:
        logger.info("umap-learn not available, falling back to PCA")
        from sklearn.decomposition import PCA

        reducer = PCA(n_components=2, random_state=42)
        return reducer.fit_transform(vectors)


def _extract_cluster_label(
    tfidf_matrix: np.ndarray,
    feature_names: list[str],
    labels: np.ndarray,
    cluster_id: int,
) -> str:
    """Extract the most representative term for a cluster.

    Uses the highest mean TF-IDF score within the cluster
    to find the most distinctive term.
    """
    cluster_mask = labels == cluster_id
    if not np.any(cluster_mask):
        return f"Cluster {cluster_id}"

    cluster_vectors = tfidf_matrix[cluster_mask]
    mean_tfidf = np.asarray(cluster_vectors.mean(axis=0)).flatten()
    top_idx = int(np.argmax(mean_tfidf))

    return feature_names[top_idx] if mean_tfidf[top_idx] > 0 else f"Cluster {cluster_id}"


def compute_2d_positions(papers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Compute 2D scatter positions and cluster assignments for papers.

    Args:
        papers: List of dicts with at least 'paper_id' and 'title'.
                Optional: 'abstract' for richer vectorization.

    Returns:
        List of dicts: {paper_id, x, y, cluster_id, cluster_label}
        Coordinates are normalized to roughly [-50, 50] range for
        comfortable Deck.gl rendering.
    """
    if len(papers) < 2:
        return [
            {
                "paper_id": p.get("paper_id", ""),
                "x": 0.0,
                "y": 0.0,
                "cluster_id": 0,
                "cluster_label": "single",
            }
            for p in papers
        ]

    # Build text corpus from title + abstract
    corpus = [
        f"{p.get('title', '')} {p.get('abstract', '')}".strip()
        for p in papers
    ]

    # TF-IDF vectorization
    vectorizer = TfidfVectorizer(
        max_features=500,
        stop_words="english",
        min_df=1,
        max_df=0.95,
    )
    tfidf_matrix = vectorizer.fit_transform(corpus)
    feature_names = vectorizer.get_feature_names_out().tolist()

    # Dimensionality reduction to 2D
    coords_2d = _reduce_to_2d(tfidf_matrix.toarray())

    # KMeans clustering
    n_clusters = max(2, min(8, len(papers) // 5 + 1))
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = kmeans.fit_predict(tfidf_matrix.toarray())

    # Normalize coordinates to [-50, 50] for Deck.gl comfort
    x_vals = coords_2d[:, 0]
    y_vals = coords_2d[:, 1]
    x_range = x_vals.max() - x_vals.min()
    y_range = y_vals.max() - y_vals.min()

    x_norm = (
        ((x_vals - x_vals.min()) / x_range * 100 - 50)
        if x_range > 0
        else np.zeros_like(x_vals)
    )
    y_norm = (
        ((y_vals - y_vals.min()) / y_range * 100 - 50)
        if y_range > 0
        else np.zeros_like(y_vals)
    )

    # Build cluster labels
    cluster_labels: dict[int, str] = {}
    for cid in range(n_clusters):
        cluster_labels[cid] = _extract_cluster_label(
            tfidf_matrix.toarray(), feature_names, labels, cid
        )

    return [
        {
            "paper_id": papers[i].get("paper_id", ""),
            "x": float(x_norm[i]),
            "y": float(y_norm[i]),
            "cluster_id": int(labels[i]),
            "cluster_label": cluster_labels[int(labels[i])],
        }
        for i in range(len(papers))
    ]
