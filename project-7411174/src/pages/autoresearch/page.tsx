/**
 * AutoResearch — Karpathy-style autonomous experiment loop.
 *
 * Real flow:
 * 1. User provides goal + initial train.py (or LLM generates baseline)
 * 2. Run baseline: `python train.py` → extract val_bpb
 * 3. Loop forever:
 *    - LLM reads current train.py + results.tsv
 *    - LLM proposes code modification
 *    - Write modified train.py → git commit
 *    - Run `python train.py` → extract metrics from stdout
 *    - If metric improved → keep commit
 *    - If metric worse or crash → git reset --hard HEAD~1
 *    - Log to results.tsv
 *    - Repeat
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "../../components/feature/Navbar";
import { getLLMConfig } from "../../lib/deep-research";
import * as localExec from "../../lib/local-exec";


// ── Types ────────────────────────────────────────────────────────────────────

interface PlanContext {
  name?: string;
  hypothesis?: string;
  method?: string;
  baselineMethod?: string;
  expectedImprovement?: string;
  metrics?: unknown;
  datasets?: unknown;
  steps?: unknown;
  codeSketch?: string;
}

interface Experiment {
  round: number;
  commit: string;
  metric: number | null;
  memoryGb: number | null;
  status: "keep" | "discard" | "crash" | "running";
  description: string;
  duration: number;
}

interface LogEntry {
  time: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
}

type Phase = "setup" | "running" | "paused" | "paper" | "completed";

// ── Paper writing pipeline stages ──────────────────────────────────────────
// Follows standard academic paper writing workflow
const PAPER_STAGES = [
  { key: "literature_review", label: "文献调研", files: ["paper/related_work.md", "paper/references.bib"], desc: "收集相关文献，生成相关工作综述和参考文献库" },
  { key: "method_design", label: "方法设计", files: ["paper/method.md", "paper/main.tex (method section)"], desc: "撰写方法论：问题定义、模型架构、训练策略" },
  { key: "experiment_analysis", label: "实验分析", files: ["analysis.py", "generate_figures.py", "figures/", "tables/"], desc: "分析实验数据，生成图表和统计结果" },
  { key: "results_writing", label: "结果撰写", files: ["paper/experiments.md", "paper/results.md"], desc: "撰写实验设置和结果分析章节" },
  { key: "intro_abstract", label: "引言与摘要", files: ["paper/introduction.md", "paper/abstract.md", "paper/keywords.md"], desc: "撰写引言（研究背景、贡献）和摘要" },
  { key: "discussion_conclusion", label: "讨论与结论", files: ["paper/discussion.md", "paper/conclusion.md", "paper/acknowledgments.md"], desc: "撰写讨论（局限性、未来方向）和结论" },
  { key: "supplementary", label: "补充材料", files: ["supplementary/*.md"], desc: "生成超参数表、架构演化、可复现性声明、计算预算" },
  { key: "latex_compile", label: "LaTeX 整合", files: ["paper/main.tex", "paper/full_paper.md", "Makefile", "SUMMARY.md"], desc: "整合所有章节到 LaTeX 模板，生成编译脚本" },
] as const;

type PaperStageKey = typeof PAPER_STAGES[number]["key"];

// ── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES: Record<string, { label: string; metric: string; direction: "lower" | "higher"; command: string; code: string }> = {
  pytorch_classifier: {
    label: "PyTorch MNIST 分类器",
    metric: "val_accuracy",
    direction: "higher",
    command: "python train.py",
    code: `"""
AutoResearch train.py — PyTorch MNIST classifier.
Uses real MNIST dataset (auto-downloads).
Outputs metrics in key: value format for extraction.
"""
import time
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

# ── Config ──────────────────────────────────────────────────
SEED = 42
EPOCHS = 10
BATCH_SIZE = 128
LR = 0.001
HIDDEN_DIM = 256

torch.manual_seed(SEED)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ── Data (MNIST — auto-download) ───────────────────────────
transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.1307,), (0.3081,)),
])
train_data = datasets.MNIST("./data", train=True, download=True, transform=transform)
val_data = datasets.MNIST("./data", train=False, download=True, transform=transform)
train_loader = DataLoader(train_data, batch_size=BATCH_SIZE, shuffle=True)
val_loader = DataLoader(val_data, batch_size=BATCH_SIZE)

# ── Model ───────────────────────────────────────────────────
class Net(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Flatten(),
            nn.Linear(28 * 28, HIDDEN_DIM),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(HIDDEN_DIM, HIDDEN_DIM),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(HIDDEN_DIM, 10),
        )
    def forward(self, x):
        return self.net(x)

model = Net().to(device)
optimizer = optim.Adam(model.parameters(), lr=LR)
criterion = nn.CrossEntropyLoss()

# ── Training ────────────────────────────────────────────────
start_time = time.time()
best_val_acc = 0.0

for epoch in range(EPOCHS):
    model.train()
    for xb, yb in train_loader:
        xb, yb = xb.to(device), yb.to(device)
        optimizer.zero_grad()
        loss = criterion(model(xb), yb)
        loss.backward()
        optimizer.step()

    # Validation
    model.eval()
    correct = total = 0
    with torch.no_grad():
        for xb, yb in val_loader:
            xb, yb = xb.to(device), yb.to(device)
            preds = model(xb).argmax(dim=1)
            correct += (preds == yb).sum().item()
            total += yb.size(0)
    val_acc = correct / total
    best_val_acc = max(best_val_acc, val_acc)
    print(f"Epoch {epoch+1}/{EPOCHS} — val_accuracy: {val_acc:.4f}")

training_seconds = time.time() - start_time

# ── Output Metrics ──────────────────────────────────────────
print("---")
print(f"val_accuracy:     {best_val_acc:.6f}")
print(f"training_seconds: {training_seconds:.1f}")
print(f"epochs:           {EPOCHS}")
print(f"batch_size:       {BATCH_SIZE}")
print(f"lr:               {LR}")
`,
  },
  sklearn_regression: {
    label: "Sklearn 回归 (California Housing)",
    metric: "val_rmse",
    direction: "lower",
    command: "python train.py",
    code: `"""
AutoResearch train.py — sklearn regression on California Housing dataset.
Uses real dataset (auto-downloads from sklearn).
"""
import time
import numpy as np
from sklearn.datasets import fetch_california_housing
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_squared_error

# ── Config ──────────────────────────────────────────────────
SEED = 42
N_ESTIMATORS = 100
MAX_DEPTH = 5
LEARNING_RATE = 0.1

np.random.seed(SEED)

# ── Data (California Housing — auto-download) ───────────────
data = fetch_california_housing()
X, y = data.data, data.target
X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=SEED)

scaler = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_val = scaler.transform(X_val)

# ── Model ───────────────────────────────────────────────────
start_time = time.time()

model = GradientBoostingRegressor(
    n_estimators=N_ESTIMATORS,
    max_depth=MAX_DEPTH,
    learning_rate=LEARNING_RATE,
    random_state=SEED,
)
model.fit(X_train, y_train)

y_pred = model.predict(X_val)
val_rmse = float(np.sqrt(mean_squared_error(y_val, y_pred)))

training_seconds = time.time() - start_time

# ── Output Metrics ──────────────────────────────────────────
print("---")
print(f"val_rmse:         {val_rmse:.6f}")
print(f"training_seconds: {training_seconds:.1f}")
print(f"n_estimators:     {N_ESTIMATORS}")
print(f"max_depth:        {MAX_DEPTH}")
print(f"learning_rate:    {LEARNING_RATE}")
`,
  },
  custom: {
    label: "自定义 / 粘贴代码",
    metric: "val_bpb",
    direction: "lower",
    command: "python train.py",
    code: "",
  },
};

// ── Metric extraction from stdout ────────────────────────────────────────────

function extractMetric(stdout: string, metricName: string): number | null {
  // Try "metric_name: 1.234" or "metric_name:          1.234"
  const re = new RegExp(`^${metricName}:\\s+([\\d.]+)`, "m");
  const m = stdout.match(re);
  if (m) return parseFloat(m[1]);
  // Also try from run.log format
  const re2 = new RegExp(`${metricName}[=:]\\s*([\\d.]+)`);
  const m2 = stdout.match(re2);
  if (m2) return parseFloat(m2[1]);
  return null;
}

function extractPeakVram(stdout: string): number | null {
  const m = stdout.match(/peak_vram_mb:\s+([\d.]+)/);
  if (m) return Math.round(parseFloat(m[1]) / 1024 * 10) / 10;
  return null;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function AutoResearchPage() {
  const [searchParams] = useSearchParams();

  // Load plan context from localStorage + URL
  const [planContext] = useState<PlanContext | null>(() => {
    try {
      const raw = localStorage.getItem("studyhub_pending_plan");
      if (raw) {
        localStorage.removeItem("studyhub_pending_plan");
        return JSON.parse(raw);
      }
    } catch { /* ignore */ }
    return null;
  });

  // Setup state — pre-fill from plan
  const [goal, setGoal] = useState(() => {
    const urlGoal = searchParams.get("goal");
    if (urlGoal) return urlGoal;
    if (planContext) {
      return [
        planContext.name,
        planContext.hypothesis ? `假设: ${planContext.hypothesis}` : "",
        planContext.method ? `方法: ${planContext.method}` : "",
        planContext.expectedImprovement ? `预期: ${planContext.expectedImprovement}` : "",
      ].filter(Boolean).join("\n");
    }
    return "";
  });
  const [selectedTemplate, setSelectedTemplate] = useState("pytorch_classifier");
  const [initialCode, setInitialCode] = useState(() => planContext?.codeSketch || TEMPLATES.pytorch_classifier.code);
  const [runCommand, setRunCommand] = useState("python train.py");
  const [metricName, setMetricName] = useState("val_accuracy");
  const [metricDirection, setMetricDirection] = useState<"lower" | "higher">("higher");
  const [timeoutSec, setTimeoutSec] = useState(86400); // 24h default — effectively no timeout
  const [generatingCode, setGeneratingCode] = useState(false);

  // Runtime state
  const [phase, setPhase] = useState<Phase>("setup");
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentCode, setCurrentCode] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [bestMetric, setBestMetric] = useState<number | null>(null);
  const [workspaceFiles, setWorkspaceFiles] = useState<string[]>([]);
  const [wsFileContent, setWsFileContent] = useState<string | null>(null);
  const [wsFileSelected, setWsFileSelected] = useState<string | null>(null);
  const [expandedExp, setExpandedExp] = useState<number | null>(null);
  const [paperStage, setPaperStage] = useState<number>(-1); // -1 = not started
  const [paperStageStatus, setPaperStageStatus] = useState<Record<string, "pending" | "running" | "done" | "error">>({});

  const abortRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Refresh workspace file list
  useEffect(() => {
    if (!runId) return;
    const refresh = () => {
      localExec.listFiles(runId).then(setWorkspaceFiles).catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [runId, experiments.length]);

  const addLog = useCallback((level: LogEntry["level"], message: string) => {
    setLogs((prev) => [...prev, {
      time: new Date().toLocaleTimeString("zh-CN"),
      level,
      message,
    }]);
  }, []);

  // ── Core Experiment Loop (Karpathy autoresearch) ────────────────────────────

  const handleStart = async () => {
    const llm = getLLMConfig();
    if (!llm) {
      addLog("error", "请先在设置页面配置 LLM (API Key + Model)");
      return;
    }
    // If no initial code provided, LLM will generate it in the setup phase


    setPhase("running");
    setExperiments([]);
    setLogs([]);
    setBestMetric(null);
    abortRef.current = false;

    // Local mutable copy of runCommand — React state is async, can't use in pipeline
    let actualRunCmd = runCommand;

    const { chatCompletion, fetchModelMaxTokens } = await import("../../lib/deep-research/llm-client");

    // Determine max output tokens based on model's context limit
    const modelMaxCtx = await fetchModelMaxTokens(llm);
    // Use ~25% of context for output, min 8192, max 16384
    const dynamicMaxTokens = Math.min(16384, Math.max(8192, Math.floor(modelMaxCtx * 0.25)));
    addLog("info", `模型上下文: ${modelMaxCtx} tokens → 输出预算: ${dynamicMaxTokens} tokens`);

    // 1. Initialize workspace
    const wsId = `ar_${Date.now()}`;
    let localRunId: string | null = null;
    try {
      const initResp = await localExec.initRun({
        run_id: wsId,
        base_code: initialCode,
      });
      localRunId = initResp.run_id;
      setRunId(localRunId);
      addLog("success", `工作区: ${initResp.workspace_path}`);
    } catch (err) {
      addLog("error", `工作区初始化失败: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("completed");
      return;
    }

    // ── Log full pipeline overview ──
    addLog("info", "╔══════════════════════════════════════════════════════╗");
    addLog("info", "║         AutoResearch 全自动实验流水线                ║");
    addLog("info", "╠══════════════════════════════════════════════════════╣");
    addLog("info", "║ Phase A: 调研 + 准备                                ║");
    addLog("info", "║   0. 文献调研 — 搜索领域 SOTA、方法、数据集          ║");
    addLog("info", "║   1. 生成 program.md — 实验目标、规则、约束          ║");
    addLog("info", "║   2. 生成 prepare.py — 数据下载 → 自动执行           ║");
    addLog("info", "║   3. 生成 train.py — 基于调研+数据+假设              ║");
    addLog("info", "║   4. 运行 baseline → 提取初始指标                    ║");
    addLog("info", "║                                                      ║");
    addLog("info", "║ Phase B: 实验循环 (LOOP FOREVER)                    ║");
    addLog("info", "║   5. LLM 读 train.py + results.tsv + 调研摘要       ║");
    addLog("info", "║   6. LLM 修改 train.py → git commit                 ║");
    addLog("info", "║   7. 执行 → 提取指标 → keep/discard → 记录 results  ║");
    addLog("info", "║   8. 重复直到手动停止                                ║");
    addLog("info", "║                                                      ║");
    addLog("info", "║ Phase C: 论文写作 (停止后自动进入)                   ║");
    addLog("info", "║   9.  方法设计 → paper/method.md [LabClaw]           ║");
    addLog("info", "║   10. 实验分析 → analysis.py + figures/ [LabClaw]    ║");
    addLog("info", "║   11. 结果撰写 → paper/results.md [LabClaw]         ║");
    addLog("info", "║   12. 引言摘要 → paper/abstract.md [LabClaw]        ║");
    addLog("info", "║   13. 讨论结论 → paper/discussion.md [LabClaw]      ║");
    addLog("info", "║   14. 文献综述 → paper/related_work.md (基于调研)    ║");
    addLog("info", "║   15. LaTeX 整合 → paper/main.tex + Makefile        ║");
    addLog("info", "╚══════════════════════════════════════════════════════╝\n");

    // ── Step 0: Literature Research ──
    addLog("info", "═══ Step 0: 文献调研 ═══");
    addLog("info", "[Step 0] 搜索领域 SOTA 方法、关键论文、常用数据集...");
    let researchSummary = "";
    try {
      const researchPrompt = `You are a research scientist. Conduct a brief literature review for this experiment.

Experiment Goal: ${goal}
${planContext?.hypothesis ? `Hypothesis: ${planContext.hypothesis}` : ""}
${planContext?.method ? `Method: ${planContext.method}` : ""}

Provide a concise research summary covering:
1. **SOTA Methods**: What are the current state-of-the-art approaches for this task? List top 3-5 methods with brief descriptions and their reported performance.
2. **Key Datasets**: What public datasets are commonly used? Include names, sizes, where to download (PhysioNet, HuggingFace, Kaggle, etc.), and the correct SDK/API to use.
3. **Evaluation Metrics**: What metrics are standard in this domain?
4. **Implementation Tips**: Common pitfalls, recommended architectures, preprocessing steps.
5. **Recommended Approach**: Based on the hypothesis, what specific model architecture and training strategy would you recommend?

Keep it focused and actionable (under 800 words). This will guide the experiment design.`;

      const researchResp = await chatCompletion(llm, [
        { role: "system", content: "You are an expert research scientist. Provide accurate, actionable literature review summaries. Be specific about methods, datasets, and performance numbers." },
        { role: "user", content: researchPrompt },
      ], { maxTokens: dynamicMaxTokens, temperature: 0.3 });

      researchSummary = researchResp.trim();
      if (researchSummary) {
        await localExec.writeFile(localRunId, "research_summary.md", researchSummary);
        addLog("success", `[Step 0] 文献调研完成 (${researchSummary.length} 字符)`);
        // Log key findings
        const firstLines = researchSummary.split("\n").slice(0, 5).join("\n");
        addLog("info", `[Step 0] 摘要:\n${firstLines}\n...`);
      } else {
        addLog("warn", "[Step 0] 调研返回为空，跳过");
      }
    } catch (err) {
      addLog("warn", `[Step 0] 文献调研失败: ${err instanceof Error ? err.message : String(err)}，继续执行`);
    }

    // ── Step 1: Generate program.md (experiment goal document) ──
    addLog("info", "═══ Step 1: 生成 program.md ═══");
    try {
      const hypothesisBlock = planContext?.hypothesis
        ? `\n## 实验假设\n${planContext.hypothesis}\n`
        : "";
      const methodBlock = planContext?.method
        ? `\n## 实验方法\n${planContext.method}\n`
        : "";
      const expectedBlock = planContext?.expectedImprovement
        ? `\n## 预期效果\n${planContext.expectedImprovement}\n`
        : "";

      const researchBlock = researchSummary
        ? `\n## 文献调研摘要\n${researchSummary.slice(0, 2000)}\n`
        : "";

      const programMd = `# autoresearch

## 实验目标
${goal || "优化 " + metricName}
${hypothesisBlock}${methodBlock}${expectedBlock}${researchBlock}
## Setup
1. 工作区已初始化: ~/studyhub-workspaces/${localRunId}
2. 核心文件: \`train.py\` — LLM 每轮修改的唯一文件
3. 数据准备: \`prepare.py\` 自动下载数据集到 \`./data/\`
4. 初始化 \`results.tsv\` 记录所有实验

## 规则

**可以做的:**
- 修改 \`train.py\` — 这是唯一被修改的文件。一切皆可改: 模型架构、优化器、超参数、训练循环、batch size、模型大小等

**不可以做的:**
- 修改 \`prepare.py\` (只读)
- 新增依赖包

**目标: 获得${metricDirection === "lower" ? "最低" : "最高"}的 ${metricName}。**

## 输出格式
脚本完成后输出:
\`\`\`
---
${metricName}:     <value>
training_seconds: <value>
\`\`\`

## 结果记录
每次实验记录到 \`results.tsv\` (tab 分隔):
\`\`\`
commit\t${metricName}\tmemory_gb\tstatus\tdescription
a1b2c3d\t0.950000\t2.1\tkeep\tbaseline
b2c3d4e\t0.970000\t2.2\tkeep\tincrease hidden dim to 512
\`\`\`

## 实验循环
LOOP FOREVER:
1. 读取当前 \`train.py\` + \`results.tsv\`
2. 修改 \`train.py\` — 尝试一个实验想法
3. git commit
4. 运行: \`${runCommand}\`
5. 提取指标: \`${metricName}\`
6. ${metricDirection === "lower" ? "指标降低" : "指标升高"} → keep commit
7. ${metricDirection === "lower" ? "指标升高" : "指标降低"} 或 crash → git reset --hard HEAD~1
8. 记录到 results.tsv
9. 重复

**简洁准则**: 同等效果下，更简单的代码更好。小改进 + 大量复杂度 = 不值得。简化代码 + 同样效果 = 保留。

**NEVER STOP**: 一旦循环开始，永不暂停询问。用户可能不在电脑前。持续运行直到被手动停止。

## 停止后
自动进入论文写作流水线:
- 使用 LabClaw skills 作为专业指导
- 按标准学术论文写作流程逐步生成
- 输出: paper/ (LaTeX + Markdown) + figures/ + supplementary/
`;
      await localExec.writeFile(localRunId, "program.md", programMd);
      addLog("success", "已生成 program.md — 实验目标与规则文档");
    } catch (err) {
      addLog("warn", `program.md 生成失败: ${err instanceof Error ? err.message : String(err)}`);
    }

    // ── Step 2: Generate train.py if not provided ──
    if (!initialCode.trim()) {
      addLog("info", "═══ Step 2: LLM 生成 train.py ═══");
      try {
        const hypothesisCtx = [
          planContext?.hypothesis ? `Hypothesis: ${planContext.hypothesis}` : "",
          planContext?.method ? `Method: ${planContext.method}` : "",
          planContext?.expectedImprovement ? `Expected: ${planContext.expectedImprovement}` : "",
        ].filter(Boolean).join("\n");

        const genResp = await chatCompletion(llm, [{ role: "user", content: `You are an ML engineer. Generate a complete, runnable train.py for this experiment goal:

${goal}
${hypothesisCtx ? `\nExperiment Context:\n${hypothesisCtx}\n` : ""}
Requirements:
- Single file, complete and runnable with "python train.py"
- Include all imports, model definition, training loop, evaluation
- Must print metrics at the end in this EXACT format:
  ---
  ${metricName}:     0.850000
  training_seconds: 45.2
- Use a real dataset (torchvision, sklearn.datasets, huggingface datasets, etc.) — NOT synthetic/random data
- If data needs downloading, include the download code in train.py itself
- Keep it simple but functional

Return ONLY Python code, no markdown fences, no explanation.` }], { maxTokens: dynamicMaxTokens, temperature: 0.3 });
        const genCode = genResp.replace(/^```(?:python)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
        if (genCode) {
          await localExec.writeCode(localRunId, "train.py", genCode, "LLM-generated initial train.py");
          addLog("success", "已生成 train.py");
          setCurrentCode(genCode);
        }
      } catch (err) {
        addLog("error", `train.py 生成失败: ${err instanceof Error ? err.message : String(err)}`);
        setPhase("completed");
        return;
      }
    }

    // (program.md already written in Step 1 above)

    // ── Step 2.5: Create virtual environment ──
    addLog("info", "═══ Step 2.5: 创建 Python 虚拟环境 ═══");
    let envPython = "python";
    let envPip = "python -m pip";
    let envCreated = false;
    {
      // Try conda first, then fall back to python -m venv
      addLog("info", "[Step 2.5] 尝试 conda...");
      const condaCheck = await localExec.executeCode(localRunId, {
        command: "conda --version",
        timeout_seconds: 10,
      });

      if (condaCheck.exit_code === 0) {
        const envName = `ar_${wsId}`;
        addLog("info", `[Step 2.5] conda create -n ${envName} python=3.11 -y`);
        const condaCreate = await localExec.executeCode(localRunId, {
          command: `conda create -n ${envName} python=3.11 -y`,
          timeout_seconds: 300,
        });
        if (condaCreate.exit_code === 0) {
          envPython = `conda run --no-banner -n ${envName} python`;
          envPip = `conda run --no-banner -n ${envName} python -m pip`;
          envCreated = true;
          addLog("success", `[Step 2.5] conda 环境 ${envName} 创建完成`);
        }
      }

      if (!envCreated) {
        // Fall back to python -m venv
        addLog("info", "[Step 2.5] conda 不可用，使用 python -m venv...");
        const venvCreate = await localExec.executeCode(localRunId, {
          command: "python -m venv .venv",
          timeout_seconds: 60,
        });
        if (venvCreate.exit_code === 0) {
          envPython = ".venv/bin/python";
          envPip = ".venv/bin/python -m pip";
          envCreated = true;
          addLog("success", "[Step 2.5] venv 环境创建完成 (.venv/)");
        } else {
          addLog("warn", "[Step 2.5] venv 创建也失败，使用系统 Python + --break-system-packages");
          envPip = "python -m pip install --break-system-packages";
        }
      }

      // Update run command to use env python
      if (envCreated) {
        actualRunCmd = actualRunCmd.replace(/^python\b/, envPython);
        setRunCommand(actualRunCmd);
        addLog("info", `[Step 2.5] 运行命令: ${actualRunCmd}`);
      }

      // Set pip mirror to Tsinghua (China)
      addLog("info", "[Step 2.5] 设置 pip 清华镜像源...");
      await localExec.executeCode(localRunId, {
        command: `${envPip} config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple`,
        timeout_seconds: 30,
      });
    }

    // 1.5 Generate and run prepare.py (data download) + requirements.txt
    addLog("info", "═══ Step 3: 数据准备 (prepare.py) ═══");
    addLog("info", "[Step 3] 向 LLM 请求生成数据下载脚本...");

    // Try up to 3 times to generate prepare.py, feeding errors back to LLM each time
    let prepareOk = false;
    let lastPrepareError = "";
    let lastPrepareCode = "";
    for (let attempt = 1; attempt <= 3 && !prepareOk; attempt++) {
      try {
        addLog("info", `[Step 3] 生成 prepare.py — 第${attempt}次尝试`);

        const hypothesisCtx = [
          planContext?.hypothesis ? `Hypothesis: ${planContext.hypothesis}` : "",
          planContext?.method ? `Method: ${planContext.method}` : "",
          planContext?.expectedImprovement ? `Expected outcome: ${planContext.expectedImprovement}` : "",
        ].filter(Boolean).join("\n");

        const errorFeedback = lastPrepareError
          ? `\n\nPREVIOUS ATTEMPT FAILED. Here is the error — you MUST fix it:\n\`\`\`\n${lastPrepareError.slice(0, 1000)}\n\`\`\`\n${lastPrepareCode ? `Previous code that failed:\n\`\`\`python\n${lastPrepareCode.slice(0, 1500)}\n\`\`\`\nAnalyze the error and generate a FIXED version. Common issues: wrong URL (use SDK instead), wrong file paths, missing imports, PhysioNet requires wfdb SDK not HTTP download.` : ""}\n`
          : "";

        const setupPrompt = `You are a machine learning data engineer. Generate a data preparation script for this experiment.

Experiment Goal: ${goal}
${hypothesisCtx ? `\nExperiment Context:\n${hypothesisCtx}\n` : ""}
Generate prepare.py that ONLY does these 3 things:
1. Download the dataset (skip if already downloaded)
2. Extract/decompress if needed (skip if already extracted)
3. Print the actual directory tree of ./data/ after extraction (use os.walk or os.listdir recursively)

CRITICAL RULES:
- DO NOT hardcode file paths or data formats — just download, extract, and list what's there
- DO NOT try to load/parse/process the data — that's train.py's job
- Check if files already exist before downloading (avoid re-downloading large files)
- The dataset MUST match the experiment domain (ECG goal → ECG dataset, NLP goal → text dataset, etc.)
- For PhysioNet datasets (ECG, EEG, etc.): use \`wfdb.dl_database('ptb-xl', './data/ptb-xl')\` — this is the ONLY reliable way. Do NOT use requests/urllib for PhysioNet (they require agreement headers).
- For HuggingFace: use \`datasets.load_dataset()\` and save to ./data/
- For Kaggle: use \`kagglehub.dataset_download()\`
- For general: use requests or urllib with proper error handling
- No timeout limits on downloads — large datasets (1GB+) are expected
- MUST print download progress — use tqdm, print percentage, or print file count during download. The user needs to see the script is working, not stuck.
- If using wfdb.dl_database, wrap it to print progress (e.g. count files in target dir periodically, or use alternative download method with visible progress)
- If using requests for large files, use stream=True with tqdm or manual percentage printing
- Print clear error messages if download fails
- MUST be under 80 lines
- At the end, print a tree of ./data/ showing all files and directories so the next step knows what's available

Also list pip dependencies (one per line).
${errorFeedback}
OUTPUT FORMAT — use EXACTLY this format:
===PREPARE_PY===
<python code, under 80 lines>
===REQUIREMENTS_TXT===
<one package per line>
===END===`;

        addLog("info", `[Step 3] 调用 LLM (maxTokens=${dynamicMaxTokens}, temp=0.3)...`);
        const resp = await chatCompletion(llm, [
          { role: "system", content: "You are a helpful assistant. Output ONLY the requested content in the exact format specified. Do NOT use <think> tags. Do NOT wrap in markdown code fences." },
          { role: "user", content: setupPrompt },
        ], { maxTokens: dynamicMaxTokens, temperature: 0.3 });

        if (!resp || resp.trim().length === 0) {
          addLog("warn", `[Step 3] 第${attempt}次: LLM 返回空内容`);
          continue;
        }

        addLog("info", `[Step 3] LLM 返回 ${resp.length} 字符，解析中...`);

        // Extract prepare.py code using delimiter or fallback to code block
        let prepareCode = "";
        let requirementsTxt = "";

        // Try delimiter format first
        const prepMatch = resp.match(/===PREPARE_PY===\s*\n([\s\S]*?)(?:===REQUIREMENTS_TXT===|===END===|$)/);
        const reqMatch = resp.match(/===REQUIREMENTS_TXT===\s*\n([\s\S]*?)(?:===END===|$)/);

        if (prepMatch) {
          prepareCode = prepMatch[1].trim();
          addLog("info", `[Step 3] 通过分隔符提取 prepare.py (${prepareCode.length} 字符)`);
        } else {
          // Fallback: extract Python code from markdown code blocks
          const codeBlockMatch = resp.match(/```(?:python)?\s*\n([\s\S]*?)```/);
          if (codeBlockMatch) {
            prepareCode = codeBlockMatch[1].trim();
            addLog("info", `[Step 3] 通过 code block 提取 prepare.py (${prepareCode.length} 字符)`);
          } else {
            // Last fallback: if it looks like Python code (has import/def/print), use the whole response
            const stripped = resp.replace(/^```(?:python)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
            if (stripped.match(/^(?:#|import |from |def |class |if )/m)) {
              prepareCode = stripped;
              addLog("info", `[Step 3] 整体作为 Python 代码 (${prepareCode.length} 字符)`);
            }
          }
        }

        if (reqMatch) {
          requirementsTxt = reqMatch[1].trim();
        }

        if (prepareCode) {
          addLog("info", `[Step 3] 写入 prepare.py...`);
          await localExec.writeCode(localRunId, "prepare.py", prepareCode, "Add prepare.py — data download");
          addLog("success", `[Step 3] 已生成 prepare.py (${prepareCode.split("\n").length} 行)`);

          if (requirementsTxt) {
            await localExec.writeCode(localRunId, "requirements.txt", requirementsTxt, "Add requirements.txt");
            addLog("success", `[Step 3] 已生成 requirements.txt`);

            // Install dependencies using conda env pip
            addLog("info", `[Step 3] 安装依赖: ${envPip} install -r requirements.txt ...`);
            const pipExec = await localExec.executeCode(localRunId, {
              command: `${envPip} install -r requirements.txt`,
              timeout_seconds: 300,
            });
            if (pipExec.exit_code === 0) {
              addLog("success", "[Step 3] 依赖安装完成");
            } else {
              addLog("warn", `[Step 3] pip install 失败 (exit ${pipExec.exit_code})`);
              if (pipExec.stderr) {
                addLog("warn", pipExec.stderr.split("\n").slice(-5).join("\n"));
              }
            }
          }

          // Run prepare.py with progress monitoring
          addLog("info", `[Step 3] 执行: ${envPython} prepare.py`);
          addLog("info", `[Step 3] 大数据集下载可能需要 10-30 分钟，请耐心等待...`);

          // Start a background size monitor that polls every 15s
          let monitorActive = true;
          const monitorProgress = async () => {
            while (monitorActive) {
              await new Promise(r => setTimeout(r, 15000));
              if (!monitorActive) break;
              try {
                const sizeCheck = await localExec.executeCode(localRunId, {
                  command: "du -sh data/ 2>/dev/null && find data/ -type f 2>/dev/null | wc -l",
                  timeout_seconds: 5,
                });
                if (sizeCheck.stdout) {
                  const lines = sizeCheck.stdout.trim().split("\n");
                  const size = lines[0]?.split("\t")[0] || "0";
                  const fileCount = lines[1]?.trim() || "0";
                  addLog("info", `[Step 3] 📦 下载进度: ${size} | ${fileCount} 个文件`);
                }
              } catch { /* ignore */ }
            }
          };
          const monitorPromise = monitorProgress();

          const prepExec = await localExec.executeCode(localRunId, {
            command: `${envPython} prepare.py`,
            timeout_seconds: 1800, // 30 min for large datasets
          });
          monitorActive = false;
          await monitorPromise.catch(() => {});

          if (prepExec.exit_code === 0) {
            addLog("success", "[Step 3] 数据下载完成 ✓");
            if (prepExec.stdout) {
              const last = prepExec.stdout.split("\n").slice(-8).join("\n");
              addLog("info", `[Step 3] prepare.py 输出:\n${last}`);
            }
            prepareOk = true;
          } else {
            const errOutput = [
              prepExec.stderr ? prepExec.stderr.split("\n").slice(-10).join("\n") : "",
              prepExec.stdout ? prepExec.stdout.split("\n").slice(-5).join("\n") : "",
            ].filter(Boolean).join("\n");
            addLog("warn", `[Step 3] prepare.py 执行失败 (exit ${prepExec.exit_code})`);
            if (errOutput) {
              addLog("warn", `[Step 3] 错误:\n${errOutput.split("\n").slice(-5).join("\n")}`);
            }
            lastPrepareError = errOutput || `exit code ${prepExec.exit_code}`;
            lastPrepareCode = prepareCode;
            addLog("info", `[Step 3] 将错误反馈给 LLM 进行自动修复...`);
          }
        } else {
          addLog("warn", `[Step 3] 第${attempt}次: 无法从 LLM 响应中提取 Python 代码`);
          addLog("warn", `[Step 3] 响应前 200 字符: ${resp.slice(0, 200)}`);
          lastPrepareError = "Failed to extract Python code from LLM response";
          lastPrepareCode = "";
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        addLog("warn", `[Step 3] 第${attempt}次失败: ${errMsg}`);
        lastPrepareError = errMsg;
        lastPrepareCode = "";
      }
    }

    if (!prepareOk) {
      addLog("warn", "[Step 3] 数据准备失败，将使用 train.py 自带的数据（如有）");
    }

    // ── Step 3.8: ALWAYS regenerate train.py based on goal + hypothesis ──
    {
      addLog("info", "═══ Step 3.8: 根据数据集 + 实验假设生成 train.py ═══");
      try {
        // List data files to understand what prepare.py produced
        const lsData = await localExec.executeCode(localRunId, {
          command: "ls -la data/ 2>/dev/null && head -5 data/*.csv 2>/dev/null || echo 'no csv files'",
          timeout_seconds: 10,
        });
        const dataInfo = (lsData.stdout || "").slice(0, 1500);

        const hypothesisCtx = [
          planContext?.hypothesis ? `Hypothesis: ${planContext.hypothesis}` : "",
          planContext?.method ? `Method: ${planContext.method}` : "",
          planContext?.expectedImprovement ? `Expected outcome: ${planContext.expectedImprovement}` : "",
        ].filter(Boolean).join("\n");

        const hasData = prepareOk && dataInfo && !dataInfo.includes("no csv files");
        const dataSection = hasData
          ? `Available data in ./data/ directory:\n${dataInfo}\n\nYou MUST load data from ./data/ (the files shown above).`
          : `No pre-downloaded data available. You MUST download the dataset yourself inside train.py.\nDownload a REAL dataset matching the experiment goal. For ECG → use PTB-XL from PhysioNet or wfdb. For NLP → use HuggingFace datasets. Do NOT use MNIST/CIFAR unless the goal is specifically about image classification.`;

        const researchCtx = researchSummary
          ? `\nLiterature Review (use this to guide your model design):\n${researchSummary.slice(0, 1500)}\n`
          : "";

        const trainPrompt = `You are an ML researcher. Generate a complete, runnable train.py for this experiment.

Experiment Goal: ${goal}
${hypothesisCtx ? `\nExperiment Context:\n${hypothesisCtx}\n` : ""}${researchCtx}
${dataSection}

Requirements:
- Single file, complete and runnable with "python train.py"
- Include all imports, data loading, model definition, training loop, evaluation
- The model and approach MUST match the experiment hypothesis and method described above
- The dataset MUST match the experiment domain — NEVER use a generic dataset (MNIST, CIFAR) when the goal is domain-specific (ECG, NLP, etc.)
- Must print metrics at the end in this EXACT format:
  ---
  ${metricName}:     0.850000
  training_seconds: 45.2
- Print epoch-level metrics during training: Epoch N/Total — ${metricName}: value
- Keep it focused and functional (under 150 lines)

Return ONLY Python code, no markdown fences, no explanation.`;

        addLog("info", `[Step 3.8] 向 LLM 请求根据实际数据生成 train.py...`);
        const trainResp = await chatCompletion(llm, [
          { role: "system", content: "You are an expert ML engineer. Output ONLY runnable Python code. No markdown, no explanation." },
          { role: "user", content: trainPrompt },
        ], { maxTokens: dynamicMaxTokens, temperature: 0.3 });

        const trainCode = trainResp.replace(/^```(?:python)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
        if (trainCode && trainCode.includes("import")) {
          await localExec.writeCode(localRunId, "train.py", trainCode, "LLM-generated train.py based on data + hypothesis");
          setCurrentCode(trainCode);
          addLog("success", `[Step 3.8] 已生成 train.py (${trainCode.split("\n").length} 行) — 基于实际数据集 + 实验假设`);
        } else {
          addLog("warn", "[Step 3.8] train.py 生成失败，使用原始模板");
        }
      } catch (err) {
        addLog("warn", `[Step 3.8] train.py 再生成失败: ${err instanceof Error ? err.message : String(err)}，使用原始模板`);
      }
    }

    // 3.5 Install train.py dependencies into conda env
    addLog("info", "═══ Step 3.5: 安装训练脚本依赖 ═══");
    {
      // Extract imports from the current train.py (may have been regenerated in Step 3.8)
      const currentTrainCode = await localExec.readFile(localRunId, "train.py").catch(() => initialCode || "");
      const codeToScan = currentTrainCode;
      const importLines = codeToScan.match(/^(?:import |from )\S+/gm) || [];
      const knownPkgs = new Set<string>();
      for (const line of importLines) {
        const m = line.match(/(?:import|from)\s+(\w+)/);
        if (m) {
          const pkg = m[1];
          const pkgMap: Record<string, string> = {
            torch: "torch torchvision", sklearn: "scikit-learn", cv2: "opencv-python",
            PIL: "Pillow", yaml: "pyyaml", np: "numpy", pd: "pandas",
          };
          knownPkgs.add(pkgMap[pkg] || pkg);
        }
      }
      const stdlib = new Set(["os", "sys", "time", "math", "json", "re", "pathlib", "collections", "functools", "itertools", "typing", "abc", "io", "copy", "random", "datetime", "argparse", "logging", "warnings", "csv", "hashlib", "shutil", "glob", "subprocess", "multiprocessing", "threading", "struct", "string"]);
      const toInstall = [...knownPkgs].filter(p => !stdlib.has(p.split(" ")[0]));

      if (toInstall.length > 0) {
        const installCmd = `${envPip} install ${toInstall.join(" ")}`;
        addLog("info", `[Step 3.5] 安装: ${toInstall.join(", ")}`);
        const depExec = await localExec.executeCode(localRunId, {
          command: installCmd,
          timeout_seconds: 600,
        });
        if (depExec.exit_code === 0) {
          addLog("success", "[Step 3.5] 训练依赖安装完成");
        } else {
          addLog("warn", `[Step 3.5] 部分依赖安装失败 (exit ${depExec.exit_code})`);
          if (depExec.stderr) {
            addLog("warn", depExec.stderr.split("\n").slice(-5).join("\n"));
          }
        }
      } else {
        addLog("info", "[Step 3.5] 未检测到需要安装的第三方包");
      }
    }

    // 2. Run baseline first
    addLog("info", "═══ Step 4: 运行 baseline ═══");
    addLog("info", `[Step 4] 执行命令: ${actualRunCmd}`);
    addLog("info", `[Step 4] 超时设置: ${timeoutSec}s | 提取指标: ${metricName} (${metricDirection === "lower" ? "越低越好" : "越高越好"})`);

    let baselineMetric: number | null = null;
    try {
      const execResp = await localExec.executeCode(localRunId, {
        command: actualRunCmd,
        timeout_seconds: timeoutSec,
      });

      if (execResp.error) {
        addLog("warn", `Baseline 执行错误: ${execResp.error}`);
      }
      if (execResp.stdout) {
        const lastLines = execResp.stdout.split("\n").slice(-15).join("\n");
        addLog("info", `stdout:\n${lastLines}`);
      }
      if (execResp.stderr) {
        const lastErr = execResp.stderr.split("\n").slice(-5).join("\n");
        if (lastErr.trim()) addLog("warn", `stderr:\n${lastErr}`);
      }

      baselineMetric = extractMetric(execResp.stdout, metricName);
      const memGb = extractPeakVram(execResp.stdout);
      // Use git rev-parse instead of assuming master branch
      const commitSha = await localExec.executeCode(localRunId, {
        command: "git rev-parse --short HEAD",
        timeout_seconds: 10,
      }).then(r => r.stdout?.trim().slice(0, 7) || "").catch(() => "");

      const baselineExp: Experiment = {
        round: 0,
        commit: commitSha || "initial",
        metric: baselineMetric,
        memoryGb: memGb,
        status: baselineMetric !== null ? "keep" : "crash",
        description: "baseline",
        duration: execResp.duration_seconds,
      };
      setExperiments([baselineExp]);

      if (baselineMetric !== null) {
        setBestMetric(baselineMetric);
        addLog("success", `Baseline ${metricName}: ${baselineMetric}${memGb ? ` | VRAM: ${memGb}GB` : ""} | ${execResp.duration_seconds.toFixed(1)}s`);

        // Write results.tsv header + baseline
        await localExec.writeFile(localRunId, "results.tsv",
          `commit\t${metricName}\tmemory_gb\tstatus\tdescription\n` +
          `${baselineExp.commit}\t${baselineMetric.toFixed(6)}\t${memGb?.toFixed(1) || "0.0"}\tkeep\tbaseline\n`
        );
      } else {
        // Auto-fix: feed error back to LLM to fix train.py
        addLog("warn", `Baseline crash — 无法提取 ${metricName}，尝试自动修复...`);
        const crashErr = [execResp.stderr || "", execResp.stdout || ""].join("\n").slice(-1500);
        const currentTrainCode = await localExec.readFile(localRunId, "train.py").catch(() => "");
        const fixPrompt = `The train.py script crashed. Fix it.

Error output:
\`\`\`
${crashErr}
\`\`\`

Current train.py:
\`\`\`python
${currentTrainCode}
\`\`\`

Goal: ${goal}
Metric: must print "${metricName}: <value>" after "---"

Fix the error and return the COMPLETE fixed train.py. Return ONLY Python code, no markdown fences.`;
        try {
          const fixResp = await chatCompletion(llm, [
            { role: "system", content: "You are an expert ML debugger. Fix the code and return ONLY the complete fixed Python file." },
            { role: "user", content: fixPrompt },
          ], { maxTokens: dynamicMaxTokens, temperature: 0.2 });
          const fixedCode = fixResp.replace(/^```(?:python)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
          if (fixedCode && fixedCode.includes("import")) {
            await localExec.writeCode(localRunId, "train.py", fixedCode, "Auto-fix train.py after baseline crash");
            setCurrentCode(fixedCode);
            addLog("info", "[Step 4] 已自动修复 train.py，重新安装依赖...");
            // Re-install deps for fixed code
            const fixImports = fixedCode.match(/^(?:import |from )\S+/gm) || [];
            const fixPkgs = new Set<string>();
            for (const line of fixImports) {
              const m = line.match(/(?:import|from)\s+(\w+)/);
              if (m) {
                const pkgMap: Record<string, string> = { torch: "torch torchvision", sklearn: "scikit-learn", cv2: "opencv-python", PIL: "Pillow", yaml: "pyyaml", np: "numpy", pd: "pandas", wfdb: "wfdb" };
                const stdlib = new Set(["os", "sys", "time", "math", "json", "re", "pathlib", "collections", "functools", "itertools", "typing", "abc", "io", "copy", "random", "datetime", "argparse", "logging", "warnings", "csv", "hashlib", "shutil", "glob", "subprocess"]);
                if (!stdlib.has(m[1])) fixPkgs.add(pkgMap[m[1]] || m[1]);
              }
            }
            if (fixPkgs.size > 0) {
              await localExec.executeCode(localRunId, { command: `${envPip} install ${[...fixPkgs].join(" ")}`, timeout_seconds: 300 });
            }
            addLog("info", "[Step 4] 重新运行 baseline...");
            const retryExec = await localExec.executeCode(localRunId, { command: actualRunCmd, timeout_seconds: timeoutSec });
            if (retryExec.stdout) {
              const lastLines = retryExec.stdout.split("\n").slice(-15).join("\n");
              addLog("info", `stdout:\n${lastLines}`);
            }
            baselineMetric = extractMetric(retryExec.stdout, metricName);
            if (baselineMetric !== null) {
              setBestMetric(baselineMetric);
              const memGb2 = extractPeakVram(retryExec.stdout);
              addLog("success", `[Step 4] 修复成功! Baseline ${metricName}: ${baselineMetric} | ${retryExec.duration_seconds.toFixed(1)}s`);
              setExperiments([{ round: 0, commit: "fixed", metric: baselineMetric, memoryGb: memGb2, status: "keep", description: "baseline (auto-fixed)", duration: retryExec.duration_seconds }]);
              await localExec.writeFile(localRunId, "results.tsv",
                `commit\t${metricName}\tmemory_gb\tstatus\tdescription\nfixed\t${baselineMetric.toFixed(6)}\t${memGb2?.toFixed(1) || "0.0"}\tkeep\tbaseline (auto-fixed)\n`
              );
            } else {
              addLog("error", `[Step 4] 修复后仍然 crash，请手动检查 train.py`);
            }
          }
        } catch (fixErr) {
          addLog("error", `[Step 4] 自动修复失败: ${fixErr instanceof Error ? fixErr.message : String(fixErr)}`);
        }
        if (baselineMetric === null) {
          addLog("error", `Baseline crash — 无法提取 ${metricName}。请检查 train.py。`);
          if (execResp.stderr) {
            addLog("error", execResp.stderr.split("\n").slice(-10).join("\n"));
          }
          setPhase("completed");
          return;
        }
      }
    } catch (err) {
      addLog("error", `Baseline 执行失败: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("completed");
      return;
    }

    // 3. Experiment loop — LOOP FOREVER
    let best = baselineMetric!;
    let round = 0;

    while (!abortRef.current) {
      round++;
      addLog("info", `\n═══ 实验 #${round} ═══`);

      const roundStart = Date.now();
      const newExp: Experiment = {
        round,
        commit: "",
        metric: null,
        memoryGb: null,
        status: "running",
        description: "...",
        duration: 0,
      };
      setExperiments((prev) => [...prev, newExp]);

      try {
        // Read current train.py
        const currentTrainPy = await localExec.readFile(localRunId, "train.py");
        setCurrentCode(currentTrainPy);

        // Read results.tsv for context
        const resultsTsv = await localExec.readFile(localRunId, "results.tsv").catch(() => "");

        // Read program.md and research summary for experiment context
        const programMd = await localExec.readFile(localRunId, "program.md").catch(() => "");
        const researchCtx = await localExec.readFile(localRunId, "research_summary.md").catch(() => "");

        // Ask LLM to modify train.py (with program.md + research as context)
        const prompt = `You are an autonomous ML researcher following the program.md rules.

${programMd ? `=== program.md ===\n${programMd.slice(0, 3000)}\n=== end ===\n` : `Goal: ${goal || "get the lowest " + metricName}\n${planContext?.hypothesis ? `Hypothesis: ${planContext.hypothesis}` : ""}\n${planContext?.method ? `Method: ${planContext.method}` : ""}`}

Current train.py:
\`\`\`python
${currentTrainPy}
\`\`\`

Results so far:
${resultsTsv}

Current best ${metricName}: ${best}
${researchCtx ? `\n=== Literature Review ===\n${researchCtx.slice(0, 1500)}\n=== end ===\nUse insights from the literature review to guide your modifications.\n` : ""}
Rules:
- You can ONLY modify train.py. No new files, no new dependencies.
- The goal is to get the ${metricDirection === "lower" ? "lowest" : "highest"} ${metricName}.
- The script runs with a fixed time budget. Everything is fair game: architecture, optimizer, hyperparameters, batch size, model size.
- Simplicity criterion: simpler is better. A small improvement with ugly complexity is not worth it.
- DO NOT just add comments or formatting changes. Make a real, substantive modification.

Respond with EXACTLY this JSON format (no markdown fences, no extra text):
{"description":"short description of what you're trying","code":"THE COMPLETE MODIFIED train.py CODE"}

The "code" field must contain the COMPLETE train.py file, not a diff. Include ALL imports, ALL functions, ALL code.`;

        addLog("info", `[实验 #${round}] 向 LLM 发送 train.py (${currentTrainPy.length} 字符) + results.tsv, 等待修改建议...`);
        const resp = await chatCompletion(llm, [{ role: "user", content: prompt }], { maxTokens: dynamicMaxTokens, temperature: 0.7 });
        addLog("info", `[实验 #${round}] LLM 返回 ${resp.length} 字符`);

        // Parse LLM response — try JSON first, then code block fallback
        let description = "";
        let newCode = "";
        try {
          let cleaned = resp.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
          cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
          const parsed = JSON.parse(cleaned);
          description = parsed.description || "unknown modification";
          newCode = parsed.code || "";
          addLog("info", `[实验 #${round}] JSON 解析成功: "${description}"`);
        } catch (parseErr) {
          addLog("info", `[实验 #${round}] JSON 解析失败，尝试 code block 提取...`);
          // Try to extract code from response
          const codeMatch = resp.match(/```python\n([\s\S]*?)```/);
          if (codeMatch) {
            newCode = codeMatch[1];
            // Try to find description in the text before the code block
            const beforeCode = resp.split("```python")[0];
            const descMatch = beforeCode.match(/description["\s:]*[:\s]*["']?([^"'\n]+)/i);
            description = descMatch ? descMatch[1].trim() : beforeCode.split("\n").filter(l => l.trim())[0]?.slice(0, 80) || "modification";
            addLog("info", `[实验 #${round}] Code block 提取成功: "${description}" (${newCode.length} 字符)`);
          } else {
            addLog("error", `[实验 #${round}] LLM 返回格式错误，跳过本轮。前 200 字符: ${resp.slice(0, 200)}`);
            setExperiments((prev) => prev.map((e) =>
              e.round === round ? { ...e, status: "crash", description: "LLM format error", duration: (Date.now() - roundStart) / 1000 } : e
            ));
            continue;
          }
        }

        if (!newCode.trim()) {
          addLog("error", "LLM 返回空代码，跳过");
          setExperiments((prev) => prev.map((e) =>
            e.round === round ? { ...e, status: "crash", description: "empty code", duration: (Date.now() - roundStart) / 1000 } : e
          ));
          continue;
        }

        addLog("info", `[实验 #${round}] 修改方向: ${description}`);

        // Write modified train.py and git commit
        addLog("info", `[实验 #${round}] 写入 train.py (${newCode.split("\n").length} 行) → git commit...`);
        const writeResp = await localExec.writeCode(localRunId, "train.py", newCode, `Exp #${round}: ${description}`);
        const commitSha = writeResp.commit_sha.slice(0, 7);
        addLog("info", `[实验 #${round}] 已提交 ${commitSha} → 开始执行...`);

        // Run experiment
        addLog("info", `[实验 #${round}] 执行: ${actualRunCmd}`);
        const execResp = await localExec.executeCode(localRunId, {
          command: actualRunCmd,
          timeout_seconds: timeoutSec,
        });

        const duration = execResp.duration_seconds;

        if (execResp.stdout) {
          const lastLines = execResp.stdout.split("\n").slice(-15).join("\n");
          addLog("info", `stdout:\n${lastLines}`);
        }

        // Extract metrics
        const metric = extractMetric(execResp.stdout, metricName);
        const memGb = extractPeakVram(execResp.stdout);

        if (metric === null) {
          // Crash or no metric output
          addLog("error", `Crash — 无法提取 ${metricName}`);
          if (execResp.stderr) {
            const tail = execResp.stderr.split("\n").slice(-10).join("\n");
            addLog("error", `stderr:\n${tail}`);
          }

          // git reset --hard HEAD~1
          await localExec.decide(localRunId, {
            keep: false,
            iteration: round,
            commit_sha: commitSha,
            duration,
            exit_code: execResp.exit_code,
          });
          addLog("info", `git reset — 回退到上一个 commit`);

          // Log to results.tsv
          const tsvLine = `${commitSha}\t0.000000\t0.0\tcrash\t${description}\n`;
          const currentTsv = await localExec.readFile(localRunId, "results.tsv").catch(() => "");
          await localExec.writeFile(localRunId, "results.tsv", currentTsv + tsvLine);

          setExperiments((prev) => prev.map((e) =>
            e.round === round ? { ...e, commit: commitSha, metric: null, memoryGb: null, status: "crash", description, duration } : e
          ));
          continue;
        }

        // Compare with best
        const improved = metricDirection === "lower"
          ? metric < best
          : metric > best;

        if (improved) {
          // KEEP — advance the branch
          await localExec.decide(localRunId, {
            keep: true,
            iteration: round,
            commit_sha: commitSha,
            duration,
            exit_code: execResp.exit_code,
            extra_metrics: execResp.metrics,
          });
          best = metric;
          setBestMetric(best);
          addLog("success", `✓ KEEP — ${metricName}: ${metric.toFixed(6)} (改进 ${metricDirection === "lower" ? "↓" : "↑"}) | ${duration.toFixed(1)}s`);
        } else {
          // DISCARD — git reset
          await localExec.decide(localRunId, {
            keep: false,
            iteration: round,
            commit_sha: commitSha,
            duration,
            exit_code: execResp.exit_code,
          });
          addLog("info", `✗ DISCARD — ${metricName}: ${metric.toFixed(6)} (未改进, best=${best.toFixed(6)}) | ${duration.toFixed(1)}s`);
        }

        // Log to results.tsv
        const status = improved ? "keep" : "discard";
        const tsvLine = `${commitSha}\t${metric.toFixed(6)}\t${memGb?.toFixed(1) || "0.0"}\t${status}\t${description}\n`;
        const currentTsv = await localExec.readFile(localRunId, "results.tsv").catch(() => "");
        await localExec.writeFile(localRunId, "results.tsv", currentTsv + tsvLine);

        setExperiments((prev) => prev.map((e) =>
          e.round === round ? {
            ...e,
            commit: commitSha,
            metric,
            memoryGb: memGb,
            status: improved ? "keep" : "discard",
            description,
            duration,
          } : e
        ));

        setCurrentCode(improved ? newCode : currentTrainPy);

      } catch (err) {
        const duration = (Date.now() - roundStart) / 1000;
        addLog("error", `实验 #${round} 异常: ${err instanceof Error ? err.message : String(err)}`);
        setExperiments((prev) => prev.map((e) =>
          e.round === round ? { ...e, status: "crash", description: String(err).slice(0, 60), duration } : e
        ));
      }
    }

    addLog("info", `\n═══ 实验阶段完成 — 共 ${round} 轮, 最佳 ${metricName}: ${best?.toFixed(6) || "N/A"} ═══`);
    addLog("info", "进入论文写作流水线...\n");

    // ── Paper writing pipeline (staged) ──
    if (localRunId && round > 0) {
      setPhase("paper");
      const resultsTsv = await localExec.readFile(localRunId, "results.tsv").catch(() => "");
      const bestTrainPy = await localExec.readFile(localRunId, "train.py").catch(() => "");
      const { parseJsonResponse } = await import("../../lib/deep-research/llm-client");
      const { buildSkillPrompt } = await import("../../lib/labclaw-skills");

      const sharedCtx = `研究目标: ${goal}
指标: ${metricName} (${metricDirection === "lower" ? "越低越好" : "越高越好"})
最佳 ${metricName}: ${best?.toFixed(6)}
实验总数: ${round}
实验结果 (TSV):
${resultsTsv}

最佳 train.py (前3000字符):
${bestTrainPy.slice(0, 3000)}`;

      // Helper: update stage status
      const setStage = (idx: number, status: "pending" | "running" | "done" | "error") => {
        setPaperStage(idx);
        setPaperStageStatus((prev) => ({ ...prev, [PAPER_STAGES[idx].key]: status }));
      };

      // ── Stage 0: 文献调研 ──
      setStage(0, "running");
      addLog("info", "══ 阶段 1/8: 文献调研 ══");
      addLog("info", "  → 加载 LabClaw skills: citation-management, literature-review, arxiv-search");
      addLog("info", "  → 生成: paper/related_work.md, paper/references.bib");
      try {
        const litSkill = await buildSkillPrompt("literature_review");
        const litResp = await chatCompletion(llm, [
          { role: "system", content: litSkill },
          { role: "user", content: `基于以下实验信息，完成文献调研阶段。

${sharedCtx}

请完成两项任务:

1. 撰写"相关工作"章节（中文，800字）:
   - 综述该研究领域的 3-5 个主要方向
   - 每个方向介绍 2-3 篇代表性工作
   - 分析现有方法的优缺点
   - 说明本研究与现有工作的区别
   - 引用格式: [Author2024]

2. 生成 BibTeX 参考文献库（15-20 条，英文，涵盖上述所有引用）

返回 JSON（不要 markdown 代码块）:
{
  "related_work": "相关工作全文",
  "bibtex": "完整的 .bib 文件内容"
}` }], { maxTokens: dynamicMaxTokens, temperature: 0.3 });
        const lit = parseJsonResponse<{ related_work: string; bibtex: string }>(litResp);
        await localExec.writeFile(localRunId, "paper/related_work.md", `# 相关工作\n\n${lit.related_work}`);
        await localExec.writeFile(localRunId, "paper/references.bib", lit.bibtex || "");
        addLog("success", "  ✓ 文献调研完成");
        setStage(0, "done");
      } catch (err) {
        addLog("error", `  ✗ 文献调研失败: ${err instanceof Error ? err.message : String(err)}`);
        setStage(0, "error");
      }

      // ── Stage 1: 方法设计 ──
      setStage(1, "running");
      addLog("info", "\n══ 阶段 2/8: 方法设计 ══");
      addLog("info", "  → 加载 LabClaw skills: scientific-writing, pytorch-lightning, statistics");
      addLog("info", "  → 生成: paper/method.md");
      try {
        const methodSkill = await buildSkillPrompt("method_design");
        const methodResp = await chatCompletion(llm, [
          { role: "system", content: methodSkill },
          { role: "user", content: `基于以下实验信息，撰写"方法"章节。

${sharedCtx}

要求（中文，1200字）:
1. **问题定义** — 形式化描述问题，定义输入输出，数学符号
2. **模型架构** — 详细描述最终模型的架构设计（参考 train.py 中的模型定义）
3. **训练策略** — 优化器选择、学习率调度、正则化方法
4. **损失函数** — 损失函数的设计和选择理由
5. **自动化实验策略** — 描述 AutoResearch 的迭代优化策略
6. **评估方法** — 评估指标的定义和选择理由

要求学术规范，使用准确的技术术语。

只返回方法章节的正文文本，不要返回 JSON。` }], { maxTokens: dynamicMaxTokens, temperature: 0.3 });
        const cleanedMethod = methodResp.replace(/^```[^\n]*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
        await localExec.writeFile(localRunId, "paper/method.md", `# 方法\n\n${cleanedMethod}`);
        addLog("success", "  ✓ 方法设计完成");
        setStage(1, "done");
      } catch (err) {
        addLog("error", `  ✗ 方法设计失败: ${err instanceof Error ? err.message : String(err)}`);
        setStage(1, "error");
      }

      // ── Stage 2: 实验分析 ──
      setStage(2, "running");
      addLog("info", "\n══ 阶段 3/8: 实验分析 ══");
      addLog("info", "  → 加载 LabClaw skills: scientific-visualization, matplotlib, statistics");
      addLog("info", "  → 生成: analysis.py, generate_figures.py");
      try {
        const analysisSkill = await buildSkillPrompt("experiment_analysis");
        const analysisResp = await chatCompletion(llm, [
          { role: "system", content: analysisSkill },
          { role: "user", content: `Generate TWO Python scripts for analyzing ML experiment results.

${sharedCtx}

Script 1 (analysis.py): Data analysis
- Read results.tsv, compute statistics (mean, std, best, worst)
- Print summary table to stdout
- Save LaTeX table to tables/results_table.tex

Script 2 (generate_figures.py): Publication-quality figures
- figures/metric_curve.pdf — metric over iterations (keep=green, discard=red, crash=gray)
- figures/comparison.pdf — bar chart of all experiments
- figures/efficiency.pdf — metric vs training time scatter
- figures/best_vs_baseline.pdf — comparison
- Style: seaborn whitegrid, 12pt font, 300 DPI, PDF+PNG, Chinese labels
- Create figures/ and tables/ dirs automatically

Return JSON (no markdown fences):
{"analysis_py":"complete script","generate_figures_py":"complete script"}` }], { maxTokens: dynamicMaxTokens, temperature: 0.3 });
        const scripts = parseJsonResponse<{ analysis_py: string; generate_figures_py: string }>(analysisResp);
        if (scripts.analysis_py) {
          await localExec.writeFile(localRunId, "analysis.py", scripts.analysis_py);
          addLog("success", "  ✓ analysis.py");
        }
        if (scripts.generate_figures_py) {
          await localExec.writeFile(localRunId, "generate_figures.py", scripts.generate_figures_py);
          addLog("success", "  ✓ generate_figures.py");
        }

        // Auto-run analysis scripts to generate figures
        addLog("info", "  运行 analysis.py ...");
        const analysisExec = await localExec.executeCode(localRunId, { command: `${envPython} analysis.py`, timeout_seconds: 120 });
        if (analysisExec.exit_code === 0) {
          addLog("success", "  ✓ analysis.py 执行完成");
        } else {
          addLog("warn", `  analysis.py 失败 (exit ${analysisExec.exit_code})`);
        }

        addLog("info", "  运行 generate_figures.py ...");
        const figExec = await localExec.executeCode(localRunId, { command: `${envPython} generate_figures.py`, timeout_seconds: 120 });
        if (figExec.exit_code === 0) {
          addLog("success", "  ✓ 图表已生成到 figures/");
        } else {
          addLog("warn", `  generate_figures.py 失败 (exit ${figExec.exit_code})`);
        }

        setStage(2, "done");
      } catch (err) {
        addLog("error", `  ✗ 实验分析失败: ${err instanceof Error ? err.message : String(err)}`);
        setStage(2, "error");
      }

      // ── Stage 3: 结果撰写 ──
      setStage(3, "running");
      addLog("info", "\n══ 阶段 4/8: 结果撰写 ══");
      addLog("info", "  → 加载 LabClaw skills: scientific-writing, statistics, scientific-visualization");
      addLog("info", "  → 生成: paper/experiments.md, paper/results.md");
      try {
        const resultsSkill = await buildSkillPrompt("results_writing");
        const resultsResp = await chatCompletion(llm, [
          { role: "system", content: resultsSkill },
          { role: "user", content: `基于以下实验信息，撰写"实验"和"结果"两个章节。

${sharedCtx}

返回 JSON（不要 markdown 代码块）:
{
  "experiments": "实验设置章节（中文，800字）— 包含: 数据集描述、实验环境、评估指标定义、基线方法、实现细节、超参数设置",
  "results": "结果与分析章节（中文，1000字）— 包含: 主要结果（含具体数值）、与基线对比、消融实验分析、不同迭代的效果对比、统计显著性讨论、图表引用说明"
}` }], { maxTokens: dynamicMaxTokens, temperature: 0.3 });
        const res = parseJsonResponse<{ experiments: string; results: string }>(resultsResp);
        if (res.experiments) {
          await localExec.writeFile(localRunId, "paper/experiments.md", `# 实验\n\n${res.experiments}`);
          addLog("success", "  ✓ paper/experiments.md");
        }
        if (res.results) {
          await localExec.writeFile(localRunId, "paper/results.md", `# 结果与分析\n\n${res.results}`);
          addLog("success", "  ✓ paper/results.md");
        }
        setStage(3, "done");
      } catch (err) {
        addLog("error", `  ✗ 结果撰写失败: ${err instanceof Error ? err.message : String(err)}`);
        setStage(3, "error");
      }

      // ── Stage 4: 引言与摘要 ──
      setStage(4, "running");
      addLog("info", "\n══ 阶段 5/8: 引言与摘要 ══");
      addLog("info", "  → 生成: paper/introduction.md, paper/abstract.md");
      try {
        // Read already-written sections for context
        const relatedWork = await localExec.readFile(localRunId, "paper/related_work.md").catch(() => "");
        const method = await localExec.readFile(localRunId, "paper/method.md").catch(() => "");
        const results = await localExec.readFile(localRunId, "paper/results.md").catch(() => "");

        const introSkill = await buildSkillPrompt("intro_abstract");
        const introResp = await chatCompletion(llm, [
          { role: "system", content: introSkill },
          { role: "user", content: `基于已完成的章节，撰写"引言"和"摘要"。

已完成章节摘要:
相关工作: ${relatedWork.slice(0, 800)}
方法: ${method.slice(0, 800)}
结果: ${results.slice(0, 800)}

${sharedCtx}

返回 JSON（不要 markdown 代码块）:
{
  "title": "论文标题（中文）",
  "abstract": "摘要（中文，300字）— 背景 → 问题 → 方法 → 结果 → 结论",
  "keywords": "关键词（5-8个，逗号分隔）",
  "introduction": "引言（中文，1000字）— 包含: 研究背景和动机、现有方法的不足（引用相关工作）、本文的主要贡献（3-4点列举）、论文结构概述"
}` }], { maxTokens: dynamicMaxTokens, temperature: 0.3 });
        const intro = parseJsonResponse<{ title?: string; abstract: string; keywords: string; introduction: string }>(introResp);
        if (intro.title) {
          await localExec.writeFile(localRunId, "paper/title.md", `# ${intro.title}`);
        }
        await localExec.writeFile(localRunId, "paper/abstract.md", `# 摘要\n\n${intro.abstract}\n\n**关键词**: ${intro.keywords}`);
        await localExec.writeFile(localRunId, "paper/introduction.md", `# 引言\n\n${intro.introduction}`);
        addLog("success", "  ✓ 引言与摘要完成");
        setStage(4, "done");
      } catch (err) {
        addLog("error", `  ✗ 引言与摘要失败: ${err instanceof Error ? err.message : String(err)}`);
        setStage(4, "error");
      }

      // ── Stage 5: 讨论与结论 ──
      setStage(5, "running");
      addLog("info", "\n══ 阶段 6/8: 讨论与结论 ══");
      addLog("info", "  → 生成: paper/discussion.md, paper/conclusion.md, paper/acknowledgments.md");
      try {
        const discSkill = await buildSkillPrompt("discussion_conclusion");
        const discResp = await chatCompletion(llm, [
          { role: "system", content: discSkill },
          { role: "user", content: `基于实验结果，撰写"讨论"、"结论"和"致谢"。

${sharedCtx}

返回 JSON（不要 markdown 代码块）:
{
  "discussion": "讨论（中文，500字）— 包含: 结果的深入解读、方法的局限性（至少3点）、潜在改进方向、与现有方法的对比讨论",
  "conclusion": "结论（中文，400字）— 包含: 工作总结、主要贡献重申、未来研究方向",
  "acknowledgments": "致谢（中文，100字）"
}` }], { maxTokens: dynamicMaxTokens, temperature: 0.3 });
        const disc = parseJsonResponse<{ discussion: string; conclusion: string; acknowledgments: string }>(discResp);
        await localExec.writeFile(localRunId, "paper/discussion.md", `# 讨论\n\n${disc.discussion}`);
        await localExec.writeFile(localRunId, "paper/conclusion.md", `# 结论\n\n${disc.conclusion}`);
        await localExec.writeFile(localRunId, "paper/acknowledgments.md", `# 致谢\n\n${disc.acknowledgments}`);
        addLog("success", "  ✓ 讨论与结论完成");
        setStage(5, "done");
      } catch (err) {
        addLog("error", `  ✗ 讨论与结论失败: ${err instanceof Error ? err.message : String(err)}`);
        setStage(5, "error");
      }

      // ── Stage 6: 补充材料 ──
      setStage(6, "running");
      addLog("info", "\n══ 阶段 7/8: 补充材料 ══");
      addLog("info", "  → 生成: supplementary/*.md");
      try {
        await localExec.writeFile(localRunId, "supplementary/experiment_details.md",
          `# 实验详细记录\n\n## 完整结果\n\`\`\`\n${resultsTsv}\n\`\`\`\n\n## 最佳模型代码\n\`\`\`python\n${bestTrainPy}\n\`\`\``);

        const suppSkill = await buildSkillPrompt("supplementary");
        const suppResp = await chatCompletion(llm, [
          { role: "system", content: suppSkill },
          { role: "user", content: `基于以下 AutoResearch 实验结果，生成补充材料。

${sharedCtx}

返回 JSON（不要 markdown 代码块）:
{
  "hyperparameter_table": "超参数搜索空间的 Markdown 表格（参数 | 搜索范围 | 最佳值）",
  "architecture_evolution": "模型架构演化描述（中文，500字）— 从 baseline 到最终模型的演化过程",
  "reproducibility": "可复现性声明（中文，200字）— 运行环境、随机种子、硬件需求",
  "compute_budget": "计算预算分析（中文，200字）— 总训练时间、平均单次实验时间、效率分析"
}` }], { maxTokens: dynamicMaxTokens, temperature: 0.3 });
        const supp = parseJsonResponse<Record<string, string>>(suppResp);
        const suppFiles = [
          ["hyperparameters.md", "超参数搜索空间", supp.hyperparameter_table],
          ["architecture_evolution.md", "模型架构演化", supp.architecture_evolution],
          ["reproducibility.md", "可复现性声明", supp.reproducibility],
          ["compute_budget.md", "计算预算分析", supp.compute_budget],
        ] as const;
        for (const [file, title, content] of suppFiles) {
          if (content) {
            await localExec.writeFile(localRunId, `supplementary/${file}`, `# ${title}\n\n${content}`);
          }
        }
        addLog("success", "  ✓ 补充材料完成");
        setStage(6, "done");
      } catch (err) {
        addLog("error", `  ✗ 补充材料失败: ${err instanceof Error ? err.message : String(err)}`);
        setStage(6, "error");
      }

      // ── Stage 7: LaTeX 整合 ──
      setStage(7, "running");
      addLog("info", "\n══ 阶段 8/8: LaTeX 整合 ══");
      addLog("info", "  → 生成: paper/main.tex, paper/full_paper.md, Makefile, SUMMARY.md");
      try {
        // Read all paper sections for assembly
        const allSections = ["abstract", "introduction", "related_work", "method", "experiments", "results", "discussion", "conclusion", "acknowledgments"];
        const sectionLabels: Record<string, string> = {
          abstract: "摘要", introduction: "引言", related_work: "相关工作", method: "方法",
          experiments: "实验", results: "结果与分析", discussion: "讨论", conclusion: "结论", acknowledgments: "致谢",
        };
        const sectionContents: Record<string, string> = {};
        for (const s of allSections) {
          sectionContents[s] = await localExec.readFile(localRunId, `paper/${s}.md`).catch(() => "");
        }
        const titleContent = await localExec.readFile(localRunId, "paper/title.md").catch(() => "");
        const bibContent = await localExec.readFile(localRunId, "paper/references.bib").catch(() => "");

        // Assemble full_paper.md
        const fullPaperMd = [
          titleContent,
          ...allSections.filter((s) => sectionContents[s]).map((s) => sectionContents[s]),
        ].join("\n\n---\n\n");
        await localExec.writeFile(localRunId, "paper/full_paper.md", fullPaperMd);

        // Generate LaTeX
        const latexSkill = await buildSkillPrompt("latex_compile");
        const latexResp = await chatCompletion(llm, [
          { role: "system", content: latexSkill },
          { role: "user", content: `将以下论文内容整合为一个完整的、可编译的 LaTeX 文件。

${fullPaperMd.slice(0, 8000)}

参考文献 BibTeX:
${bibContent.slice(0, 2000)}

要求:
- 使用 article 文档类 + ctex 宏包（中文支持）
- xelatex 编译
- 包含所有章节的完整内容（不是占位符）
- 图表引用: \\includegraphics{../figures/metric_curve.pdf} 等
- 结果表格用 \\input{../tables/results_table.tex}
- BibTeX 引用
- 页眉页脚、行号（审稿用）

只返回 .tex 文件内容，不要 markdown 代码块。` }], { maxTokens: dynamicMaxTokens, temperature: 0.3 });
        const cleanedTex = latexResp.replace(/^```(?:latex|tex)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
        await localExec.writeFile(localRunId, "paper/main.tex", cleanedTex);
        addLog("success", "  ✓ paper/main.tex");

        // Makefile
        await localExec.writeFile(localRunId, "Makefile", `# AutoResearch 论文编译
.PHONY: all figures paper analysis clean

all: figures paper

figures:
\t@echo "生成图表..."
\tpython generate_figures.py
\t@echo "图表已保存到 figures/"

paper: figures
\t@echo "编译 LaTeX..."
\tcd paper && xelatex -interaction=nonstopmode main.tex
\tcd paper && bibtex main || true
\tcd paper && xelatex -interaction=nonstopmode main.tex
\tcd paper && xelatex -interaction=nonstopmode main.tex
\t@echo "论文已编译: paper/main.pdf"

analysis:
\tpython analysis.py

clean:
\trm -f paper/*.aux paper/*.bbl paper/*.blg paper/*.log paper/*.out paper/*.toc
`);
        addLog("success", "  ✓ Makefile");

        // SUMMARY.md
        const doneStages = PAPER_STAGES.map((s, i) => {
          const st = paperStageStatus[s.key] || (i <= 7 ? "done" : "pending");
          return `| ${st === "done" ? "✓" : st === "error" ? "✗" : "…"} | ${s.label} | ${s.files.join(", ")} |`;
        });
        await localExec.writeFile(localRunId, "SUMMARY.md", `# AutoResearch 实验总结

## 基本信息
- **目标**: ${goal}
- **实验轮数**: ${round}
- **最佳 ${metricName}**: ${best?.toFixed(6) || "N/A"}
- **完成时间**: ${new Date().toLocaleString("zh-CN")}

## 论文写作进度
| 状态 | 阶段 | 输出文件 |
|------|------|---------|
${doneStages.join("\n")}

## 快速开始
\`\`\`bash
# 生成图表
python generate_figures.py

# 数据分析
python analysis.py

# 编译论文 (需要 xelatex + ctex)
make paper

# 一键全部
make all
\`\`\`

## 实验结果
\`\`\`
${resultsTsv}
\`\`\`
`);
        addLog("success", "  ✓ SUMMARY.md");
        addLog("success", "\n═══ 论文写作流水线完成！所有文件已就绪 ═══");
        setStage(7, "done");
      } catch (err) {
        addLog("error", `  ✗ LaTeX 整合失败: ${err instanceof Error ? err.message : String(err)}`);
        setStage(7, "error");
      }
    }

    setPhase("completed");
  };

  const handleStop = () => {
    abortRef.current = true;
    addLog("warn", "停止中... (等待当前实验完成)");
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <Navbar />
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <i className="ri-flask-line text-accent-cyan" />
              AutoResearch
            </h1>
            <p className="text-xs text-text-muted mt-1">
              Karpathy-style autonomous experiment loop — modify train.py → run → keep/discard → repeat
            </p>
          </div>
          <div className="flex items-center gap-3">
            {phase === "running" && (
              <button onClick={handleStop}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors">
                <i className="ri-stop-line mr-1" />停止
              </button>
            )}
            {phase === "completed" && (
              <>
                <button onClick={() => { abortRef.current = false; setPhase("running"); handleStart(); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/10 transition-colors">
                  <i className="ri-play-line mr-1" />继续
                </button>
                <button onClick={() => { setPhase("setup"); setLogs([]); setExperiments([]); setRunId(null); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-cyan text-bg-primary hover:opacity-90 transition-opacity">
                  <i className="ri-add-line mr-1" />新实验
                </button>
              </>
            )}
          </div>
        </div>

        {phase === "setup" ? (
          <SetupView
            goal={goal} onGoalChange={setGoal}
            initialCode={initialCode} onInitialCodeChange={setInitialCode}
            runCommand={runCommand} onRunCommandChange={setRunCommand}
            metricName={metricName} onMetricNameChange={setMetricName}
            metricDirection={metricDirection} onMetricDirectionChange={setMetricDirection}
            timeoutSec={timeoutSec} onTimeoutSecChange={setTimeoutSec}
            selectedTemplate={selectedTemplate}
            onTemplateChange={(t) => {
              setSelectedTemplate(t);
              const tmpl = TEMPLATES[t];
              if (tmpl && tmpl.code) {
                setInitialCode(tmpl.code);
                setMetricName(tmpl.metric);
                setMetricDirection(tmpl.direction);
                setRunCommand(tmpl.command);
              }
            }}
            planContext={planContext}
            generatingCode={generatingCode}
            onGenerateFromPlan={async () => {
              try {
                const llm = getLLMConfig();
                if (!llm) {
                  alert("请先在设置中配置 LLM (API Key + API Base + Model)");
                  return;
                }
                if (!goal.trim()) {
                  alert("请先填写实验目标");
                  return;
                }
                setGeneratingCode(true);
                const { chatCompletion, fetchModelMaxTokens } = await import("../../lib/deep-research/llm-client");
                const modelMax = await fetchModelMaxTokens(llm);
                const maxTokens = Math.min(16384, Math.max(8192, Math.floor(modelMax * 0.25)));

                const prompt = `Generate a complete, runnable train.py for this research experiment.

Goal: ${goal}
${planContext?.hypothesis ? `Hypothesis: ${planContext.hypothesis}` : ""}
${planContext?.method ? `Method: ${planContext.method}` : ""}
${planContext?.expectedImprovement ? `Expected outcome: ${planContext.expectedImprovement}` : ""}
${planContext?.datasets ? `Datasets: ${JSON.stringify(planContext.datasets).slice(0, 500)}` : ""}
${planContext?.codeSketch ? `Code sketch:\n${planContext.codeSketch}` : ""}

Requirements:
- Single file, complete and runnable with "python train.py"
- The model and approach MUST match the experiment hypothesis and method above
- The dataset MUST match the experiment domain — NEVER use MNIST/CIFAR for domain-specific goals (ECG, NLP, etc.)
- If data needs downloading, include download code using appropriate SDK (wfdb for PhysioNet, datasets for HuggingFace, etc.)
- Must print metrics at the end in this format:
  ---
  ${metricName}:     0.850000
  training_seconds: 45.2
- Print epoch-level metrics: Epoch N/Total — ${metricName}: value
- Include all imports, model definition, training loop, evaluation
- Keep it focused and functional (under 150 lines)

Return ONLY the Python code, no markdown fences, no explanation.`;
                const code = await chatCompletion(llm, [{ role: "user", content: prompt }], { maxTokens, temperature: 0.3 });
                const cleaned = code.replace(/^```(?:python)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
                if (cleaned) {
                  setInitialCode(cleaned);
                } else {
                  alert("生成失败：LLM 返回为空");
                }
              } catch (err) {
                console.error("Generate failed:", err);
                alert(`生成失败: ${err instanceof Error ? err.message : String(err)}`);
              } finally {
                setGeneratingCode(false);
              }
            }}
            onStart={handleStart}
          />
        ) : (
          <div className="flex flex-col gap-4 h-[calc(100vh-140px)]">
            {/* Paper writing progress bar */}
            {(phase === "paper" || (phase === "completed" && paperStage >= 0)) && (
              <div className="flex-shrink-0 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-2">
                  <i className="ri-article-line text-accent-cyan text-sm" />
                  <span className="text-xs font-semibold">论文写作流水线</span>
                  <span className="text-[10px] text-text-muted ml-auto">
                    {PAPER_STAGES.filter((s) => paperStageStatus[s.key] === "done").length}/{PAPER_STAGES.length} 完成
                  </span>
                </div>
                <div className="flex gap-1">
                  {PAPER_STAGES.map((stage, i) => {
                    const st = paperStageStatus[stage.key] || "pending";
                    return (
                      <div key={stage.key} className="flex-1 group relative">
                        <div className={`h-2 rounded-full transition-all ${
                          st === "done" ? "bg-green-400" :
                          st === "running" ? "bg-accent-cyan animate-pulse" :
                          st === "error" ? "bg-red-400" :
                          "bg-white/[0.08]"
                        }`} />
                        <div className={`mt-1 text-center text-[8px] truncate ${
                          st === "done" ? "text-green-400" :
                          st === "running" ? "text-accent-cyan font-medium" :
                          st === "error" ? "text-red-400" :
                          "text-text-muted"
                        }`}>
                          {stage.label}
                        </div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                          <div className="px-3 py-2 rounded-lg bg-bg-secondary border border-white/[0.1] shadow-lg text-[9px] whitespace-nowrap">
                            <div className="font-medium text-text-primary mb-1">{stage.label}</div>
                            <div className="text-text-muted">{stage.desc}</div>
                            <div className="text-text-muted mt-1">文件: {stage.files.join(", ")}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-4 flex-1 min-h-0">
            {/* Left: Experiment History */}
            <div className="w-72 flex-shrink-0 border border-white/[0.06] rounded-xl overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                <h2 className="text-xs font-semibold flex items-center gap-2">
                  <i className="ri-history-line text-accent-cyan" />
                  实验记录
                  <span className="text-text-muted font-normal">({experiments.length})</span>
                </h2>
                {bestMetric !== null && (
                  <div className="mt-1.5 text-[10px] text-green-400">
                    最佳 {metricName}: {bestMetric.toFixed(6)}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {experiments.map((exp) => (
                  <button key={exp.round} onClick={() => setExpandedExp(expandedExp === exp.round ? null : exp.round)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                      exp.status === "keep" ? "border-green-400/20 bg-green-400/[0.04]" :
                      exp.status === "discard" ? "border-white/[0.06] bg-white/[0.01]" :
                      exp.status === "crash" ? "border-red-400/20 bg-red-400/[0.04]" :
                      "border-accent-cyan/20 bg-accent-cyan/[0.04] animate-pulse"
                    }`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        exp.status === "keep" ? "bg-green-400" :
                        exp.status === "discard" ? "bg-gray-500" :
                        exp.status === "crash" ? "bg-red-400" :
                        "bg-accent-cyan animate-pulse"
                      }`} />
                      <span className="text-[11px] font-mono text-text-primary">
                        {exp.round === 0 ? "baseline" : `#${exp.round}`}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono">{exp.commit || "..."}</span>
                      <span className={`ml-auto text-[10px] font-mono ${
                        exp.status === "keep" ? "text-green-400" :
                        exp.status === "crash" ? "text-red-400" :
                        "text-text-muted"
                      }`}>
                        {exp.metric?.toFixed(4) || "—"}
                      </span>
                    </div>
                    <div className="mt-1 text-[9px] text-text-muted truncate">{exp.description}</div>
                    {expandedExp === exp.round && (
                      <div className="mt-2 pt-2 border-t border-white/[0.06] text-[9px] text-text-secondary space-y-0.5">
                        <div>Status: <span className={exp.status === "keep" ? "text-green-400" : exp.status === "crash" ? "text-red-400" : "text-text-muted"}>{exp.status}</span></div>
                        {exp.metric !== null && <div>{metricName}: {exp.metric.toFixed(6)}</div>}
                        {exp.memoryGb !== null && <div>VRAM: {exp.memoryGb}GB</div>}
                        <div>Duration: {exp.duration.toFixed(1)}s</div>
                      </div>
                    )}
                  </button>
                ))}
                {experiments.length === 0 && (
                  <p className="text-[10px] text-text-muted text-center py-8">等待实验开始...</p>
                )}
              </div>
            </div>

            {/* Center: Logs */}
            <div className="flex-1 border border-white/[0.06] rounded-xl overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
                <h2 className="text-xs font-semibold flex items-center gap-2">
                  <i className="ri-terminal-line text-accent-cyan" />
                  实验日志
                </h2>
                {phase === "running" && (
                  <span className="text-[10px] text-accent-cyan flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
                    运行中
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed bg-[#0a0e14]">
                {logs.map((log, i) => (
                  <div key={i} className={`${
                    log.level === "error" ? "text-red-400" :
                    log.level === "warn" ? "text-amber-400" :
                    log.level === "success" ? "text-green-400" :
                    "text-text-secondary"
                  } ${log.message.startsWith("\n") ? "mt-3" : ""} whitespace-pre-wrap`}>
                    <span className="text-text-muted">{log.time}</span> {log.message}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>

            {/* Right: Workspace Files */}
            <div className="w-80 flex-shrink-0 border border-white/[0.06] rounded-xl overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                <h2 className="text-xs font-semibold flex items-center gap-2">
                  <i className="ri-folder-open-line text-accent-cyan" />
                  工作区文件
                  <span className="text-text-muted font-normal">({workspaceFiles.length})</span>
                </h2>
                {runId && (
                  <div className="mt-1 text-[9px] text-text-muted font-mono truncate">
                    ~/studyhub-workspaces/{runId}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {workspaceFiles.length > 0 ? (
                  <div className="space-y-0.5">
                    {workspaceFiles.map((f) => (
                      <button key={f} onClick={async () => {
                        if (wsFileSelected === f) {
                          setWsFileSelected(null);
                          setWsFileContent(null);
                        } else {
                          setWsFileSelected(f);
                          try {
                            const content = await localExec.readFile(runId!, f);
                            setWsFileContent(content);
                          } catch { setWsFileContent("(读取失败)"); }
                        }
                      }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                          wsFileSelected === f
                            ? "bg-accent-cyan/10 text-accent-cyan"
                            : "hover:bg-white/[0.04] text-text-secondary"
                        }`}>
                        <i className={`text-xs ${
                          f.endsWith(".py") ? "ri-code-s-slash-line text-yellow-400" :
                          f.endsWith(".tsv") || f.endsWith(".csv") ? "ri-table-line text-green-400" :
                          f.endsWith(".log") ? "ri-file-text-line text-blue-400" :
                          "ri-file-line text-text-muted"
                        }`} />
                        <span className="text-[10px] truncate font-mono">{f}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-text-muted text-center py-8">等待工作区初始化...</p>
                )}

                {wsFileSelected && wsFileContent !== null && (
                  <div className="mt-3 p-3 rounded-lg bg-[#0a0e14] border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-accent-cyan font-mono">{wsFileSelected}</span>
                      <button onClick={() => navigator.clipboard.writeText(wsFileContent)}
                        className="text-[9px] px-2 py-0.5 rounded bg-white/[0.06] text-text-muted hover:text-accent-cyan cursor-pointer">
                        <i className="ri-clipboard-line mr-0.5" />复制
                      </button>
                    </div>
                    <pre className="text-[10px] font-mono text-text-secondary whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed">
                      {wsFileContent}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Setup View ───────────────────────────────────────────────────────────────

function SetupView({
  goal, onGoalChange,
  initialCode, onInitialCodeChange,
  runCommand, onRunCommandChange,
  metricName, onMetricNameChange,
  metricDirection, onMetricDirectionChange,
  timeoutSec, onTimeoutSecChange,
  selectedTemplate, onTemplateChange,
  planContext, generatingCode, onGenerateFromPlan,
  onStart,
}: {
  goal: string; onGoalChange: (v: string) => void;
  initialCode: string; onInitialCodeChange: (v: string) => void;
  runCommand: string; onRunCommandChange: (v: string) => void;
  metricName: string; onMetricNameChange: (v: string) => void;
  metricDirection: "lower" | "higher"; onMetricDirectionChange: (v: "lower" | "higher") => void;
  timeoutSec: number; onTimeoutSecChange: (v: number) => void;
  selectedTemplate: string; onTemplateChange: (v: string) => void;
  planContext: PlanContext | null;
  generatingCode: boolean;
  onGenerateFromPlan: () => void;
  onStart: () => void;
}) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Plan context banner */}
      {planContext && (
        <div className="p-4 rounded-xl bg-green-400/[0.06] border border-green-400/20">
          <div className="flex items-center gap-2 mb-2">
            <i className="ri-lightbulb-line text-green-400" />
            <span className="text-xs font-semibold text-green-400">已加载研究方案</span>
            <span className="text-xs text-text-secondary">{planContext.name}</span>
          </div>
          {planContext.hypothesis && (
            <div className="text-[10px] text-text-muted">假设: {planContext.hypothesis}</div>
          )}
          {planContext.method && (
            <div className="text-[10px] text-text-muted">方法: {planContext.method}</div>
          )}
        </div>
      )}

      {/* Goal */}
      <div className="p-6 rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <i className="ri-target-line text-accent-cyan" />
          实验目标
        </h2>
        <textarea
          value={goal}
          onChange={(e) => onGoalChange(e.target.value)}
          placeholder="例: get the lowest val_bpb (language model pretraining)"
          rows={3}
          className="w-full px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan/40 resize-y"
        />
      </div>

      {/* Template selector + Initial train.py */}
      <div className="p-6 rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <i className="ri-code-s-slash-line text-yellow-400" />
            初始 train.py
          </h2>
          <div className="flex items-center gap-2">
            {/* Template buttons */}
            {Object.entries(TEMPLATES).map(([key, tmpl]) => (
              <button key={key} onClick={() => onTemplateChange(key)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                  selectedTemplate === key
                    ? "bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30"
                    : "bg-white/[0.04] text-text-muted border border-white/[0.06] hover:bg-white/[0.08]"
                }`}>
                {tmpl.label}
              </button>
            ))}
            {/* Generate from plan */}
            {planContext && (
              <button onClick={onGenerateFromPlan} disabled={generatingCode}
                className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-green-400/10 text-green-400 border border-green-400/20 hover:bg-green-400/20 transition-all disabled:opacity-50">
                {generatingCode ? (
                  <><i className="ri-loader-4-line animate-spin mr-1" />生成中...</>
                ) : (
                  <><i className="ri-magic-line mr-1" />从方案生成</>
                )}
              </button>
            )}
          </div>
        </div>
        <textarea
          value={initialCode}
          onChange={(e) => onInitialCodeChange(e.target.value)}
          placeholder={`# 粘贴你的 train.py 代码\n# 脚本需要输出指标，格式如:\n# ---\n# val_accuracy:     0.850000\n# training_seconds: 45.2`}
          rows={20}
          className="w-full px-4 py-3 rounded-lg bg-[#0a0e14] border border-white/[0.08] text-[11px] font-mono text-text-secondary placeholder-text-muted focus:outline-none focus:border-accent-cyan/40 resize-y leading-relaxed"
        />
        <div className="mt-2 text-[9px] text-text-muted">
          脚本必须在 stdout 输出指标，格式: <code className="px-1 py-0.5 rounded bg-white/[0.06]">{metricName}: 数值</code>。LLM 会在此基础上迭代修改。
        </div>
      </div>

      {/* Configuration */}
      <div className="p-6 rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <i className="ri-settings-3-line text-accent-cyan" />
          配置
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-text-muted block mb-1">运行命令</label>
            <input value={runCommand} onChange={(e) => onRunCommandChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-text-primary focus:outline-none focus:border-accent-cyan/40" />
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-1">超时 (秒)</label>
            <input type="number" value={timeoutSec} onChange={(e) => onTimeoutSecChange(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-text-primary focus:outline-none focus:border-accent-cyan/40" />
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-1">目标指标名</label>
            <input value={metricName} onChange={(e) => onMetricNameChange(e.target.value)}
              placeholder="val_bpb"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-text-primary focus:outline-none focus:border-accent-cyan/40" />
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-1">优化方向</label>
            <select value={metricDirection} onChange={(e) => onMetricDirectionChange(e.target.value as "lower" | "higher")}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-text-primary focus:outline-none focus:border-accent-cyan/40">
              <option value="lower">越低越好 (loss, bpb)</option>
              <option value="higher">越高越好 (accuracy, f1)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Start button */}
      <button onClick={onStart}
        className="w-full py-3.5 rounded-xl text-sm font-semibold bg-accent-cyan text-bg-primary hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
        <i className="ri-play-fill" />
        开始实验循环
      </button>

      {/* Info box */}
      <div className="p-4 rounded-xl bg-accent-cyan/[0.04] border border-accent-cyan/20 text-[11px] text-text-secondary leading-relaxed">
        <h3 className="font-semibold text-accent-cyan mb-2">Karpathy AutoResearch 模式</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>先运行 baseline 获取初始指标</li>
          <li>LLM 读取当前 train.py + 历史结果</li>
          <li>LLM 提出代码修改（架构、超参、优化器...）</li>
          <li>写入修改后的 train.py → git commit</li>
          <li>真实运行 <code className="px-1 py-0.5 rounded bg-white/[0.06] font-mono">{runCommand}</code> → 提取 <code className="px-1 py-0.5 rounded bg-white/[0.06] font-mono">{metricName}</code></li>
          <li>指标改进 → keep commit，未改进 → git reset</li>
          <li>循环直到你手动停止</li>
        </ol>
      </div>
    </div>
  );
}
