# Requirements: StudyHub 学术研究社区平台

**Defined:** 2026-03-15
**Core Value:** Input a research direction → get a complete paper landscape with AI-identified gaps → generate and auto-execute experiment plans that improve on existing work.

## v1 Requirements

### Infrastructure (INFRA)

- [ ] **INFRA-01**: System runs via Docker Compose with all services (PostgreSQL, Neo4j, Meilisearch, Valkey, SeaweedFS, Temporal)
- [ ] **INFRA-02**: FastAPI gateway handles JWT authentication, rate limiting, and request routing
- [ ] **INFRA-03**: Temporal server orchestrates long-running workflows with retry and timeout management
- [ ] **INFRA-04**: Valkey Streams provides event-driven inter-service communication
- [ ] **INFRA-05**: SeaweedFS stores PDFs, model checkpoints, and experiment logs (S3-compatible)
- [ ] **INFRA-06**: LLM Gateway provides unified interface to Claude/GPT with cost tracking and model fallback

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

- [ ] **CNKI-01**: System searches CNKI for Chinese papers matching user query
- [ ] **CNKI-02**: System searches Wanfang for Chinese papers matching user query
- [ ] **CNKI-03**: Chinese paper metadata (title, authors, abstract, journal, citations) extracted and normalized
- [ ] **CNKI-04**: System handles anti-scraping with rate limiting and session management
- [ ] **CNKI-05**: System degrades gracefully when CNKI/Wanfang sources are unavailable

### Citation Network (CITE)

- [ ] **CITE-01**: System recursively expands citation network from seed papers (configurable depth 1-3)
- [ ] **CITE-02**: System retrieves both citing papers (who cited this) and referenced papers (what this cites)
- [ ] **CITE-03**: System discovers semantically related papers beyond direct citation links
- [ ] **CITE-04**: Citation graph stored in Neo4j with paper nodes and citation/relation edges
- [ ] **CITE-05**: System applies citation budget to prevent graph explosion (cap at configurable max papers)
- [ ] **CITE-06**: User can manually expand a specific node's citations from the graph view

### Paper Quality (QUAL)

- [ ] **QUAL-01**: System computes composite quality score per paper (citations + annual citation velocity + impact factor + author H-index)
- [ ] **QUAL-02**: User can see quality score breakdown for each paper
- [ ] **QUAL-03**: Papers ranked by quality score within search results and graph views
- [ ] **QUAL-04**: System identifies top-N key papers in a research direction

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

- [ ] **EXPR-01**: Desktop agent (Tauri) manages experiment execution on user's local GPU
- [ ] **EXPR-02**: System sets up isolated experiment environment (git branch, dependencies, data download)
- [ ] **EXPR-03**: System reproduces baseline first, confirming metrics match reported values
- [ ] **EXPR-04**: Autonomous experiment loop: LLM analyzes → generates improvement → modifies code → trains → evaluates → keeps/discards
- [ ] **EXPR-05**: Each iteration tracked with git commit, metrics recorded in results.tsv
- [ ] **EXPR-06**: User can set stopping conditions (max rounds, consecutive rounds without improvement, time budget)
- [ ] **EXPR-07**: User can manually guide the experiment loop (suggest specific changes to try)
- [ ] **EXPR-08**: Experiment code execution is sandboxed in Docker containers with restricted filesystem/network
- [ ] **EXPR-09**: GPU utilization, memory, and temperature displayed in real-time
- [ ] **EXPR-10**: User can pause, resume, and skip experiment iterations

### Experiment Dashboard (DASH)

- [ ] **DASH-01**: User can view experiment progress (current round, best metrics, improvement over baseline)
- [ ] **DASH-02**: System displays training curves and metric evolution across iterations
- [ ] **DASH-03**: User can compare results across experiment iterations in a table
- [ ] **DASH-04**: Experiment queue management (add, reorder, cancel queued experiments)
- [ ] **DASH-05**: Desktop experiment status syncs to web dashboard in real-time

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

- [ ] **AUTH-01**: User can register with email and password
- [ ] **AUTH-02**: User can log in and maintain session across browser refreshes
- [ ] **AUTH-03**: User can log out from any page
- [ ] **AUTH-04**: JWT-based authentication with refresh token rotation

### Web Application (WAPP)

- [ ] **WAPP-01**: Next.js web application with SSR for SEO-friendly paper pages
- [ ] **WAPP-02**: Responsive layout supporting desktop and tablet screen sizes
- [ ] **WAPP-03**: Chinese and English UI language support

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
| (populated by roadmapper) | | |

**Coverage:**
- v1 requirements: 82 total
- Mapped to phases: 0
- Unmapped: 82 ⚠️

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after initial definition*
