"""LLM prompt templates for Deep Research analysis pipeline.

All prompts use XML-tag delimiters for paper content to prevent
prompt injection (research pitfall #5). Templates use double-brace
escaping for JSON output structure in f-strings.

Reference: AI-Scientist generate_ideas.py, gpt-researcher analysis prompts.
"""

# ─── Abstract-Level Screening (Haiku) ─────────────────────────────────────


def build_tldr_prompt(
    title: str,
    abstract: str,
    year: int | None,
    venue: str | None,
) -> list[dict]:
    """Build TLDR screening prompt for abstract-level analysis.

    Returns bilingual summary, methods, datasets, metrics, paper type.
    Truncates abstract to 1000 chars for cost control.
    """
    safe_abstract = (abstract or "")[:1000]
    safe_year = str(year) if year else "unknown"
    safe_venue = venue or "unknown"

    content = f"""Analyze the following academic paper and provide a structured analysis.

<paper>
<title>{title}</title>
<abstract>{safe_abstract}</abstract>
<year>{safe_year}</year>
<venue>{safe_venue}</venue>
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

    return [{"role": "user", "content": content}]


# ─── Full-Text Deep Analysis (Sonnet) ─────────────────────────────────────


def build_deep_analysis_prompt(
    title: str,
    abstract: str | None,
    parsed_content: str | None,
) -> list[dict]:
    """Build deep analysis prompt for top-N papers with full text.

    Extracts detailed methodology, contributions, limitations, future work.
    Uses parsed PDF content when available, falls back to abstract.
    """
    text_content = parsed_content or abstract or "No content available"
    # Truncate to ~4000 chars to fit context and control costs
    safe_content = text_content[:4000]

    content = f"""Perform a detailed analysis of this academic paper.

<paper>
<title>{title}</title>
<content>{safe_content}</content>
</paper>

Return a JSON object with exactly these fields:
{{
  "detailed_methodology": "Detailed description of the methodology used (2-3 paragraphs)",
  "key_contributions": ["contribution 1", "contribution 2", "contribution 3"],
  "limitations": ["limitation 1", "limitation 2"],
  "future_work": ["direction 1", "direction 2"]
}}

Return ONLY valid JSON, no additional text."""

    return [{"role": "user", "content": content}]


# ─── Relationship Classification (Haiku) ──────────────────────────────────


def build_relationship_prompt(
    title_a: str,
    abstract_a: str,
    title_b: str,
    abstract_b: str,
) -> list[dict]:
    """Build pairwise relationship classification prompt.

    Classifies how paper_b relates to paper_a. Only called for
    citation-connected pairs (not O(n^2)).
    Truncates abstracts to 500 chars each.
    """
    safe_abstract_a = (abstract_a or "")[:500]
    safe_abstract_b = (abstract_b or "")[:500]

    content = f"""Given two academic papers, classify their relationship.

<paper_a>
<title>{title_a}</title>
<abstract>{safe_abstract_a}</abstract>
</paper_a>

<paper_b>
<title>{title_b}</title>
<abstract>{safe_abstract_b}</abstract>
</paper_b>

Classify the relationship of paper_b relative to paper_a as exactly ONE of:
- "improvement": paper_b improves upon paper_a's method
- "comparison": paper_b compares against paper_a
- "survey": paper_b surveys/reviews paper_a's area
- "application": paper_b applies paper_a's method to a new domain
- "theoretical_basis": paper_a provides theoretical foundation for paper_b
- "unrelated": no meaningful relationship

Return JSON: {{"relationship": "<type>", "confidence": 0.0, "explanation": "brief reason"}}

Return ONLY valid JSON, no additional text."""

    return [{"role": "user", "content": content}]


# ─── Gap Detection (Sonnet) ───────────────────────────────────────────────


def build_gap_detection_prompt(
    direction: str,
    paper_count: int,
    corpus_summary: str,
    method_frequencies: str,
) -> list[dict]:
    """Build corpus-level gap identification prompt.

    Analyzes the entire paper corpus for research gaps,
    underexplored method combinations, and missing evaluations.
    """
    content = f"""You are analyzing a corpus of {paper_count} academic papers in the area of "{direction}".

<corpus_summary>
{corpus_summary}
</corpus_summary>

<method_frequencies>
{method_frequencies}
</method_frequencies>

Identify:
1. Research gaps: areas mentioned but not deeply explored
2. Underexplored combinations: methods that haven't been combined
3. Missing evaluations: datasets or metrics not yet applied to promising methods

Return JSON:
{{
  "gaps": [{{"description": "...", "evidence": "...", "potential_impact": "high|medium|low"}}],
  "underexplored": [{{"combination": "...", "why_promising": "..."}}],
  "missing_evaluations": [{{"method": "...", "missing": "..."}}]
}}

Return ONLY valid JSON, no additional text."""

    return [{"role": "user", "content": content}]


# ─── Trend Interpretation (Haiku) ─────────────────────────────────────────


def build_trend_interpretation_prompt(
    direction: str,
    method_year_counts: str,
) -> list[dict]:
    """Build trend detection prompt from year-grouped method frequencies.

    Identifies ascending/declining methods and emerging topics.
    """
    content = f"""Analyze the temporal trends of research methods in "{direction}".

<method_year_counts>
{method_year_counts}
</method_year_counts>

Based on the year-by-year method frequencies above, identify:
1. Ascending methods: gaining popularity over time
2. Declining methods: losing popularity
3. Emerging topics: appeared recently
4. Stable methods: consistently used

Return JSON:
{{
  "ascending_methods": [{{"method": "...", "evidence": "..."}}],
  "declining_methods": [{{"method": "...", "evidence": "..."}}],
  "emerging_topics": [{{"topic": "...", "evidence": "..."}}],
  "stable_methods": [{{"method": "...", "evidence": "..."}}]
}}

Return ONLY valid JSON, no additional text."""

    return [{"role": "user", "content": content}]
