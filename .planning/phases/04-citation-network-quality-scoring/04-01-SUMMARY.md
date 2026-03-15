---
phase: "04"
plan: "01"
subsystem: citation-network
tags: [neo4j, citation-graph, bfs, semantic-scholar]
requires: [02-01]
provides: [neo4j-client, citation-schemas, expansion-engine, s2-citation-methods]
affects: [main-lifespan, s2-client]
tech-stack:
  added: [neo4j-async-driver]
patterns: [bfs-expansion, budget-control, batch-merge, rate-limiting-semaphore]
key-files:
  created:
    - backend/app/schemas/citation.py
    - backend/app/services/citation_network/__init__.py
    - backend/app/services/citation_network/neo4j_client.py
    - backend/app/services/citation_network/expansion_engine.py
    - backend/tests/test_citation_network.py
  modified:
    - backend/app/services/paper_search/s2_client.py
    - backend/app/main.py
    - backend/pyproject.toml
key-decisions:
  - "Neo4j async driver with transaction functions for all queries"
  - "BFS with priority selection by citation count at each level"
  - "asyncio.Semaphore(1) for S2 rate limiting within expansion"
  - "Neo4j startup non-fatal (same pattern as Meilisearch)"
requirements-completed:
  - CITE-01
  - CITE-02
  - CITE-04
  - CITE-05
duration: "15 min"
completed: "2026-03-15"
---

# Phase 04 Plan 01: Neo4j Client & BFS Citation Expansion Engine Summary

Async Neo4j client with batch MERGE operations and BFS citation expansion engine with per-level and total budget caps for controlled graph growth.

## What Was Built

**Task 1: Neo4j client, citation schemas, and S2 citation methods**
- CitationEdge, CitationExpansionRequest/Response, CitationGraph Pydantic schemas
- Neo4jClient with setup_schema (constraints + indexes), batch_merge_papers, batch_merge_edges, get_paper_neighborhood, batch_merge_similarity_edges, update_quality_scores, get_top_papers_by_quality
- Added get_citations and get_references to SemanticScholarClient with retry and 404 handling
- Neo4j wired into FastAPI lifespan (non-fatal, same pattern as Meilisearch)

**Task 2: BFS expansion engine with budget control and tests**
- expand_citations: BFS over depth 1-3, fetches citations + references per paper
- Priority selection: sorted by citation_count descending at each level
- Budget enforcement: per-level cap and total budget cap with early termination
- Rate limiting: asyncio.Semaphore(1) for S2 API requests
- 18 tests covering schemas, Neo4j client, S2 methods, and expansion logic

## Deviations from Plan

None - plan executed as written.

## Duration

Started: 2026-03-15 | Duration: ~15 min | Tasks: 2 | Files: 7

## Next

Ready for 04-02 (similarity service and citation REST endpoints).
