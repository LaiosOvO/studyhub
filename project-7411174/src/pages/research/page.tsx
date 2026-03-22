import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { plansApi } from "../../lib/api";
import Navbar from "../../components/feature/Navbar";
import {
  runDeepResearch,
  getLLMConfig,
  regenerateReportFromResult,
  type PipelineProgress,
  type PipelineResult,
  type PipelinePhase,
  type ResearchConfig,
} from "../../lib/deep-research";

/** Strip <think>...</think> blocks from LLM output */
function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

type Step = "config" | "progress" | "complete";

/** Pipeline phases mapped to UI labels */
const PIPELINE_STAGES: { key: string; label: string; icon: string }[] = [
  { key: "searching", label: "搜索论文", icon: "ri-search-line" },
  { key: "expanding", label: "扩展引用", icon: "ri-git-branch-line" },
  { key: "scoring", label: "质量评分", icon: "ri-star-line" },
  { key: "analyzing", label: "AI 分析", icon: "ri-robot-line" },
  { key: "classifying", label: "分类聚类", icon: "ri-bubble-chart-line" },
  { key: "detecting_gaps", label: "检测空白", icon: "ri-lightbulb-line" },
  { key: "generating_report", label: "生成报告", icon: "ri-file-chart-line" },
];

const SOURCE_OPTIONS = ["openalex"];
const SOURCE_LABELS: Record<string, string> = {
  openalex: "OpenAlex",
};

interface ConfigState {
  direction: string;
  depth: number;
  maxPapers: number;
  sources: string[];
  yearFrom: number;
  yearTo: number;
  languages: string[];
}

// ── ConfigStep ──────────────────────────────────────────────────────────────
function ConfigStep({ onStart, isSubmitting }: { onStart: (config: ConfigState) => void; isSubmitting: boolean }) {
  const [searchParams] = useSearchParams();
  const directionParam = searchParams.get("direction") || "";
  const paperParam = searchParams.get("paper") || "";
  const initialDirection = directionParam || paperParam;

  const [config, setConfig] = useState<ConfigState>({
    direction: initialDirection,
    depth: 2,
    maxPapers: 50,
    sources: ["openalex"],
    yearFrom: 2018,
    yearTo: 2026,
    languages: ["en", "zh"],
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const toggleLanguage = (lang: string) => {
    setConfig((c) => {
      if (lang === "all") return { ...c, languages: ["en", "zh"] };
      return { ...c, languages: [lang] };
    });
  };

  const currentLang = config.languages.length >= 2 ? "all" : config.languages[0] || "all";

  // Check if LLM is configured
  const llmConfig = getLLMConfig();
  const llmReady = !!llmConfig;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent-cyan/30 bg-accent-cyan/[0.08] mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
          <span className="text-xs font-medium text-accent-cyan">深度研究 (本地模式)</span>
        </div>
        <h1 className="text-3xl font-bold text-text-primary mb-3">配置你的研究任务</h1>
        <p className="text-text-secondary">AI 将在浏览器中直接搜索、分析论文并生成文献综述</p>
      </div>

      {/* LLM Config Warning */}
      {!llmReady && (
        <div className="p-4 rounded-xl bg-amber-400/[0.08] border border-amber-400/20 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <i className="ri-alert-line text-amber-400" />
            <span className="text-sm font-medium text-amber-300">需要配置 LLM</span>
          </div>
          <p className="text-xs text-amber-300/70 mb-3">
            深度研究需要 LLM API 进行论文分析和报告生成。请先在设置页面配置你的 API Key。
          </p>
          <a
            href="/settings"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-300 text-xs font-medium hover:bg-amber-400/20 transition-colors"
          >
            <i className="ri-settings-3-line" /> 前往设置
          </a>
        </div>
      )}

      <div className="glass rounded-2xl p-8 border border-white/[0.06] space-y-6">
        {/* Research Direction */}
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-2">
            研究方向 <span className="text-red-400">*</span>
          </label>
          <textarea
            className="w-full bg-bg-primary/60 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent-cyan/50 transition-colors"
            rows={2}
            value={config.direction}
            onChange={(e) => setConfig({ ...config, direction: e.target.value })}
            placeholder="输入研究方向，例如：大语言模型在医疗影像中的应用"
          />
        </div>

        {/* Quick Start Hint */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-accent-cyan/[0.05] border border-accent-cyan/20">
          <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-accent-cyan/10 flex-shrink-0">
            <i className="ri-rocket-line text-accent-cyan" />
          </span>
          <div>
            <p className="text-sm font-medium text-text-primary">浏览器端运行</p>
            <p className="text-xs text-text-muted">论文搜索通过 OpenAlex API，分析和报告生成使用你配置的 LLM</p>
          </div>
        </div>

        {/* Advanced Config Toggle */}
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-accent-cyan transition-colors cursor-pointer"
        >
          <span className="w-4 h-4 flex items-center justify-center">
            <i className={advancedOpen ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} />
          </span>
          {advancedOpen ? "收起高级配置" : "展开高级配置"}
        </button>

        {advancedOpen && (
          <div className="space-y-5 pt-2 border-t border-white/[0.06] animate-fade-in">
            {/* Depth + Max Papers */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">引用扩展深度：{config.depth} 层</label>
                <input type="range" min={1} max={3} value={config.depth}
                  onChange={(e) => setConfig({ ...config, depth: parseInt(e.target.value) })}
                  className="w-full h-1 accent-[#00D4B8] cursor-pointer" />
                <div className="flex justify-between text-[10px] text-text-muted mt-1"><span>浅（1层）</span><span>深（3层）</span></div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">最大论文数：{config.maxPapers}</label>
                <input type="range" min={10} max={200} step={10} value={config.maxPapers}
                  onChange={(e) => setConfig({ ...config, maxPapers: parseInt(e.target.value) })}
                  className="w-full h-1 accent-[#00D4B8] cursor-pointer" />
                <div className="flex justify-between text-[10px] text-text-muted mt-1"><span>10篇</span><span>200篇</span></div>
              </div>
            </div>

            {/* Data Sources */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-3">数据来源</label>
              <div className="flex flex-wrap gap-2">
                {SOURCE_OPTIONS.map((s) => (
                  <button key={s}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-accent-cyan/10 border-accent-cyan/40 text-accent-cyan cursor-default"
                  >{SOURCE_LABELS[s] || s}</button>
                ))}
                <span className="px-3 py-1.5 text-xs text-text-muted">（浏览器端仅支持 OpenAlex）</span>
              </div>
            </div>

            {/* Year Range */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-3">
                时间范围：{config.yearFrom} – {config.yearTo}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input type="range" min={2000} max={2026} value={config.yearFrom}
                  onChange={(e) => setConfig({ ...config, yearFrom: parseInt(e.target.value) })}
                  className="w-full h-1 accent-[#00D4B8] cursor-pointer" />
                <input type="range" min={2000} max={2026} value={config.yearTo}
                  onChange={(e) => setConfig({ ...config, yearTo: parseInt(e.target.value) })}
                  className="w-full h-1 accent-[#00D4B8] cursor-pointer" />
              </div>
            </div>

            {/* Language */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">语言偏好</label>
              <div className="flex gap-2">
                {[{ k: "all", l: "全部" }, { k: "en", l: "英文" }, { k: "zh", l: "中文" }].map(({ k, l }) => (
                  <button key={k} onClick={() => toggleLanguage(k)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                      currentLang === k ? "bg-accent-cyan text-bg-primary" : "bg-white/[0.04] text-text-secondary hover:bg-white/[0.08]"
                    }`}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Start Button */}
        <button
          onClick={() => onStart(config)}
          disabled={!config.direction.trim() || isSubmitting || !llmReady}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-base font-semibold bg-accent-cyan text-bg-primary hover:bg-accent-cyan-dim disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap cyan-glow"
        >
          {isSubmitting ? (
            <>
              <i className="ri-loader-4-line animate-spin" />
              启动研究中...
            </>
          ) : (
            <>
              <span className="w-5 h-5 flex items-center justify-center"><i className="ri-rocket-line" /></span>
              开始深度研究
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── ProgressStep ──────────────────────────────────────────────────────────────
interface ProgressLog { time: string; text: string; type: "info" | "success" | "warn" | "error" }

function ProgressStep({
  progress,
  logs,
  direction,
  onCancel,
}: {
  progress: PipelineProgress;
  logs: ProgressLog[];
  direction: string;
  onCancel: () => void;
}) {
  const [logsOpen, setLogsOpen] = useState(false);

  const phaseLabel = (phase: string): string => {
    const found = PIPELINE_STAGES.find((s) => s.key === phase);
    return found?.label ?? phase;
  };

  const currentStageIdx = PIPELINE_STAGES.findIndex((s) => s.key === progress.phase);
  const isComplete = progress.phase === "completed";
  const isFailed = progress.phase === "failed";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-text-primary">
          {isComplete ? "研究完成" : isFailed ? "任务失败" : "研究任务进行中"}
        </h1>
        <p className="text-text-secondary text-sm truncate max-w-lg mx-auto mt-2">{direction}</p>
        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-cyan/[0.08] border border-accent-cyan/20">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
          <span className="text-[10px] font-medium text-accent-cyan">本地运行中</span>
        </div>
      </div>

      {/* Pipeline Stages Bar */}
      <div className="glass rounded-2xl p-5 border border-white/[0.06] mb-6">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {PIPELINE_STAGES.map((stage, i) => {
            const isDone = isComplete || (currentStageIdx >= 0 && i < currentStageIdx);
            const isActive = !isComplete && !isFailed && i === currentStageIdx;
            return (
              <div key={stage.key} className="flex items-center flex-shrink-0">
                <div className="flex flex-col items-center gap-2 px-3">
                  <div className={`w-9 h-9 flex items-center justify-center rounded-full border-2 transition-all duration-500 ${
                    isDone ? "bg-accent-cyan border-accent-cyan text-bg-primary" :
                    isActive ? "border-accent-cyan text-accent-cyan" :
                    "border-white/[0.12] text-text-muted"
                  }`}>
                    {isDone
                      ? <i className="ri-check-line text-sm" />
                      : <i className={`${stage.icon} text-sm ${isActive ? "animate-pulse" : ""}`} />
                    }
                  </div>
                  <span className={`text-[10px] whitespace-nowrap ${
                    isDone ? "text-accent-cyan" : isActive ? "text-text-primary font-medium" : "text-text-muted"
                  }`}>{stage.label}</span>
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <div className={`h-px w-8 flex-shrink-0 transition-all duration-700 ${
                    isDone && !isActive ? "bg-accent-cyan" : "bg-white/[0.08]"
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Left - Activity & Phase Details */}
        <div className="flex-1 min-w-0">
          {/* Current Activity */}
          <div className="glass rounded-xl border border-white/[0.06] p-6 mb-4">
            <div className="flex items-center gap-3 mb-4">
              {!isComplete && !isFailed && (
                <div className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-accent-cyan bg-accent-cyan/10">
                  <i className="ri-loader-4-line text-accent-cyan animate-spin text-lg" />
                </div>
              )}
              {isComplete && (
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-green-400/10 border-2 border-green-400">
                  <i className="ri-check-double-line text-green-400 text-lg" />
                </div>
              )}
              {isFailed && (
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-red-400/10 border-2 border-red-400">
                  <i className="ri-error-warning-line text-red-400 text-lg" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-text-primary">
                  {isComplete ? "所有阶段已完成" : isFailed ? "任务执行失败" : phaseLabel(progress.phase)}
                </h3>
                <p className="text-xs text-text-secondary truncate">
                  {progress.currentActivity || (isComplete ? "研究数据已就绪" : "等待中...")}
                </p>
              </div>
              {!isComplete && !isFailed && (
                <button
                  onClick={onCancel}
                  className="px-3 py-1.5 rounded-lg border border-red-400/20 text-red-400 text-xs font-medium hover:bg-red-400/10 transition-colors"
                >
                  取消
                </button>
              )}
            </div>

            {/* Progress bar */}
            {!isComplete && !isFailed && (
              <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent-cyan transition-all duration-1000"
                  style={{
                    width: currentStageIdx >= 0
                      ? `${((currentStageIdx + 0.5) / PIPELINE_STAGES.length) * 100}%`
                      : "5%",
                  }}
                />
              </div>
            )}
            {isComplete && <div className="h-1.5 rounded-full bg-green-400" />}
            {isFailed && (
              <>
                <div className="h-1.5 rounded-full bg-red-400/50" />
                {progress.error && (
                  <div className="mt-3 p-3 rounded-lg bg-red-400/[0.08] border border-red-400/20">
                    <p className="text-xs text-red-300">{progress.error}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Phase History Timeline */}
          <div className="glass rounded-xl border border-white/[0.06] p-5 mb-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-4">
              <i className="ri-list-check text-accent-cyan" />
              阶段进度
            </h3>
            <div className="space-y-3">
              {PIPELINE_STAGES.map((stage, i) => {
                const isDone = isComplete || (currentStageIdx >= 0 && i < currentStageIdx);
                const isActive = !isComplete && !isFailed && i === currentStageIdx;
                return (
                  <div key={stage.key} className="flex items-center gap-3">
                    <div className={`w-6 h-6 flex items-center justify-center rounded-full border transition-all flex-shrink-0 ${
                      isDone ? "bg-accent-cyan border-accent-cyan text-bg-primary" :
                      isActive ? "border-accent-cyan text-accent-cyan border-2" :
                      "border-white/[0.12] text-text-muted"
                    }`}>
                      {isDone ? (
                        <i className="ri-check-line text-[10px]" />
                      ) : isActive ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
                      ) : (
                        <span className="text-[9px] font-mono">{i + 1}</span>
                      )}
                    </div>
                    <span className={`text-xs ${
                      isDone ? "text-accent-cyan" :
                      isActive ? "text-text-primary font-medium" :
                      "text-text-muted"
                    }`}>
                      {stage.label}
                    </span>
                    {isActive && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan ml-auto">
                        进行中
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Log Panel */}
          <div className="glass rounded-xl border border-white/[0.06]">
            <button
              onClick={() => setLogsOpen(!logsOpen)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 flex items-center justify-center"><i className="ri-terminal-line" /></span>
                详细日志
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/[0.08] text-text-muted font-mono">{logs.length}</span>
              </span>
              <i className={logsOpen ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} />
            </button>
            {logsOpen && (
              <div className="border-t border-white/[0.06] p-3 max-h-52 overflow-y-auto space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[10px] text-text-muted font-mono flex-shrink-0">{log.time}</span>
                    <span className={`text-xs leading-relaxed ${
                      log.type === "success" ? "text-green-400" :
                      log.type === "warn" ? "text-amber-400" :
                      log.type === "error" ? "text-red-400" :
                      "text-text-secondary"
                    }`}>{log.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right - Live Stats */}
        <div className="w-56 flex-shrink-0 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">实时统计</h2>
          {[
            { icon: "ri-article-line", value: progress.papersFound.toLocaleString(), label: "已发现论文", color: "text-accent-cyan" },
            { icon: "ri-robot-line", value: progress.papersAnalyzed.toLocaleString(), label: "已深度分析", color: "text-green-400" },
            { icon: "ri-database-2-line", value: progress.totalPapers.toLocaleString(), label: "总论文数", color: "text-text-secondary" },
          ].map((stat) => (
            <div key={stat.label} className="glass rounded-xl p-4 border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-5 h-5 flex items-center justify-center ${stat.color}`}>
                  <i className={`${stat.icon} text-sm`} />
                </span>
                <span className="text-[10px] text-text-muted">{stat.label}</span>
              </div>
              <div className={`text-xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── CompleteStep ──────────────────────────────────────────────────────────────
function CompleteStep({
  result,
  direction,
  onNewResearch,
  onResultUpdate,
}: {
  result: PipelineResult;
  direction: string;
  onNewResearch: () => void;
  onResultUpdate: (r: PipelineResult) => void;
}) {
  const navigate = useNavigate();
  const [showReport, setShowReport] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [generatingPlans, setGeneratingPlans] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planCount, setPlanCount] = useState(3);
  // Load previously generated plans from localStorage keyed by direction
  const plansStorageKey = `studyhub_generated_plans_${direction.slice(0, 60)}`;
  const [generatedPlans, setGeneratedPlans] = useState<Array<{
    id: string;
    title: string;
    researchQuestion: string;
    methodology: string;
    innovation: string;
    expectedContribution: string;
    difficulty: string;
    difficultyReason: string;
    estimatedTime: string;
    datasets: string[];
    saved: boolean;
  }>>(() => {
    try {
      const stored = localStorage.getItem(plansStorageKey);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Auto-persist generated plans to localStorage
  useEffect(() => {
    if (generatedPlans.length > 0) {
      localStorage.setItem(plansStorageKey, JSON.stringify(generatedPlans));
    }
  }, [generatedPlans, plansStorageKey]);

  // Show plans section if we have persisted plans
  useEffect(() => {
    if (generatedPlans.length > 0 && !showPlans) {
      setShowPlans(true);
    }
  }, []);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setRegenError(null);
    try {
      const report = await regenerateReportFromResult(direction, result.papers, result.gapAnalysis);
      const updated = { ...result, report };
      onResultUpdate(updated);
      setShowReport(true);
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : String(err));
    } finally {
      setRegenerating(false);
    }
  };

  const handleGeneratePlans = async () => {
    setGeneratingPlans(true);
    setPlanError(null);
    try {
      const llm = getLLMConfig();
      if (!llm) throw new Error("请先在设置中配置 LLM");

      const { chatCompletion, parseJsonResponse } = await import("../../lib/deep-research/llm-client");

      // Build concise context from gap analysis + top papers
      const gaps = result.gapAnalysis?.gaps.map(g => `- ${g.description} (影响: ${g.potential_impact})`).join("\n") || "无";
      const underexplored = result.gapAnalysis?.underexplored.map(u => `- ${u.combination}: ${u.why_promising}`).join("\n") || "无";
      const topPapers = result.papers.slice(0, 10).map((p, i) =>
        `[${i + 1}] ${p.title} (${p.year}) — ${p.tldrZh || p.tldrEn}`
      ).join("\n");

      // Generate plans one at a time to stay within token limits
      const planContext = `研究方向: "${direction}"

## 已识别的研究空白
${gaps}

## 未探索的方法组合
${underexplored}

## 核心论文
${topPapers}`;

      const plans: Array<{
        title: string;
        research_question: string;
        methodology: string;
        innovation: string;
        expected_contribution: string;
        difficulty: string;
        difficulty_reason: string;
        estimated_time: string;
        datasets: string[];
        key_references: number[];
      }> = [];

      const previousTitles: string[] = [];
      let failedCount = 0;

      for (let planIdx = 0; planIdx < planCount; planIdx++) {
        setPlanError(null);
        setGeneratingPlans(true);
        // Show progress to user
        setPlanError(`正在生成第 ${planIdx + 1}/${planCount} 个方案...`);

        const avoidText = previousTitles.length > 0
          ? `\n\n注意：已有方案"${previousTitles.join("、")}"，请生成完全不同角度、不同方法的方案。不要重复已有方案的思路。`
          : "";

        const prompt = `你是一位资深科研顾问。基于以下信息生成第 ${planIdx + 1} 个研究方案。

${planContext}${avoidText}

返回一个 JSON 对象（不是数组）：
{"title":"方案标题","research_question":"要回答什么问题","methodology":"具体技术方案","innovation":"与现有工作的区别","expected_contribution":"学术和实际价值","difficulty":"高|中|低","difficulty_reason":"理由","estimated_time":"预计时间","datasets":["数据集"],"key_references":[1,2]}

只返回 JSON，不要其他文本。`;

        try {
          // Small delay between requests to avoid rate limiting
          if (planIdx > 0) await new Promise(r => setTimeout(r, 1000));
          const response = await chatCompletion(llm, [{ role: "user", content: prompt }], {
            maxTokens: 2048,
            temperature: 0.7,
          });
          const plan = parseJsonResponse<typeof plans[0]>(stripThink(response));
          plans.push(plan);
          previousTitles.push(plan.title);
        } catch (err) {
          console.warn(`方案 ${planIdx + 1} 生成失败:`, err);
          failedCount++;
        }
      }
      if (failedCount > 0 && plans.length > 0) {
        setPlanError(`${plans.length} 个方案生成成功，${failedCount} 个失败`);
      } else {
        setPlanError(null);
      }

      if (plans.length === 0) throw new Error("所有方案生成均失败");

      setGeneratedPlans(plans.map((p, i) => ({
        id: `local_plan_${Date.now()}_${i}`,
        title: p.title,
        researchQuestion: p.research_question,
        methodology: p.methodology,
        innovation: p.innovation,
        expectedContribution: p.expected_contribution,
        difficulty: p.difficulty,
        difficultyReason: p.difficulty_reason,
        estimatedTime: p.estimated_time,
        datasets: p.datasets || [],
        saved: false,
      })));
      setShowPlans(true);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingPlans(false);
    }
  };

  const handleSavePlan = async (planId: string) => {
    const plan = generatedPlans.find(p => p.id === planId);
    if (!plan || plan.saved) return;

    // Save to backend API
    try {
      await plansApi.create({
        title: plan.title,
        hypothesis: plan.researchQuestion,
        method_description: plan.methodology,
        datasets: plan.datasets,
        difficulty: plan.difficulty,
        estimated_time: plan.estimatedTime,
        direction,
      });
    } catch (err) {
      console.warn("后端保存失败，仅保存到本地:", err);
    }

    // Also save to localStorage as fallback
    const toSave = {
      ...plan,
      direction,
      createdAt: new Date().toISOString(),
      status: "draft" as const,
    };
    const existing = JSON.parse(localStorage.getItem("studyhub_local_plans") || "[]");
    existing.unshift(toSave);
    localStorage.setItem("studyhub_local_plans", JSON.stringify(existing.slice(0, 50)));

    setGeneratedPlans(prev => prev.map(p => p.id === planId ? { ...p, saved: true } : p));
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-full bg-accent-cyan/10 border-2 border-accent-cyan flex items-center justify-center mx-auto mb-6">
          <i className="ri-check-double-line text-3xl text-accent-cyan" />
        </div>
        <h1 className="text-3xl font-bold text-text-primary mb-3">研究任务完成！</h1>
        <p className="text-text-secondary">
          已分析 {result.analyzedPapers} 篇论文，发现 {result.totalPapers} 篇相关文献
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6 max-w-lg mx-auto">
        {[
          { icon: "ri-article-line", value: String(result.totalPapers), label: "发现论文" },
          { icon: "ri-robot-line", value: String(result.analyzedPapers), label: "深度分析" },
          { icon: "ri-link", value: String(result.relationships.length), label: "关系对" },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-4 border border-white/[0.06] text-center">
            <span className="w-5 h-5 flex items-center justify-center mx-auto mb-2 text-accent-cyan">
              <i className={`${stat.icon} text-sm`} />
            </span>
            <div className="text-2xl font-bold text-gradient-cyan font-mono">{stat.value}</div>
            <div className="text-xs text-text-muted mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 max-w-lg mx-auto">
        <button
          onClick={() => setShowReport(!showReport)}
          className="w-full py-4 rounded-xl text-base font-semibold bg-accent-cyan text-bg-primary hover:bg-accent-cyan-dim transition-all cursor-pointer cyan-glow flex items-center justify-center gap-2"
        >
          <i className="ri-file-chart-line text-base" />
          {showReport ? "收起报告" : "查看文献综述报告"}
        </button>
        <button
          onClick={onNewResearch}
          className="w-full py-3.5 rounded-xl text-sm font-medium border border-white/[0.1] text-text-secondary hover:border-accent-cyan/30 hover:text-accent-cyan hover:bg-accent-cyan/[0.05] transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <i className="ri-add-line" /> 新建研究
        </button>
      </div>

      {/* Regenerate Report Button */}
      {!result.report && (
        <div className="mt-4 max-w-lg mx-auto">
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="w-full py-3.5 rounded-xl text-sm font-medium bg-amber-400/10 border border-amber-400/20 text-amber-400 hover:bg-amber-400/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {regenerating ? (
              <><i className="ri-loader-4-line animate-spin" /> 正在重新生成报告...</>
            ) : (
              <><i className="ri-refresh-line" /> 重新生成报告</>
            )}
          </button>
          {regenError && (
            <p className="text-xs text-red-400 mt-2 text-center">{regenError}</p>
          )}
        </div>
      )}

      {/* Report Display */}
      {showReport && !result.report && (
        <div className="mt-8 glass rounded-2xl border border-white/[0.06] p-8 text-center">
          <i className="ri-file-warning-line text-3xl text-amber-400 mb-3" />
          <p className="text-sm text-text-secondary">报告生成失败或未完成。点击上方按钮重新生成。</p>
        </div>
      )}
      {showReport && result.report && (
        <div className="mt-8 glass rounded-2xl border border-white/[0.06] p-8">
          <h2 className="text-xl font-bold text-text-primary mb-6 flex items-center gap-2">
            <i className="ri-file-chart-line text-accent-cyan" />
            文献综述: {direction}
          </h2>
          <div className="prose prose-invert prose-sm max-w-none text-text-secondary leading-relaxed [&_h2]:text-text-primary [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-4 [&_h3]:text-text-primary [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_p]:mb-4 [&_ul]:mb-4 [&_ol]:mb-4 [&_li]:mb-1 [&_strong]:text-text-primary [&_a]:text-accent-cyan">
            <ReactMarkdown>{stripThink(result.report.overview)}</ReactMarkdown>
          </div>

          {/* References */}
          {result.report.references && (
            <div className="mt-8 pt-6 border-t border-white/[0.06]">
              <h3 className="text-sm font-semibold text-text-primary mb-4">参考文献</h3>
              <div className="space-y-1 text-xs text-text-muted font-mono whitespace-pre-wrap">
                {result.report.references}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Gap Analysis */}
      {result.gapAnalysis && result.gapAnalysis.gaps.length > 0 && (
        <div className="mt-6 glass rounded-2xl border border-white/[0.06] p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <i className="ri-lightbulb-line text-amber-400" />
            研究空白与机会
          </h3>
          <div className="space-y-3">
            {result.gapAnalysis.gaps.map((gap, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    gap.potential_impact === "high" ? "bg-red-400/10 text-red-400 border border-red-400/20" :
                    gap.potential_impact === "medium" ? "bg-amber-400/10 text-amber-400 border border-amber-400/20" :
                    "bg-green-400/10 text-green-400 border border-green-400/20"
                  }`}>{gap.potential_impact}</span>
                </div>
                <p className="text-xs text-text-secondary">{gap.description}</p>
                {gap.evidence && (
                  <p className="text-[10px] text-text-muted mt-1">证据: {gap.evidence}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Research Plans */}
      <div className="mt-6 glass rounded-2xl border border-white/[0.06] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <i className="ri-flask-line text-green-400" />
            研究方案
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-white/[0.1] overflow-hidden">
              {[1, 2, 3, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setPlanCount(n)}
                  disabled={generatingPlans}
                  className={`px-3 py-1.5 text-xs font-medium transition-all ${
                    planCount === n
                      ? "bg-accent-cyan/20 text-accent-cyan border-r border-accent-cyan/20"
                      : "bg-white/[0.02] text-text-muted hover:text-text-secondary hover:bg-white/[0.04] border-r border-white/[0.06]"
                  } last:border-r-0 disabled:opacity-50`}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              onClick={handleGeneratePlans}
              disabled={generatingPlans}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-400/10 border border-green-400/20 text-green-400 hover:bg-green-400/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {generatingPlans ? (
                <><i className="ri-loader-4-line animate-spin" /> 生成中...</>
              ) : generatedPlans.length > 0 ? (
                <><i className="ri-refresh-line" /> 重新生成</>
              ) : (
                <><i className="ri-magic-line" /> 生成研究方案</>
              )}
            </button>
          </div>
        </div>
        {planError && (
          <p className={`text-xs mb-3 ${planError.startsWith("正在生成") ? "text-accent-cyan" : "text-red-400"}`}>
            {planError.startsWith("正在生成") && <i className="ri-loader-4-line animate-spin mr-1" />}
            {planError}
          </p>
        )}
        {generatedPlans.length > 0 ? (
          <>
            <div className="space-y-4">
              {generatedPlans.map((plan, i) => {
                const diffColor = plan.difficulty === "低" ? "text-green-400 bg-green-400/10 border-green-400/20" :
                  plan.difficulty === "中" ? "text-amber-400 bg-amber-400/10 border-amber-400/20" :
                  "text-red-400 bg-red-400/10 border-red-400/20";
                return (
                  <div key={plan.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                    {/* Header */}
                    <div className="flex items-start justify-between p-4 pb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-text-muted font-mono">方案 {i + 1}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${diffColor}`}>
                            {plan.difficulty}难度
                          </span>
                          <span className="text-[10px] text-text-muted">{plan.estimatedTime}</span>
                        </div>
                        <h4 className="text-sm font-semibold text-text-primary">{plan.title}</h4>
                      </div>
                      <button
                        onClick={() => handleSavePlan(plan.id)}
                        disabled={plan.saved}
                        className={`flex-shrink-0 ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          plan.saved
                            ? "bg-green-400/10 border border-green-400/20 text-green-400"
                            : "bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/20"
                        }`}
                      >
                        {plan.saved ? (
                          <><i className="ri-check-line" /> 已保存</>
                        ) : (
                          <><i className="ri-save-line" /> 接受并保存</>
                        )}
                      </button>
                    </div>

                    {/* Body */}
                    <div className="px-4 pb-4 space-y-2.5">
                      <div>
                        <span className="text-[10px] text-text-muted">研究问题</span>
                        <p className="text-xs text-text-secondary mt-0.5">{plan.researchQuestion}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-muted">方法路线</span>
                        <p className="text-xs text-text-secondary mt-0.5">{plan.methodology}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-muted">创新点</span>
                        <p className="text-xs text-text-secondary mt-0.5">{plan.innovation}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-muted">预期贡献</span>
                        <p className="text-xs text-text-secondary mt-0.5">{plan.expectedContribution}</p>
                      </div>
                      {plan.datasets.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-text-muted">数据集:</span>
                          {plan.datasets.map((d, j) => (
                            <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-text-secondary border border-white/[0.06]">{d}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigate to plans page */}
            {generatedPlans.some(p => p.saved) && (
              <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-center">
                <button
                  onClick={() => navigate("/plans")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan text-sm font-medium hover:bg-accent-cyan/20 transition-all cursor-pointer"
                >
                  <i className="ri-draft-line" /> 在方案页面查看已保存的方案
                </button>
              </div>
            )}
          </>
        ) : !generatingPlans && (
          <div className="flex flex-col items-center justify-center py-8 text-text-muted">
            <i className="ri-flask-line text-2xl mb-2 opacity-30" />
            <p className="text-xs">点击上方按钮，AI 将根据文献综述和研究空白自动生成研究方案</p>
          </div>
        )}
      </div>

      {/* Analyzed Papers List */}
      <div className="mt-6 glass rounded-2xl border border-white/[0.06] p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <i className="ri-article-line text-accent-cyan" />
          分析论文列表 ({result.papers.length})
        </h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {result.papers.map((paper, i) => (
            <div key={paper.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] transition-colors">
              <div className="flex items-start gap-2">
                <span className="text-[10px] text-text-muted font-mono w-6 flex-shrink-0 pt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary line-clamp-1">{paper.title}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {paper.authors.slice(0, 3).join(", ")} · {paper.year ?? "n.d."} · {paper.venue || "—"}
                  </p>
                  {paper.tldrZh && paper.tldrZh !== paper.title && (
                    <p className="text-[10px] text-text-secondary mt-1">{paper.tldrZh}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-accent-cyan">引用: {paper.citationCount}</span>
                    <span className="text-[10px] text-text-muted">质量: {paper.qualityScore.toFixed(3)}</span>
                    {paper.methods.length > 0 && (
                      <span className="text-[10px] text-text-muted">方法: {paper.methods.slice(0, 3).join(", ")}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ResearchPage() {
  const [searchParams] = useSearchParams();
  const localId = searchParams.get("local");

  // Try to load a saved local result
  const loadedLocal = (() => {
    if (!localId) return null;
    try {
      const history = JSON.parse(localStorage.getItem("studyhub_research_history") || "[]");
      return history.find((h: { id: string }) => h.id === localId) || null;
    } catch { return null; }
  })();

  const [step, setStep] = useState<Step>(loadedLocal ? "complete" : "config");
  const [direction, setDirection] = useState(loadedLocal?.direction || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [progress, setProgress] = useState<PipelineProgress>({
    phase: "searching",
    papersFound: 0,
    papersAnalyzed: 0,
    totalPapers: 0,
    currentActivity: "初始化中...",
    error: null,
  });
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [result, setResult] = useState<PipelineResult | null>(loadedLocal?.result || null);
  const abortRef = useRef<AbortController | null>(null);
  const lastPhaseRef = useRef<PipelinePhase>("searching");
  const navigate = useNavigate();

  const addLog = useCallback((text: string, type: ProgressLog["type"] = "info") => {
    const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs((prev) => [...prev.slice(-100), { time, text, type }]);
  }, []);

  const handleStart = async (config: ConfigState) => {
    const llm = getLLMConfig();
    if (!llm) {
      setSubmitError("请先在设置页面配置 LLM API Key");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setDirection(config.direction);
    setLogs([]);

    const abortController = new AbortController();
    abortRef.current = abortController;

    // Switch to progress view immediately
    setStep("progress");
    setIsSubmitting(false);

    addLog(`启动深度研究: ${config.direction}`, "info");
    addLog(`模式: 浏览器本地运行`, "info");
    addLog(`LLM: ${llm.model}`, "info");

    try {
      const researchConfig: ResearchConfig = {
        direction: config.direction,
        depth: config.depth,
        maxPapers: config.maxPapers,
        sources: config.sources,
        yearFrom: config.yearFrom,
        yearTo: config.yearTo,
        languages: config.languages,
        llm,
      };

      const pipelineResult = await runDeepResearch(
        researchConfig,
        (p) => {
          setProgress(p);

          // Log phase transitions
          if (p.phase !== lastPhaseRef.current) {
            const prevPhase = lastPhaseRef.current;
            lastPhaseRef.current = p.phase;

            const prevLabel = PIPELINE_STAGES.find(s => s.key === prevPhase)?.label ?? prevPhase;
            if (prevPhase !== "searching" || p.phase !== "searching") {
              addLog(`${prevLabel} 完成`, "success");
            }

            if (p.phase === "completed") {
              addLog("所有阶段完成！", "success");
            } else if (p.phase === "failed") {
              addLog(`任务失败: ${p.error || "未知错误"}`, "error");
            } else {
              const label = PIPELINE_STAGES.find(s => s.key === p.phase)?.label ?? p.phase;
              addLog(`进入阶段: ${label}`, "info");
            }
          }

          // Log activity updates
          if (p.currentActivity) {
            addLog(p.currentActivity, p.error ? "error" : "info");
          }
        },
        abortController.signal,
      );

      setResult(pipelineResult);
      setStep("complete");

      // Persist result to localStorage
      try {
        const saved = {
          id: `research_${Date.now()}`,
          direction: config.direction,
          createdAt: new Date().toISOString(),
          result: pipelineResult,
        };
        const history = JSON.parse(localStorage.getItem("studyhub_research_history") || "[]");
        history.unshift(saved);
        // Keep last 20 results
        localStorage.setItem("studyhub_research_history", JSON.stringify(history.slice(0, 20)));
      } catch { /* localStorage full or unavailable */ }
    } catch (err) {
      if (abortController.signal.aborted) {
        addLog("用户取消了研究任务", "warn");
        setStep("config");
      } else {
        addLog(`任务失败: ${err instanceof Error ? err.message : String(err)}`, "error");
        // Stay on progress step to show error
      }
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const steps: { key: Step; label: string; num: number }[] = [
    { key: "config", label: "配置", num: 1 },
    { key: "progress", label: "进行中", num: 2 },
    { key: "complete", label: "完成", num: 3 },
  ];

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <div className="pt-24 pb-16 px-6">
        <div className="flex items-center justify-center gap-0 mb-12 max-w-xs mx-auto">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                  step === s.key ? "border-accent-cyan bg-accent-cyan text-bg-primary" :
                  steps.findIndex((x) => x.key === step) > i ? "border-accent-cyan bg-accent-cyan/20 text-accent-cyan" :
                  "border-white/[0.15] text-text-muted"
                }`}>{s.num}</div>
                <span className={`text-[10px] whitespace-nowrap ${step === s.key ? "text-accent-cyan" : "text-text-muted"}`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 w-12 mx-2 mb-4 transition-all ${
                  steps.findIndex((x) => x.key === step) > i ? "bg-accent-cyan" : "bg-white/[0.1]"
                }`} />
              )}
            </div>
          ))}
        </div>

        {step === "config" && (
          <>
            <ConfigStep onStart={handleStart} isSubmitting={isSubmitting} />
            {submitError && (
              <div className="max-w-2xl mx-auto mt-4 p-4 rounded-xl bg-red-400/[0.08] border border-red-400/20 text-center">
                <p className="text-sm text-red-300">{submitError}</p>
              </div>
            )}
          </>
        )}
        {step === "progress" && (
          <ProgressStep progress={progress} logs={logs} direction={direction} onCancel={handleCancel} />
        )}
        {step === "complete" && result && (
          <CompleteStep
            result={result}
            direction={direction}
            onNewResearch={() => {
              setStep("config");
              setResult(null);
              setLogs([]);
              setProgress({ phase: "searching", papersFound: 0, papersAnalyzed: 0, totalPapers: 0, currentActivity: "初始化中...", error: null });
              lastPhaseRef.current = "searching";
            }}
            onResultUpdate={(updated) => {
              setResult(updated);
              // Update localStorage too
              try {
                const history = JSON.parse(localStorage.getItem("studyhub_research_history") || "[]");
                const idx = history.findIndex((h: { direction: string }) => h.direction === direction);
                if (idx >= 0) {
                  history[idx].result = updated;
                  localStorage.setItem("studyhub_research_history", JSON.stringify(history));
                }
              } catch { /* ignore */ }
            }}
          />
        )}
      </div>
    </div>
  );
}
