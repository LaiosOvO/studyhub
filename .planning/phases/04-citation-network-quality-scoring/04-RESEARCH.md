# Phase 4: Citation Network & Quality Scoring - Research

**Researched:** 2026-03-15
**Domain:** Citation graph construction, academic paper quality metrics, Neo4j graph storage
**Confidence:** HIGH

## Summary

Phase 4 builds a citation expansion engine that recursively discovers citing/referenced papers from seed papers, stores the citation graph in Neo4j, discovers semantically related papers beyond direct citations, and computes composite quality scores. The primary data sources are Semantic Scholar (citations, references, recommendations, SPECTER2 embeddings) and OpenAlex (citation counts, H-index, impact factor, referenced_works). Neo4j stores the graph with Paper nodes and CITES/RELATED_TO edges.

The existing Phase 2 infrastructure provides the paper search clients (S2, OpenAlex, PubMed, arXiv), the `PaperResult` schema, deduplication, and Meilisearch indexing. Neo4j is already running in Docker Compose (neo4j:2025 image, bolt://localhost:7687) with credentials configured in `Settings`, but no application code connects to it yet. The Neo4j Python driver v6.1 provides a native async API (`AsyncGraphDatabase.driver`) that fits the existing async FastAPI architecture.

The critical design challenge is budget control -- recursive citation expansion at depth 3 can explode exponentially. A BFS approach with per-level budget caps and priority-based selection (by citation count or relevance) prevents this. Semantic Scholar's `/paper/{id}/citations` and `/paper/{id}/references` endpoints paginate up to 1000 results per call, and the Recommendations API (`/recommendations/v1/papers/forpaper/{id}`) provides semantically similar papers beyond direct citation links.

**Primary recommendation:** Use Semantic Scholar as the primary citation data source (citations, references, recommendations, embeddings), supplement with OpenAlex for impact factor and H-index data, store everything in Neo4j with a simple Paper-CITES->Paper schema, and enforce budget caps at every BFS level.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CITE-01 | Recursive citation expansion depth 1-3 | S2 `/paper/{id}/citations` + `/paper/{id}/references` with BFS and depth parameter |
| CITE-02 | Both citing and referenced papers | S2 citations endpoint (incoming) + references endpoint (outgoing) |
| CITE-03 | Semantically related papers beyond direct citations | S2 Recommendations API `GET /recommendations/v1/papers/forpaper/{id}` |
| CITE-04 | Citation graph in Neo4j | Neo4j async driver v6.1 with Paper nodes + CITES/RELATED_TO edges |
| CITE-05 | Configurable budget to prevent explosion | BFS with per-level cap, priority queue by citation_count |
| CITE-06 | Manual expansion from graph view | Endpoint that runs single-depth expansion from a given paper_id |
| QUAL-01 | Composite quality score (citations + velocity + IF + H-index) | OpenAlex `cited_by_count`, `counts_by_year`, source `summary_stats`, author `h_index` |
| QUAL-02 | Quality score breakdown per paper | Pydantic schema with individual component scores |
| QUAL-03 | Ranked by quality in search/graph | Sort by quality_score in search results + Neo4j `ORDER BY` |
| QUAL-04 | Top-N key papers identification | Sort by quality_score descending, take top N |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| neo4j | 6.1.x | Neo4j async Python driver | Official driver, native async API, managed transactions with retries |
| httpx | 0.28.x | HTTP client for S2 API calls | Already in project, async, connection pooling |
| tenacity | 9.x | Retry logic for API calls | Already in project, used by all search clients |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pyalex | 0.21.x | OpenAlex data (H-index, IF) | Fetching author/source metrics for quality scoring |
| numpy | latest | Cosine similarity for embeddings | Only if computing local similarity from SPECTER2 vectors |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| S2 Recommendations API | Local SPECTER2 embeddings + cosine similarity | More control but requires downloading/storing 768-dim vectors per paper |
| Neo4j driver direct | neomodel OGM | OGM adds abstraction overhead; raw Cypher is more flexible for graph traversals |
| BFS expansion | Recursive Cypher queries | BFS in Python gives budget control; Cypher recursion harder to cap mid-traversal |

**Installation:**
```bash
cd backend && uv add neo4j
```

Note: `numpy` likely already available as a transitive dependency. Only add explicitly if needed for embedding similarity.

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
  services/
    citation_network/
      __init__.py
      neo4j_client.py       # AsyncDriver wrapper, connection lifecycle
      expansion_engine.py    # BFS citation expansion with budget control
      similarity_service.py  # S2 Recommendations + SPECTER2 similarity
      quality_scorer.py      # Composite quality score computation
    paper_search/            # (existing) search clients
  models/
    paper.py                 # (existing) add quality_score column
  schemas/
    citation.py              # Citation graph request/response schemas
    quality.py               # Quality score breakdown schema
  routers/
    citations.py             # Citation expansion + graph query endpoints
```

### Pattern 1: Neo4j Async Client Singleton
**What:** A thin wrapper around `AsyncGraphDatabase.driver` managed by FastAPI lifespan
**When to use:** All Neo4j interactions throughout the application

```python
# Source: Neo4j Python Driver 6.1 async docs
from neo4j import AsyncGraphDatabase, AsyncDriver

class Neo4jClient:
    """Async Neo4j client managed by FastAPI lifespan."""

    def __init__(self, uri: str, user: str, password: str) -> None:
        self._driver: AsyncDriver = AsyncGraphDatabase.driver(
            uri, auth=(user, password)
        )

    async def close(self) -> None:
        await self._driver.close()

    async def execute_write(self, query: str, **params) -> list[dict]:
        async with self._driver.session() as session:
            result = await session.execute_write(
                lambda tx: tx.run(query, **params)
            )
            return [record.data() async for record in result]

    async def execute_read(self, query: str, **params) -> list[dict]:
        async with self._driver.session() as session:
            result = await session.execute_read(
                lambda tx: tx.run(query, **params)
            )
            return [record.data() async for record in result]
```

### Pattern 2: BFS Citation Expansion with Budget Control
**What:** Breadth-first expansion of citation graph with per-level paper caps
**When to use:** CITE-01, CITE-05 -- recursive expansion that must not explode

```python
async def expand_citations(
    seed_paper_ids: list[str],
    max_depth: int = 2,          # 1-3
    budget_per_level: int = 50,  # cap per BFS level
    total_budget: int = 200,     # absolute cap
) -> CitationGraph:
    visited: set[str] = set()
    queue: list[str] = list(seed_paper_ids)
    total_added = 0

    for depth in range(max_depth):
        if not queue or total_added >= total_budget:
            break
        next_level: list[PaperResult] = []
        # Fan out: fetch citations + references for all papers in queue
        for paper_id in queue:
            citing = await s2_client.get_citations(paper_id, limit=100)
            referenced = await s2_client.get_references(paper_id, limit=100)
            candidates = citing + referenced
            # Filter already visited
            new_papers = [p for p in candidates if p.s2_id not in visited]
            next_level.extend(new_papers)

        # Priority selection: rank by citation_count, take top budget_per_level
        next_level.sort(key=lambda p: p.citation_count, reverse=True)
        selected = next_level[:min(budget_per_level, total_budget - total_added)]

        # Store in Neo4j and update tracking
        for paper in selected:
            visited.add(paper.s2_id)
            total_added += 1
            await neo4j_client.merge_paper_and_edges(paper, ...)

        queue = [p.s2_id for p in selected]
```

### Pattern 3: MERGE-Based Neo4j Upserts
**What:** Idempotent upsert of papers and citation edges using Cypher MERGE
**When to use:** Every time papers or citation relationships are discovered

```cypher
// Merge paper node (idempotent)
MERGE (p:Paper {paper_id: $paper_id})
ON CREATE SET p.title = $title, p.doi = $doi, p.year = $year,
              p.citation_count = $citation_count, p.quality_score = $quality_score
ON MATCH SET  p.citation_count = $citation_count, p.quality_score = $quality_score

// Merge citation edge
MATCH (a:Paper {paper_id: $citing_id})
MATCH (b:Paper {paper_id: $cited_id})
MERGE (a)-[:CITES]->(b)

// Merge semantic similarity edge
MATCH (a:Paper {paper_id: $paper_a})
MATCH (b:Paper {paper_id: $paper_b})
MERGE (a)-[r:RELATED_TO]->(b)
ON CREATE SET r.score = $similarity_score, r.source = 's2_recommendations'
```

### Pattern 4: Quality Score as Weighted Composite
**What:** Normalize each metric to 0-1, then weighted sum
**When to use:** QUAL-01 quality scoring

```python
def compute_quality_score(
    citation_count: int,
    citation_velocity: float,  # citations per year
    impact_factor: float | None,
    h_index: int | None,
    weights: QualityWeights | None = None,
) -> QualityBreakdown:
    w = weights or DEFAULT_WEIGHTS  # e.g., 0.35, 0.25, 0.2, 0.2
    # Normalize each to 0-1 using log scaling with caps
    norm_citations = min(log10(citation_count + 1) / 4.0, 1.0)  # 10000 = 1.0
    norm_velocity = min(citation_velocity / 50.0, 1.0)           # 50/yr = 1.0
    norm_if = min((impact_factor or 0) / 20.0, 1.0)             # IF 20 = 1.0
    norm_h = min((h_index or 0) / 80.0, 1.0)                    # h=80 = 1.0

    composite = (
        w.citations * norm_citations
        + w.velocity * norm_velocity
        + w.impact_factor * norm_if
        + w.h_index * norm_h
    )
    return QualityBreakdown(
        score=round(composite, 4),
        citations=norm_citations,
        velocity=norm_velocity,
        impact_factor=norm_if,
        h_index=norm_h,
    )
```

### Anti-Patterns to Avoid
- **Unbounded recursive expansion:** Never expand citations without a hard budget cap. Depth 3 from a highly-cited paper can yield millions of papers.
- **N+1 API calls:** Batch paper ID lookups where possible. S2 supports batch paper details via `POST /paper/batch`.
- **Storing full paper data in Neo4j:** Neo4j is for graph topology + lightweight properties. Full metadata stays in PostgreSQL. Neo4j Paper nodes hold: paper_id, title, doi, year, citation_count, quality_score.
- **Synchronous Neo4j calls:** Always use the async driver (`AsyncGraphDatabase`). Never use the sync `GraphDatabase` in a FastAPI async context.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Semantic similarity | Custom embedding + vector search | S2 Recommendations API | Pre-computed, no infrastructure needed, high quality |
| Citation data | Scraping Google Scholar | S2 + OpenAlex APIs | Structured, rate-limited, legal, comprehensive |
| Graph database | Adjacency lists in PostgreSQL | Neo4j | Variable-depth traversals are O(relationships) vs O(n^2) joins |
| H-index computation | Custom SQL query | OpenAlex author endpoint `h_index` field | Already computed, updated regularly |
| Impact factor | Custom journal ranking table | OpenAlex source `summary_stats.2yr_mean_citedness` | Maintained by OpenAlex, covers 250k+ sources |
| Retry/backoff | Custom retry loops | tenacity decorators | Already used in all Phase 2 clients |
| Deduplication | Custom matching in Neo4j | Existing deduplicator.py | Already handles DOI + fuzzy title matching |

**Key insight:** The academic API ecosystem (S2 + OpenAlex) provides almost all raw data needed. The engineering challenge is orchestrating API calls within rate limits and budget constraints, not computing metrics from scratch.

## Common Pitfalls

### Pitfall 1: Citation Graph Explosion
**What goes wrong:** Expanding a well-cited paper (e.g., "Attention Is All You Need" with 100k+ citations) at depth 2+ produces millions of candidates.
**Why it happens:** Citation networks follow power-law distributions. Top papers have extreme fan-out.
**How to avoid:** Hard budget caps at every level. Priority-based selection (highest citation count first). Total budget across all levels. Log warnings when budget is hit.
**Warning signs:** Expansion taking >30 seconds, memory usage spiking, API rate limits hit repeatedly.

### Pitfall 2: Semantic Scholar Rate Limits
**What goes wrong:** Hitting S2's rate limits (1 request/second without API key, ~10/sec with key) during expansion of many papers.
**Why it happens:** BFS expansion at depth 2 with 50 papers/level = 100+ API calls for citations+references alone.
**How to avoid:** Use asyncio.Semaphore(1) for S2 (already established in Phase 2). Batch paper lookups with `POST /paper/batch` (up to 500 IDs). Cache S2 responses in Valkey with 24h TTL. Process expansion asynchronously (return immediately, poll for results).
**Warning signs:** HTTP 429 responses, expansion timeouts.

### Pitfall 3: Neo4j MERGE Performance on Large Imports
**What goes wrong:** Slow MERGE operations when upserting thousands of nodes without indexes.
**Why it happens:** MERGE without a unique constraint does a full scan.
**How to avoid:** Create unique constraint on Paper.paper_id before any data import. Use UNWIND for batch operations instead of individual MERGE calls.
**Warning signs:** Single paper upsert taking >100ms, import of 200 papers taking >30 seconds.

### Pitfall 4: Inconsistent Paper IDs Across Sources
**What goes wrong:** Same paper has different IDs in S2 (S2 paperId), OpenAlex (W-prefixed ID), and local DB (UUID). Duplicates appear in Neo4j.
**Why it happens:** Each source has its own ID scheme. DOI is the only reliable cross-source identifier, but not all papers have DOIs.
**How to avoid:** Use local DB paper.id (UUID) as Neo4j paper_id. Map S2/OpenAlex IDs through the existing deduplication layer before storing. Store source IDs as properties on the Paper node for cross-referencing.
**Warning signs:** Duplicate paper nodes in Neo4j with different paper_ids for the same paper.

### Pitfall 5: Missing Quality Data
**What goes wrong:** Many papers lack impact factor data (conference papers), H-index (new authors), or have zero citations.
**Why it happens:** Not all papers are in journals (no IF). New papers have no citations yet. Author H-index requires OpenAlex lookup.
**How to avoid:** Make all quality components optional with None handling. Use 0 as fallback for missing components. Weight the score by available components (if only 2 of 4 components available, normalize to those 2). Flag papers with incomplete quality data.
**Warning signs:** All papers getting the same quality score, quality scores of exactly 0.

## Code Examples

### S2 Citation Fetch
```python
# Source: S2 Academic Graph API /paper/{paper_id}/citations
S2_CITATION_FIELDS = (
    "paperId,externalIds,title,abstract,authors,year,"
    "citationCount,venue,isOpenAccess,openAccessPdf,"
    "isInfluential"
)

async def get_citations(
    self, paper_id: str, limit: int = 100, offset: int = 0
) -> list[CitationEdge]:
    """Get papers that cite the given paper."""
    response = await self._client.get(
        f"{S2_BASE}/paper/{paper_id}/citations",
        params={
            "fields": f"citingPaper.{S2_CITATION_FIELDS},isInfluential,contexts,intents",
            "limit": min(limit, 1000),
            "offset": offset,
        },
        headers=self._headers,
        timeout=30.0,
    )
    response.raise_for_status()
    data = response.json().get("data") or []
    return [
        CitationEdge(
            citing_paper=_map_s2_to_paper(item["citingPaper"]),
            is_influential=item.get("isInfluential", False),
            intents=item.get("intents", []),
        )
        for item in data
        if item.get("citingPaper")
    ]
```

### S2 Recommendations (Semantic Similarity)
```python
# Source: S2 Recommendations API
S2_RECS_BASE = "https://api.semanticscholar.org/recommendations/v1"

async def get_similar_papers(
    self, paper_id: str, limit: int = 20
) -> list[PaperResult]:
    """Get semantically similar papers via S2 Recommendations API."""
    response = await self._client.get(
        f"{S2_RECS_BASE}/papers/forpaper/{paper_id}",
        params={"fields": S2_FIELDS, "limit": min(limit, 500)},
        headers=self._headers,
        timeout=30.0,
    )
    response.raise_for_status()
    recs = response.json().get("recommendedPapers") or []
    return [_map_s2_to_paper(p) for p in recs]
```

### Neo4j Schema Setup
```cypher
// Run once at startup or via migration
CREATE CONSTRAINT paper_id_unique IF NOT EXISTS
FOR (p:Paper) REQUIRE p.paper_id IS UNIQUE;

CREATE INDEX paper_doi IF NOT EXISTS
FOR (p:Paper) ON (p.doi);

CREATE INDEX paper_quality IF NOT EXISTS
FOR (p:Paper) ON (p.quality_score);
```

### Neo4j Batch Upsert with UNWIND
```cypher
// Batch upsert papers
UNWIND $papers AS paper
MERGE (p:Paper {paper_id: paper.paper_id})
ON CREATE SET p.title = paper.title, p.doi = paper.doi,
              p.year = paper.year, p.citation_count = paper.citation_count,
              p.quality_score = paper.quality_score, p.s2_id = paper.s2_id,
              p.openalex_id = paper.openalex_id
ON MATCH SET  p.citation_count = paper.citation_count,
              p.quality_score = paper.quality_score

// Batch upsert citation edges
UNWIND $edges AS edge
MATCH (a:Paper {paper_id: edge.citing_id})
MATCH (b:Paper {paper_id: edge.cited_id})
MERGE (a)-[:CITES]->(b)
```

### OpenAlex Quality Data Fetch
```python
# Fetch author H-index from OpenAlex
async def get_author_h_index(self, author_name: str) -> int | None:
    """Get H-index for first matching author in OpenAlex."""
    def _sync():
        from pyalex import Authors
        results = Authors().search(author_name).get(per_page=1)
        if results:
            stats = results[0].get("summary_stats", {})
            return stats.get("h_index")
        return None
    return await asyncio.to_thread(_sync)

# Fetch journal impact factor (2yr mean citedness) from OpenAlex
async def get_journal_impact(self, source_id: str) -> float | None:
    """Get 2yr mean citedness (proxy for impact factor) from OpenAlex."""
    def _sync():
        from pyalex import Sources
        results = Sources().filter(openalex=source_id).get(per_page=1)
        if results:
            stats = results[0].get("summary_stats", {})
            return stats.get("2yr_mean_citedness")
        return None
    return await asyncio.to_thread(_sync)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Google Scholar scraping | S2 + OpenAlex APIs | 2023-2024 | Structured, legal, comprehensive data |
| Custom embedding servers | S2 Recommendations API + SPECTER2 via `embedding.specterv2` field | 2023 | No infrastructure needed for similarity |
| Sync Neo4j driver | Async Neo4j driver (v5.0+, now v6.1) | 2023 | Native async/await, no thread pool needed |
| neo4j-driver package | neo4j package | v6.0 (Sep 2025) | Old package name deprecated |
| Manual IF tables | OpenAlex `summary_stats.2yr_mean_citedness` | 2022+ | Always current, covers 250k+ sources |

**Deprecated/outdated:**
- `neo4j-driver` package name: Use `neo4j` package instead (v6.0+)
- `aioneo4j` third-party wrapper: Unnecessary since official driver has native async (v5.0+)
- Microsoft Academic Graph: Replaced by OpenAlex

## Open Questions

1. **S2 API Key Rate Limits**
   - What we know: Without API key: 1 req/sec. With key: higher limits (10-100/sec claimed).
   - What's unclear: Exact rate limits with the project's S2 API key. Whether batch endpoints have different limits.
   - Recommendation: Start with conservative semaphore (1 req/sec), monitor 429s, increase if possible.

2. **OpenAlex H-index Availability**
   - What we know: OpenAlex provides `h_index` on author objects. But mapping paper authors to OpenAlex author IDs requires name matching.
   - What's unclear: How reliable the name-to-author-ID matching is, especially for Chinese names.
   - Recommendation: Use first author's H-index as proxy. Cache author lookups in Valkey. Fall back to None if matching fails.

3. **Neo4j 2025 Image Specifics**
   - What we know: Docker compose uses `neo4j:2025` image. Neo4j 2025 is the latest major version.
   - What's unclear: Whether any APOC procedures are needed, and if the 2025 community edition supports them.
   - Recommendation: Use only core Cypher (no APOC) to avoid community/enterprise edition issues.

## Sources

### Primary (HIGH confidence)
- S2 Academic Graph API swagger.json - Citation/reference endpoints, pagination, fields
- S2 Recommendations API swagger.json - Similar papers endpoint, request/response format
- Neo4j Python Driver 6.1 async docs - AsyncGraphDatabase, session management, query execution
- Neo4j GraphGist citation schema - Paper nodes, CITES relationships, Cypher patterns

### Secondary (MEDIUM confidence)
- OpenAlex developer docs - `cites` filter, `referenced_works`, `summary_stats` fields, author `h_index`
- S2 SPECTER2 blog post - `embedding.specterv2` field for paper embeddings

### Tertiary (LOW confidence)
- S2 rate limits (exact numbers with API key not officially documented in current docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Neo4j driver 6.1 async API well-documented, S2/OpenAlex APIs verified via swagger
- Architecture: HIGH - BFS with budget control is standard graph traversal pattern; Neo4j MERGE is well-established
- Pitfalls: HIGH - Citation explosion and rate limits are well-known challenges with documented mitigations

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (30 days - APIs are stable)
