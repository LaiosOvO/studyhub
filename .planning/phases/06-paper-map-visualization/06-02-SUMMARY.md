---
phase: 06-paper-map-visualization
plan: 02
status: completed
completed_at: 2026-03-16
---

## Summary

Added topic map (Deck.gl cluster scatter) and timeline (vis-timeline) views alongside the citation graph, with a backend embedding endpoint that computes 2D positions via TF-IDF + UMAP.

## What was done

### Backend
- Created `embedding_service.py` with `compute_2d_positions()` -- TF-IDF vectorization, UMAP (PCA fallback) 2D reduction, KMeans clustering with auto-labeling
- Added `GET /tasks/{task_id}/embeddings` endpoint that computes and caches 2D paper positions with cluster assignments
- Added `scikit-learn` and `umap-learn` to backend dependencies

### Frontend
- **TopicMap**: Deck.gl OrthographicView scatter plot with ScatterplotLayer (colored clusters) and TextLayer (cluster labels at centroids). Fetches embeddings from API. SSR-safe via `dynamic()`.
- **TimelineView**: vis-timeline wrapper with zoom/pan. Papers sorted chronologically, grouped by cluster, styled by quality score. Papers without year excluded. SSR-safe via `dynamic()`.
- **useVisTimeline hook**: Manages timeline lifecycle (create, update items, select event, destroy).
- **MapView updated**: Replaced "Coming soon" placeholders with real TopicMap and TimelineView via lazy-loaded dynamic imports.
- **graph-transforms.ts**: Replaced stubs with real `toDeckGlPoints()` (embedding API -> scatter points) and `toTimelineItems()` (nodes -> timeline items with quality CSS classes).
- **i18n**: Added topicMap and timeline sub-keys to zh-CN and en messages.

### Packages installed
- Frontend: `deck.gl`, `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/react`, `@loaders.gl/core`, `vis-timeline`, `vis-data`
- Backend: `scikit-learn`, `umap-learn`

## Key decisions
- Used standalone vis-timeline/vis-data imports to avoid moment.js (~300KB savings)
- Cluster colors use Tableau10 palette for accessibility
- Embeddings cached in task.config to avoid recomputation
- Timeline excludes papers without year data (cannot place chronologically)
- Both views share Zustand state: switching tabs preserves selected paper and filters
