# AutoResearch 全自动实验流水线 — 需求 & 设计 & 实现

## 1. 需求

### 核心需求（用户原话）
> "论文的计划从设计到数据集下载到模型文件到训练到跑曲线都要自动化，一个要求。"

### 详细需求列表

| # | 需求 | 状态 |
|---|------|------|
| 1 | **一键全自动**: 点击开始 → 自动走完全流程 → 输出论文 | ✅ 已完成 |
| 2 | **program.md**: 参考 Karpathy autoresearch 模式，生成实验目标文档 | ✅ 已完成 |
| 3 | **prepare.py 自动生成+执行**: LLM 生成数据下载脚本，自动运行 | ✅ 已完成 (分隔符格式) |
| 4 | **真实数据集**: 模板使用 MNIST/California Housing，LLM 自行寻找数据 | ✅ 已完成 |
| 5 | **实验循环**: modify train.py → git commit → run → extract metric → keep/discard | ✅ 已完成 |
| 6 | **论文写作**: 8 阶段（文献→方法→分析→结果→引言→讨论→补充→LaTeX） | ✅ 已完成 |
| 7 | **LabClaw Skills**: 每个论文写作阶段加载对应 SKILL.md 作为 LLM system prompt | ✅ 已完成 (路径可配置) |
| 8 | **详细日志**: 每一步都有清晰的 log 输出（[Step N] 前缀） | ✅ 已完成 |
| 9 | **超时策略**: 默认 24h (前端)、24h (Tauri)、30min (后端)，UI 可配置 | ✅ 已完成 |
| 10 | **maxTokens 动态化**: 根据模型上下文窗口动态设置，不硬编码 | ✅ 已完成 |
| 11 | **依赖自动安装**: conda 虚拟环境 + 清华镜像源 + pip install | ✅ 已完成 |
| 12 | **conda 虚拟环境**: 每次实验自动创建隔离的 conda env | ✅ 已完成 |

## 2. 架构设计

```
┌─────────────────────────────────────────────────────┐
│                    前端 (React)                       │
│  pages/autoresearch/page.tsx                         │
│                                                       │
│  ┌─────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ 配置面板 │  │ 日志面板  │  │ 实验表格 + 代码  │    │
│  └─────────┘  └──────────┘  └──────────────────┘    │
│         │            ▲              ▲                  │
│         ▼            │              │                  │
│  ┌─────────────────────────────────────────────┐     │
│  │         Pipeline Engine (handleStart)        │     │
│  │                                               │     │
│  │  Phase A: 实验准备                            │     │
│  │    Step 1: program.md (Karpathy 目标文档)     │     │
│  │    Step 2: train.py (LLM 生成 or 用户提供)   │     │
│  │    Step 3: prepare.py + pip install + 执行    │     │
│  │    Step 4: baseline 运行                      │     │
│  │                                               │     │
│  │  Phase B: 实验循环 (LOOP)                     │     │
│  │    LLM → modify train.py → commit → run →     │     │
│  │    extract metric → keep/discard → results.tsv│     │
│  │                                               │     │
│  │  Phase C: 论文写作 (8 stages)                 │     │
│  │    Stage 1-8: 加载 LabClaw skill → LLM →      │     │
│  │    生成 paper/*.md + figures/ + LaTeX          │     │
│  └─────────────────────────────────────────────┘     │
│                    │                                   │
│     ┌──────────────┼──────────────┐                   │
│     ▼              ▼              ▼                   │
│  local-exec.ts   llm-client.ts  labclaw-skills.ts   │
└─────────────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│ Tauri Backend │ │ LLM API  │ │ LabClaw      │
│ (Rust)        │ │ (proxy)  │ │ SKILL.md     │
│ autoresearch  │ │          │ │ 文件系统      │
│ .rs           │ │          │ │              │
└──────────────┘ └──────────┘ └──────────────┘
```

### 数据流

```
用户点击 "开始"
    │
    ├─→ fetchModelMaxTokens(llm) → dynamicMaxTokens
    │
    ├─→ Step 1: 写入 program.md (静态模板 + 用户目标)
    │
    ├─→ Step 2: chatCompletion → train.py (如果用户没提供)
    │
    ├─→ Step 3: chatCompletion → prepare.py + requirements.txt
    │     │   格式: ===PREPARE_PY=== / ===REQUIREMENTS_TXT=== / ===END===
    │     ├─→ pip install -r requirements.txt
    │     └─→ python prepare.py
    │
    ├─→ Step 4: python train.py → extractMetric → baseline
    │
    ├─→ LOOP (until user stops):
    │     ├─→ readFile(train.py, results.tsv, program.md)
    │     ├─→ chatCompletion → {"description":"...","code":"..."}
    │     ├─→ writeCode(train.py) → git commit
    │     ├─→ executeCode(python train.py) → extractMetric
    │     ├─→ metric improved? → keep : git reset
    │     └─→ append results.tsv
    │
    └─→ Paper Pipeline (8 stages):
          ├─→ buildSkillPrompt(stage) → LabClaw system prompt
          ├─→ chatCompletion → paper content
          └─→ writeFile(paper/*.md, figures/, supplementary/)
```

## 3. 关键实现细节

### 3.1 prepare.py 生成：分隔符替代 JSON

**问题**: LLM 把 Python 代码放在 JSON 字符串里，代码中的引号/换行破坏 JSON 解析。

**解决**: 改用分隔符格式:
```
===PREPARE_PY===
<python code>
===REQUIREMENTS_TXT===
<packages>
===END===
```

用正则提取：
```typescript
const prepMatch = resp.match(/===PREPARE_PY===\s*\n([\s\S]*?)(?:===REQUIREMENTS_TXT===|===END===|$)/);
```

回退策略: 分隔符 → code block → 整体作为 Python。

### 3.2 maxTokens 动态化

```typescript
const modelMaxCtx = await fetchModelMaxTokens(llm);
// 25% of context for output, clamped to [8192, 16384]
const dynamicMaxTokens = Math.min(16384, Math.max(8192, Math.floor(modelMaxCtx * 0.25)));
```

### 3.3 依赖安装

在 prepare.py 执行前自动 `pip install -r requirements.txt`。

### 3.4 LabClaw Skills 集成

| 论文阶段 | LabClaw Skills |
|----------|---------------|
| 文献调研 | citation-management, literature-review, arxiv-search |
| 方法设计 | scientific-writing, pytorch-lightning, statistics |
| 实验分析 | scientific-visualization, matplotlib, statistics, EDA |
| 结果撰写 | scientific-writing, statistics, scientific-visualization |
| 引言摘要 | scientific-writing, citation-management, literature-review |
| 讨论结论 | scientific-writing, scientific-critical-thinking, brainstorming |
| 补充材料 | statistics, scientific-writing |
| LaTeX 整合 | scientific-writing |

### 3.5 实验循环 JSON 解析

实验循环仍使用 JSON (`{"description":"...","code":"..."}`), 但增加了 code block 回退：
```typescript
try {
  JSON.parse(cleaned);
} catch {
  // Fallback: extract from ```python ... ```
  const codeMatch = resp.match(/```python\n([\s\S]*?)```/);
}
```

## 4. 文件清单

| 文件 | 用途 |
|------|------|
| `project-7411174/src/pages/autoresearch/page.tsx` | 主页面，包含完整 pipeline |
| `project-7411174/src/lib/labclaw-skills.ts` | LabClaw skill 加载器 |
| `project-7411174/src/lib/local-exec.ts` | Tauri/Web 统一执行抽象层 |
| `project-7411174/src/lib/deep-research/llm-client.ts` | LLM 客户端 (含 think 标签处理) |
| `apps/desktop/src-tauri/src/commands/autoresearch.rs` | Tauri 本地执行命令 (8个) |
| `apps/desktop/src-tauri/src/lib.rs` | 命令注册 |
| `backend/app/services/autoresearch/executor.py` | 后端执行引擎 |
| `backend/app/routers/autoresearch.py` | 7 个 REST API 端点 |

## 5. 最近修改记录

### 2026-03-22

1. **prepare.py 生成改为分隔符格式** — 不再用 JSON 包裹代码
2. **maxTokens 动态化** — `fetchModelMaxTokens()` 获取模型上下文，取 25% 作为输出预算
3. **自动安装依赖** — `pip install -r requirements.txt` 在 prepare.py 执行前
4. **详细日志** — 每步带 `[Step N]` 前缀，包含字符数、行数、LLM 响应大小等
5. **实验循环 JSON 回退** — 解析失败时从 code block 提取代码
6. **所有 maxTokens 统一** — 消除硬编码的 4096/6144/8192
