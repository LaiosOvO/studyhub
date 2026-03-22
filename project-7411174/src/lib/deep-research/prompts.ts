/**
 * LLM prompt templates for client-side deep research.
 * Ported from backend prompts.py with XML-tag delimiters.
 */

import type { AnalyzedPaper, ScoredPaper } from "./types";

/**
 * Build TLDR screening prompt for a batch of papers.
 * Processes multiple papers in one LLM call for efficiency.
 */
export function buildBatchAnalysisPrompt(papers: ScoredPaper[]): string {
  const paperEntries = papers.map((p, i) => {
    const safeAbstract = (p.abstract || "无摘要")
      .slice(0, 600)
      .replace(/[<>]/g, "");
    return `<paper index="${i + 1}">
<title>${p.title.replace(/[<>]/g, "")}</title>
<abstract>${safeAbstract}</abstract>
<year>${p.year ?? "unknown"}</year>
<venue>${p.venue || "unknown"}</venue>
</paper>`;
  }).join("\n\n");

  return `Analyze the following ${papers.length} academic papers. For each paper, provide a structured analysis.

${paperEntries}

Return a JSON array with one object per paper (in order), each containing:
{
  "index": 1,
  "tldr_en": "One-sentence summary in English (max 80 words)",
  "tldr_zh": "一句话中文总结（最多80字）",
  "methods": ["method1", "method2"],
  "datasets": ["dataset1", "dataset2"],
  "paper_type": "empirical|theoretical|survey|application|methodology"
}

Return ONLY a valid JSON array, no additional text.`;
}

/**
 * Build relationship classification prompt for paper pairs.
 */
export function buildRelationshipPrompt(
  pairs: { a: AnalyzedPaper; b: AnalyzedPaper }[],
): string {
  const entries = pairs.map((pair, i) => {
    const absA = (pair.a.abstract || "").slice(0, 300).replace(/[<>]/g, "");
    const absB = (pair.b.abstract || "").slice(0, 300).replace(/[<>]/g, "");
    return `<pair index="${i + 1}">
<paper_a>${pair.a.title.replace(/[<>]/g, "")}: ${absA}</paper_a>
<paper_b>${pair.b.title.replace(/[<>]/g, "")}: ${absB}</paper_b>
</pair>`;
  }).join("\n\n");

  return `Classify the relationship between each pair of academic papers.

${entries}

For each pair, classify paper_b's relationship to paper_a as ONE of:
- "improvement": paper_b improves upon paper_a's method
- "comparison": paper_b compares against paper_a
- "survey": paper_b surveys paper_a's area
- "application": paper_b applies paper_a's method to a new domain
- "theoretical_basis": paper_a provides theoretical foundation for paper_b
- "unrelated": no meaningful relationship

Return a JSON array:
[{"index": 1, "relationship": "<type>", "confidence": 0.8, "explanation": "brief reason"}]

Return ONLY valid JSON array.`;
}

/**
 * Build gap detection prompt from analyzed corpus.
 */
export function buildGapDetectionPrompt(
  direction: string,
  papers: AnalyzedPaper[],
): string {
  // Build corpus summary
  const methodCounts: Record<string, number> = {};
  const yearCounts: Record<number, number> = {};

  for (const p of papers) {
    for (const m of p.methods) {
      methodCounts[m] = (methodCounts[m] || 0) + 1;
    }
    if (p.year) {
      yearCounts[p.year] = (yearCounts[p.year] || 0) + 1;
    }
  }

  const topMethods = Object.entries(methodCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([m, c]) => `${m}: ${c}`)
    .join("\n");

  const paperTypes = papers.reduce(
    (acc, p) => {
      acc[p.paperType] = (acc[p.paperType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const summaryLines = [
    `Total papers: ${papers.length}`,
    `Year range: ${Math.min(...papers.filter(p => p.year).map(p => p.year!))} - ${Math.max(...papers.filter(p => p.year).map(p => p.year!))}`,
    `Paper types: ${Object.entries(paperTypes).map(([t, c]) => `${t}(${c})`).join(", ")}`,
    `Top TLDRs (sample):`,
    ...papers.slice(0, 5).map(p => `  - ${p.tldrEn}`),
  ].join("\n");

  return `You are analyzing a corpus of ${papers.length} academic papers in the area of "${direction}".

<corpus_summary>
${summaryLines}
</corpus_summary>

<method_frequencies>
${topMethods}
</method_frequencies>

Identify as many as possible (aim for 10+ gaps):
1. Research gaps: areas mentioned but not deeply explored (at least 5)
2. Underexplored combinations: methods/techniques that haven't been combined yet (at least 3)
3. Missing evaluations: datasets or metrics not yet applied to promising methods (at least 3)
4. Methodological gaps: limitations in current approaches that need addressing
5. Application gaps: domains where existing methods haven't been applied

Be thorough and specific. Each gap should be actionable — a researcher should be able to start a project based on it.

Return JSON:
{
  "gaps": [{"description": "...", "evidence": "...", "potential_impact": "high|medium|low"}],
  "underexplored": [{"combination": "...", "why_promising": "..."}],
  "missing_evaluations": [{"method": "...", "missing": "..."}]
}

Return ONLY valid JSON.`;
}

/**
 * Build report generation prompt.
 */
export function buildReportPrompt(
  direction: string,
  papers: AnalyzedPaper[],
  gapAnalysis: { gaps: { description: string }[]; underexplored: { combination: string }[] } | null,
): string {
  // Build numbered source list
  const numberedSources = papers
    .slice(0, 30) // Limit to top 30 for context window
    .map((p, i) => {
      const authors = p.authors.slice(0, 3).join(", ");
      return `[${i + 1}] ${authors} (${p.year ?? "n.d."}). "${p.title}". ${p.venue || ""}. ${p.tldrEn || ""}`;
    })
    .join("\n");

  const gapsSummary = gapAnalysis
    ? `\n已识别的研究空白:\n${gapAnalysis.gaps.map(g => `- ${g.description}`).join("\n")}\n已识别的未探索组合:\n${gapAnalysis.underexplored.map(u => `- ${u.combination}`).join("\n")}`
    : "";

  return `Write a comprehensive literature review on "${direction}" in Chinese (中文).

The review should include these sections:
1. 概述 (Overview) — 2-3 paragraphs introducing the field
2. 方法论综述 (Methodology Review) — main approaches and their evolution
3. 关键发现 (Key Findings) — important results and contributions
4. 研究空白与未来方向 (Gaps and Future Directions) — what's missing and what's next

${gapsSummary}

Sources (use [1], [2], etc. for inline citations):
${numberedSources}

Rules:
- Write in Chinese (中文)
- Use [1], [2], ..., [n] inline to cite sources
- Every factual claim MUST have at least one citation
- Write analytical prose, NOT bullet points
- Each section should be 2-4 paragraphs
- Use ## for section headings
- Do NOT include a separate References section (it will be added automatically)

Return the complete review text with inline citations.`;
}
