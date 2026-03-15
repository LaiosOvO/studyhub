# Pitfalls Research

**Domain:** AI-powered academic research platform (paper discovery, experiment automation, researcher collaboration)
**Researched:** 2026-03-15
**Confidence:** MEDIUM-HIGH (domain knowledge + verified web research)

## Critical Pitfalls

### Pitfall 1: Citation Graph Explosion During Recursive Expansion

**What goes wrong:**
Recursive citation expansion at depth 2+ causes combinatorial explosion. A single seed paper with 50 references, each with 50 references, yields 2,500 papers at depth 2. With 100 seed papers from multi-source search, depth-2 expansion can attempt to fetch 250,000+ papers per query. The system either runs out of memory, exhausts API rate limits, or stores an unmanageably large graph that Neo4j struggles to query.

**Why it happens:**
Citation networks follow power-law distributions. High-impact papers (which quality scoring pushes to the top) have thousands of citations. A naive BFS expansion treats every edge equally, and developers underestimate how fast the frontier grows because they test with obscure topics that have sparse citation networks.

**How to avoid:**
- Implement a citation budget per query (e.g., max 5,000 papers total, not per depth level)
- Use priority-based expansion: expand high-quality papers first, stop when budget exhausted
- Filter before expanding: only follow citations to papers matching relevance criteria (title/abstract similarity > threshold)
- Cache previously expanded papers in Neo4j so repeated queries reuse existing graph data
- Stream results to the frontend progressively rather than waiting for full expansion

**Warning signs:**
- Deep Research tasks taking >30 minutes for common topics
- Neo4j heap usage climbing steadily during expansion
- API rate limit errors from Semantic Scholar or OpenAlex during a single query
- Users reporting "still loading" on popular research directions

**Phase to address:**
Phase 1 (Deep Research Engine) -- this is the foundational design decision. Getting expansion strategy wrong here means rewriting the core algorithm later.

---

### Pitfall 2: Cross-Source Paper Deduplication Failure

**What goes wrong:**
The same paper appears 3-5 times in results because it exists in OpenAlex, Semantic Scholar, PubMed, and arXiv with slightly different metadata. DOI matching catches only 60-70% of duplicates because: (1) not all sources provide DOIs, (2) Chinese papers on CNKI/Wanfang rarely have DOIs, (3) preprints on arXiv have different DOIs than their published versions, (4) some publishers assign one DOI to a conference abstract collection. The citation graph becomes polluted with duplicate nodes, breaking citation counts and graph analysis.

**Why it happens:**
Developers assume DOI is a universal unique identifier. It is not. Chinese academic papers frequently lack DOIs entirely. ArXiv preprints get new DOIs when published in journals. Conference papers may share DOIs with proceedings volumes. Fuzzy title matching has its own problems: transliterated author names, varying title translations between Chinese and English, and special characters in medical/scientific terms.

**How to avoid:**
- Multi-stage deduplication pipeline: (1) exact DOI match, (2) normalized title + first author + year match, (3) fuzzy title similarity (Jaccard or Levenshtein) with author overlap, (4) abstract fingerprinting for borderline cases
- Maintain a canonical paper ID in PostgreSQL that maps to source-specific IDs (OpenAlex ID, S2 ID, PMID, CNKI ID)
- For Chinese papers: normalize CJK characters, handle simplified/traditional Chinese variants
- Link arXiv preprints to their published versions using OpenAlex's "related works" or S2's "externalIds" field
- Run deduplication as a batch job after initial collection, not inline during fetching (performance)
- Use the ASySD approach: rule-based deduplication with multiple matching criteria weighted by confidence

**Warning signs:**
- Same paper appearing multiple times in search results with slightly different titles
- Citation counts that seem inflated compared to Google Scholar
- Graph visualization showing disconnected clusters that should be connected (because duplicates split the citation chain)

**Phase to address:**
Phase 1 (Deep Research Engine) -- must be solved before citation network construction. Dedup quality directly affects every downstream feature (quality scoring, gap analysis, SOTA identification).

---

### Pitfall 3: LLM Costs Spiral Out of Control During Paper Analysis

**What goes wrong:**
Deep Research Phase 4 (LLM-powered analysis) sends full paper text to Claude/GPT for methodology extraction, gap identification, and trend detection. At ~15-30 pages per paper and 127 "core" papers per query (from the design doc example), a single Deep Research run consumes 500K-2M tokens. At $3-15/M input tokens, each query costs $1.50-$30. With 100 daily queries in production, monthly LLM costs reach $4,500-$90,000. The freemium model becomes unsustainable.

**Why it happens:**
Developers prototype with 5-10 papers and extrapolate linearly. They don't account for: (1) full-text PDFs being 10-50x longer than abstracts, (2) users re-running queries with slight modifications, (3) the LLM being called multiple times per paper (extraction, classification, comparison), (4) prompt engineering iterations that increase prompt length over time.

**How to avoid:**
- Tiered analysis: use abstracts for initial screening (cheap), full-text only for top-20 papers (expensive)
- Cache LLM analysis results per paper -- a paper analyzed once should never be re-analyzed unless the prompt version changes
- Use structured extraction prompts that target specific fields (methods, datasets, metrics) rather than open-ended "analyze this paper"
- Implement a cost tracking dashboard from day one: track tokens consumed per query, per user, per day
- Use smaller/local models (Qwen, Llama) for classification tasks, reserve Claude/GPT for synthesis and insight generation
- Batch papers by topic cluster and analyze clusters together rather than individually
- Set hard per-query and per-user token budgets with graceful degradation

**Warning signs:**
- Monthly LLM API bills exceeding infrastructure costs
- Average query cost rising as users discover deeper analysis features
- Users complaining about slow responses (because you're processing too many papers through LLM)
- Prompt templates growing beyond 2,000 tokens of system instructions

**Phase to address:**
Phase 1 (Deep Research Engine) for architecture, Phase 3 (Plan Generation) for the second major LLM cost center. Design the LLM gateway with cost controls from the start.

---

### Pitfall 4: CNKI/Wanfang Scraping Breaks Unpredictably

**What goes wrong:**
CNKI (95% of Chinese academic resources) and Wanfang actively fight scrapers. They change page structures, add CAPTCHAs, implement browser fingerprinting, rotate session requirements, and throttle or ban IPs. Your scraper works for 2 weeks, then breaks silently -- returning empty results or partial data without errors. Users think there are no Chinese papers on their topic when really the scraper is failing.

**Why it happens:**
CNKI is a commercial platform that sells access. Scraping undermines their business model. They invest continuously in anti-scraping measures. Unlike OpenAlex (which wants you to use their API), CNKI wants you to buy a subscription. Developers build scrapers against the current page structure and don't plan for change. Additionally, CNKI has been restricting access to international institutions since 2022.

**How to avoid:**
- Treat CNKI/Wanfang as degraded data sources: the system must function fully without them
- Implement health checks that test scraper viability daily with known queries
- Use institutional API access if available (some universities have CNKI API agreements)
- Consider CNKI's overseas API (oversea.cnki.net) which may offer more stable programmatic access
- Supplement with: OpenAlex (which indexes some Chinese journals), CrossRef (for DOI-registered Chinese papers), DOAJ (open access Chinese journals)
- Build a scraper abstraction layer so scrapers can be swapped/updated without changing business logic
- Store raw HTML/responses for debugging when results change unexpectedly
- Implement exponential backoff, proxy rotation, and session management as first-class concerns
- Alert on significant drops in Chinese paper counts for known topics

**Warning signs:**
- Sudden drop in Chinese paper results (>50% decline week-over-week)
- Increase in HTTP 403/429 responses from CNKI
- Scraper returning fewer results than manual CNKI search for the same query
- CAPTCHA challenges appearing in stored response bodies

**Phase to address:**
Phase 1 (Deep Research Engine) -- but design for graceful degradation from the start. CNKI integration should be a plugin, not a hard dependency.

---

### Pitfall 5: Unsandboxed Experiment Execution Enables Code Injection

**What goes wrong:**
The experiment engine generates Python code via LLM and executes it on the user's machine with full filesystem and network access. A malicious or hallucinated LLM output could: delete files, exfiltrate data, install malware, mine cryptocurrency using the GPU, or modify other experiments' results. Even non-malicious bugs in generated code can corrupt the training environment, overwrite datasets, or fill disk with logs.

**Why it happens:**
The autoresearch loop modifies `train.py` and runs it directly. Developers focus on making experiments work and defer security. The Tauri desktop agent runs with the user's full permissions. LLM-generated code is treated as trusted because "the LLM knows what it's doing." NVIDIA's 2025 research confirms that AI-generated code must be treated as untrusted output, and sanitization alone is insufficient.

**How to avoid:**
- Run every experiment iteration in a Docker container with: (1) read-only filesystem except for designated output directory, (2) no network access except to download approved datasets, (3) GPU access via NVIDIA Container Toolkit, (4) CPU/memory/time limits
- Implement a code review step before execution: static analysis for dangerous patterns (os.system, subprocess, file deletion, network calls outside allowlist)
- Use a git-based approach: each experiment iteration is a commit, but commits happen inside the container, not on the host
- Separate the experiment workspace from user data -- experiments should never have access to the home directory
- Implement a watchdog process that monitors container resource usage and kills runaway experiments
- Log all file operations for audit

**Warning signs:**
- Experiment code containing `import os`, `subprocess.run`, `shutil.rmtree`, or network calls
- GPU utilization at 100% when no experiment is supposedly running
- Unexpected network traffic from the desktop agent
- Experiments producing files outside their designated output directory

**Phase to address:**
Phase 4 (Experiment Execution Engine) -- this is the phase where code execution is introduced. Security architecture must be designed before the first experiment runs.

---

### Pitfall 6: Temporal Workflow Non-Determinism Causes Silent Failures

**What goes wrong:**
Temporal replays workflow history to recover state after crashes. If workflow code is non-deterministic (uses random numbers, current time, or external API calls directly in workflow logic), replay produces different results than the original execution. This causes "non-determinism detected" errors that halt all in-flight Deep Research and experiment workflows. Worse: if you deploy a code change that modifies workflow logic, all running workflows break on their next replay.

**Why it happens:**
Temporal's determinism requirement is counterintuitive. Developers write workflow code like normal Python, using `datetime.now()`, `random.choice()`, or conditional logic based on external state. These all break replay. The Temporal learning curve is steep -- expect a month before the team is productive. Workflow versioning during deployment is another trap: rolling deploys cause some workers to run old code and others new code, creating inconsistent behavior.

**How to avoid:**
- All non-deterministic operations (API calls, time, random) go in Activities, never in Workflow code
- Workflows should only contain orchestration logic: sequence activities, handle results, branch on activity outputs
- Use Temporal's workflow.now() instead of datetime.now()
- Implement replay testing in CI: record workflow histories, replay them against new code versions before deploying
- Use Temporal's Worker Versioning to safely deploy workflow code changes
- Keep workflow logic as simple as possible -- push complexity into activities
- Write a "Temporal rules" linting rule that catches common violations (importing datetime, random, requests in workflow files)

**Warning signs:**
- "Non-determinism detected" errors in Temporal UI
- Workflows stuck in "running" state for much longer than expected
- Deployment causing a spike in workflow failures
- Different results when the same workflow is retried

**Phase to address:**
Phase 1 (Deep Research Engine) -- Temporal is introduced here. Establish patterns and linting rules before building Phase 3 and Phase 4 workflows on top.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing paper full-text in PostgreSQL instead of MinIO | Simpler queries, one fewer service | Database bloat (PDFs are 1-50MB each), backup times explode, can't serve files via CDN | Never -- even for MVP, use MinIO/S3 |
| Skipping paper deduplication in MVP | Ship faster, simpler pipeline | Every downstream feature (citation counts, graph, quality scores) is wrong. Must retrofit dedup and re-process all data | Never -- dedup is foundational |
| Using synchronous API calls for data source fetching | Simpler code, easier debugging | 6 data sources x 2-5 seconds each = 12-30 second API response times | Only for prototype/demo, not shipped code |
| Hardcoding LLM prompts in source code | Fast iteration on prompts | Can't A/B test, no version history, every prompt change requires deployment | MVP only, must extract to config before Phase 3 |
| Single Neo4j instance for all graph data | Simple deployment | Cannot scale reads for popular topics, single point of failure, no read replicas | Acceptable until ~100K papers in graph |
| Embedding experiment code directly in Tauri app (no container) | Faster to build, no Docker dependency | Security nightmare, environment conflicts between experiments, no reproducibility | Never -- containers from day one |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OpenAlex API | Not using `mailto` parameter for polite pool, getting throttled to 1 req/s | Always include `mailto=your@email.com` in requests for 10 req/s polite pool rate |
| OpenAlex API | Not batching requests -- making 50 individual calls when OR syntax can combine them | Use pipe-separated OR filter syntax to batch up to 50 IDs in one request |
| Semantic Scholar | Not requesting an API key, stuck at 1 req/s public rate | Apply for API key (free for research) to get 100 req/s |
| PubMed E-utilities | Not setting tool/email parameters, getting blocked | Always set `tool` and `email` parameters; apply for API key for unlimited access |
| CNKI | Building scraper against main site (cnki.net) which has aggressive anti-bot | Try oversea.cnki.net first; use institutional access APIs where available |
| Neo4j | Loading papers one at a time with individual Cypher CREATE statements | Use LOAD CSV or batch UNWIND for bulk imports (100-1000x faster) |
| Temporal | Putting HTTP calls in workflow code instead of activities | All I/O must be in Activities; Workflows are pure orchestration |
| MinerU/GROBID | Assuming PDF parsing always succeeds | 10-20% of academic PDFs fail to parse (scanned images, unusual layouts); always have fallback (raw text extraction) |
| Meilisearch | Not configuring Chinese tokenizer (jieba) before indexing | Enable Chinese language support and configure `jieba` tokenizer at index creation time |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading entire citation graph into frontend memory | Browser tab crashes, mobile devices freeze | Use server-side pagination/windowing; only send visible subgraph + 1 hop to frontend | >500 nodes in React Flow |
| Neo4j full-graph Cypher queries without LIMIT | Queries take minutes, lock database | Always use LIMIT, pagination via SKIP, and index-backed WHERE clauses | >100K papers in database |
| Synchronous PDF parsing in API request handler | API timeouts, worker thread starvation | Queue PDF parsing as Temporal activities, return task_id for polling | >5 concurrent users uploading PDFs |
| Storing experiment metrics in PostgreSQL as JSON blobs | Slow aggregation queries for dashboards | Use ClickHouse for time-series metrics from the start (as designed) | >1000 experiment iterations |
| Single LLM provider without fallback | Total outage when OpenAI/Anthropic has downtime | LLM Gateway with automatic provider fallback (Claude -> GPT -> local model) | First provider outage |
| WebSocket connections without heartbeat/reconnection | Users see stale "loading" state when connection silently drops | Client-side heartbeat ping every 30s, automatic reconnection with state recovery | Moderate network instability |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| LLM-generated experiment code runs with user's full permissions | Code injection, data exfiltration, ransomware | Docker containers with minimal permissions, no host network, read-only filesystem except output dir |
| Storing academic credentials (CNKI login, institutional proxy) in plaintext config | Credential theft, institutional access revoked | Use OS keychain (Tauri supports this) or encrypted env vars, never in config files |
| Paper PDFs served without access control | Copyright violations, legal liability | Serve PDFs through authenticated endpoints, respect publisher terms, prefer open-access versions |
| User research profiles publicly accessible without consent | Privacy violations, unwanted contact, GDPR issues | Opt-in visibility for profiles, separate public/private profile views, allow hiding institutional affiliation |
| Experiment results synced over unencrypted HTTP | Research data interception, academic espionage | TLS everywhere, including desktop-to-server sync; pin certificates in Tauri app |
| Prompt injection via paper titles/abstracts into LLM analysis | LLM produces manipulated analysis results, false gaps/trends | Sanitize paper metadata before including in LLM prompts; use structured input formats, not raw concatenation |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing raw citation graph without filtering options | Professors see 5,000 nodes and give up | Start with top-20 papers, let user expand interactively; provide pre-set filters (by year, by method, by impact) |
| Deep Research with no progress feedback | Users think it's broken after 30 seconds | WebSocket streaming: show papers found in real-time, show current phase, show ETA |
| Experiment results shown only as numbers in a table | Non-ML professors can't interpret AUC changes | Auto-generated plain-language summaries ("Your model improved by 7% and now outperforms 4 of 5 baseline methods") |
| English-only interface for Chinese university professors | Primary users struggle with navigation | Chinese should be the default locale; bilingual paper metadata display; Chinese keyword search with English fallback |
| Requiring account creation before showing any value | Users bounce before seeing what the platform does | Allow anonymous Deep Research with limited depth; show sample paper maps for popular topics |
| Auto-experiment runs for hours with no way to check in | Professor checks in the morning, experiment failed at hour 1 | Push notifications (WeChat integration) for: experiment started, hit new best, failed, completed |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Paper Search:** Often missing Chinese paper results -- verify CNKI/Wanfang scrapers are returning results and dedup is not removing them as false duplicates
- [ ] **Citation Graph:** Often missing self-citations and within-journal citations -- verify bidirectional citation links are captured (not just "references" but also "cited by")
- [ ] **Quality Scoring:** Often missing recency weighting -- a 2024 paper with 50 citations may be more impactful than a 2010 paper with 500 -- verify citation velocity is included
- [ ] **PDF Parsing:** Often fails silently on scanned PDFs (common in older Chinese journals) -- verify parser handles image-based PDFs with OCR fallback
- [ ] **Experiment Execution:** Often "works" but isn't reproducible -- verify random seeds are set, data loading order is deterministic, GPU non-determinism is controlled (torch.backends.cudnn.deterministic)
- [ ] **Desktop-Web Sync:** Often loses data during offline periods -- verify conflict resolution strategy exists when desktop runs experiments while server is unreachable
- [ ] **Researcher Matching:** Often produces plausible but wrong matches -- verify matching against known collaborations (co-authored papers) as ground truth
- [ ] **Bilingual Search:** Often returns different results for Chinese vs English queries about the same topic -- verify cross-lingual query expansion or translation is working

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Graph explosion (too many papers stored) | MEDIUM | Prune graph by quality score threshold; delete papers below cutoff; rebuild citation edges; reindex Meilisearch |
| Duplicate papers in database | HIGH | Run batch dedup across all papers; merge duplicate nodes in Neo4j (complex: must merge all edges); rebuild quality scores; notify users of changed paper counts |
| LLM cost overrun | LOW | Switch to abstract-only analysis immediately; cache results more aggressively; implement per-user quotas; no data loss |
| CNKI scraper broken | LOW | Degrade gracefully to non-Chinese sources; notify users that Chinese results are temporarily limited; fix scraper independently |
| Unsandboxed code caused damage | HIGH | Restore from backup; audit all experiment outputs for tampering; implement containerization before resuming; review and clean any exfiltrated data |
| Temporal non-determinism errors | MEDIUM | Terminate affected workflows; fix determinism violation; redeploy workers; restart workflows from the beginning (Temporal supports this) |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Citation graph explosion | Phase 1: Deep Research Engine | Load test with "deep learning" (broad topic); verify <5min completion, <10K papers stored |
| Cross-source deduplication failure | Phase 1: Deep Research Engine | Search "ECG diagnosis" across all sources; manually verify no duplicates in top-50 results |
| LLM cost spiral | Phase 1: Deep Research Engine | Run 10 full Deep Research queries; verify average cost <$2/query with abstract-first tiering |
| CNKI/Wanfang scraping fragility | Phase 1: Deep Research Engine | Automated daily health check; system functions correctly with CNKI disabled |
| Unsandboxed experiment execution | Phase 4: Experiment Engine | Attempt to write to host filesystem from experiment code; verify it fails. Attempt network access; verify it's blocked |
| Temporal non-determinism | Phase 1: Deep Research Engine | Replay tests in CI; deploy code changes while workflows are running; verify no failures |
| Frontend graph rendering crash | Phase 2: Paper Map Web | Render citation graph for "machine learning" (~10K papers); verify browser doesn't crash, uses progressive loading |
| Desktop-web sync data loss | Phase 4: Experiment Engine | Run experiment while offline; reconnect; verify all results sync without data loss |
| Bilingual search inconsistency | Phase 1: Deep Research Engine | Search "ECG diagnosis" in English and Chinese; verify result overlap >70% |
| Researcher matching accuracy | Phase 5: Community | Test matching against 10 known collaborator pairs from published co-authored papers |

## Sources

- [OpenAlex Rate Limits and Authentication](https://docs.openalex.org/how-to-use-the-api/rate-limits-and-authentication) - HIGH confidence
- [Neo4j Infinigraph scaling architecture](https://neo4j.com/news/neo4js-latest-targets-graph-database-performance-at-scale/) - HIGH confidence
- [Neo4j Performance Tuning Guide](https://graphable.ai/blog/neo4j-performance/) - MEDIUM confidence
- [NVIDIA Sandboxing Agentic Workflows](https://developer.nvidia.com/blog/practical-security-guidance-for-sandboxing-agentic-workflows-and-managing-execution-risk/) - HIGH confidence
- [NVIDIA Code Execution Risks in Agentic AI](https://developer.nvidia.com/blog/how-code-execution-drives-key-risks-in-agentic-ai-systems/) - HIGH confidence
- [Temporal Best Practices Guide](https://medium.com/@ajayshekar01/best-practices-for-building-temporal-workflows-a-practical-guide-with-examples-914fedd2819c) - MEDIUM confidence
- [Temporal Safe Deployments](https://docs.temporal.io/develop/safe-deployments) - HIGH confidence
- [ASySD Paper Deduplication Tool](https://pmc.ncbi.nlm.nih.gov/articles/PMC10483700/) - HIGH confidence
- [Evidence-based Deduplication Review](https://pmc.ncbi.nlm.nih.gov/articles/PMC10789108/) - HIGH confidence
- [CNKI International Access Restrictions](https://thechinaproject.com/2023/07/06/cut-off-from-chinas-data-and-info-overseas-academics-analysts-get-crafty/) - MEDIUM confidence
- [Docker for ML Best Practices 2025](https://markaicode.com/docker-containerization-llm-applications-best-practices-2025/) - MEDIUM confidence
- [LLM Hallucination Survey 2025](https://arxiv.org/abs/2510.06265) - HIGH confidence

---
*Pitfalls research for: StudyHub academic research platform*
*Researched: 2026-03-15*
