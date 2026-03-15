---
phase: "04"
plan: "02"
subsystem: citation-network
tags: [similarity, s2-recommendations, rest-api, citation-endpoints]
requires: [04-01]
provides: [similarity-service, citations-router, expand-endpoint, graph-query-endpoint]
affects: [main-routers]
tech-stack:
  added: []
patterns: [recommendations-api, related-to-edges, non-fatal-discovery]
key-files:
  created:
    - backend/app/services/citation_network/similarity_service.py
    - backend/app/routers/citations.py
    - backend/tests/test_citation_similarity.py
  modified:
    - backend/app/main.py
key-decisions:
  - "RELATED_TO edges separate from CITES in Neo4j (different relationship types)"
  - "Similarity discovery non-fatal in expand endpoints (logged warning on failure)"
  - "Citations router uses lazy imports for get_settings to avoid circular deps"
requirements-completed:
  - CITE-03
  - CITE-06
duration: "10 min"
completed: "2026-03-15"
---

# Phase 04 Plan 02: Semantic Similarity & Citation REST Endpoints Summary

S2 Recommendations API integration for semantic similarity discovery and REST endpoints for citation expansion, manual node expansion, and graph queries.

## What Was Built

**Task 1: Similarity service and citations router**
- get_similar_papers: S2 Recommendations API with retry and 404 handling
- discover_and_store_similar: batch merge papers + RELATED_TO edges in Neo4j
- Citations router with 3 endpoints:
  - POST /citations/expand: multi-seed BFS expansion + similarity discovery
  - POST /citations/expand-node/{s2_id}: single-depth manual expansion
  - GET /citations/graph/{paper_id}: Neo4j neighborhood query with depth 1-3
- Router registered in main.py at /citations prefix

**Task 2: Tests for similarity service and citations endpoints**
- 11 tests covering similarity service (success, 404, API key), discover_and_store_similar, and all router endpoints including error cases (neo4j unavailable, depth validation)

## Deviations from Plan

None - plan executed as written.

## Duration

Started: 2026-03-15 | Duration: ~10 min | Tasks: 2 | Files: 4

## Next

Ready for 04-03 (quality scoring algorithm with ranking).
