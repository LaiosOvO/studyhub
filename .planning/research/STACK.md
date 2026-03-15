# Stack Research

**Domain:** Academic research platform (paper discovery, experiment automation, researcher collaboration)
**Researched:** 2026-03-15
**Confidence:** MEDIUM-HIGH

## Verdict on Proposed Stack

The design doc proposes: FastAPI + Next.js + Tauri + Neo4j + Temporal + PostgreSQL + Meilisearch + Redis + ClickHouse + MinIO.

**7 of 10 validated. 3 need changes:**

| Proposed | Verdict | Action |
|----------|---------|--------|
| FastAPI | KEEP | Excellent fit for Python ML ecosystem |
| Next.js | KEEP | SSR + React ecosystem, well-maintained |
| Tauri | KEEP | Stable v2, lightweight desktop agent |
| Neo4j | KEEP (with caveats) | Best for citation graphs, Community Edition sufficient for MVP |
| Temporal | KEEP | Perfect for long-running research workflows |
| PostgreSQL | KEEP | Battle-tested, no reason to change |
| Meilisearch | KEEP | Native Chinese tokenization, simple to operate |
| Redis | REPLACE with Valkey | Redis license drama; Valkey is the community fork |
| ClickHouse | DEFER | Overkill for MVP analytics, use PostgreSQL initially |
| MinIO | REPLACE with SeaweedFS | MinIO repo archived Feb 2026, no longer maintained OSS |

## Recommended Stack

### Backend Framework

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| FastAPI | 0.135.x | API server, WebSocket, SSE | Python-native, async, seamless with ML/NLP libraries (PyTorch, transformers, pyalex, semanticscholar). SSE support for streaming research results. Starlette 1.0+ foundation. | HIGH |
| Python | 3.12+ | Runtime | Best balance of library support and performance. 3.13 acceptable but some ML libs lag. | HIGH |
| Pydantic | 2.x | Data validation | FastAPI's native schema layer, generates OpenAPI docs automatically. | HIGH |
| uvicorn | 0.34+ | ASGI server | Production-grade async server for FastAPI. | HIGH |

### Frontend Framework

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Next.js | 16.1 | Web application | SSR for SEO on paper pages (Google Scholar indexing), App Router is stable, React 19 support, Turbopack for fast dev. | HIGH |
| React | 19.2 | UI library | Ships with Next.js 16, needed for React Flow. | HIGH |
| TypeScript | 5.7+ | Type safety | Non-negotiable for a project this complex. | HIGH |

### Desktop Application

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Tauri | 2.10.x | Desktop experiment agent | 15x smaller than Electron (~10MB vs ~150MB), 60% less memory. Rust backend can directly manage GPU processes, file I/O, and system monitoring. Stable since Oct 2024, active development through 2026. | HIGH |

### Databases

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| PostgreSQL | 17.9 | Primary relational store | Users, experiments, plans, metadata. Rock-solid, excellent JSON support for semi-structured data. Use pg17 (not 18.x which is too new for production libs). | HIGH |
| Neo4j Community | 2025.01+ | Citation graph database | Citation networks are textbook graph problems. Multi-hop traversal (find papers 3 citations away) is O(n) in Neo4j vs exponential joins in SQL. Community Edition is single-node but sufficient for self-hosted MVP. CalVer versioning since Jan 2025. | HIGH |
| Valkey | 8.1+ | Cache, pub/sub, queues | Drop-in Redis replacement, BSD 3-clause license, backed by AWS/Google/Oracle via Linux Foundation. Redis changed to source-available licensing in 2024; Valkey is the community-endorsed fork. API-compatible -- all Redis client libraries work unchanged. | HIGH |
| Meilisearch | 1.37 | Full-text search | Built-in Chinese tokenization via Charabia (no plugin config needed, unlike Elasticsearch). Sub-50ms search. Simpler to operate than Elasticsearch for this scale. Supports typo tolerance and faceted search. | MEDIUM-HIGH |

### Workflow Orchestration

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Temporal | Server 1.25+ / Python SDK 1.x | Long-running task orchestration | Deep Research workflows run 10-60 minutes with multiple stages (search, expand, analyze). Temporal provides durable execution: if the server crashes mid-workflow, it resumes exactly where it left off. Built-in retry, timeout, heartbeat. Python SDK is production-grade. Nexus GA enables cross-namespace communication if needed later. | HIGH |

### Object Storage

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| SeaweedFS | latest (3.x) | PDF storage, model checkpoints, logs | MinIO's open-source GitHub repo was archived on Feb 13, 2026 -- the community edition is frozen and all development moved to proprietary MinIO AIStor. SeaweedFS is the recommended replacement: Apache 2.0 license, S3-compatible API, production-proven, adopted by Kubeflow as default storage backend replacing MinIO. Single command Docker deployment: `docker run -p 8333:8333 chrislusf/seaweedfs server -s3`. | HIGH |

### Analytics (DEFERRED)

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| ~~ClickHouse~~ | ~~26.2~~ | ~~Platform analytics~~ | DEFER to Phase 5+. ClickHouse is overkill for MVP analytics (hot research directions, experiment success rates). PostgreSQL with materialized views handles this at MVP scale. Add ClickHouse when you have 10K+ users generating analytics queries. Self-hosting ClickHouse requires significant DevOps expertise. | MEDIUM |

### Visualization Libraries

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| React Flow | 12.10.x | Citation graph view | Purpose-built for interactive node-based UIs in React. Drag, zoom, pan, custom nodes out of the box. React 19 + Tailwind 4 compatible. MIT license. The scholarmaps reference project uses this exact library. | HIGH |
| D3.js | 7.x | Force-directed layouts, charts | Compute force-directed graph layouts, feed positions to React Flow. Also used for training curves and metrics charts in experiment dashboard. | HIGH |
| Deck.gl | 9.1 | Topic map (large-scale) | GPU-accelerated rendering for thousands of paper nodes in the topic map view. WebGPU-ready. Handles the "10K paper dots on a 2D map" use case that React Flow would struggle with. | MEDIUM |
| vis-timeline | 7.x | Timeline view | Mature timeline component with grouping and zoom. Lightweight, does one thing well. | MEDIUM |

### AI/ML Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| LiteLLM | latest | LLM gateway | Unified API for Claude/GPT/local models. Handles fallback, rate limiting, cost tracking. Abstracts away provider differences. | MEDIUM |
| sentence-transformers | latest | Embedding generation | Paper similarity, researcher matching. Use `all-MiniLM-L6-v2` for English, `shibing624/text2vec-base-chinese` for Chinese. | HIGH |
| MinerU | latest | PDF extraction | Best-in-class academic PDF parsing (30K+ stars). Handles formulas, tables, layout. Output Markdown/JSON. Use as primary parser. | MEDIUM-HIGH |
| GROBID | 0.8.x | PDF metadata extraction | Complement to MinerU for structured TEI XML output (author affiliation, references list). Run as Docker service. | HIGH |

### Academic Data Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| pyalex | 0.14+ | OpenAlex API client | Primary paper source (250M papers, free, no rate limit with polite pool). Use for bulk discovery. | HIGH |
| semanticscholar | 0.8+ | Semantic Scholar client | Citation graph construction (best citation data quality). 100 req/s with API key. | HIGH |
| Biopython (Entrez) | 1.84+ | PubMed API | Biomedical papers. Critical for ECG/medical domain. E-utilities API. | HIGH |
| scholarly | 1.7+ | Google Scholar scraper | Supplementary source. Rate-limited, use sparingly. | MEDIUM |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Docker Compose | Local infrastructure | Single `docker-compose.yml` for PostgreSQL, Neo4j, Valkey, Meilisearch, SeaweedFS, Temporal. Essential for self-hosted deployment. |
| uv | Python package management | 10-100x faster than pip. Modern lockfile support. Use instead of pip/poetry. |
| pnpm | Node package management | Faster and more disk-efficient than npm/yarn. Workspace support for monorepo. |
| Turborepo | Monorepo build orchestration | Caches builds across apps/web and apps/desktop. Pairs with pnpm workspaces. |
| Ruff | Python linting + formatting | Replaces black + flake8 + isort. 10-100x faster. |
| Biome | JS/TS linting + formatting | Replaces ESLint + Prettier. Faster, zero-config. |
| Alembic | Database migrations | SQLAlchemy-based migrations for PostgreSQL schema evolution. |
| SQLAlchemy | Python ORM | Async support with asyncpg driver. Use 2.0+ style. |

## Installation

### Infrastructure (Docker Compose)

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:17
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: studyhub
      POSTGRES_USER: studyhub
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}

  neo4j:
    image: neo4j:2025.01-community
    ports: ["7474:7474", "7687:7687"]
    environment:
      NEO4J_AUTH: neo4j/${NEO4J_PASSWORD}

  valkey:
    image: valkey/valkey:8
    ports: ["6379:6379"]

  meilisearch:
    image: getmeili/meilisearch:v1.37
    ports: ["7700:7700"]
    environment:
      MEILI_MASTER_KEY: ${MEILI_MASTER_KEY}

  seaweedfs:
    image: chrislusf/seaweedfs:latest
    ports: ["8333:8333"]
    command: "server -s3"

  temporal:
    image: temporalio/auto-setup:latest
    ports: ["7233:7233"]
    depends_on: [postgres]

  temporal-ui:
    image: temporalio/ui:latest
    ports: ["8080:8080"]

  grobid:
    image: lfoppiano/grobid:0.8.1
    ports: ["8070:8070"]
```

### Python Backend

```bash
# Using uv (recommended)
uv init backend
cd backend

# Core
uv add fastapi[standard] uvicorn pydantic sqlalchemy[asyncio] asyncpg alembic

# Temporal
uv add temporalio

# Academic data
uv add pyalex semanticscholar biopython scholarly

# AI/ML
uv add litellm sentence-transformers torch

# PDF parsing
uv add mineru

# Graph database
uv add neo4j

# Search
uv add meilisearch

# Object storage (S3 client)
uv add boto3

# Cache
uv add redis  # Valkey is Redis-protocol compatible

# Dev
uv add --dev ruff pytest pytest-asyncio httpx
```

### Frontend (Next.js Web App)

```bash
pnpm create next-app@latest apps/web --typescript --tailwind --app --src-dir

cd apps/web
pnpm add @xyflow/react d3 deck.gl vis-timeline
pnpm add @tanstack/react-query zustand
pnpm add -D @types/d3 biome
```

### Desktop (Tauri)

```bash
pnpm create tauri-app apps/desktop --template react-ts
cd apps/desktop
pnpm add @tauri-apps/api @tauri-apps/plugin-shell @tauri-apps/plugin-fs
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Backend | FastAPI | Django | Django's ORM and sync-first design adds friction with async ML workloads. FastAPI's native async + Pydantic is better for this use case. |
| Backend | FastAPI | Flask | Flask lacks native async, OpenAPI generation, and type validation. FastAPI is strictly superior for API-first projects. |
| Frontend | Next.js | Nuxt (Vue) | React ecosystem has React Flow, Deck.gl, and richer visualization library support. Vue's visualization ecosystem is thinner. |
| Frontend | Next.js | Remix | Remix is good but smaller ecosystem. Next.js 16's App Router + RSC covers our SSR needs. |
| Desktop | Tauri | Electron | 15x larger binary, 60% more memory. For an experiment agent that runs alongside GPU training, resource efficiency matters. |
| Graph DB | Neo4j | ArangoDB | Neo4j has the richest Cypher query language and best tooling for graph visualization. ArangoDB is multi-model but jack-of-all-trades. |
| Graph DB | Neo4j | Apache AGE (PG extension) | AGE avoids a separate service but lacks Neo4j's graph-specific optimizations, APOC procedures, and GDS library. Citation network traversal is core enough to justify dedicated infra. |
| Search | Meilisearch | Elasticsearch | Elasticsearch is 10x more complex to operate, requires manual Chinese analyzer configuration (ik plugin), heavier resource usage. Meilisearch handles Chinese out of the box. |
| Search | Meilisearch | Typesense | Typesense lacks native CJK tokenization. Meilisearch's Charabia tokenizer handles Chinese/Japanese/Korean automatically. |
| Cache | Valkey | Redis | Redis adopted source-available licensing (RSALv2/SSPLv1) in March 2024. Valkey is the Linux Foundation community fork, API-compatible, BSD-licensed. No reason to choose Redis over Valkey for new projects. |
| Cache | Valkey | Dragonfly | Dragonfly has BSL license (converts to Apache 2.0 after time). 25x faster than Redis but adds commercial license complexity. Valkey is simpler for self-hosted. |
| Object Storage | SeaweedFS | MinIO | MinIO GitHub repo archived Feb 2026. Community edition frozen. SeaweedFS is Apache 2.0, actively maintained, adopted by Kubeflow. |
| Object Storage | SeaweedFS | Garage | Garage is AGPLv3 (viral license), and its S3 API coverage is explicitly incomplete. SeaweedFS has broader S3 compatibility and Apache 2.0 license. |
| Workflow | Temporal | Celery | Celery is a task queue, not a workflow engine. Deep Research needs multi-step orchestration with state, retries, and resume-on-crash -- Celery cannot do this. |
| Workflow | Temporal | Prefect | Prefect is data-pipeline focused. Temporal's durable execution model is purpose-built for long-running multi-step workflows like deep research and experiment automation. |
| Analytics | PostgreSQL (MVP) | ClickHouse | ClickHouse requires dedicated DevOps. At MVP scale (<1K users), PostgreSQL materialized views + pg_stat_statements handle analytics queries. Add ClickHouse when analytics become a bottleneck. |
| Python pkg mgr | uv | Poetry | uv is 10-100x faster, better lockfile format, active Astral development. Poetry is slower and has dependency resolution issues. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| MinIO (community) | GitHub repo archived Feb 2026. Frozen, no security patches. | SeaweedFS |
| Redis (new installs) | Source-available license since March 2024. Legal risk for commercial use. | Valkey 8.1+ |
| Elasticsearch | Massive operational overhead for this scale. Requires manual Chinese tokenizer config. | Meilisearch |
| Celery | Task queue, not workflow engine. Cannot handle multi-step research workflows with state persistence. | Temporal |
| LangChain (for core workflows) | Adds abstraction overhead without clear benefit when you have Temporal for orchestration. Over-engineered for direct API calls to paper sources. | Direct API calls via pyalex/semanticscholar + Temporal workflows |
| Electron | Resource-heavy desktop runtime. 150MB+ binaries, high memory usage. Unacceptable when co-existing with GPU training workloads. | Tauri 2.x |
| MongoDB | No clear use case when PostgreSQL handles JSON (jsonb) and Neo4j handles graphs. Adding a third data paradigm increases operational complexity without benefit. | PostgreSQL jsonb |
| pip/poetry | Slower, weaker lockfile support, less reliable dependency resolution. | uv |

## Stack Patterns by Variant

**If Chinese paper search is the primary use case:**
- Prioritize Meilisearch Chinese tokenization testing early
- Add jieba as supplementary Chinese NLP tokenizer for custom analysis
- Test CNKI/Wanfang scraping reliability with rate limiting before committing to those data sources

**If experiment automation is the primary use case:**
- Prioritize Tauri + Temporal integration
- Build the experiment runner loop first, web dashboard second
- Consider aim (experiment tracking library, 6K stars) for metrics visualization instead of building custom

**If the platform grows beyond single-server:**
- Neo4j Community Edition is single-node only. Migration to Neo4j Enterprise (clustering) or a re-architecture to Apache AGE would be needed.
- SeaweedFS supports distributed mode natively -- no migration needed.
- Temporal supports multi-region replication if workflows need HA.

## Version Compatibility Matrix

| Component | Compatible With | Notes |
|-----------|-----------------|-------|
| FastAPI 0.135.x | Python 3.12-3.13, Pydantic 2.x, Starlette 1.0+ | Use `fastapi[standard]` install |
| Next.js 16.1 | React 19.2, Node 20+ | Turbopack for dev, Webpack for production |
| Tauri 2.10.x | Rust 1.77+, Node 20+ | Frontend can share components with Next.js web app |
| React Flow 12.10.x | React 19, Tailwind 4 | Package renamed to `@xyflow/react` |
| Neo4j 2025.01+ | Python driver 6.1+, Java 21 | CalVer versioning since Jan 2025 |
| Temporal Server 1.25+ | Python SDK 1.x, Go SDK 1.x | Self-host via Docker or use Temporal Cloud |
| Valkey 8.1 | All Redis client libraries (redis-py, ioredis) | Drop-in replacement, same protocol |
| Meilisearch 1.37 | meilisearch-python 0.31+, meilisearch-js 0.38+ | Check SDK compatibility on each update |
| SeaweedFS 3.x | Any S3 client (boto3, AWS SDK) | S3-compatible API |
| PostgreSQL 17.9 | SQLAlchemy 2.0+, asyncpg 0.29+, Alembic 1.14+ | Do not use PG 18.x yet (too new for ecosystem) |

## Sources

- [FastAPI Releases](https://github.com/fastapi/fastapi/releases) -- Version 0.135.x confirmed (MEDIUM confidence on exact minor)
- [Next.js 16 Blog](https://nextjs.org/blog/next-16) -- Version 16.1 stable confirmed (HIGH confidence)
- [Tauri 2.0 Release](https://v2.tauri.app/blog/tauri-20/) -- Stable since Oct 2024, v2.10.3 current (HIGH confidence)
- [Neo4j CalVer Migration](https://neo4j.com/docs/upgrade-migration-guide/current/version-2025-2026/) -- 2025.01+ confirmed (HIGH confidence)
- [Temporal Replay 2025](https://temporal.io/blog/replay-2025-product-announcements) -- Nexus GA, Python SDK active (HIGH confidence)
- [Meilisearch Releases](https://github.com/meilisearch/meilisearch/releases) -- v1.37 confirmed (HIGH confidence)
- [MinIO Archived](https://www.infoq.com/news/2025/12/minio-s3-api-alternatives/) -- Repo archived Feb 2026 (HIGH confidence)
- [SeaweedFS GitHub](https://github.com/seaweedfs/seaweedfs) -- Active, Apache 2.0, S3 compatible (HIGH confidence)
- [Valkey vs Redis](https://www.dragonflydb.io/guides/valkey-vs-redis) -- Redis license change confirmed, Valkey is community fork (HIGH confidence)
- [React Flow](https://reactflow.dev/whats-new) -- v12.10.1 confirmed (HIGH confidence)
- [Deck.gl](https://deck.gl/docs/whats-new) -- v9.1 WebGPU support confirmed (MEDIUM confidence)
- [ClickHouse 26.2](https://clickhouse.com/docs/whats-new/changelog) -- Version confirmed but self-hosting complexity noted (MEDIUM confidence)
- [PostgreSQL 18.3 Released](https://www.postgresql.org/about/news/postgresql-183-179-1613-1517-and-1422-released-3246/) -- PG 17.9 recommended over 18.x (HIGH confidence)

---
*Stack research for: StudyHub Academic Research Platform*
*Researched: 2026-03-15*
