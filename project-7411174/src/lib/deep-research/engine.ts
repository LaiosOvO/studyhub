/**
 * Client-side deep research engine.
 *
 * Orchestrates the full pipeline: search → expand → score → analyze →
 * classify → detect_gaps → generate_report.
 *
 * All API calls (OpenAlex + LLM) run directly from the browser.
 */

import type {
  AnalyzedPaper,
  GapAnalysis,
  LLMConfig,
  PaperRelationship,
  PipelinePhase,
  PipelineProgress,
  PipelineResult,
  ResearchConfig,
  ResearchReport,
  ScoredPaper,
} from "./types";
import { chatCompletion, parseJsonResponse } from "./llm-client";
import { expandCitations, searchPapers } from "./paper-search";
import { scorePapers } from "./scoring";
import {
  buildBatchAnalysisPrompt,
  buildGapDetectionPrompt,
  buildRelationshipPrompt,
  buildReportPrompt,
} from "./prompts";

export type ProgressCallback = (progress: PipelineProgress) => void;

/**
 * Run the full deep research pipeline on the client.
 * Throws on unrecoverable errors; individual step failures are graceful.
 */
export async function runDeepResearch(
  config: ResearchConfig,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
): Promise<PipelineResult> {
  const llm = config.llm;
  let papersFound = 0;
  let papersAnalyzed = 0;

  const emit = (phase: PipelinePhase, activity: string, error: string | null = null) => {
    onProgress({
      phase,
      papersFound,
      papersAnalyzed,
      totalPapers: papersFound,
      currentActivity: activity,
      error,
    });
  };

  const checkAbort = () => {
    if (signal?.aborted) throw new Error("用户取消了研究任务");
  };

  try {
    // ── Phase 1: Search ──────────────────────────────────────────
    emit("searching", "正在搜索学术论文...");
    const searchResults = await searchPapers({
      query: config.direction,
      maxResults: config.maxPapers,
      yearFrom: config.yearFrom,
      yearTo: config.yearTo,
      onProgress: (msg) => emit("searching", msg),
    });
    papersFound = searchResults.length;
    emit("searching", `搜索完成: 找到 ${papersFound} 篇论文`);
    checkAbort();

    if (searchResults.length === 0) {
      throw new Error("未找到相关论文，请尝试调整搜索关键词");
    }

    // ── Phase 2: Expand Citations ────────────────────────────────
    emit("expanding", "正在扩展引用网络...");
    let allPapers = [...searchResults];

    if (config.depth >= 2) {
      const expanded = await expandCitations({
        papers: searchResults,
        maxNew: Math.min(config.maxPapers - searchResults.length, 50),
        onProgress: (msg) => emit("expanding", msg),
      });
      allPapers = [...searchResults, ...expanded];
      papersFound = allPapers.length;
    }
    emit("expanding", `引用网络扩展完成: 共 ${papersFound} 篇论文`);
    checkAbort();

    // ── Phase 3: Score ───────────────────────────────────────────
    emit("scoring", "正在计算质量评分...");
    const scored = scorePapers(allPapers);
    emit("scoring", `评分完成: 最高分 ${scored[0]?.qualityScore.toFixed(3)}`);
    checkAbort();

    // ── Phase 4: Analyze (LLM) ──────────────────────────────────
    emit("analyzing", "正在用 AI 分析论文...");
    const topPapers = scored.slice(0, Math.min(30, scored.length)); // Analyze top 30
    const analyzed = await analyzePapers(llm, topPapers, (msg) => {
      papersAnalyzed = parseInt(msg.match(/(\d+)/)?.[1] || "0") || papersAnalyzed;
      emit("analyzing", msg);
    });
    papersAnalyzed = analyzed.length;
    emit("analyzing", `分析完成: ${papersAnalyzed} 篇论文`);
    checkAbort();

    // ── Phase 5: Classify Relationships (LLM) ────────────────────
    emit("classifying", "正在分类论文间关系...");
    const relationships = await classifyRelationships(llm, analyzed, (msg) =>
      emit("classifying", msg),
    );
    emit("classifying", `关系分类完成: ${relationships.length} 对关系`);
    checkAbort();

    // ── Phase 6: Detect Gaps (LLM) ──────────────────────────────
    emit("detecting_gaps", "正在识别研究空白...");
    let gapAnalysis: GapAnalysis | null = null;
    try {
      gapAnalysis = await detectGaps(llm, config.direction, analyzed);
    } catch (err) {
      emit("detecting_gaps", `空白检测失败: ${err instanceof Error ? err.message : String(err)}`);
    }
    emit("detecting_gaps", "研究空白识别完成");
    checkAbort();

    // ── Phase 7: Generate Report (LLM) ──────────────────────────
    emit("generating_report", "正在生成文献综述报告...");
    let report: ResearchReport | null = null;
    try {
      report = await generateReport(llm, config.direction, analyzed, gapAnalysis);
    } catch (err) {
      emit("generating_report", `报告生成失败: ${err instanceof Error ? err.message : String(err)}`);
    }
    emit("generating_report", "报告生成完成");

    // ── Done ─────────────────────────────────────────────────────
    emit("completed", "深度研究完成！");

    return {
      papers: analyzed,
      relationships,
      gapAnalysis,
      report,
      totalPapers: papersFound,
      analyzedPapers: papersAnalyzed,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    emit("failed", errorMsg, errorMsg);
    throw err;
  }
}

// ── Internal pipeline steps ──────────────────────────────────────

/**
 * Analyze papers in batches via LLM.
 * Processes 5 papers per LLM call for efficiency.
 */
async function analyzePapers(
  llm: LLMConfig,
  papers: ScoredPaper[],
  onProgress: (msg: string) => void,
): Promise<AnalyzedPaper[]> {
  const analyzed: AnalyzedPaper[] = [];
  const batchSize = 5;

  for (let i = 0; i < papers.length; i += batchSize) {
    const batch = papers.slice(i, i + batchSize);
    onProgress(`正在分析第 ${i + 1}-${Math.min(i + batchSize, papers.length)} 篇（共 ${papers.length} 篇）`);

    try {
      const prompt = buildBatchAnalysisPrompt(batch);
      const response = await chatCompletion(llm, [{ role: "user", content: prompt }]);
      const results = parseJsonResponse<
        { index: number; tldr_en: string; tldr_zh: string; methods: string[]; datasets: string[]; paper_type: string }[]
      >(response);

      for (let j = 0; j < batch.length; j++) {
        const r = results[j] || {
          tldr_en: batch[j].title,
          tldr_zh: batch[j].title,
          methods: [],
          datasets: [],
          paper_type: "unknown",
        };
        analyzed.push({
          ...batch[j],
          tldrEn: r.tldr_en || batch[j].title,
          tldrZh: r.tldr_zh || batch[j].title,
          methods: r.methods || [],
          datasets: r.datasets || [],
          paperType: r.paper_type || "unknown",
        });
      }
    } catch (err) {
      // On LLM failure, add papers with minimal analysis
      for (const paper of batch) {
        analyzed.push({
          ...paper,
          tldrEn: paper.title,
          tldrZh: paper.title,
          methods: [],
          datasets: [],
          paperType: "unknown",
        });
      }
      onProgress(`批次 ${i / batchSize + 1} 分析失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return analyzed;
}

/**
 * Classify relationships between citation-connected paper pairs.
 * Only processes pairs with actual citation links (not O(n^2)).
 */
async function classifyRelationships(
  llm: LLMConfig,
  papers: AnalyzedPaper[],
  onProgress: (msg: string) => void,
): Promise<PaperRelationship[]> {
  const paperMap = new Map(papers.map(p => [p.id, p]));
  const relationships: PaperRelationship[] = [];

  // Find citation-connected pairs
  const pairs: { a: AnalyzedPaper; b: AnalyzedPaper }[] = [];
  for (const paper of papers) {
    for (const refId of paper.referenceIds.slice(0, 5)) {
      const ref = paperMap.get(refId);
      if (ref) pairs.push({ a: ref, b: paper });
    }
  }

  if (pairs.length === 0) return [];

  // Process in batches of 5
  const batchSize = 5;
  for (let i = 0; i < Math.min(pairs.length, 30); i += batchSize) {
    const batch = pairs.slice(i, i + batchSize);
    onProgress(`分类第 ${i + 1}-${Math.min(i + batchSize, pairs.length)} 对关系`);

    try {
      const prompt = buildRelationshipPrompt(batch);
      const response = await chatCompletion(llm, [{ role: "user", content: prompt }]);
      const results = parseJsonResponse<
        { index: number; relationship: string; confidence: number; explanation: string }[]
      >(response);

      for (let j = 0; j < batch.length; j++) {
        const r = results[j];
        if (r) {
          relationships.push({
            sourceId: batch[j].a.id,
            targetId: batch[j].b.id,
            relationship: r.relationship,
            confidence: r.confidence,
            explanation: r.explanation,
          });
        }
      }
    } catch {
      onProgress(`批次 ${i / batchSize + 1} 关系分类失败，跳过`);
    }
  }

  return relationships;
}

/**
 * Detect research gaps in the analyzed corpus.
 */
async function detectGaps(
  llm: LLMConfig,
  direction: string,
  papers: AnalyzedPaper[],
): Promise<GapAnalysis> {
  const prompt = buildGapDetectionPrompt(direction, papers);
  const response = await chatCompletion(llm, [{ role: "user", content: prompt }], {
    maxTokens: 2048,
  });

  const result = parseJsonResponse<{
    gaps: { description: string; evidence: string; potential_impact: string }[];
    underexplored: { combination: string; why_promising: string }[];
    missing_evaluations: { method: string; missing: string }[];
  }>(response);

  return {
    gaps: result.gaps || [],
    underexplored: result.underexplored || [],
    missingEvaluations: result.missing_evaluations || [],
  };
}

/**
 * Generate literature review report in multiple LLM calls to stay within context limits.
 *
 * Strategy: split into 3 calls:
 *   1. Overview + Methodology (papers 1-10)
 *   2. Key Findings (papers 11-20)
 *   3. Gaps & Future Directions (papers 21-30 + gap analysis)
 * Then combine into one report.
 */
async function generateReport(
  llm: LLMConfig,
  direction: string,
  papers: AnalyzedPaper[],
  gapAnalysis: GapAnalysis | null,
): Promise<ResearchReport> {
  const topPapers = papers.slice(0, 30);
  const chunkSize = 10;
  const chunks: AnalyzedPaper[][] = [];
  for (let i = 0; i < topPapers.length; i += chunkSize) {
    chunks.push(topPapers.slice(i, i + chunkSize));
  }

  const formatSources = (chunk: AnalyzedPaper[], offset: number) =>
    chunk.map((p, i) => {
      const authors = p.authors.slice(0, 3).join(", ");
      return `[${offset + i + 1}] ${authors} (${p.year ?? "n.d."}). "${p.title}". ${p.venue || ""}. ${p.tldrEn || ""}`;
    }).join("\n");

  // ── Call 1: Overview + Methodology (papers 1-10) ──
  const call1Prompt = `你是一位学术文献综述专家。请为研究方向"${direction}"撰写文献综述的前两个章节。

## 要求
1. **概述** — 2-3 段介绍该领域的背景、发展和重要性
2. **方法论综述** — 2-3 段总结主要方法和技术路线的演进

## 参考文献（使用 [n] 引用）
${formatSources(chunks[0] || [], 0)}

## 规则
- 用中文撰写
- 使用 [1], [2] 等行内引用
- 每个事实性陈述必须有引用
- 用 ## 作为章节标题
- 写分析性散文，不要用列表`;

  const part1 = await chatCompletion(llm, [{ role: "user", content: call1Prompt }], {
    maxTokens: 4096,
    temperature: 0.4,
  });

  // ── Call 2: Key Findings (papers 11-20) ──
  let part2 = "";
  if (chunks.length > 1) {
    const call2Prompt = `你是一位学术文献综述专家，正在为"${direction}"撰写文献综述。

前文已写好概述和方法论综述，现在请撰写：
3. **关键发现** — 2-3 段总结该领域的重要研究成果和贡献

## 已写内容摘要
${part1.slice(0, 500)}...

## 本节参考文献（使用 [n] 引用）
${formatSources(chunks[1], chunkSize)}

## 规则
- 用中文撰写
- 使用 [11], [12] 等行内引用（编号延续前文）
- 每个事实性陈述必须有引用
- 用 ## 作为章节标题
- 写分析性散文，不要用列表`;

    part2 = await chatCompletion(llm, [{ role: "user", content: call2Prompt }], {
      maxTokens: 4096,
      temperature: 0.4,
    });
  }

  // ── Call 3: Gaps & Future Directions (papers 21-30 + gap analysis) ──
  const gapsSummary = gapAnalysis
    ? `\n## 已识别的研究空白\n${gapAnalysis.gaps.map(g => `- ${g.description}`).join("\n")}\n## 已识别的未探索组合\n${gapAnalysis.underexplored.map(u => `- ${u.combination}`).join("\n")}`
    : "";

  const call3Sources = chunks.length > 2 ? formatSources(chunks[2], chunkSize * 2) : formatSources(chunks[0] || [], 0);

  const call3Prompt = `你是一位学术文献综述专家，正在为"${direction}"撰写文献综述。

前文已写好概述、方法论综述和关键发现，现在请撰写最后一节：
4. **研究空白与未来方向** — 2-3 段分析当前研究的不足和未来机会
${gapsSummary}

## 本节参考文献（使用 [n] 引用）
${call3Sources}

## 规则
- 用中文撰写
- 使用行内引用 [n]
- 每个事实性陈述必须有引用
- 用 ## 作为章节标题
- 写分析性散文，不要用列表
- 结合上述已识别的研究空白进行分析`;

  const part3 = await chatCompletion(llm, [{ role: "user", content: call3Prompt }], {
    maxTokens: 4096,
    temperature: 0.4,
  });

  // ── Combine ──
  const fullReport = [part1, part2, part3].filter(Boolean).join("\n\n");

  const references = topPapers
    .map((p, i) => {
      const authors = p.authors.slice(0, 3).join(", ");
      const et = p.authors.length > 3 ? " et al." : "";
      return `[${i + 1}] ${authors}${et} (${p.year ?? "n.d."}). "${p.title}". ${p.venue || ""}`;
    })
    .join("\n");

  return {
    overview: fullReport,
    methodology: "",
    findings: "",
    gaps: "",
    references,
  };
}

/**
 * Regenerate report from existing analyzed papers (no re-search needed).
 * Used when report generation failed or user wants to retry.
 */
export async function regenerateReportFromResult(
  direction: string,
  papers: AnalyzedPaper[],
  gapAnalysis: GapAnalysis | null,
): Promise<ResearchReport> {
  const llm = getLLMConfig();
  if (!llm) throw new Error("LLM 未配置。请在设置页面配置 API Key。");
  return generateReport(llm, direction, papers, gapAnalysis);
}

/**
 * Get LLM config from localStorage.
 * Returns null if not configured.
 */
export function getLLMConfig(): LLMConfig | null {
  const apiKey = localStorage.getItem("studyhub_llm_api_key") || "";
  const apiBase = localStorage.getItem("studyhub_llm_api_base") || "";
  const model = localStorage.getItem("studyhub_llm_model") || "";
  const maxContextTokens = parseInt(localStorage.getItem("studyhub_llm_max_tokens") || "32000", 10);

  if (!apiKey || !apiBase || !model) return null;
  return { apiKey, apiBase, model, maxContextTokens };
}
