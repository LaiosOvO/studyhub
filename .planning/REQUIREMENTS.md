# Requirements: StudyHub 学术研究社区平台

**Defined:** 2026-03-15
**Core Value:** Input a research direction → get a complete paper landscape with AI-identified gaps → generate and auto-execute experiment plans that improve on existing work.

## v1 Requirements

### Infrastructure (INFRA)

- [x] **INFRA-01**: System runs via Docker Compose with all services (PostgreSQL, Neo4j, Meilisearch, Valkey, SeaweedFS, Temporal)
- [x] **INFRA-02**: FastAPI gateway handles JWT authentication, rate limiting, and request routing
- [x] **INFRA-03**: Temporal server orchestrates long-running workflows with retry and timeout management
- [x] **INFRA-04**: Valkey Streams provides event-driven inter-service communication
- [x] **INFRA-05**: SeaweedFS stores PDFs, model checkpoints, and experiment logs (S3-compatible)
- [x] **INFRA-06**: LLM Gateway provides unified interface to Claude/GPT with cost tracking and model fallback

### Paper Search (SRCH)

- [ ] **SRCH-01**: User can search papers by keywords, returning results from OpenAlex, Semantic Scholar, PubMed, and arXiv
- [ ] **SRCH-02**: User can search by paper title or DOI to find a specific paper
- [ ] **SRCH-03**: User can search by author name to find their publications
- [ ] **SRCH-04**: System deduplicates papers across sources (DOI matching + fuzzy title/author matching)
- [ ] **SRCH-05**: User can filter results by year range, citation count, venue, and language
- [ ] **SRCH-06**: User can sort results by relevance, citation count, recency, or quality score
- [ ] **SRCH-07**: Search supports both Chinese and English queries with proper tokenization
- [ ] **SRCH-08**: Paper metadata indexed in Meilisearch for millisecond-level full-text search

### Chinese Sources (CNKI)

- [x] **CNKI-01**: System searches CNKI for Chinese papers matching user query
- [x] **CNKI-02**: System searches Wanfang for Chinese papers matching user query
- [x] **CNKI-03**: Chinese paper metadata (title, authors, abstract, journal, citations) extracted and normalized
- [x] **CNKI-04**: System handles anti-scraping with rate limiting and session management
- [x] **CNKI-05**: System degrades gracefully when CNKI/Wanfang sources are unavailable

### Scholar Profiles (SCHOL)

- [ ] **SCHOL-01**: Baidu Baike scraper extracts scholar profiles (name, institution, rank, birth_year, research_fields, honors)
- [ ] **SCHOL-02**: Google Scholar enrichment adds h-index, total citations, and recent publication list
- [ ] **SCHOL-03**: Scholar-Paper linking via author name matching with fuzzy CJK support and deduplication
- [ ] **SCHOL-04**: Scholar data model with seed import pipeline, incremental update API, and scheduled refresh task

### Citation Network (CITE)

- [x] **CITE-01**: System recursively expands citation network from seed papers (configurable depth 1-3)
- [x] **CITE-02**: System retrieves both citing papers (who cited this) and referenced papers (what this cites)
- [x] **CITE-03**: System discovers semantically related papers beyond direct citation links
- [x] **CITE-04**: Citation graph stored in Neo4j with paper nodes and citation/relation edges
- [x] **CITE-05**: System applies citation budget to prevent graph explosion (cap at configurable max papers)
- [x] **CITE-06**: User can manually expand a specific node's citations from the graph view

### Paper Quality (QUAL)

- [x] **QUAL-01**: System computes composite quality score per paper (citations + annual citation velocity + impact factor + author H-index)
- [x] **QUAL-02**: User can see quality score breakdown for each paper
- [x] **QUAL-03**: Papers ranked by quality score within search results and graph views
- [x] **QUAL-04**: System identifies top-N key papers in a research direction

### Deep Research (DEEP)

- [ ] **DEEP-01**: User can start a Deep Research task by providing a research direction, paper, or author
- [ ] **DEEP-02**: System runs multi-stage pipeline: search → citation expansion → quality scoring → AI analysis
- [ ] **DEEP-03**: System provides real-time progress updates via WebSocket (phase, papers found, ETA)
- [ ] **DEEP-04**: User can configure search parameters (depth, sources, time range, languages)
- [ ] **DEEP-05**: System stores complete results in PostgreSQL (metadata) + Neo4j (graph) + Meilisearch (index) + SeaweedFS (PDFs)
- [ ] **DEEP-06**: User can refine results by adjusting filters or excluding categories
- [ ] **DEEP-07**: User can expand specific areas of the graph manually after initial research
- [ ] **DEEP-08**: System generates a Markdown literature review report from Deep Research results

### Paper Parsing (PARS)

- [ ] **PARS-01**: System extracts full text from PDF papers using MinerU or GROBID
- [ ] **PARS-02**: Parser handles Chinese academic PDFs with proper character recognition
- [ ] **PARS-03**: Extracted content includes structured sections: title, abstract, methodology, experiments, results, references
- [ ] **PARS-04**: Parsed papers stored in structured format for LLM analysis

### AI Analysis (ANAL)

- [ ] **ANAL-01**: System generates bilingual TLDR summaries (Chinese + English) per paper
- [ ] **ANAL-02**: System extracts methodology and techniques used in each paper
- [ ] **ANAL-03**: System identifies research gaps and underexplored areas within a direction
- [ ] **ANAL-04**: System detects trends (ascending/declining methods, emerging topics)
- [ ] **ANAL-05**: System classifies paper relationships (improvement, comparison, survey, application, theoretical basis)
- [ ] **ANAL-06**: AI analysis uses tiered approach (abstract-first screening, full-text for top papers) to control LLM costs

### Paper Map Visualization (PMAP)

- [ ] **PMAP-01**: User can view citation graph with interactive node/edge rendering (React Flow + D3 force layout)
- [ ] **PMAP-02**: Node size represents citation count, color represents research cluster/method family
- [ ] **PMAP-03**: User can click a node to see paper details (abstract, quality score, methods, key findings)
- [ ] **PMAP-04**: User can zoom, pan, and drag nodes in the graph view
- [ ] **PMAP-05**: User can filter graph by time range, method type, or quality threshold
- [ ] **PMAP-06**: User can view topic/discipline map showing research clusters as regions (Deck.gl)
- [ ] **PMAP-07**: User can view timeline showing key papers and milestones chronologically (vis-timeline)
- [ ] **PMAP-08**: User can switch between citation graph, topic map, and timeline views
- [ ] **PMAP-09**: User can export graph data for use in other tools
- [ ] **PMAP-10**: User can save paper collections/reading lists from the map

### Plan Generation (PLAN)

- [ ] **PLAN-01**: System identifies current SOTA methods and metrics for a research direction
- [ ] **PLAN-02**: System analyzes improvement opportunities (method gaps, data gaps, architectural improvements)
- [ ] **PLAN-03**: System generates experiment plans with: hypothesis, method, baselines, metrics, datasets, technical roadmap, code skeleton
- [ ] **PLAN-04**: Each plan includes feasibility scoring (compute requirements, data availability, expected improvement, difficulty)
- [ ] **PLAN-05**: User can choose data strategy: open-source datasets first, own data, or hybrid
- [ ] **PLAN-06**: System recommends relevant open-source datasets with download links
- [ ] **PLAN-07**: User can view and modify generated plans before execution
- [ ] **PLAN-08**: Plans can be generated from three entry points: research direction, specific paper improvement, or AI-discovered gap

### Experiment Execution (EXPR)

- [x] **EXPR-01**: Desktop agent (Tauri) manages experiment execution on user's local GPU
- [x] **EXPR-02**: System sets up isolated experiment environment (git branch, dependencies, data download)
- [x] **EXPR-03**: System reproduces baseline first, confirming metrics match reported values
- [x] **EXPR-04**: Autonomous experiment loop: LLM analyzes → generates improvement → modifies code → trains → evaluates → keeps/discards
- [x] **EXPR-05**: Each iteration tracked with git commit, metrics recorded in results.tsv
- [x] **EXPR-06**: User can set stopping conditions (max rounds, consecutive rounds without improvement, time budget)
- [x] **EXPR-07**: User can manually guide the experiment loop (suggest specific changes to try)
- [x] **EXPR-08**: Experiment code execution is sandboxed in Docker containers with restricted filesystem/network
- [x] **EXPR-09**: GPU utilization, memory, and temperature displayed in real-time
- [x] **EXPR-10**: User can pause, resume, and skip experiment iterations

### Experiment Dashboard (DASH)

- [x] **DASH-01**: User can view experiment progress (current round, best metrics, improvement over baseline)
- [x] **DASH-02**: System displays training curves and metric evolution across iterations
- [ ] **DASH-03**: User can compare results across experiment iterations in a table
- [ ] **DASH-04**: Experiment queue management (add, reorder, cancel queued experiments)
- [x] **DASH-05**: Desktop experiment status syncs to web dashboard in real-time

### Experiment Reports (REPT)

- [ ] **REPT-01**: System auto-generates structured experiment report after completion
- [ ] **REPT-02**: Report includes: abstract, methodology, results table, training curves, ablation analysis, conclusion
- [ ] **REPT-03**: Report available in Markdown and PDF format
- [ ] **REPT-04**: Figures and charts auto-generated from experiment data

### Researcher Profiles (PROF)

- [ ] **PROF-01**: User can register with name, institution, title, email, and research directions
- [ ] **PROF-02**: System auto-enriches profile by matching name+institution against OpenAlex/CNKI/Wanfang
- [ ] **PROF-03**: Auto-enrichment pulls: publication list, citation counts, H-index, co-author network, research keywords
- [ ] **PROF-04**: User can edit and curate auto-generated profile information
- [ ] **PROF-05**: User can specify current research needs (what help they're looking for)
- [ ] **PROF-06**: Other users can view researcher profiles with publications and expertise tags

### Researcher Matching (MTCH)

- [ ] **MTCH-01**: System recommends potential collaborators based on skill complementarity (not similarity)
- [ ] **MTCH-02**: Matching algorithm combines: research vector similarity, skill complementarity, co-citation analysis, institutional proximity
- [ ] **MTCH-03**: Each match includes LLM-generated explanation of why the match makes sense
- [ ] **MTCH-04**: User can view match score and complementarity breakdown

### Research Needs Marketplace (NEED)

- [ ] **NEED-01**: User can publish structured research needs (what they need, required skills, research direction)
- [ ] **NEED-02**: User can browse needs filtered by tags, research direction, and match relevance
- [ ] **NEED-03**: System shows match score between user profile and each listed need
- [ ] **NEED-04**: User can contact need publisher via in-app message

### Messaging (MESG)

- [ ] **MESG-01**: User can send direct messages to other researchers
- [ ] **MESG-02**: User can view conversation history
- [ ] **MESG-03**: User receives notification indicator for new messages

### Authentication (AUTH)

- [x] **AUTH-01**: User can register with email and password
- [x] **AUTH-02**: User can log in and maintain session across browser refreshes
- [x] **AUTH-03**: User can log out from any page
- [x] **AUTH-04**: JWT-based authentication with refresh token rotation

### Web Application (WAPP)

- [x] **WAPP-01**: Next.js web application with SSR for SEO-friendly paper pages
- [x] **WAPP-02**: Responsive layout supporting desktop and tablet screen sizes
- [x] **WAPP-03**: Chinese and English UI language support

## v2 Requirements

### Advanced Paper Features

- **SRCH-V2-01**: Cross-lingual paper linking (match Chinese/English versions of same work)
- **SRCH-V2-02**: Paper change monitoring (alert when new papers appear in watched directions)
- **SRCH-V2-03**: Collaborative reading lists shared between researchers

### Advanced Experiment Features

- **EXPR-V2-01**: SOTA benchmark tracking per research direction
- **EXPR-V2-02**: Dataset strategy wizard (interactive flow for finding/selecting datasets)
- **EXPR-V2-03**: Multi-GPU distributed experiment support
- **EXPR-V2-04**: Cloud GPU provisioning for users without local hardware

### Advanced Community Features

- **MTCH-V2-01**: Co-citation network-based researcher discovery
- **NEED-V2-01**: Project collaboration management board
- **PROF-V2-01**: Research output tracking and impact metrics over time

### Analytics & Business

- **BIZZ-V2-01**: ClickHouse analytics for platform metrics (hot directions, experiment success rates)
- **BIZZ-V2-02**: Freemium tier enforcement (usage limits per plan)
- **BIZZ-V2-03**: API access for Pro/Enterprise users

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time chat / video | Chinese academics use WeChat; building another chat is wasted effort |
| Collaborative paper writing | Overleaf and Google Docs are deeply entrenched and specialized |
| Social feeds / likes / follows | ResearchGate's social features widely criticized as noise |
| Full-text paper hosting | Copyright liability; link to original sources instead |
| Grant/funding matching | Too complex for v1, requires NSFC integration |
| Mobile native app | Responsive web sufficient; Tauri desktop for experiments |
| Plagiarism detection | CNKI dominates this in China |
| Peer review system | Extremely complex; journals handle this |
| General ML platform | Can't beat W&B/MLflow on general tracking; stay focused on paper-to-experiment |

## Traceability

Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 1 | Complete |
| INFRA-06 | Phase 1 | Complete |
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| WAPP-01 | Phase 1 | Complete |
| WAPP-02 | Phase 1 | Complete |
| WAPP-03 | Phase 1 | Complete |
| SRCH-01 | Phase 2 | Pending |
| SRCH-02 | Phase 2 | Pending |
| SRCH-03 | Phase 2 | Pending |
| SRCH-04 | Phase 2 | Pending |
| SRCH-05 | Phase 2 | Pending |
| SRCH-06 | Phase 2 | Pending |
| SRCH-07 | Phase 2 | Pending |
| SRCH-08 | Phase 2 | Pending |
| PARS-01 | Phase 2 | Pending |
| PARS-02 | Phase 2 | Pending |
| PARS-03 | Phase 2 | Pending |
| PARS-04 | Phase 2 | Pending |
| CNKI-01 | Phase 3 | Complete |
| CNKI-02 | Phase 3 | Complete |
| CNKI-03 | Phase 3 | Complete |
| CNKI-04 | Phase 3 | Complete |
| CNKI-05 | Phase 3 | Complete |
| CITE-01 | Phase 4 | Complete |
| CITE-02 | Phase 4 | Complete |
| CITE-03 | Phase 4 | Complete |
| CITE-04 | Phase 4 | Complete |
| CITE-05 | Phase 4 | Complete |
| CITE-06 | Phase 4 | Complete |
| QUAL-01 | Phase 4 | Complete |
| QUAL-02 | Phase 4 | Complete |
| QUAL-03 | Phase 4 | Complete |
| QUAL-04 | Phase 4 | Complete |
| DEEP-01 | Phase 5 | Pending |
| DEEP-02 | Phase 5 | Pending |
| DEEP-03 | Phase 5 | Pending |
| DEEP-04 | Phase 5 | Pending |
| DEEP-05 | Phase 5 | Pending |
| DEEP-06 | Phase 5 | Pending |
| DEEP-07 | Phase 5 | Pending |
| DEEP-08 | Phase 5 | Pending |
| ANAL-01 | Phase 5 | Pending |
| ANAL-02 | Phase 5 | Pending |
| ANAL-03 | Phase 5 | Pending |
| ANAL-04 | Phase 5 | Pending |
| ANAL-05 | Phase 5 | Pending |
| ANAL-06 | Phase 5 | Pending |
| PMAP-01 | Phase 6 | Pending |
| PMAP-02 | Phase 6 | Pending |
| PMAP-03 | Phase 6 | Pending |
| PMAP-04 | Phase 6 | Pending |
| PMAP-05 | Phase 6 | Pending |
| PMAP-06 | Phase 6 | Pending |
| PMAP-07 | Phase 6 | Pending |
| PMAP-08 | Phase 6 | Pending |
| PMAP-09 | Phase 6 | Pending |
| PMAP-10 | Phase 6 | Pending |
| PLAN-01 | Phase 7 | Pending |
| PLAN-02 | Phase 7 | Pending |
| PLAN-03 | Phase 7 | Pending |
| PLAN-04 | Phase 7 | Pending |
| PLAN-05 | Phase 7 | Pending |
| PLAN-06 | Phase 7 | Pending |
| PLAN-07 | Phase 7 | Pending |
| PLAN-08 | Phase 7 | Pending |
| EXPR-01 | Phase 8 | Pending |
| EXPR-02 | Phase 8 | Pending |
| EXPR-03 | Phase 8 | Pending |
| EXPR-04 | Phase 8 | Pending |
| EXPR-05 | Phase 8 | Pending |
| EXPR-06 | Phase 8 | Pending |
| EXPR-07 | Phase 8 | Pending |
| EXPR-08 | Phase 8 | Pending |
| EXPR-09 | Phase 8 | Pending |
| EXPR-10 | Phase 8 | Pending |
| DASH-01 | Phase 9 | Complete |
| DASH-02 | Phase 9 | Complete |
| DASH-03 | Phase 9 | Pending |
| DASH-04 | Phase 9 | Pending |
| DASH-05 | Phase 9 | Complete |
| REPT-01 | Phase 9 | Pending |
| REPT-02 | Phase 9 | Pending |
| REPT-03 | Phase 9 | Pending |
| REPT-04 | Phase 9 | Pending |
| PROF-01 | Phase 10 | Pending |
| PROF-02 | Phase 10 | Pending |
| PROF-03 | Phase 10 | Pending |
| PROF-04 | Phase 10 | Pending |
| PROF-05 | Phase 10 | Pending |
| PROF-06 | Phase 10 | Pending |
| MTCH-01 | Phase 10 | Pending |
| MTCH-02 | Phase 10 | Pending |
| MTCH-03 | Phase 10 | Pending |
| MTCH-04 | Phase 10 | Pending |
| NEED-01 | Phase 10 | Pending |
| NEED-02 | Phase 10 | Pending |
| NEED-03 | Phase 10 | Pending |
| NEED-04 | Phase 10 | Pending |
| MESG-01 | Phase 10 | Pending |
| MESG-02 | Phase 10 | Pending |
| MESG-03 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 108 total
- Mapped to phases: 108
- Unmapped: 0

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after roadmap creation*
