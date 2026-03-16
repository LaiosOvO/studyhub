# Roadmap: StudyHub Academic Research Platform

## Overview

StudyHub delivers an AI-powered academic research platform in 10 phases, progressing from infrastructure through the core data pipeline (search, citations, deep research), into visualization and plan generation, then experiment automation, and finally community collaboration. The critical path runs through the Deep Research Engine -- Paper Map, Plan Generation, and Community all consume its output. Each phase delivers a coherent, independently verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Infrastructure & Auth Foundation** - Docker Compose services, API gateway, auth, and web app shell
- [x] **Phase 2: Paper Search & Ingestion** - Multi-source paper search with PDF parsing and full-text indexing
- [x] **Phase 3: Chinese Academic Sources** - CNKI and Wanfang integration with anti-scraping resilience
- [x] **Phase 4: Citation Network & Quality Scoring** - Recursive citation graph construction and paper quality ranking
- [x] **Phase 5: Deep Research Engine** - End-to-end research pipeline with AI analysis and literature review generation
- [ ] **Phase 6: Paper Map Visualization** - Interactive citation graph, topic map, and timeline views
- [ ] **Phase 7: Plan Generation & SOTA Analysis** - AI-powered experiment plan generation from research gaps
- [ ] **Phase 8: Experiment Execution Engine** - Tauri desktop agent with autonomous experiment loop and GPU management
- [ ] **Phase 9: Experiment Dashboard & Reports** - Real-time experiment monitoring and auto-generated publishable reports
- [ ] **Phase 10: Community & Collaboration** - Researcher profiles, matching, needs marketplace, and messaging

## Phase Details

### Phase 1: Infrastructure & Auth Foundation
**Goal**: A running platform where users can register, log in, and see a web application shell backed by all required infrastructure services
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, AUTH-01, AUTH-02, AUTH-03, AUTH-04, WAPP-01, WAPP-02, WAPP-03
**Success Criteria** (what must be TRUE):
  1. Running `docker compose up` starts all services (PostgreSQL, Neo4j, Meilisearch, Valkey, SeaweedFS, Temporal) and they pass health checks
  2. User can register with email/password, log in, and remain logged in after browser refresh
  3. User can log out from any page and is redirected to the login screen
  4. Web application renders in both Chinese and English with responsive layout on desktop and tablet
  5. LLM Gateway responds to a test prompt and reports cost tracking data
**Plans**: TBD

Plans:
- [x] 01-01: Docker Compose infrastructure and service health
- [x] 01-02: FastAPI gateway with JWT auth and rate limiting
- [x] 01-03: Next.js web shell with i18n and auth flows
- [x] 01-04: LLM Gateway and Temporal workflow foundation

### Phase 2: Paper Search & Ingestion
**Goal**: Users can search for papers across international sources and get deduplicated, indexed results with full-text extraction from PDFs
**Depends on**: Phase 1
**Requirements**: SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05, SRCH-06, SRCH-07, SRCH-08, PARS-01, PARS-02, PARS-03, PARS-04
**Success Criteria** (what must be TRUE):
  1. User can search by keywords, title/DOI, or author name and see combined results from OpenAlex, Semantic Scholar, PubMed, and arXiv
  2. Duplicate papers from different sources appear as a single result with source indicators
  3. User can filter by year, citations, venue, language and sort by relevance, citations, recency, or quality
  4. Search works for both Chinese and English queries with sub-second response times from Meilisearch
  5. PDF papers are parsed into structured sections (title, abstract, methodology, experiments, results, references) and stored for downstream analysis
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md -- Multi-source paper search clients, dedup, and search API
- [x] 02-02-PLAN.md -- Meilisearch indexing with filtering, sorting, and index-on-search
- [x] 02-03-PLAN.md -- GROBID PDF parsing pipeline with structured section extraction

### Phase 3: Chinese Academic Sources
**Goal**: Users can discover Chinese papers from CNKI and Wanfang alongside international results, with the system handling anti-scraping gracefully
**Depends on**: Phase 2
**Requirements**: CNKI-01, CNKI-02, CNKI-03, CNKI-04, CNKI-05
**Success Criteria** (what must be TRUE):
  1. User's keyword search returns Chinese papers from CNKI with normalized metadata (title, authors, abstract, journal, citations)
  2. User's keyword search returns Chinese papers from Wanfang with normalized metadata
  3. When CNKI or Wanfang is unavailable or rate-limited, search still returns results from other sources with a clear status indicator
  4. Chinese paper results are deduplicated and merged with international results from Phase 2
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md -- BrowserPool, schema extensions, and CNKI scraper client
- [x] 03-02-PLAN.md -- Wanfang scraper and aggregator integration with graceful degradation

### Phase 03.1: Scholar Profile Harvesting (INSERTED)

**Goal**: Build a scholar profile database seeded from Baidu Baike and Google Scholar, storing researcher metadata (name, institution, rank, age, research fields, h-index) linked to papers
**Depends on**: Phase 2
**Requirements**: SCHOL-01, SCHOL-02, SCHOL-03, SCHOL-04
**Success Criteria** (what must be TRUE):
  1. Scholar model stores name, institution, title/rank, birth_year, research_fields, h_index, and source URLs
  2. Baidu Baike scraper extracts scholar profiles with normalized metadata
  3. Google Scholar enrichment adds h-index, citation count, and publication list
  4. Scholars are linked to papers via author name matching with fuzzy CJK support
  5. Seed data for ECG domain scholars is imported and verified
**Plans**: 2 plans

Plans:
- [x] 03.1-01-PLAN.md -- Scholar model, Baidu Baike scraper, seed import, and CRUD endpoints
- [x] 03.1-02-PLAN.md -- Google Scholar enrichment, scholar-paper linking, and Temporal refresh workflow

### Phase 4: Citation Network & Quality Scoring
**Goal**: Users can explore the citation landscape around any paper with quality-ranked results stored in a graph database
**Depends on**: Phase 2
**Requirements**: CITE-01, CITE-02, CITE-03, CITE-04, CITE-05, CITE-06, QUAL-01, QUAL-02, QUAL-03, QUAL-04
**Success Criteria** (what must be TRUE):
  1. User can expand a paper's citation network recursively (depth 1-3) and see both citing and referenced papers
  2. System discovers semantically related papers beyond direct citations
  3. Each paper displays a composite quality score with breakdown (citations, velocity, impact factor, H-index)
  4. Papers are ranked by quality score in search results and graph views, with top-N key papers highlighted
  5. Citation graph is stored in Neo4j and respects configurable paper count budgets to prevent explosion
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md -- Neo4j client, BFS citation expansion engine with budget control
- [x] 04-02-PLAN.md -- Semantic similarity discovery, manual expansion, and citation REST endpoints
- [x] 04-03-PLAN.md -- Composite quality scoring algorithm with ranking and top-N identification

### Phase 5: Deep Research Engine
**Goal**: Users can launch an end-to-end research task that automatically discovers papers, builds the citation graph, scores quality, and produces AI-powered analysis with a literature review
**Depends on**: Phase 4 (and Phase 3 for Chinese sources)
**Requirements**: DEEP-01, DEEP-02, DEEP-03, DEEP-04, DEEP-05, DEEP-06, DEEP-07, DEEP-08, ANAL-01, ANAL-02, ANAL-03, ANAL-04, ANAL-05, ANAL-06
**Success Criteria** (what must be TRUE):
  1. User can start a Deep Research task by providing a research direction, paper, or author and see real-time progress via WebSocket (phase, papers found, ETA)
  2. System runs the full pipeline (search, citation expansion, quality scoring, AI analysis) as a Temporal workflow that survives server restarts
  3. Each paper has bilingual TLDR summaries, extracted methodology, and classified relationships to other papers
  4. System identifies research gaps, underexplored areas, and trend detection (ascending/declining methods) across the paper corpus
  5. User receives a Markdown literature review report and can refine results by adjusting filters or expanding specific graph areas
**Plans**: 4 plans

Plans:
- [x] 05-01-PLAN.md -- Deep Research Temporal workflow orchestration with WebSocket progress
- [x] 05-02-PLAN.md -- AI analysis pipeline (TLDR, methodology extraction, relationship classification)
- [x] 05-03-PLAN.md -- Gap identification, trend detection, and literature review generation
- [x] 05-04-PLAN.md -- Result refinement, manual expansion, and report retrieval endpoints

### Phase 6: Paper Map Visualization
**Goal**: Users can visually explore the research landscape through interactive citation graphs, topic maps, and timelines
**Depends on**: Phase 5
**Requirements**: PMAP-01, PMAP-02, PMAP-03, PMAP-04, PMAP-05, PMAP-06, PMAP-07, PMAP-08, PMAP-09, PMAP-10
**Success Criteria** (what must be TRUE):
  1. User can view a citation graph with nodes sized by citation count and colored by research cluster, with zoom, pan, and drag interaction
  2. User can click any node to see paper details (abstract, quality score, methods, key findings)
  3. User can filter the graph by time range, method type, or quality threshold
  4. User can switch between citation graph, topic/discipline map (cluster regions), and chronological timeline views
  5. User can export graph data and save paper collections/reading lists from the map
**Plans**: 3 plans

Plans:
- [x] 06-01-PLAN.md -- Citation graph view with React Flow, D3 force layout, Zustand store, and shared data layer
- [x] 06-02-PLAN.md -- Topic map (Deck.gl) and timeline (vis-timeline) views with backend embedding endpoint
- [x] 06-03-PLAN.md -- Filtering, export (JSON/CSV/PNG), and reading list backend + frontend

### Phase 7: Plan Generation & SOTA Analysis
**Goal**: Users can generate actionable experiment plans from AI-identified research gaps, complete with hypotheses, baselines, datasets, and code skeletons
**Depends on**: Phase 5
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06, PLAN-07, PLAN-08
**Success Criteria** (what must be TRUE):
  1. System identifies current SOTA methods and metrics for a given research direction
  2. System generates experiment plans with hypothesis, method, baselines, metrics, datasets, technical roadmap, and code skeleton
  3. Each plan includes feasibility scoring (compute requirements, data availability, expected improvement, difficulty)
  4. User can choose data strategy (open-source first, own data, hybrid) and see recommended datasets with download links
  5. User can view and modify generated plans before execution, with plans generated from three entry points (direction, paper improvement, AI-discovered gap)
**Plans**: 3 plans

Plans:
- [x] 07-01-PLAN.md -- ExperimentPlan model, schemas, SOTA identifier, and improvement analyzer
- [x] 07-02-PLAN.md -- Plan generator with reflection, feasibility scoring, dataset recommendation, Temporal workflow, and REST API
- [x] 07-03-PLAN.md -- Code skeleton generation and Next.js plan list/editor UI

### Phase 8: Experiment Execution Engine
**Goal**: Users can run autonomous experiment loops on their local GPU via a desktop agent that modifies code, trains models, evaluates results, and iterates
**Depends on**: Phase 7
**Requirements**: EXPR-01, EXPR-02, EXPR-03, EXPR-04, EXPR-05, EXPR-06, EXPR-07, EXPR-08, EXPR-09, EXPR-10
**Success Criteria** (what must be TRUE):
  1. Tauri desktop agent installs, connects to the web platform, and manages experiment execution on local GPU
  2. System sets up isolated experiment environments (git branch, dependencies, data) and reproduces baselines first
  3. Autonomous loop runs: LLM analyzes, generates improvement, modifies code, trains, evaluates, keeps/discards -- with each iteration tracked via git commit
  4. User can set stopping conditions, manually guide iterations, and pause/resume/skip experiments
  5. Experiment code runs sandboxed in Docker containers with real-time GPU utilization, memory, and temperature display
**Plans**: 4 plans

Plans:
- [ ] 08-01-PLAN.md -- ExperimentRun model, experiment REST API, Tauri v2 desktop scaffold with state machine
- [ ] 08-02-PLAN.md -- GitManager, DockerRunner, environment setup, baseline reproduction, metrics tracking
- [ ] 08-03-PLAN.md -- GPU monitoring (pynvml), Tauri-to-web WebSocket sync, GPU display components
- [ ] 08-04-PLAN.md -- Autonomous experiment loop (LLM-driven modify/train/evaluate), iteration control UI

### Phase 9: Experiment Dashboard & Reports
**Goal**: Users can monitor experiment progress in real-time on the web and receive auto-generated publishable reports upon completion
**Depends on**: Phase 8
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, REPT-01, REPT-02, REPT-03, REPT-04
**Success Criteria** (what must be TRUE):
  1. User can view experiment progress (current round, best metrics, improvement over baseline) with training curves and metric evolution
  2. User can compare results across iterations in a table and manage the experiment queue (add, reorder, cancel)
  3. Desktop experiment status syncs to web dashboard in real-time
  4. System auto-generates a structured report (abstract, methodology, results, training curves, ablation analysis, conclusion) in Markdown and PDF
  5. Figures and charts in the report are auto-generated from experiment data
**Plans**: TBD

Plans:
- [ ] 09-01: Real-time experiment dashboard with training curves
- [ ] 09-02: Iteration comparison, queue management, and desktop sync
- [ ] 09-03: Auto-generated experiment reports (Markdown + PDF)

### Phase 10: Community & Collaboration
**Goal**: Researchers can discover and connect with complementary collaborators through enriched profiles, intelligent matching, a needs marketplace, and direct messaging
**Depends on**: Phase 1 (auth), Phase 5 (research data for profile enrichment)
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06, MTCH-01, MTCH-02, MTCH-03, MTCH-04, NEED-01, NEED-02, NEED-03, NEED-04, MESG-01, MESG-02, MESG-03
**Success Criteria** (what must be TRUE):
  1. User can register a researcher profile that is auto-enriched with publications, citations, H-index, and co-author network from academic databases
  2. System recommends potential collaborators based on skill complementarity with LLM-generated explanations of why each match makes sense
  3. User can publish structured research needs and browse others' needs filtered by tags, direction, and match relevance
  4. User can send direct messages to other researchers, view conversation history, and see notification indicators for new messages
  5. Other users can view researcher profiles with publications, expertise tags, and current research needs
**Plans**: TBD

Plans:
- [ ] 10-01: Researcher profiles with academic database auto-enrichment
- [ ] 10-02: Researcher matching algorithm and match explanation UI
- [ ] 10-03: Research needs marketplace
- [ ] 10-04: Direct messaging and notifications

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10

Note: Phase 3 and Phase 4 can execute in parallel (both depend on Phase 2). Phase 6 and Phase 7 can execute in parallel (both depend on Phase 5). Phase 10 can begin after Phase 5 if desired.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure & Auth Foundation | 4/4 | Complete | 2026-03-15 |
| 2. Paper Search & Ingestion | 3/3 | Complete | 2026-03-15 |
| 3. Chinese Academic Sources | 2/2 | Complete | 2026-03-15 |
| 03.1. Scholar Profile Harvesting | 2/2 | Complete    | 2026-03-15 |
| 4. Citation Network & Quality Scoring | 3/3 | Complete | 2026-03-15 |
| 5. Deep Research Engine | 4/4 | Complete | 2026-03-16 |
| 6. Paper Map Visualization | 3/3 | Complete | 2026-03-16 |
| 7. Plan Generation & SOTA Analysis | 3/3 | Complete | 2026-03-16 |
| 8. Experiment Execution Engine | 0/4 | Not started | - |
| 9. Experiment Dashboard & Reports | 0/3 | Not started | - |
| 10. Community & Collaboration | 0/4 | Not started | - |
