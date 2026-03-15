# Phase 5: Deep Research Engine - Research

**Researched:** 2026-03-16
**Domain:** Temporal workflow orchestration, LLM-powered academic paper analysis, WebSocket real-time progress, literature review generation
**Confidence:** HIGH

## Summary

Phase 5 composes existing infrastructure (search aggregator, citation expansion, quality scoring, LLM gateway) into a single Temporal workflow that runs the full deep research pipeline end-to-end. The core technical challenges are: (1) orchestrating a multi-stage pipeline as durable Temporal activities with progress reporting via `@workflow.query`, (2) bridging Temporal workflow state to WebSocket clients for real-time progress, (3) designing LLM prompts for bilingual TLDR, methodology extraction, relationship classification, gap identification, and trend detection, and (4) generating a coherent Markdown literature review from structured analysis results.

The existing codebase already has the Temporal worker, LLM service with cost tracking, paper search aggregator, BFS citation expansion engine, quality scorer, and a placeholder `DeepResearchWorkflow`. Phase 5 replaces the placeholder with a real multi-activity workflow and adds a new `deep_research/` service module for AI analysis. WebSocket is new infrastructure that must be added to FastAPI.

**Primary recommendation:** Build the workflow as a sequence of Temporal activities (search, expand, score, analyze, report), expose workflow progress via `@workflow.query`, and poll that query from a FastAPI WebSocket endpoint that pushes updates to the client. Use tiered LLM analysis (abstract-only for screening, full-text for top-N papers) to control costs.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEEP-01 | User can start Deep Research by providing direction, paper, or author | Temporal workflow input schema with entry_type enum; existing `/workflows/deep-research` endpoint extended |
| DEEP-02 | Multi-stage pipeline: search -> citation expansion -> quality scoring -> AI analysis | Temporal workflow with 5 sequential activities reusing existing services |
| DEEP-03 | Real-time progress via WebSocket (phase, papers found, ETA) | `@workflow.query` on workflow + FastAPI WebSocket endpoint polling Temporal |
| DEEP-04 | User can configure search parameters (depth, sources, time range, languages) | Extended DeepResearchInput dataclass with all configurable fields |
| DEEP-05 | Complete results stored in PostgreSQL + Neo4j + Meilisearch + SeaweedFS | Each activity persists to its respective store; DeepResearchTask model in PostgreSQL |
| DEEP-06 | User can refine results by adjusting filters or excluding categories | POST endpoint to update filters, triggers partial re-analysis workflow |
| DEEP-07 | User can expand specific graph areas after initial research | Reuse Phase 4 manual expansion endpoint from within a new activity |
| DEEP-08 | Markdown literature review report generated | Report generation activity using LLM with structured prompt and paper summaries |
| ANAL-01 | Bilingual TLDR summaries per paper | LLM analysis activity with bilingual prompt template; abstract-first screening |
| ANAL-02 | Methodology and techniques extraction | Structured extraction prompt returning JSON with methods, datasets, metrics |
| ANAL-03 | Research gaps and underexplored areas | Gap identification prompt over corpus-level aggregated analysis |
| ANAL-04 | Trend detection (ascending/declining methods) | Year-grouped method frequency analysis + LLM trend interpretation |
| ANAL-05 | Paper relationship classification | Pairwise classification prompt: improvement, comparison, survey, application, theoretical_basis |
| ANAL-06 | Tiered analysis (abstract-first, full-text for top papers) | Two-pass architecture: cheap model on abstracts, expensive model on top-N parsed papers |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| temporalio | >=1.9.0 | Workflow orchestration with signals/queries | Already in use; durable workflows survive restarts |
| litellm | >=1.55.0 | LLM completion with cost tracking | Already in use via llm_service.py; multi-provider fallback |
| fastapi | >=0.115.0 | WebSocket endpoint for progress | Already in use; native WebSocket support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pydantic | >=2.10.0 | Schema for analysis results, workflow I/O | Already in use; structured JSON outputs |
| jinja2 | >=3.1.0 | Literature review Markdown templating | Composing final report from structured data |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| WebSocket polling Temporal queries | Valkey Pub/Sub for progress events | Valkey adds another dependency in the progress path; Temporal query is simpler for this use case |
| Jinja2 for report | Raw f-strings | Jinja2 handles conditional sections, loops over papers, bilingual blocks cleanly |
| SSE for progress | WebSocket | SSE is simpler for unidirectional but WebSocket allows client to send cancel/refine signals |

**Installation:**
```bash
uv add jinja2
```

(All other dependencies already installed.)

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── workflows/
│   └── deep_research.py          # Temporal workflow + activities (replace placeholder)
├── services/
│   └── deep_research/
│       ├── __init__.py
│       ├── analyzer.py            # LLM analysis (TLDR, methodology, relationships)
│       ├── gap_detector.py        # Gap identification and trend detection
│       ├── report_generator.py    # Markdown literature review generation
│       └── prompts.py             # All LLM prompt templates
├── routers/
│   └── deep_research.py          # REST + WebSocket endpoints
├── schemas/
│   └── deep_research.py          # Input/output/progress schemas
└── models/
    └── deep_research.py          # DeepResearchTask SQLAlchemy model
```

### Pattern 1: Temporal Workflow with Query-Based Progress
**What:** Workflow maintains internal state dict updated after each activity. A `@workflow.query` handler exposes this state. FastAPI WebSocket polls the query every 2-3 seconds and pushes to client.
**When to use:** Long-running workflows where clients need progress visibility.
**Example:**
```python
# Source: Temporal Python SDK docs - message-passing
from dataclasses import dataclass, field
from temporalio import workflow

@dataclass
class DeepResearchProgress:
    phase: str = "pending"
    papers_found: int = 0
    papers_analyzed: int = 0
    total_papers: int = 0
    current_activity: str = ""
    eta_seconds: int | None = None
    error: str | None = None

@workflow.defn
class DeepResearchWorkflow:
    def __init__(self) -> None:
        self._progress = DeepResearchProgress()

    @workflow.query
    def get_progress(self) -> DeepResearchProgress:
        """Synchronous query handler -- cannot do async ops."""
        return self._progress

    @workflow.run
    async def run(self, input: DeepResearchInput) -> DeepResearchResult:
        self._progress = DeepResearchProgress(phase="searching")

        search_result = await workflow.execute_activity(
            search_papers_activity,
            input,
            start_to_close_timeout=timedelta(minutes=5),
        )
        self._progress = DeepResearchProgress(
            phase="expanding",
            papers_found=search_result.count,
        )
        # ... continue pipeline
```

### Pattern 2: Tiered LLM Analysis
**What:** Two-pass analysis to control costs. Pass 1: cheap/fast model on abstracts for all papers (TLDR, basic classification). Pass 2: expensive model on full parsed text for top-N quality-scored papers (deep methodology, detailed gaps).
**When to use:** When analyzing 50-200+ papers and LLM costs must be managed.
**Example:**
```python
# Tiered analysis pattern from AI-Scientist / gpt-researcher
async def analyze_papers_tiered(
    papers: list[PaperWithQuality],
    session: AsyncSession,
    user_id: str,
    top_n: int = 20,
) -> list[PaperAnalysis]:
    # Pass 1: Abstract-level screening (all papers, cheap model)
    screening_results = []
    for paper in papers:
        result = await llm_completion(
            session=session,
            user_id=user_id,
            messages=build_tldr_prompt(paper.abstract, paper.title),
            model="claude-haiku-4-20250514",  # cheap model
            max_tokens=512,
            request_type="deep_research_screening",
        )
        screening_results.append(parse_screening(result.content))

    # Pass 2: Full-text analysis (top-N papers, expensive model)
    top_papers = sorted(papers, key=lambda p: p.quality.score, reverse=True)[:top_n]
    for paper in top_papers:
        if paper.parsed_content:
            result = await llm_completion(
                session=session,
                user_id=user_id,
                messages=build_deep_analysis_prompt(paper),
                model=None,  # default (claude-sonnet)
                max_tokens=2048,
                request_type="deep_research_analysis",
            )
            # merge into screening result
```

### Pattern 3: Activity-Per-Stage with Own DB Sessions
**What:** Each Temporal activity creates its own DB session (isolation pattern from Phase 3.1). Activities are independently retriable without side effects leaking.
**When to use:** All Temporal activities that touch the database.
**Example:**
```python
# Source: scholar_refresh.py pattern established in Phase 3.1
@activity.defn
async def search_papers_activity(input_json: str) -> str:
    """Activity: search papers across all sources.

    Creates own HTTP client and returns JSON-serialized results.
    Temporal activities must use serializable I/O.
    """
    import json
    import httpx
    from app.services.paper_search.aggregator import search_all_sources
    from app.schemas.search import SearchRequest

    params = json.loads(input_json)
    request = SearchRequest(**params)

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await search_all_sources(request, client)

    return response.model_dump_json()
```

### Pattern 4: WebSocket Progress Bridge
**What:** FastAPI WebSocket endpoint that authenticates the user, then polls a Temporal workflow query in a loop, sending JSON progress updates to the client.
**When to use:** DEEP-03 requirement.
**Example:**
```python
# Source: FastAPI WebSocket docs + Temporal query docs
from fastapi import WebSocket, WebSocketDisconnect
from temporalio.client import Client

@router.websocket("/ws/deep-research/{workflow_id}")
async def deep_research_progress(websocket: WebSocket, workflow_id: str):
    await websocket.accept()
    try:
        client = await get_temporal_client()
        handle = client.get_workflow_handle(workflow_id)

        while True:
            progress = await handle.query(
                DeepResearchWorkflow.get_progress
            )
            await websocket.send_json(progress.__dict__)

            if progress.phase in ("completed", "failed"):
                break

            await asyncio.sleep(3)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        await websocket.send_json({"error": str(exc)})
        await websocket.close()
```

### Anti-Patterns to Avoid
- **Putting LLM calls inside the Temporal workflow directly:** LLM calls are non-deterministic. Always wrap them in activities. Workflows must be deterministic.
- **Passing large objects between activities:** Temporal has a 2MB payload limit. Pass paper IDs between activities, not full paper content. Activities fetch their own data.
- **Single monolithic analysis activity:** If one paper's analysis fails, the entire activity retries. Break into per-paper or batch activities with partial progress.
- **Polling WebSocket without backoff:** If Temporal is slow, polling every 100ms wastes resources. Use 2-3 second intervals.
- **Mutating progress state outside workflow.run:** Query handlers are read-only. Only update `_progress` inside the `run` method between activity calls.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Workflow durability | Custom job queue with PostgreSQL polling | Temporal workflows | Temporal handles retries, timeouts, crash recovery automatically |
| LLM cost tracking | Manual token counting | litellm.completion_cost (already in llm_service) | LiteLLM maintains up-to-date pricing for all providers |
| Report templating | String concatenation for Markdown | Jinja2 templates | Handles conditionals, loops, escaping, bilingual sections |
| WebSocket auth | Custom token parsing | Reuse existing JWT verification from auth_service | Already has access/refresh token logic |
| Structured LLM output | Regex parsing of LLM text | JSON mode / structured output in prompt | LiteLLM supports response_format={"type": "json_object"} |

**Key insight:** Phase 5 is primarily an *orchestration* phase -- composing existing services into a pipeline. The temptation is to rewrite search/expansion/scoring, but the correct approach is to wrap existing functions as Temporal activities and add only the new analysis layer.

## Common Pitfalls

### Pitfall 1: Temporal Activity Payload Size
**What goes wrong:** Passing full paper objects (with parsed_content) between activities exceeds Temporal's 2MB payload limit.
**Why it happens:** Natural instinct is to pass rich objects between pipeline stages.
**How to avoid:** Activities receive paper IDs and fetch data themselves. Return only summary data (IDs, counts, scores) between activities.
**Warning signs:** `PayloadTooLarge` errors from Temporal, workflows failing on the transition between activities.

### Pitfall 2: LLM Cost Explosion
**What goes wrong:** Analyzing 200 papers with full-text prompts using Claude Sonnet costs $50+ per research task.
**Why it happens:** No screening step; every paper gets expensive analysis.
**How to avoid:** Tiered analysis (ANAL-06): abstract-only with Haiku for all papers (~$0.01/paper), full-text with Sonnet for top 15-20 papers (~$0.10/paper). Budget ceiling per task.
**Warning signs:** user_usage cost spikes, single workflow exceeding $5.

### Pitfall 3: Non-Deterministic Workflow Code
**What goes wrong:** Temporal replays workflows on recovery. Any non-deterministic code (random, datetime.now, API calls) inside the workflow class causes replay failures.
**Why it happens:** Developers put business logic in the workflow instead of activities.
**How to avoid:** All I/O, LLM calls, and DB access MUST be in `@activity.defn` functions. Workflow only orchestrates activity calls and updates progress state.
**Warning signs:** `NonDeterministicError` from Temporal on workflow recovery.

### Pitfall 4: WebSocket Connection Lifecycle
**What goes wrong:** WebSocket connections pile up without cleanup, or client reconnects create duplicate progress streams.
**Why it happens:** No connection management or heartbeat.
**How to avoid:** Use try/finally to clean up, add heartbeat/ping, track active connections per workflow_id, reject duplicates.
**Warning signs:** Memory growth in FastAPI process, stale WebSocket connections.

### Pitfall 5: Prompt Injection via Paper Content
**What goes wrong:** Malicious paper abstracts or titles could manipulate LLM analysis prompts.
**Why it happens:** Paper content is inserted directly into prompts without sanitization.
**How to avoid:** Use XML-tag delimiters for paper content in prompts (e.g., `<paper_abstract>...</paper_abstract>`). Truncate abstracts to reasonable length (500-1000 chars). Strip control characters.
**Warning signs:** Analysis results that echo instructions or contain unexpected commands.

### Pitfall 6: Missing Papers in Analysis
**What goes wrong:** Papers found by search but not yet persisted to PostgreSQL are referenced in analysis, causing lookup failures.
**Why it happens:** Activities run in sequence but assume prior activity's DB writes are committed.
**How to avoid:** Each activity commits its writes before returning. Next activity queries fresh data. Use `expire_on_commit=False` (already configured).
**Warning signs:** `None` results when looking up paper IDs that should exist.

## Code Examples

### DeepResearchTask Model (PostgreSQL)
```python
# New model for tracking deep research tasks
from sqlalchemy import DateTime, Enum, Float, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON
from app.database import Base

class DeepResearchTask(Base):
    __tablename__ = "deep_research_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    workflow_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)

    # Input parameters
    research_direction: Mapped[str] = mapped_column(Text, nullable=False)
    entry_type: Mapped[str] = mapped_column(String(20), nullable=False)  # direction/paper/author
    config: Mapped[dict] = mapped_column(JSON, default=dict)  # depth, sources, time_range, languages

    # Status
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending/running/completed/failed

    # Results summary
    papers_found: Mapped[int] = mapped_column(Integer, default=0)
    papers_analyzed: Mapped[int] = mapped_column(Integer, default=0)
    total_cost: Mapped[float] = mapped_column(Float, default=0.0)
    report_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Analysis results (JSON)
    gaps: Mapped[list | None] = mapped_column(JSON, nullable=True)
    trends: Mapped[list | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

### Bilingual TLDR Prompt Template
```python
# Source: deep-research pattern + AI-Scientist analysis approach
TLDR_PROMPT = """Analyze the following academic paper and provide a structured analysis.

<paper>
<title>{title}</title>
<abstract>{abstract}</abstract>
<year>{year}</year>
<venue>{venue}</venue>
</paper>

Return a JSON object with exactly these fields:
{{
  "tldr_en": "One-sentence summary in English (max 100 words)",
  "tldr_zh": "One-sentence summary in Chinese (max 100 characters)",
  "methods": ["method1", "method2"],
  "datasets": ["dataset1", "dataset2"],
  "key_metrics": {{"metric_name": "value"}},
  "paper_type": "empirical|theoretical|survey|application|methodology"
}}

Return ONLY valid JSON, no additional text."""
```

### Relationship Classification Prompt
```python
RELATIONSHIP_PROMPT = """Given two academic papers, classify their relationship.

<paper_a>
<title>{title_a}</title>
<abstract>{abstract_a}</abstract>
</paper_a>

<paper_b>
<title>{title_b}</title>
<abstract>{abstract_b}</abstract>
</paper_b>

Classify the relationship of paper_b relative to paper_a as exactly ONE of:
- "improvement": paper_b improves upon paper_a's method
- "comparison": paper_b compares against paper_a
- "survey": paper_b surveys/reviews paper_a's area
- "application": paper_b applies paper_a's method to a new domain
- "theoretical_basis": paper_a provides theoretical foundation for paper_b
- "unrelated": no meaningful relationship

Return JSON: {{"relationship": "<type>", "confidence": 0.0-1.0, "explanation": "brief reason"}}"""
```

### Gap Detection Over Corpus
```python
GAP_DETECTION_PROMPT = """You are analyzing a corpus of {paper_count} academic papers in the area of "{direction}".

<corpus_summary>
{corpus_summary}
</corpus_summary>

<method_frequencies>
{method_frequencies}
</method_frequencies>

<temporal_trends>
{temporal_trends}
</temporal_trends>

Identify:
1. Research gaps: areas mentioned but not deeply explored
2. Underexplored combinations: methods that haven't been combined
3. Missing evaluations: datasets or metrics not yet applied to promising methods

Return JSON:
{{
  "gaps": [{{"description": "...", "evidence": "...", "potential_impact": "high|medium|low"}}],
  "underexplored": [{{"combination": "...", "why_promising": "..."}}],
  "missing_evaluations": [{{"method": "...", "missing": "..."}}]
}}"""
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual literature review | AI-assisted analysis with gap detection | 2024-2025 | Hours -> minutes for initial survey |
| Single LLM call for all analysis | Tiered approach (cheap screening + deep analysis) | 2024 | 10x cost reduction at similar quality |
| REST polling for progress | WebSocket/SSE with structured progress | 2024 | Real-time UX, lower server load |
| Flat paper lists | Graph-based corpus analysis | 2023-2024 | Relationship-aware gap detection |

**Deprecated/outdated:**
- Synchronous literature review pipelines: use async Temporal workflows for durability
- GPT-3.5 for analysis: modern Haiku/Sonnet tiers give better quality at competitive prices

## Open Questions

1. **Cost ceiling per deep research task**
   - What we know: Tiered analysis controls per-paper cost. 200 papers * $0.01 screening + 20 * $0.10 deep = ~$4
   - What's unclear: What should the hard ceiling be? Should it be configurable per user?
   - Recommendation: Default ceiling of $10 per task, configurable in task input. Abort if exceeded.

2. **PDF parsing integration timing**
   - What we know: GROBID parser exists from Phase 2. Full-text analysis needs parsed content.
   - What's unclear: Should PDF downloading + parsing be a separate activity or inline with analysis?
   - Recommendation: Separate activity. Not all papers have accessible PDFs. Analysis should degrade gracefully to abstract-only.

3. **Relationship classification scope**
   - What we know: Pairwise classification of all papers is O(n^2). For 200 papers, that's 19,900 pairs.
   - What's unclear: How to make this tractable.
   - Recommendation: Only classify relationships between papers connected by citation edges in Neo4j (already have these from Phase 4). This reduces to O(edges) which is typically 500-2000.

4. **Report language**
   - What we know: Platform supports Chinese + English. Papers may be in either language.
   - What's unclear: Should report be bilingual or user-selectable?
   - Recommendation: User-selectable language with bilingual TLDR always present. Default to Chinese (target audience).

## Sources

### Primary (HIGH confidence)
- Temporal Python SDK docs: message-passing (queries, signals) - https://docs.temporal.io/develop/python/message-passing
- FastAPI WebSocket docs - https://fastapi.tiangolo.com/advanced/websockets/
- Existing codebase: `backend/app/workflows/`, `backend/app/services/` - all existing patterns verified by reading source

### Secondary (MEDIUM confidence)
- deep-research reference project (`/Users/admin/ai/ref/deep-research/src/deep-research.ts`) - recursive depth/breadth research pattern, progress callback
- gpt-researcher reference project (`/Users/admin/ai/ref/gpt-researcher/gpt_researcher/skills/deep_research.py`) - context management, query generation, report writing
- AI-Scientist reference project (`/Users/admin/ai/ref/AI-Scientist/ai_scientist/generate_ideas.py`) - structured LLM prompts for idea generation/evaluation

### Tertiary (LOW confidence)
- Cost estimates for LLM analysis tiers - based on training data pricing knowledge, needs validation against current LiteLLM pricing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all core libraries already in use, only Jinja2 is new
- Architecture: HIGH - patterns established in Phases 1-4 (Temporal, activities, services), directly extensible
- Pitfalls: HIGH - based on Temporal docs (payload limits, determinism), established project patterns (DB session isolation)
- LLM prompts: MEDIUM - prompt design will need iteration during implementation, but structure is sound

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable stack, no fast-moving dependencies)
