# AutoResearch v2 — 需求 + 设计 + 实现

## 1. 需求

### 1.1 核心问题
当前 AutoResearch 的流程顺序有误：
- **现状**: 直接生成 train.py → 跑实验 → 最后才调研写论文
- **问题**: 没有先做文献调研，盲目训练，不了解领域现状

### 1.2 正确的研究流程

```
Phase A: 调研阶段（先了解领域）
  1. 文献调研 — 搜索该领域的核心论文、SOTA 方法、数据集
  2. 方案设计 — 基于调研结果，确定实验假设、方法、数据集

Phase B: 数据准备
  3. 下载数据集 — 用 SDK（wfdb/datasets/kagglehub）下载匹配的数据集
  4. 数据探索 — 列出目录结构、基本统计信息

Phase C: 实验阶段（基于调研的知识来训练）
  5. 生成 train.py — 基于调研得到的 SOTA 方法 + 假设 + 实际数据
  6. 运行 baseline → 提取初始指标
  7. 实验循环 — LLM 读 train.py + results.tsv + 调研报告 → 修改 → 执行 → keep/discard
  8. 重复直到手动停止

Phase D: 论文写作（停止后自动进入）
  9.  文献综述 → paper/related_work.md
  10. 方法设计 → paper/method.md
  11. 实验分析 → analysis.py + figures/
  12. 结果撰写 → paper/results.md
  13. 引言摘要 → paper/abstract.md
  14. 讨论结论 → paper/discussion.md
  15. LaTeX 整合 → paper/main.tex
```

### 1.3 关键要求

1. **prepare.py 只负责下载+解压+列目录**，不写死文件路径和数据格式
2. **train.py 必须基于实验假设 + 实际数据 + 调研知识生成**，绝不使用默认 MNIST 模板
3. **数据集下载用 SDK**：PhysioNet → `wfdb.dl_database()`，HuggingFace → `datasets.load_dataset()`，Kaggle → `kagglehub`
4. **"从方案生成"按钮**必须正常工作，使用假设上下文
5. **实验循环中 LLM 能看到调研报告**，做出更有针对性的修改

### 1.4 用户反馈记录
- "为什么是先跑 epoch 训练模型最后才开始调研论文什么的你的顺序是不是反了"
- "train.py 是 autoresearch 的 train 大哥"
- "为什么现在的是图像数据集不是 ecg 的数据集"
- "prepare 就只准备下载的逻辑然后解压的逻辑和具体的数据的目录直接看下载后解压的文件目录不事先写死"
- "让 LLM 多轮搜索查找数据集"
- "你的数据集像是能用 SDK 的能不能直接用 SDK 来下载呢"

---

## 2. 设计

### 2.1 流程架构

```
┌─────────────────────────────────────────────────────────┐
│  Phase A: 调研 (新增)                                    │
│  ┌─────────────┐    ┌──────────────┐                     │
│  │ Step 0.5    │───→│ Step 0.8     │                     │
│  │ 文献调研    │    │ 方案优化     │                     │
│  │ (Deep       │    │ (基于调研    │                     │
│  │  Research)  │    │  更新假设)   │                     │
│  └─────────────┘    └──────────────┘                     │
├─────────────────────────────────────────────────────────┤
│  Phase B: 准备                                           │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────┐ │
│  │ Step 1   │→ │ Step 2.5 │→ │ Step 3    │→ │Step 3.8│ │
│  │program.md│  │ venv     │  │prepare.py │  │train.py│ │
│  │(含调研   │  │ 创建     │  │数据下载   │  │基于数据│ │
│  │ 结论)    │  │          │  │SDK下载    │  │+假设   │ │
│  └──────────┘  └──────────┘  └───────────┘  └────────┘ │
├─────────────────────────────────────────────────────────┤
│  Phase C: 实验循环                                       │
│  ┌──────────┐  ┌──────────────────────────────────────┐ │
│  │ Step 4   │→ │ Step 5-8: LOOP                       │ │
│  │ baseline │  │ LLM reads train.py + results.tsv     │ │
│  │          │  │ + research_summary (调研摘要)         │ │
│  └──────────┘  └──────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  Phase D: 论文写作 (停止后)                              │
│  Steps 9-15: 文献综述→方法→分析→结果→引言→讨论→LaTeX    │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Step 0.5 文献调研（新增）

在 Step 1 之前，调用现有的 Deep Research 引擎：
- 输入: 实验目标 `goal` + 假设 `hypothesis`
- 输出: 调研摘要保存到 `research_summary.md`
- 包含: 领域 SOTA、关键方法、常用数据集、评估指标
- 这个摘要会传给后续所有 LLM 调用

### 2.3 数据下载策略

prepare.py 的 prompt 明确指定用 SDK：
```
PhysioNet (ECG/EEG/医学) → wfdb.dl_database()
HuggingFace → datasets.load_dataset()
Kaggle → kagglehub.dataset_download()
通用 → requests + 断点续传
```

prepare.py 只做 3 件事：下载、解压、列出目录树。

### 2.4 train.py 生成策略

Step 3.8 无条件运行，prompt 包含：
- 实验假设 + 方法
- 调研摘要（SOTA 方法参考）
- 实际数据目录结构
- 显式禁止使用 MNIST/CIFAR（除非目标就是图像分类）

### 2.5 "从方案生成"按钮

- 同样包含假设、方法、预期、数据集等上下文
- 加了 alert 错误提示（LLM 未配置、目标为空、生成失败）
- 指标名称动态传入

---

## 3. 实现状态

### 3.1 已实现

| 功能 | 文件 | 状态 |
|------|------|------|
| prepare.py 只下载+解压+列目录 | `page.tsx` Step 3 prompt | ✅ |
| prepare.py 用 SDK 下载 | `page.tsx` Step 3 prompt | ✅ |
| prepare.py 超时 30min | `page.tsx` line ~709 | ✅ |
| Step 3.8 无条件生成 train.py | `page.tsx` line ~739 | ✅ |
| train.py 基于假设+数据生成 | `page.tsx` Step 3.8 prompt | ✅ |
| 禁止使用 MNIST/CIFAR | `page.tsx` Step 3.8 prompt | ✅ |
| program.md 含假设/方法/预期 | `page.tsx` Step 1 | ✅ |
| "从方案生成"含假设上下文 | `page.tsx` onGenerateFromPlan | ✅ |
| "从方案生成"错误提示 | `page.tsx` alert() | ✅ |
| 实验循环含假设上下文 | `page.tsx` experiment loop prompt | ✅ |

### 3.2 待实现

| 功能 | 优先级 | 说明 |
|------|--------|------|
| Step 0.5 文献调研 | P0 | 在实验前调用 Deep Research 引擎 |
| 调研摘要传给 train.py 生成 | P0 | 让 train.py 参考 SOTA 方法 |
| 调研摘要传给实验循环 | P1 | 让 LLM 修改时参考领域知识 |
| "从方案生成"按钮 debug | P0 | 需确认 getLLMConfig 是否正常 |

### 3.3 关键文件

- `project-7411174/src/pages/autoresearch/page.tsx` — 主页面，所有 AutoResearch 逻辑
- `project-7411174/src/lib/deep-research/engine.ts` — Deep Research 引擎 + getLLMConfig
- `project-7411174/src/lib/deep-research/llm-client.ts` — LLM 调用封装
- `project-7411174/src/lib/local-exec.ts` — 本地命令执行（Tauri invoke）

### 3.4 配置依赖

`getLLMConfig()` 需要 localStorage 中设置：
- `studyhub_llm_api_key` — API Key
- `studyhub_llm_api_base` — API Base URL
- `studyhub_llm_model` — 模型名
- `studyhub_llm_max_tokens` — 最大上下文 tokens

这些在设置页面配置。如果任一为空，返回 null，所有 LLM 功能不可用。
