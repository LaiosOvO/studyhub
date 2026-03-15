# Phase 7: Plan Generation & SOTA Analysis - Research

**Researched:** 2026-03-16
**Domain:** SOTA identification, experiment plan generation, feasibility scoring, dataset recommendation, plan editing UI
**Confidence:** HIGH

## Summary

Phase 7 transforms the Deep Research Engine's analysis output (gaps, trends, paper analyses) into actionable experiment plans. The core technical challenges are: (1) identifying current SOTA methods and metrics from the analyzed corpus plus external benchmarks, (2) generating structured experiment plans with hypotheses, baselines, datasets, and code skeletons via multi-step LLM prompting with reflection, (3) computing feasibility scores across compute/data/difficulty dimensions, (4) recommending relevant open-source datasets from Hugging Face Hub, and (5) building a plan editing UI in Next.js where users can review and modify generated plans before sending them to the experiment engine (Phase 8).

The existing codebase provides everything needed as input: `DeepResearchTask` stores gaps, trends, and paper analyses; `GapResult` and `TrendResult` from `gap_detector.py` provide structured gap/trend data; `PaperAnalysis` contains methods, metrics, and datasets per paper; and the `llm_service.py` provides cost-tracked LLM calls with fallback. Phase 7 adds a new `plan_generation/` service module for SOTA analysis and plan generation, a new `ExperimentPlan` SQLAlchemy model, new Temporal activities wired into a plan generation workflow, dataset recommendation via Hugging Face Hub API, and a Next.js plan editor page.

**Primary recommendation:** Build SOTA identification as a corpus-analysis + external-lookup service, plan generation as a multi-step LLM pipeline with AI-Scientist-style reflection (generate -> score -> refine), and the plan editor as a structured form UI with Markdown preview. Use the Hugging Face `huggingface_hub` Python client for dataset search/recommendation. Reuse the established Temporal activity pattern for orchestration.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAN-01 | System identifies current SOTA methods and metrics for a research direction | SOTA identifier service: aggregates methods/metrics from paper analyses + queries Hugging Face/archived PWC data for benchmark rankings |
| PLAN-02 | System analyzes improvement opportunities (method gaps, data gaps, architectural improvements) | Improvement analyzer: consumes GapResult + SOTA data, LLM identifies concrete improvement vectors |
| PLAN-03 | System generates experiment plans with hypothesis, method, baselines, metrics, datasets, technical roadmap, code skeleton | Multi-step LLM pipeline with AI-Scientist-style idea generation and reflection rounds |
| PLAN-04 | Each plan includes feasibility scoring (compute, data availability, expected improvement, difficulty) | Feasibility scorer: LLM-based scoring with structured rubric, validated against compute cost estimates |
| PLAN-05 | User can choose data strategy: open-source datasets first, own data, or hybrid | DataStrategy enum in plan input schema; dataset recommender respects this preference |
| PLAN-06 | System recommends relevant open-source datasets with download links | Hugging Face Hub API search by task/tag/keyword; returns dataset cards with size, license, download URL |
| PLAN-07 | User can view and modify generated plans before execution | Next.js plan editor page: structured form for each plan field + Markdown preview for code skeleton |
| PLAN-08 | Plans can be generated from three entry points: research direction, specific paper improvement, or AI-discovered gap | Plan generation accepts entry_type enum; each type constructs different LLM context |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| temporalio | >=1.9.0 | Workflow orchestration for plan generation pipeline | Already in use; plan generation is a multi-activity workflow |
| litellm | >=1.55.0 | LLM calls for SOTA analysis, plan generation, feasibility scoring | Already in use; cost tracking, multi-provider fallback |
| fastapi | >=0.115.0 | REST endpoints for plans CRUD and generation triggers | Already in use; established router pattern |
| huggingface_hub | >=0.28.0 | Dataset search and recommendation via HF Hub API | Official Python client; programmatic dataset discovery |
| jinja2 | >=3.1.0 | Plan template rendering (code skeletons, experiment configs) | Already installed from Phase 5; template composition |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pydantic | >=2.10.0 | ExperimentPlan, FeasibilityScore, SOTAResult schemas | Already in use; structured LLM output parsing |
| httpx | >=0.27.0 | External API calls (HF Hub fallback, archived benchmark data) | Already in use; async HTTP client |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| huggingface_hub for dataset search | Direct HF API via httpx | Client handles pagination, auth, retry; less code |
| Jinja2 for code skeleton generation | Raw LLM output | LLM generates the skeleton content, Jinja2 wraps it in a consistent template structure |
| Papers with Code API for SOTA | Archived PWC data dump | PWC shut down by Meta July 2025; use archived data + HF SOTA leaderboards instead |

**Installation:**
```bash
uv add huggingface_hub
```

(All other dependencies already installed.)

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
  services/
    plan_generation/
      __init__.py
      sota_identifier.py     # SOTA method/metric extraction from corpus + external sources
      improvement_analyzer.py # Gap-to-improvement-opportunity mapping
      plan_generator.py       # Multi-step LLM plan generation with reflection
      feasibility_scorer.py   # Compute/data/difficulty feasibility assessment
      dataset_recommender.py  # HF Hub dataset search and recommendation
      prompts.py              # All LLM prompt templates for plan generation
      code_skeleton.py        # Code skeleton generation and template rendering
  models/
    experiment_plan.py        # ExperimentPlan SQLAlchemy model
  schemas/
    plan.py                   # Pydantic schemas for plan I/O
  routers/
    plans.py                  # REST endpoints for plan CRUD and generation
  workflows/
    plan_generation.py        # Temporal workflow + activities

apps/web/src/app/[locale]/
  plans/
    page.tsx                  # Plan list view
    [planId]/
      page.tsx                # Plan detail / editor view
      edit/
        page.tsx              # Full plan editor with form + Markdown preview
```

### Pattern 1: AI-Scientist-Style Idea Generation with Reflection
**What:** Generate experiment ideas via LLM, then iterate with reflection rounds to refine. Each round rates the idea on interestingness, feasibility, and novelty, allowing the LLM to self-improve before finalizing.
**When to use:** PLAN-03 (plan generation). Initial generation tends to be generic; reflection produces more specific, actionable plans.
**Example:**
```python
# Source: AI-Scientist generate_ideas.py pattern
async def generate_experiment_plan(
    context: PlanGenerationContext,
    session: AsyncSession,
    user_id: str,
    num_reflections: int = 3,
) -> ExperimentPlanDraft:
    """Generate an experiment plan with reflection rounds.

    Round 1: Generate initial plan from context (gaps, SOTA, papers).
    Rounds 2-N: Reflect on quality, refine hypothesis/method/baselines.
    Stops early if LLM indicates convergence ("I am done").
    """
    messages = build_initial_plan_prompt(context)

    response = await llm_completion(
        session=session,
        user_id=user_id,
        messages=messages,
        model=None,  # Sonnet for quality
        max_tokens=4096,
        request_type="plan_generation",
    )
    plan_draft = parse_plan_json(response.content)

    for round_num in range(2, num_reflections + 1):
        reflect_messages = build_reflection_prompt(
            plan_draft=plan_draft,
            round_num=round_num,
            total_rounds=num_reflections,
        )
        response = await llm_completion(
            session=session,
            user_id=user_id,
            messages=reflect_messages,
            model=None,
            max_tokens=4096,
            request_type="plan_reflection",
        )
        if "I am done" in response.content:
            break
        plan_draft = parse_plan_json(response.content)

    return plan_draft
```

### Pattern 2: Three Entry Points with Shared Pipeline
**What:** PLAN-08 requires three entry points (direction, paper improvement, gap). Each entry point constructs different LLM context, but feeds into the same plan generation pipeline.
**When to use:** When the same generation logic applies to different starting conditions.
**Example:**
```python
# Entry point dispatcher
async def create_plan_context(
    entry_type: str,
    task_id: str,
    session: AsyncSession,
    # Optional per entry type:
    paper_id: str | None = None,
    gap_index: int | None = None,
) -> PlanGenerationContext:
    """Build plan generation context from entry type.

    - "direction": uses full SOTA + all gaps from DeepResearchTask
    - "paper": focuses on improving a specific paper's method
    - "gap": focuses on a specific AI-discovered gap
    """
    task = await load_deep_research_task(task_id, session)

    if entry_type == "direction":
        return PlanGenerationContext(
            direction=task.research_direction,
            sota=await identify_sota(task, session),
            gaps=task.gaps,
            trends=task.trends,
            top_papers=get_top_papers(task),
        )
    elif entry_type == "paper":
        paper = await load_paper(paper_id, session)
        return PlanGenerationContext(
            direction=task.research_direction,
            focus_paper=paper,
            sota=await identify_sota(task, session),
            improvements=await analyze_paper_improvements(paper, task, session),
        )
    elif entry_type == "gap":
        gap = extract_gap_by_index(task.gaps, gap_index)
        return PlanGenerationContext(
            direction=task.research_direction,
            focus_gap=gap,
            sota=await identify_sota(task, session),
            related_papers=find_papers_related_to_gap(gap, task),
        )
```

### Pattern 3: Structured Feasibility Scoring
**What:** Each plan dimension scored independently with a rubric, then combined into a composite score. LLM evaluates each dimension against explicit criteria.
**When to use:** PLAN-04 (feasibility scoring).
**Example:**
```python
class FeasibilityScore(BaseModel):
    """Multi-dimensional feasibility assessment."""
    compute_requirements: int  # 1-5 (1=single GPU hours, 5=cluster weeks)
    data_availability: int     # 1-5 (1=needs collection, 5=freely available)
    expected_improvement: int  # 1-5 (1=marginal, 5=significant)
    difficulty: int            # 1-5 (1=straightforward, 5=novel research required)
    overall: float             # weighted average
    explanation: str           # LLM-generated justification

    @property
    def is_feasible(self) -> bool:
        """A plan is considered feasible if overall >= 2.5."""
        return self.overall >= 2.5
```

### Pattern 4: MLE-Agent-Style Advisor for SOTA
**What:** Combines corpus analysis (internal papers) with external search (HF Hub, archived benchmarks) to identify current SOTA. Unlike pure LLM hallucination, grounds SOTA claims in actual paper data.
**When to use:** PLAN-01 (SOTA identification).
**Example:**
```python
async def identify_sota(
    task: DeepResearchTask,
    session: AsyncSession,
) -> SOTAResult:
    """Identify SOTA from paper corpus + external benchmarks.

    Step 1: Extract top methods/metrics from paper analyses (grounded in data).
    Step 2: Query HF Hub for benchmark leaderboards in the research area.
    Step 3: LLM synthesizes a SOTA summary combining both sources.
    """
    # Step 1: Internal corpus analysis
    paper_analyses = task.config.get("paper_analyses", {})
    methods_by_metric = aggregate_methods_by_metric(paper_analyses)

    # Step 2: External benchmark lookup
    hf_benchmarks = await search_hf_benchmarks(task.research_direction)

    # Step 3: LLM synthesis
    sota_summary = await synthesize_sota(
        methods_by_metric, hf_benchmarks, task.research_direction,
        session, task.user_id,
    )
    return sota_summary
```

### Anti-Patterns to Avoid
- **Generating plans without grounding in corpus data:** LLMs will hallucinate plausible-sounding but non-existent methods. Always feed actual paper analyses, real gap data, and verified SOTA metrics as context.
- **Single monolithic LLM call for plan generation:** A single prompt asking for hypothesis + method + baselines + datasets + code skeleton produces shallow output. Break into stages: SOTA -> improvements -> plan -> feasibility -> code skeleton.
- **Skipping reflection rounds:** AI-Scientist found that initial idea generations are generic. 2-3 reflection rounds significantly improve specificity and feasibility.
- **Hardcoding feasibility thresholds:** Different research domains have vastly different compute norms. Let the LLM score relative to the specific domain, not absolute numbers.
- **Building a rich text editor for plans:** Overkill for v1. A structured form with Markdown preview for the code skeleton field is sufficient and much simpler to build.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dataset discovery | Custom web scraper for dataset sites | `huggingface_hub` client `list_datasets()` | Handles pagination, auth, 200k+ datasets indexed |
| SOTA benchmark lookup | Custom scraping of leaderboard sites | HF Hub models/datasets API + archived PWC data | PWC is dead; HF Hub is the new standard for benchmarks |
| Code skeleton formatting | String concatenation for Python code | Jinja2 templates with proper indentation | Templates handle imports, boilerplate, config blocks cleanly |
| Plan versioning | Custom diff system for plan edits | PostgreSQL JSON column with version timestamps | Simple, sufficient for v1; plans are edited, not collaboratively versioned |
| Experiment idea scoring | Custom heuristic scoring | LLM-based scoring with structured rubric (AI-Scientist pattern) | Domain-specific scoring requires understanding the research field |

**Key insight:** Phase 7 is primarily an *LLM orchestration* phase -- composing prompts that consume Phase 5's structured output and produce structured plans. The core complexity is in prompt engineering and ensuring plans are grounded in real data, not in infrastructure.

## Common Pitfalls

### Pitfall 1: Hallucinated SOTA Claims
**What goes wrong:** LLM claims "method X achieves 95% accuracy on dataset Y" without basis in the actual paper corpus.
**Why it happens:** LLM training data includes outdated benchmarks; no grounding in user's actual research context.
**How to avoid:** Always provide paper analyses as context for SOTA identification. Extract actual metrics from PaperAnalysis.key_metrics. Cross-reference with HF Hub benchmarks. Mark unverified claims as "estimated" in the plan.
**Warning signs:** SOTA metrics that don't appear in any analyzed paper's key_metrics dict.

### Pitfall 2: Over-Ambitious Plan Generation
**What goes wrong:** Plans propose novel architectures requiring months of research, presented as "feasible experiments."
**Why it happens:** LLMs default to impressive-sounding research without considering practical constraints.
**How to avoid:** Feasibility scoring is mandatory (PLAN-04). Plans with compute_requirements > 4 or difficulty > 4 get flagged. Reflection rounds explicitly ask "Is this achievable in 1-2 weeks with a single GPU?"
**Warning signs:** Plans with no concrete baseline reference, vague "novel architecture" descriptions without specific modifications.

### Pitfall 3: Generic Code Skeletons
**What goes wrong:** Code skeletons are so generic they're useless (just PyTorch boilerplate).
**Why it happens:** Plan generation prompt doesn't include enough specificity about the actual method modifications.
**How to avoid:** Code skeleton generation receives the full plan (hypothesis, method, baselines, datasets) as context. Include specific function stubs for the proposed modifications, not just training boilerplate. Reference the baseline code structure from analyzed papers.
**Warning signs:** Code skeletons that would work for any ML task without modification.

### Pitfall 4: Dataset Recommendations Without Relevance Check
**What goes wrong:** System recommends popular datasets that are irrelevant to the specific research direction.
**Why it happens:** Keyword matching on dataset names/tags without understanding research context.
**How to avoid:** Use datasets already mentioned in the paper corpus as primary recommendations. HF Hub search as secondary. LLM validates relevance of each recommendation against the specific plan's hypothesis.
**Warning signs:** Recommending ImageNet for an NLP task, or GLUE for a computer vision experiment.

### Pitfall 5: Plans Not Linked to Specific Gaps
**What goes wrong:** Generated plans are generic improvements disconnected from the AI-identified gaps.
**Why it happens:** Gap data not properly threaded into plan generation context.
**How to avoid:** Each plan MUST reference the specific gap(s) or improvement opportunity it addresses. The plan generation prompt explicitly includes the gap description and evidence. The "gap" entry point (PLAN-08) makes this mandatory.
**Warning signs:** Plans that don't reference any specific gap from the GapResult.

### Pitfall 6: LLM Cost Explosion in Plan Generation
**What goes wrong:** Generating 5+ plans with 3 reflection rounds each, plus feasibility scoring, plus dataset recommendations costs $20+ per request.
**Why it happens:** Sonnet on full corpus context for every step.
**How to avoid:** Tiered approach: generate plan candidates with Sonnet (expensive), score feasibility with Haiku (cheap), generate code skeletons with Sonnet only for top-ranked plans. Default to 3 plans max. Cost ceiling per plan generation request ($15).
**Warning signs:** Single plan generation request exceeding $5.

## Code Examples

### ExperimentPlan Model (PostgreSQL)
```python
# Source: established project model patterns (deep_research.py)
class ExperimentPlan(Base):
    """A generated experiment plan linked to a Deep Research task."""

    __tablename__ = "experiment_plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: uuid.uuid4().hex)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    task_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)  # FK to DeepResearchTask

    # Entry point metadata
    entry_type: Mapped[str] = mapped_column(String(20), nullable=False)  # direction/paper/gap
    source_paper_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    source_gap_index: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Plan content (user-editable)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    hypothesis: Mapped[str] = mapped_column(Text, nullable=False)
    method_description: Mapped[str] = mapped_column(Text, nullable=False)
    baselines: Mapped[list] = mapped_column(JSON, default=list)   # [{name, paper_id, metrics}]
    metrics: Mapped[list] = mapped_column(JSON, default=list)      # ["accuracy", "F1", ...]
    datasets: Mapped[list] = mapped_column(JSON, default=list)     # [{name, url, size, license}]
    technical_roadmap: Mapped[list] = mapped_column(JSON, default=list)  # [{step, description}]
    code_skeleton: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Feasibility scoring
    feasibility: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # {compute_requirements, data_availability, expected_improvement, difficulty, overall, explanation}

    # Data strategy
    data_strategy: Mapped[str] = mapped_column(String(20), default="open_source")  # open_source/own_data/hybrid

    # Status
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft/approved/executing/completed

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

### SOTA Identification Prompt
```python
# Source: AI-Scientist + MLE-agent advisor pattern combined
SOTA_IDENTIFICATION_PROMPT = """You are analyzing the state-of-the-art in "{direction}".

<corpus_analysis>
Papers analyzed: {paper_count}
Top methods by frequency: {top_methods}
Best reported metrics:
{best_metrics}
</corpus_analysis>

<external_benchmarks>
{hf_benchmarks}
</external_benchmarks>

Based on the corpus analysis and external benchmarks, identify:
1. Current SOTA methods (with specific metric values when available)
2. The most commonly used baselines
3. Standard evaluation metrics for this field
4. Key datasets used for benchmarking

Return JSON:
{{
  "sota_methods": [
    {{"method": "...", "metric": "...", "value": "...", "paper_title": "...", "confidence": "high|medium|low"}}
  ],
  "standard_baselines": [
    {{"name": "...", "typical_metrics": {{}}, "paper_title": "..."}}
  ],
  "evaluation_metrics": ["metric1", "metric2"],
  "benchmark_datasets": [
    {{"name": "...", "size": "...", "url": "...", "commonly_used_for": "..."}}
  ]
}}

Return ONLY valid JSON, no additional text."""
```

### Plan Generation Prompt
```python
# Source: AI-Scientist idea_first_prompt pattern adapted for experiment plans
PLAN_GENERATION_PROMPT = """You are an expert ML researcher generating an experiment plan for "{direction}".

<sota>
{sota_summary}
</sota>

<identified_gaps>
{gaps_summary}
</identified_gaps>

<improvement_opportunities>
{improvements_summary}
</improvement_opportunities>

{entry_context}

Generate a concrete, actionable experiment plan. Be specific about:
- What exactly to change in the method
- Which existing implementation to start from
- What metrics to measure and what improvement to expect

Return JSON:
{{
  "title": "Concise descriptive title",
  "hypothesis": "If we [specific change], then [expected outcome] because [reasoning]",
  "method_description": "Detailed description of the proposed method (2-3 paragraphs)",
  "baselines": [{{"name": "...", "description": "...", "expected_metrics": {{}}}}],
  "metrics": ["metric1", "metric2"],
  "datasets": [{{"name": "...", "why": "..."}}],
  "technical_roadmap": [
    {{"step": 1, "description": "..."}},
    {{"step": 2, "description": "..."}}
  ],
  "interestingness": 1-10,
  "feasibility": 1-10,
  "novelty": 1-10
}}

Return ONLY valid JSON, no additional text."""
```

### Dataset Recommendation via HF Hub
```python
# Source: huggingface_hub Python client docs
from huggingface_hub import HfApi

async def recommend_datasets(
    direction: str,
    plan_datasets: list[str],
    data_strategy: str,
    limit: int = 10,
) -> list[DatasetRecommendation]:
    """Search HF Hub for relevant datasets.

    Searches by keywords from the research direction and plan's
    mentioned datasets. Filters by size and license.
    """
    api = HfApi()

    # Search by direction keywords
    keywords = extract_search_keywords(direction)

    results = []
    for keyword in keywords[:3]:  # Top 3 keyword searches
        datasets = api.list_datasets(
            search=keyword,
            sort="downloads",
            direction=-1,
            limit=limit,
        )
        for ds in datasets:
            results.append(DatasetRecommendation(
                name=ds.id,
                url=f"https://huggingface.co/datasets/{ds.id}",
                downloads=ds.downloads,
                tags=ds.tags or [],
                license=next((t for t in (ds.tags or []) if t.startswith("license:")), None),
            ))

    # Deduplicate and rank by relevance
    return deduplicate_and_rank(results, direction, limit)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Papers with Code API for SOTA lookup | HF Hub leaderboards + corpus-derived SOTA | July 2025 (PWC shutdown) | Must use HF Hub or archived PWC data |
| Manual experiment planning | AI-generated plans with reflection (AI-Scientist pattern) | 2024-2025 | Structured, reproducible experiment plans at scale |
| Simple keyword search for datasets | HF Hub API with 200k+ indexed datasets | 2024-2025 | Programmatic dataset discovery with metadata |
| Single-shot plan generation | Multi-round reflection with self-scoring | 2024 (AI-Scientist) | Higher quality, more specific plans |

**Deprecated/outdated:**
- Papers with Code API: shut down by Meta July 2025. Use archived `paperswithcode-data` repo for historical data, HF Hub for current benchmarks.
- Single-shot idea generation without reflection: AI-Scientist showed 2-3 reflection rounds produce significantly better ideas.

## Open Questions

1. **How many plans to generate per request?**
   - What we know: AI-Scientist generates up to 20 ideas but most are low quality. MLE-agent generates one focused plan.
   - What's unclear: Optimal number for user experience.
   - Recommendation: Default to 3 plans per request. Each gets feasibility scoring. User sees ranked list. Can request more if needed.

2. **Code skeleton language and framework assumptions**
   - What we know: Most ML experiments use Python + PyTorch.
   - What's unclear: Should code skeletons assume a specific framework?
   - Recommendation: Default to PyTorch. Include framework preference in plan config. Code skeletons are editable by user.

3. **How to handle stale SOTA data**
   - What we know: Paper corpus is from the deep research task's point in time. SOTA moves fast.
   - What's unclear: How quickly SOTA identification becomes outdated.
   - Recommendation: Always show "SOTA as of [deep research task date]" in plans. Plans are regeneratable.

4. **Plan persistence and versioning**
   - What we know: Users need to edit plans (PLAN-07). Plans feed into Phase 8 execution.
   - What's unclear: Whether we need version history for edited plans.
   - Recommendation: Store current state only in v1. Add `updated_at` timestamp. Full version history deferred to v2.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `backend/app/services/deep_research/`, `backend/app/workflows/deep_research.py`, `backend/app/models/deep_research.py` -- all patterns verified by reading source
- AI-Scientist reference: `/Users/admin/ai/ref/AI-Scientist/ai_scientist/generate_ideas.py` -- idea generation with reflection rounds, novelty checking, structured JSON output
- MLE-agent reference: `/Users/admin/ai/ref/MLE-agent/mle/agents/advisor.py`, `planner.py` -- SOTA advisor pattern, plan generation, dataset clarification
- Hugging Face Hub docs: `list_datasets()` API with search, sort, filtering

### Secondary (MEDIUM confidence)
- AI-Scientist `perform_experiments.py` -- experiment execution loop pattern (relevant for understanding what plans should produce for Phase 8 consumption)
- MLE-agent `workflow/baseline.py` -- end-to-end workflow: advise -> plan -> code -> debug
- Papers with Code status: confirmed shut down July 2025 via web search; archived data at `paperswithcode/paperswithcode-data`

### Tertiary (LOW confidence)
- Cost estimates for multi-round plan generation: based on Phase 5 cost patterns (~$0.10 per Sonnet call), needs validation against actual usage
- HF Hub benchmark coverage: assumed good for popular ML tasks, may have gaps for niche domains

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all core libraries already in use except `huggingface_hub` (well-documented, widely used)
- Architecture: HIGH -- extends established patterns (Temporal activities, services module, prompt templates, SQLAlchemy models)
- SOTA identification: MEDIUM -- PWC shutdown means fallback to HF Hub + corpus analysis; coverage may vary by domain
- Plan generation quality: MEDIUM -- AI-Scientist reflection pattern is proven but prompt engineering will need iteration
- Pitfalls: HIGH -- grounded in AI-Scientist experience and established project patterns

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable stack, HF Hub API evolving but backward-compatible)
