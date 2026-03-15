# Architecture Research

**Domain:** AI-powered academic research platform (paper discovery + experiment automation + researcher collaboration)
**Researched:** 2026-03-15
**Confidence:** MEDIUM-HIGH

## Standard Architecture

### System Overview

The design doc proposes a layered architecture that aligns well with established patterns for platforms combining long-running AI workflows, graph-heavy data, and real-time collaboration. The architecture below refines the design doc's proposal based on research into how similar systems (AI-Scientist, gpt-researcher, scholarly platforms) are structured.

```
┌────────────────────────────────────────────────────────────────┐
│                       CLIENT LAYER                              │
│  ┌──────────────────────┐       ┌──────────────────────────┐   │
│  │  Web App (Next.js)    │       │  Desktop Agent (Tauri)    │   │
│  │  - Paper Map views    │       │  - Experiment execution   │   │
│  │  - Community / Match  │       │  - GPU management         │   │
│  │  - Dashboard / Plans  │       │  - Offline-capable        │   │
│  └──────────┬───────────┘       └────────────┬─────────────┘   │
│             │ HTTPS/WSS                       │ HTTPS/WSS       │
└─────────────┼────────────────────────────────┼─────────────────┘
              │                                │
              ▼                                ▼
┌────────────────────────────────────────────────────────────────┐
│                    GATEWAY LAYER                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  API Gateway (FastAPI)                                    │  │
│  │  - JWT auth + RBAC    - Rate limiting (per-user/tier)     │  │
│  │  - Request routing    - WebSocket manager (SSE fallback)  │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                              │                                  │
│  ┌──────────────────────────▼───────────────────────────────┐  │
│  │  Workflow Orchestrator (Temporal)                          │  │
│  │  - Deep Research workflows    - Experiment workflows      │  │
│  │  - Plan Generation workflows  - Profile Enrichment        │  │
│  │  - Retry / timeout / resume   - Workflow versioning       │  │
│  └──────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────┐
│                       CORE SERVICES                              │
│                              │                                   │
│  ┌───────────────┐  ┌───────▼───────┐  ┌────────────────────┐  │
│  │ Deep Research  │  │ Plan          │  │ Experiment Engine  │  │
│  │ Engine         │  │ Generator     │  │ (orchestrates      │  │
│  │ (multi-source  │  │ (SOTA gap     │  │  Desktop Agent)    │  │
│  │  search, cite  │  │  analysis,    │  │                    │  │
│  │  expansion,    │  │  code skel    │  │                    │  │
│  │  LLM analysis) │  │  generation)  │  │                    │  │
│  └───────┬───────┘  └───────┬───────┘  └─────────┬──────────┘  │
│          │                  │                     │              │
│  ┌───────▼───────┐  ┌──────▼────────┐  ┌────────▼───────────┐  │
│  │ Paper Map     │  │ Community     │  │ Notification       │  │
│  │ Service       │  │ Service       │  │ Service            │  │
│  │ (graph views, │  │ (profiles,    │  │ (email, in-app,    │  │
│  │  topic maps,  │  │  matching,    │  │  experiment        │  │
│  │  timelines)   │  │  needs board, │  │  progress push)    │  │
│  │               │  │  messaging)   │  │                    │  │
│  └───────────────┘  └──────────────┘  └────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  SHARED INFRASTRUCTURE                      │  │
│  │                                                            │  │
│  │  LLM Gateway        Data Source        Paper Parser        │  │
│  │  (model routing,    Aggregator         (MinerU + GROBID,   │  │
│  │   cost control,     (OpenAlex, S2,      PDF full-text      │  │
│  │   fallback chain)   PubMed, CNKI,       extraction)        │  │
│  │                     arXiv, Wanfang)                        │  │
│  │                                                            │  │
│  │  Event Bus (Redis Streams)    File Storage (MinIO/S3)      │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────┐
│                        DATA LAYER                                │
│                                                                  │
│  PostgreSQL        Neo4j           Meilisearch                   │
│  (users, plans,    (citation       (full-text search,            │
│   experiments,     graph, author   Chinese tokenization,         │
│   metadata)        networks,       faceted filtering)            │
│                    co-citation)                                   │
│                                                                  │
│  Redis             ClickHouse      MinIO                         │
│  (cache, sessions, (analytics:     (PDFs, model                  │
│   event streams,   experiment      checkpoints,                  │
│   rate limiting)   stats, trends)  experiment logs)              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| **Web App (Next.js)** | UI for paper maps, community, dashboards. SSR for SEO on public paper pages. | API Gateway via HTTPS/WSS |
| **Desktop Agent (Tauri)** | Local experiment execution, GPU management, offline experiment queue. Rust backend for system-level access. | API Gateway via HTTPS/WSS for sync; local filesystem for experiments |
| **API Gateway (FastAPI)** | Single entry point. Auth, rate limiting, request routing, WebSocket management. Thin layer -- no business logic. | All core services, Temporal |
| **Temporal Orchestrator** | Durable execution of long-running workflows (deep research = hours, experiments = days). Handles retries, timeouts, resume after crash. | Core services as activity workers |
| **Deep Research Engine** | Multi-source paper search, recursive citation expansion, quality scoring, LLM-powered analysis. | Data Source Aggregator, Paper Parser, LLM Gateway, Neo4j, PostgreSQL, Meilisearch |
| **Plan Generator** | SOTA identification, gap analysis, improvement plan generation, code skeleton creation. | Deep Research results (PostgreSQL/Neo4j), LLM Gateway |
| **Experiment Engine** | Orchestrates experiment lifecycle on server side. Desktop Agent runs actual training. Tracks progress, manages results. | Desktop Agent (WebSocket), PostgreSQL, MinIO, Notification Service |
| **Paper Map Service** | Serves graph data for citation views, topic clustering for map view, timeline data. Read-heavy, precomputed where possible. | Neo4j (graph queries), PostgreSQL (metadata), Redis (cache) |
| **Community Service** | Researcher profiles, auto-enrichment from academic DBs, matching algorithm, needs marketplace, messaging. | PostgreSQL, Neo4j (collaboration graph), Data Source Aggregator |
| **Notification Service** | Push experiment progress, matching alerts, message notifications. Multi-channel (WebSocket, email, WeChat). | Redis Streams (subscribe to events), all services publish events |
| **LLM Gateway** | Unified interface to Claude/GPT/local models. Model routing, cost tracking, fallback chains, prompt management. | External LLM APIs, local model endpoints |
| **Data Source Aggregator** | Unified interface to 7+ academic data sources. Rate limiting, dedup, normalization. | External APIs (OpenAlex, S2, PubMed, arXiv, CNKI, Wanfang, Crossref) |
| **Paper Parser** | PDF to structured text. MinerU for high-quality extraction, GROBID for metadata/references. | MinIO (read PDFs), PostgreSQL (store parsed content) |
| **Event Bus (Redis Streams)** | Async event distribution. Decouples services. Consumer groups for reliable delivery. | All services publish/subscribe |

## Recommended Project Structure

```
study-community/
├── apps/
│   ├── web/                         # Next.js Web application
│   │   ├── src/
│   │   │   ├── app/                 # App Router pages
│   │   │   │   ├── (auth)/          # Auth-required routes
│   │   │   │   ├── (public)/        # Public routes (paper maps for SEO)
│   │   │   │   └── api/             # BFF API routes (minimal)
│   │   │   ├── components/
│   │   │   │   ├── paper-map/       # Graph, topic map, timeline views
│   │   │   │   ├── experiment/      # Dashboard, progress, reports
│   │   │   │   ├── community/       # Profiles, matching, needs board
│   │   │   │   └── shared/          # Common UI components
│   │   │   ├── hooks/               # React hooks (data fetching, WS)
│   │   │   ├── lib/                 # API client, utils, types
│   │   │   └── stores/              # Client state (Zustand)
│   │   └── package.json
│   │
│   └── desktop/                     # Tauri desktop application
│       ├── src-tauri/               # Rust backend
│       │   ├── src/
│       │   │   ├── experiment/      # Experiment runner (autoresearch loop)
│       │   │   ├── gpu/             # GPU detection, allocation
│       │   │   ├── sync/            # Web<->Desktop sync logic
│       │   │   └── commands.rs      # IPC command handlers
│       │   └── Cargo.toml
│       └── src/                     # Frontend (shares web components)
│
├── backend/
│   ├── gateway/                     # FastAPI gateway application
│   │   ├── main.py
│   │   ├── routers/                 # Route definitions (thin)
│   │   ├── middleware/              # Auth, rate limit, CORS, logging
│   │   ├── websocket/              # WS connection manager
│   │   └── deps.py                 # Dependency injection
│   │
│   ├── services/                    # Core domain services
│   │   ├── deep_research/
│   │   │   ├── engine.py           # Orchestration logic
│   │   │   ├── analyzers/          # LLM-based analysis modules
│   │   │   ├── scorers/            # Paper quality scoring
│   │   │   └── models.py           # Domain models
│   │   ├── plan_generator/
│   │   │   ├── sota_analyzer.py
│   │   │   ├── gap_finder.py
│   │   │   ├── code_generator.py
│   │   │   └── models.py
│   │   ├── experiment/
│   │   │   ├── manager.py          # Server-side experiment tracking
│   │   │   ├── report_generator.py
│   │   │   └── models.py
│   │   ├── paper_map/
│   │   │   ├── graph_builder.py    # Neo4j graph operations
│   │   │   ├── topic_clusterer.py
│   │   │   └── models.py
│   │   ├── community/
│   │   │   ├── profiles.py
│   │   │   ├── matcher.py          # Matching algorithm
│   │   │   ├── needs_board.py
│   │   │   └── models.py
│   │   └── notification/
│   │       ├── dispatcher.py
│   │       └── channels/           # Email, WebSocket, WeChat
│   │
│   ├── shared/                      # Shared infrastructure
│   │   ├── llm/
│   │   │   ├── gateway.py          # Model routing, fallback
│   │   │   ├── prompts/            # Prompt templates
│   │   │   └── cost_tracker.py
│   │   ├── data_sources/
│   │   │   ├── base.py             # Abstract source interface
│   │   │   ├── openalex.py
│   │   │   ├── semantic_scholar.py
│   │   │   ├── pubmed.py
│   │   │   ├── arxiv.py
│   │   │   ├── cnki.py
│   │   │   ├── wanfang.py
│   │   │   └── aggregator.py       # Dedup + normalize
│   │   ├── parsers/
│   │   │   ├── mineru.py
│   │   │   └── grobid.py
│   │   ├── events/
│   │   │   ├── bus.py              # Redis Streams publish/subscribe
│   │   │   └── schemas.py          # Event type definitions
│   │   ├── storage/
│   │   │   └── minio_client.py
│   │   └── db/
│   │       ├── postgres.py         # SQLAlchemy async
│   │       ├── neo4j_client.py     # Neo4j driver wrapper
│   │       ├── meili_client.py
│   │       └── redis_client.py
│   │
│   └── workflows/                   # Temporal workflow definitions
│       ├── deep_research/
│       │   ├── workflow.py          # Workflow definition
│       │   └── activities.py        # Activity implementations
│       ├── experiment/
│       │   ├── workflow.py
│       │   └── activities.py
│       ├── plan_generation/
│       │   ├── workflow.py
│       │   └── activities.py
│       └── profile_enrichment/
│           ├── workflow.py
│           └── activities.py
│
├── infra/
│   ├── docker-compose.yml           # All services
│   ├── docker-compose.dev.yml       # Dev overrides
│   ├── temporal/
│   │   └── docker-compose.temporal.yml
│   ├── neo4j/
│   │   └── init-constraints.cypher  # Schema constraints
│   ├── postgres/
│   │   └── init.sql
│   └── nginx/                       # Reverse proxy config
│
├── shared/                          # Cross-app shared types
│   ├── types/                       # TypeScript types (web + desktop)
│   └── api-client/                  # Generated API client
│
└── pyproject.toml                   # Python monorepo config
```

### Structure Rationale

- **`apps/` vs `backend/`**: Clean client-server separation. Both Tauri and Next.js live under `apps/` because they are presentation-layer concerns.
- **`backend/gateway/` separate from `backend/services/`**: The gateway is a thin routing layer. Services contain domain logic. This prevents the gateway from becoming a god object.
- **`backend/shared/`**: Infrastructure code (DB clients, LLM gateway, event bus) shared across services. Not a "utils dump" -- each subfolder has a clear responsibility.
- **`backend/workflows/`**: Temporal workflows isolated from services. Workflows orchestrate; activities call into services. This keeps Temporal concerns separate from domain logic.
- **`shared/` (root)**: TypeScript types and generated API client shared between web and desktop apps.

## Architectural Patterns

### Pattern 1: Temporal Workflow for Long-Running Operations

**What:** All multi-step, long-running operations (deep research, experiment execution, plan generation, profile enrichment) run as Temporal workflows, not as background tasks in FastAPI.

**When to use:** Any operation that takes >30 seconds, has multiple steps, or needs resume-after-failure.

**Trade-offs:**
- Pro: Automatic retries, timeout handling, workflow versioning, visibility into running workflows, resume after server crash
- Pro: Temporal's durable execution eliminates the need for custom state machines in the DB
- Con: Adds operational complexity (Temporal server + DB). Worth it for this project given 4+ workflow types.

**Example:**
```python
# backend/workflows/deep_research/workflow.py
@workflow.defn
class DeepResearchWorkflow:
    @workflow.run
    async def run(self, params: DeepResearchParams) -> DeepResearchResult:
        # Phase 1: Multi-source search (parallel activities)
        search_results = await asyncio.gather(
            workflow.execute_activity(
                search_openalex, params.query, start_to_close_timeout=timedelta(minutes=5)
            ),
            workflow.execute_activity(
                search_pubmed, params.query, start_to_close_timeout=timedelta(minutes=5)
            ),
            workflow.execute_activity(
                search_semantic_scholar, params.query, start_to_close_timeout=timedelta(minutes=5)
            ),
        )

        # Phase 2: Dedup and citation expansion
        papers = await workflow.execute_activity(
            deduplicate_and_merge, search_results,
            start_to_close_timeout=timedelta(minutes=10)
        )

        expanded = await workflow.execute_activity(
            expand_citations, papers, params.depth,
            start_to_close_timeout=timedelta(minutes=30)
        )

        # Phase 3: Quality scoring
        scored = await workflow.execute_activity(
            score_papers, expanded,
            start_to_close_timeout=timedelta(minutes=5)
        )

        # Phase 4: LLM analysis (expensive, idempotent)
        insights = await workflow.execute_activity(
            analyze_with_llm, scored,
            start_to_close_timeout=timedelta(hours=1),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )

        return DeepResearchResult(papers=scored, insights=insights)
```

### Pattern 2: Event-Driven Decoupling via Redis Streams

**What:** Services communicate asynchronously through Redis Streams events. Each service publishes domain events; interested services subscribe via consumer groups.

**When to use:** When one action should trigger reactions in multiple services without coupling them. E.g., "paper analyzed" triggers both paper map update and notification push.

**Trade-offs:**
- Pro: Services stay independent. Adding a new consumer doesn't require changing the publisher.
- Pro: Redis Streams consumer groups provide reliable delivery with acknowledgment.
- Con: Eventual consistency -- the paper map may lag a few seconds behind analysis completion.
- Con: Debugging distributed flows requires good tracing (use correlation IDs).

**Key events:**
```python
# Event types flowing through Redis Streams
DEEP_RESEARCH_STARTED    = "deep_research.started"
DEEP_RESEARCH_PROGRESS   = "deep_research.progress"     # Papers found count
DEEP_RESEARCH_COMPLETED  = "deep_research.completed"
PAPER_ANALYZED           = "paper.analyzed"              # Single paper LLM analysis done
PLAN_GENERATED           = "plan.generated"
EXPERIMENT_STARTED       = "experiment.started"
EXPERIMENT_ROUND_DONE    = "experiment.round.completed"  # Each autoresearch iteration
EXPERIMENT_COMPLETED     = "experiment.completed"
PROFILE_ENRICHED         = "profile.enriched"
MATCH_FOUND              = "community.match.found"
```

### Pattern 3: Data Source Aggregator with Adapter Pattern

**What:** Each academic data source (OpenAlex, S2, PubMed, CNKI, etc.) implements a common interface. The aggregator queries multiple sources in parallel, deduplicates by DOI/title similarity, and normalizes into a unified paper schema.

**When to use:** Always -- this is the foundation of the Deep Research Engine.

**Trade-offs:**
- Pro: Adding new data sources is a single adapter implementation.
- Pro: Per-source rate limiting and error handling is isolated.
- Con: Deduplication across sources is non-trivial (fuzzy title matching needed for Chinese papers without DOI).

**Example:**
```python
# backend/shared/data_sources/base.py
class DataSource(ABC):
    @abstractmethod
    async def search(self, query: str, filters: SearchFilters) -> list[RawPaper]: ...

    @abstractmethod
    async def get_citations(self, paper_id: str) -> list[str]: ...

    @abstractmethod
    async def get_references(self, paper_id: str) -> list[str]: ...

    @abstractmethod
    async def get_paper_details(self, paper_id: str) -> RawPaper | None: ...

# backend/shared/data_sources/aggregator.py
class DataSourceAggregator:
    def __init__(self, sources: list[DataSource]):
        self._sources = sources

    async def search_all(self, query: str, filters: SearchFilters) -> list[Paper]:
        raw_results = await asyncio.gather(
            *(source.search(query, filters) for source in self._sources),
            return_exceptions=True
        )
        # Filter out failed sources (log warnings), flatten, dedup, normalize
        return self._deduplicate(self._normalize(self._flatten(raw_results)))
```

### Pattern 4: Dual-Database Strategy (PostgreSQL + Neo4j)

**What:** PostgreSQL is the system of record for all entities (users, papers metadata, experiments, plans). Neo4j is a read-optimized projection specifically for graph traversal queries (citation paths, co-author networks, topic clusters).

**When to use:** This split is necessary because citation graph queries (find all papers within 3 hops of paper X, weighted by citation count) are orders of magnitude faster in Neo4j than in relational DB with recursive CTEs.

**Trade-offs:**
- Pro: Each DB used for its strength. PostgreSQL for ACID transactions, Neo4j for graph traversal.
- Pro: Georgia Tech's production citation graph (471K nodes, 2.1M relationships) performs well in Neo4j.
- Con: Data must be kept in sync. Use event-driven sync: when a paper is created/updated in PostgreSQL, publish event, Neo4j consumer updates the graph.
- Con: Two databases to operate and back up.

**Sync strategy:**
```
PostgreSQL (source of truth) --[event]--> Redis Streams --[consumer]--> Neo4j (graph projection)
```

### Pattern 5: Desktop Agent as Remote Worker

**What:** The Tauri desktop agent acts as a remote Temporal activity worker for experiment execution. It registers with Temporal, polls for experiment tasks, runs them on local GPU, and reports results back.

**When to use:** All experiment execution. The server never runs GPU-intensive training -- it only orchestrates.

**Trade-offs:**
- Pro: GPU stays on researcher's machine. No cloud GPU costs. Data sovereignty.
- Pro: Temporal handles the connection -- if desktop goes offline, workflow pauses and resumes when it reconnects.
- Con: Experiments only run when desktop agent is online. This is acceptable for the use case (lab machines run 24/7).
- Con: Tauri's Rust backend must embed the Temporal SDK (or use HTTP polling as a simpler alternative).

**Architecture decision:** Start with HTTP polling (Desktop Agent polls server for tasks every 30s) rather than embedding Temporal SDK in Rust. This is simpler and sufficient for v1. Migrate to direct Temporal worker if needed later.

## Data Flow

### Flow 1: Deep Research (the critical path)

```
User submits query ("ECG自动诊断算法")
    │
    ▼
[API Gateway] ──POST──▶ [Temporal] starts DeepResearchWorkflow
    │                         │
    │ returns task_id          ├──▶ Activity: search_openalex()
    │                         ├──▶ Activity: search_pubmed()
    ▼                         ├──▶ Activity: search_s2()
[WebSocket]                   └──▶ Activity: search_cnki()
  connects                         │
    │                              ▼
    │                    Activity: deduplicate_and_merge()
    │                              │
    │    ◄──event──               ▼
    │    progress          Activity: expand_citations(depth=2)
    │                              │ (loops, querying Neo4j for existing,
    │                              │  fetching new from APIs)
    │    ◄──event──               ▼
    │    progress          Activity: score_papers()
    │                              │
    │                              ▼
    │                    Activity: parse_pdfs() [top N papers]
    │                              │ (MinerU/GROBID via Paper Parser)
    │                              ▼
    │                    Activity: analyze_with_llm()
    │                              │ (trends, gaps, opportunities)
    │    ◄──event──               ▼
    │    completed         Store results:
    ▼                       PostgreSQL (paper metadata)
[UI updates                 Neo4j (citation graph)
 paper map]                 Meilisearch (full-text index)
                            MinIO (PDF files)
```

### Flow 2: Experiment Execution

```
User clicks "Start Experiment" on generated plan
    │
    ▼
[API Gateway] ──POST──▶ [Temporal] starts ExperimentWorkflow
    │                         │
    │                         ▼
    │                    Activity: prepare_experiment()
    │                      (generate code, config, dataset URLs)
    │                         │
    │                         ▼
    │                    Activity: notify_desktop_agent()
    │                      (push task to experiment queue)
    │                         │
    │                         ▼
    │              ┌──── Desktop Agent polls for tasks ────┐
    │              │                                        │
    │              │  LOOP:                                 │
    │              │  1. Download datasets                  │
    │              │  2. Run baseline                       │
    │              │  3. LLM suggests improvement           │
    │              │  4. Modify code, train                 │
    │              │  5. Evaluate metrics                   │
    │              │  6. Keep or discard                    │
    │              │  7. Report round results ──POST──▶ Server
    │              │                                   │
    │   ◄──event── │                                   ▼
    │   round done │                          Store in PostgreSQL
    │              │                          Update experiment status
    │              └───── repeat until done ────────────┘
    │                         │
    │                         ▼
    │                    Activity: generate_report()
    │                      (compile results.tsv into report)
    │                         │
    ▼                         ▼
[Dashboard shows           Upload: report, best model checkpoint
 real-time progress]       to MinIO. Publish EXPERIMENT_COMPLETED event.
```

### Flow 3: Community Matching

```
New user registers + profile enrichment
    │
    ▼
[Temporal] ProfileEnrichmentWorkflow
    │
    ├──▶ Activity: search_openalex(author_name, institution)
    ├──▶ Activity: search_cnki(author_name)
    │
    ▼
Activity: extract_skills_and_topics()
    │ (LLM analysis of publication list)
    ▼
Activity: compute_researcher_embedding()
    │ (embed research direction + skills)
    ▼
Store: PostgreSQL (profile), Neo4j (co-author graph)
    │
    ▼
Event: PROFILE_ENRICHED
    │
    ▼
[Community Service] re-runs matching for this user
    │
    ├── Cosine similarity on research embeddings
    ├── Skill complementarity scoring
    ├── Co-citation analysis (Neo4j)
    ├── Feasibility scoring (same city bonus)
    └── LLM generates match explanation
    │
    ▼
Store matches in PostgreSQL
Publish MATCH_FOUND events
    │
    ▼
[Notification Service] sends match alerts
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-50 researchers (launch) | Single server. All services in one FastAPI process. Docker Compose for infra. Temporal + 1 worker. This is sufficient. |
| 50-500 researchers | Separate Temporal workers by workflow type (research worker, experiment worker). Add Redis caching for paper map data. Consider read replicas for PostgreSQL if query load grows. |
| 500-5000 researchers | Split gateway from services into separate processes. Add connection pooling (PgBouncer). Neo4j may need more memory for larger graphs. Consider precomputing paper map views as materialized views. |
| 5000+ researchers | Beyond self-hosted single server. Would need Kubernetes, horizontal scaling of workers, Neo4j cluster. Cross that bridge if/when reached. |

### Scaling Priorities

1. **First bottleneck: LLM API costs and rate limits.** Deep Research with LLM analysis of hundreds of papers is expensive. Mitigation: cache LLM results per paper (same paper analyzed once), use smaller/local models for initial scoring, reserve expensive models for deep analysis. The LLM Gateway's cost tracking is essential from day one.

2. **Second bottleneck: Data source API rate limits.** OpenAlex polite pool (10/s), S2 (100/s with key), PubMed (10/s). For concurrent deep research sessions, implement per-source request queuing in the Data Source Aggregator with token bucket rate limiting.

3. **Third bottleneck: Neo4j memory for large citation graphs.** A single deep research task can produce 4000+ paper nodes with 10,000+ citation edges. Multiple concurrent sessions compound this. Mitigation: prune low-quality nodes aggressively, use Neo4j heap tuning, consider pagination in graph queries.

## Anti-Patterns

### Anti-Pattern 1: Gateway as Business Logic Layer

**What people do:** Put domain logic (paper scoring, matching algorithms) directly in FastAPI route handlers.
**Why it's wrong:** Gateway becomes unmaintainable. Can't reuse logic from Temporal workflows. Testing requires HTTP setup.
**Do this instead:** Gateway routes call service functions. Services contain all domain logic. Temporal activities call the same service functions.

### Anti-Pattern 2: Direct Service-to-Service Calls

**What people do:** Deep Research Engine directly calls Paper Map Service to update the graph after analysis.
**Why it's wrong:** Creates tight coupling. If Paper Map is down, Deep Research fails. Adding a new consumer (e.g., analytics) requires changing Deep Research.
**Do this instead:** Deep Research publishes a `PAPER_ANALYZED` event to Redis Streams. Paper Map and any other interested service subscribe independently.

### Anti-Pattern 3: Synchronous Citation Expansion

**What people do:** Expand citations recursively in a single synchronous call, blocking until all depths are explored.
**Why it's wrong:** Citation expansion at depth 2 can generate 10,000+ API calls. A synchronous call would timeout or overwhelm rate limits.
**Do this instead:** Use Temporal workflow with activities for each expansion level. Each level is a separate activity with its own timeout. Publish progress events between levels.

### Anti-Pattern 4: Storing Everything in Neo4j

**What people do:** Use Neo4j as the primary database for all data including user accounts, experiment configs, and messages.
**Why it's wrong:** Neo4j is not designed for transactional CRUD operations. No RBAC in community edition. Schema-less means no validation.
**Do this instead:** PostgreSQL is the source of truth. Neo4j is a read-optimized projection for graph queries only. Sync via events.

### Anti-Pattern 5: Tight Desktop-Server Coupling

**What people do:** Desktop agent makes direct database connections to the server's PostgreSQL/Neo4j.
**Why it's wrong:** Security nightmare. Desktop is an untrusted client. Database credentials on user's machine.
**Do this instead:** Desktop agent communicates exclusively through the API Gateway using authenticated HTTPS. All data exchange goes through API endpoints.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OpenAlex API | REST, async HTTP client (httpx) | Polite pool: include email in requests for 10/s. Free, no key needed. |
| Semantic Scholar API | REST, API key auth | Apply for API key for 100/s. Without key: 1/s (unusable). |
| PubMed E-utilities | REST, API key optional | 10/s without key, higher with. Use `tool` and `email` params. |
| arXiv | OAI-PMH (bulk) + REST API | Bulk harvest for initial load, API for real-time queries. |
| CNKI | Web scraping (Selenium/Playwright) | Anti-scraping is aggressive. Need session management, CAPTCHA handling. Rate limit strictly. |
| Wanfang | Web scraping | Similar to CNKI. Less aggressive anti-scraping. |
| Claude/GPT APIs | REST via LLM Gateway | Route through gateway for cost control, fallback, prompt versioning. |
| MinerU | Local service (Docker) | Self-hosted. GPU recommended for OCR. Batch processing queue. |
| GROBID | Local service (Docker) | Self-hosted. CPU-only. Good for metadata extraction. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Gateway <-> Services | Direct function calls (same process in v1) | Extract to gRPC/HTTP if splitting into separate processes later |
| Services <-> Temporal | Temporal SDK (activities registered on workers) | Workers run in same Python process as services |
| Services <-> Services | Redis Streams events (async) | Never direct calls between domain services |
| Web <-> Gateway | HTTPS REST + WebSocket for real-time | API versioning from day one (/api/v1/) |
| Desktop <-> Gateway | HTTPS REST + WebSocket for experiment sync | Desktop polls for tasks, pushes results. Auth via JWT refresh tokens. |
| PostgreSQL <-> Neo4j | Event-driven sync via Redis Streams | PostgreSQL is source of truth; Neo4j is eventually consistent projection |
| Services <-> Meilisearch | Direct client calls (search is synchronous) | Index updates triggered by events |

## Build Order (Dependencies)

The following build order respects component dependencies:

```
Phase 1: Foundation (must come first)
├── PostgreSQL schema + SQLAlchemy models
├── Redis setup (cache + event bus skeleton)
├── FastAPI gateway skeleton (auth, routing, WebSocket)
├── Docker Compose for all infra
└── Data Source Aggregator (OpenAlex + S2 + PubMed adapters)

Phase 2: Deep Research Engine (core value, depends on Phase 1)
├── Temporal setup + Deep Research Workflow
├── Citation expansion logic
├── Paper quality scoring
├── LLM Gateway + analysis pipeline
├── Paper Parser (MinerU/GROBID integration)
└── Neo4j graph storage + sync from PostgreSQL

Phase 3: Paper Map (depends on Phase 2 data)
├── Neo4j graph query service
├── React Flow citation graph view
├── Meilisearch indexing + search UI
└── Basic paper detail panels

Phase 4: Plan Generator (depends on Phase 2)
├── SOTA analyzer (reads Deep Research results)
├── Gap finder + improvement suggestion (LLM)
├── Code skeleton generator
└── Dataset recommender

Phase 5: Experiment Engine (depends on Phase 4)
├── Tauri desktop app skeleton
├── Experiment loop (autoresearch pattern)
├── Server-side experiment tracking
├── Web<->Desktop sync (experiment progress)
└── Experiment report generator

Phase 6: Community (independent of 3-5, depends on Phase 1)
├── User registration + profile
├── Profile auto-enrichment workflow
├── Matching algorithm
├── Needs marketplace
└── In-app messaging

Phase 7: Polish (depends on all above)
├── Notification service (multi-channel)
├── Topic map view + Timeline view
├── ClickHouse analytics
├── CNKI/Wanfang adapters (anti-scraping complexity)
└── Freemium tier enforcement
```

**Critical path:** Phase 1 -> Phase 2 -> Phase 3 is the critical path. Paper Map cannot be built without Deep Research data. Everything else can be parallelized after Phase 1.

**Community (Phase 6) is intentionally late** despite being "easy" because: (1) it needs a user base to be useful, (2) the first users (ECG research team) are known personally and don't need a matching algorithm, (3) Deep Research + Paper Map is the core differentiator that attracts users in the first place.

## Sources

- [Temporal: Revolutionizing Workflow Orchestration in Microservices](https://medium.com/@surajsub_68985/temporal-revolutionizing-workflow-orchestration-in-microservices-architectures-f8265afa4dc0) - MEDIUM confidence
- [The Rise of Durable Execution Engines (Temporal, Restate) in Event-Driven Architecture](https://www.kai-waehner.de/blog/2025/06/05/the-rise-of-the-durable-execution-engine-temporal-restate-in-an-event-driven-architecture-apache-kafka/) - MEDIUM confidence
- [FastAPI for Microservices: High-Performance Python API Design Patterns](https://talent500.com/blog/fastapi-microservices-python-api-design-patterns-2025/) - MEDIUM confidence
- [Event-Driven Architecture in Python with FastAPI and Redis Streams](https://medium.com/write-a-catalyst/mastering-event-driven-architecture-in-python-e2add3002763) - MEDIUM confidence
- [Microservices Communication with Redis Streams](https://redis.io/learn/howtos/solutions/microservices/interservice-communication) - HIGH confidence (official Redis docs)
- [Neo4j Citation Graph Example](https://github.com/neo4j-graph-examples/citations) - HIGH confidence (official Neo4j example)
- [Research Collaboration Discovery through Neo4j Knowledge Graph (Georgia Tech, PEARC 2024)](https://dl.acm.org/doi/10.1145/3626203.3670539) - HIGH confidence (peer-reviewed)
- [Tauri WebSocket Plugin](https://v2.tauri.app/plugin/websocket/) - HIGH confidence (official docs)
- [AI-Scientist (Sakana)](https://github.com/SakanaAI/AI-Scientist) - HIGH confidence (reference implementation for experiment automation)
- [Agentic AI for Scientific Discovery (ICLR Workshop)](https://iclragenticai.github.io/) - MEDIUM confidence
- [AI co-scientist multi-agent system (Google Research)](https://research.google/blog/accelerating-scientific-discovery-with-ai-powered-empirical-software/) - MEDIUM confidence

---
*Architecture research for: StudyHub academic research platform*
*Researched: 2026-03-15*
