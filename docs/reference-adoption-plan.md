# 参考项目采纳方案

> 基于 4 个参考项目的深度代码分析，提出可落地的改进方案
> 生成时间: 2026-03-19

---

## 一、引用图谱：raw Three.js → react-force-graph-3d

### 现状问题
- `CitationGraph3D.tsx` 有 425 行手写 Three.js 代码
- 手动管理场景、相机、渲染器、OrbitControls、Raycaster、hover/click 检测、resize、动画循环、清理
- 静态布局（预计算位置），无力导向模拟
- 无方向箭头、无动画粒子

### 参考项目
**3d-force-graph** (5.9K stars) + **react-force-graph** (3K stars)

### 改进方案

**替换为 `react-force-graph-3d`，代码从 425 行降到 ~60 行：**

```tsx
import ForceGraph3D from 'react-force-graph-3d';

<ForceGraph3D
  graphData={{ nodes, links }}
  nodeVal={node => Math.log2(node.citations + 1) * 3}    // 引用数控制大小
  nodeColor={node => clusterColors[node.cluster]}          // 聚类颜色
  nodeLabel={node => `${node.title} (${node.citations})`} // 悬停提示
  onNodeClick={(node) => setSelectedPaper(node)}           // 点击选中
  linkCurvature={0.15}                                     // 曲线边
  linkDirectionalArrowLength={6}                           // 方向箭头 (新增!)
  linkDirectionalParticles={2}                             // 动画粒子 (新增!)
  linkColor={() => 'rgba(255,255,255,0.18)'}
  backgroundColor="#050A18"
  warmupTicks={50}
  cooldownTime={3000}
/>
```

**自定义发光效果保留：**
```tsx
nodeThreeObject={(node) => {
  const group = new THREE.Group();
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(5),
    new THREE.MeshStandardMaterial({ color: node.color, emissive: node.color, emissiveIntensity: 0.55 })
  );
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(12),
    new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: 0.09, side: THREE.BackSide })
  );
  group.add(sphere, glow);
  return group;
}}
```

### 收益
| 维度 | 现在 | 改后 |
|------|------|------|
| 代码量 | 425 行 | ~60 行 |
| 布局 | 静态预计算 | 力导向自动布局 |
| 方向箭头 | 无 | 内置 |
| 动画粒子 | 无 | 内置 |
| 过滤 | 手动 visibility | `nodeVisibility` prop |
| 内存管理 | 手动 dispose | 自动 |

### 安装
```bash
npm install react-force-graph-3d
```

---

## 二、Deep Research 报告：Jinja2 模板 → STORM 式管道

### 现状问题
- 报告通过 Jinja2 模板一次性填充生成
- **无内联引用**（参考文献只在底部列出）
- 单视角分析（无多角度审视）
- 无分节并行生成

### 参考项目
**STORM** (Stanford, 28K stars) — 多视角研究 + 带内联引用的分节并行报告生成

### 改进方案

#### 1. 内联引用 (P0 — 最关键改进)

**当前**: 报告正文无引用标注，参考文献在末尾
**目标**: 正文中出现 `[1]`、`[3]` 等内联引用

```python
# 给 LLM 的 prompt 模式 (学自 STORM)
SECTION_PROMPT = """
Based on the collected information, write the "{section_title}" section.

The collected information (numbered sources):
[1] {paper_1_title} ({paper_1_year}): {paper_1_snippet}
[2] {paper_2_title} ({paper_2_year}): {paper_2_snippet}
...

Rules:
- Use [1], [2], ..., [n] inline (e.g., 'Transformer架构由Vaswani等人提出[1]，后被改进为BERT[3]。')
- Do NOT include a References section.
- Write in {language}.
"""
```

**引用索引统一** (各节独立生成后合并):
```python
def merge_section_citations(sections: list[str], section_refs: list[dict]) -> tuple[str, list]:
    """STORM 的 placeholder 模式: 先替换为占位符，再统一编号"""
    global_refs = []
    merged = []
    for section_text, local_refs in zip(sections, section_refs):
        text = section_text
        for local_idx, ref in enumerate(local_refs, 1):
            global_idx = len(global_refs) + 1
            # 两阶段替换避免冲突
            text = text.replace(f"[{local_idx}]", f"__PLACEHOLDER_{global_idx}__")
            global_refs.append(ref)
        for i in range(1, len(global_refs) + 1):
            text = text.replace(f"__PLACEHOLDER_{i}__", f"[{i}]")
        merged.append(text)
    return "\n\n".join(merged), global_refs
```

#### 2. 分节并行生成 (P1)

```python
# 替换单次 Jinja2 渲染
import asyncio

sections = ["研究概述", "核心方法", "关键论文", "研究空白", "发展趋势"]

async def generate_report(analyses, papers):
    # 1. 生成大纲
    outline = await llm_call("根据分析结果生成报告大纲", model="sonnet")

    # 2. 并行生成各节 (每节只接收相关论文子集)
    section_tasks = [
        generate_section(section, get_relevant_papers(section, papers))
        for section in outline.sections
    ]
    section_results = await asyncio.gather(*section_tasks)

    # 3. 合并引用索引
    full_text, references = merge_section_citations(section_results)

    # 4. 生成导言摘要 (STORM 的 polish 阶段)
    lead = await llm_call(f"为以下报告写一段导言摘要:\n{full_text}", model="sonnet")

    return f"{lead}\n\n{full_text}\n\n## 参考文献\n{format_refs(references)}"
```

#### 3. 多视角分析 (P2)

```python
# STORM 的 persona 模式
PERSPECTIVES = [
    "方法论研究者: 关注技术创新和算法改进",
    "应用研究者: 关注实际部署和工程挑战",
    "领域新人: 关注入门路径和核心概念",
]

async def multi_perspective_analysis(papers, topic):
    perspectives_results = await asyncio.gather(*[
        analyze_with_perspective(papers, topic, persona)
        for persona in PERSPECTIVES
    ])
    return merge_perspectives(perspectives_results)
```

### 收益
| 维度 | 现在 | 改后 |
|------|------|------|
| 内联引用 | 无 | `[1][3]` 内联标注 |
| 生成方式 | 一次 Jinja2 填充 | 分节并行 LLM 生成 |
| 分析视角 | 单一 | 2-3 个 persona |
| 导言摘要 | 固定模板文本 | LLM 从全文生成 |
| 报告质量 | 模板化 | 分析性散文 |

---

## 三、实验仪表盘：JSON blob → 规范化指标存储

### 现状问题
- 迭代数据存在 `rounds` JSON 列中（一个大 blob）
- 无法高效查询单个指标的训练曲线
- 无法跨 run 对比指标
- 桌面端逐条发送指标（无批量）

### 参考项目
**MLflow** (24.8K stars) — 规范化指标存储 + 批量日志 + 对比查询
**Aim** (6K stars) — context 命名空间 + 自动系统资源追踪

### 改进方案

#### 1. 规范化指标表 (P0)

```sql
-- 新建 experiment_metrics 表
CREATE TABLE experiment_metrics (
    id SERIAL PRIMARY KEY,
    run_id UUID REFERENCES experiment_runs(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,         -- "loss", "accuracy", "bleu"
    value DOUBLE PRECISION NOT NULL,
    step INTEGER NOT NULL,             -- 迭代轮次
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    context JSONB DEFAULT '{}',        -- Aim 模式: {"subset": "train"}
    UNIQUE (run_id, key, step, context)
);

CREATE INDEX idx_metrics_run_key ON experiment_metrics(run_id, key);
CREATE INDEX idx_metrics_step ON experiment_metrics(run_id, key, step);
```

#### 2. 批量日志端点 (P1)

```python
# 学自 MLflow LogBatch — 桌面端批量同步
@router.post("/experiments/{run_id}/metrics/batch")
async def log_metrics_batch(run_id: UUID, payload: MetricsBatch):
    """
    payload: {
        metrics: [{key, value, step, timestamp, context?}, ...],  # 最多 1000
        params: [{key, value}, ...],                                # 最多 100
        gpu: {utilization, memory_used, temperature}
    }
    """
    # 批量 INSERT
    await db.execute(
        insert(ExperimentMetric).values(
            [{"run_id": run_id, **m} for m in payload.metrics]
        )
    )
```

#### 3. 跨 run 对比端点 (P1)

```python
# 学自 MLflow GetMetricHistoryBulkInterval
@router.get("/experiments/metrics/compare")
async def compare_metrics(
    run_ids: list[UUID] = Query(...),
    metric_key: str = Query(...),
    start_step: int = Query(0),
    end_step: int = Query(None),
    max_results: int = Query(200),  # 每个 run 的采样点数
):
    """返回多个 run 的同一指标，供 Recharts 叠加绘图"""
    # 降采样: WHERE step % (total_steps / max_results) = 0
    ...
```

#### 4. Params vs Metrics 分离 (P2)

```python
# 学自 MLflow: 不可变参数 vs 时序指标
class ExperimentRun:
    params: dict       # 设置一次: learning_rate, model_class, batch_size
    # metrics 现在在 experiment_metrics 表中，不再是 rounds JSON
```

### 收益
| 维度 | 现在 | 改后 |
|------|------|------|
| 指标存储 | JSON blob (rounds) | 规范化表，按 (run, key, step) 索引 |
| 训练曲线查询 | 加载整个 JSON | `WHERE key='loss' AND step BETWEEN x AND y` |
| 跨 run 对比 | 不支持 | 批量查询 + 降采样 |
| 桌面同步 | 逐条 WebSocket | 批量 POST (最多 1000 条/次) |
| 指标组织 | 扁平 key 名 | context 命名空间 `{"subset": "train"}` |

---

## 四、LabClaw Skills 直接采纳

### citation-management: 3 层去重策略

```python
# 当前: DOI 精确 + 模糊标题
# 改进: 3 层去重 (学自 LabClaw)
def deduplicate_papers(papers: list[Paper]) -> list[Paper]:
    seen = {}  # DOI -> Paper

    for paper in papers:
        # Layer 1: 精确 DOI
        if paper.doi and paper.doi in seen:
            merge(seen[paper.doi], paper)
            continue

        # Layer 2: 模糊标题 (rapidfuzz ratio >= 85)
        title_match = find_fuzzy_match(paper.title, seen.values(), threshold=85)
        if title_match:
            merge(title_match, paper)
            continue

        # Layer 3: 作者+年份+标题组合 (LabClaw 新增)
        combo_key = f"{normalize_authors(paper.authors)}:{paper.year}:{normalize_title(paper.title)[:50]}"
        if combo_key in seen_combos:
            merge(seen_combos[combo_key], paper)
            continue

        seen[paper.doi or paper.id] = paper
```

### statistics: 检验选择决策树

嵌入实验报告自动推荐统计方法：

| 数据类型 | 组数 | 配对? | 正态? | 推荐检验 |
|---------|------|-------|-------|---------|
| 连续 | 2 | 否 | 是 | Independent t-test |
| 连续 | 2 | 否 | 否 | Mann-Whitney U |
| 连续 | 2 | 是 | 是 | Paired t-test |
| 连续 | 2 | 是 | 否 | Wilcoxon signed-rank |
| 连续 | 3+ | 否 | 是 | One-way ANOVA |
| 连续 | 3+ | 否 | 否 | Kruskal-Wallis |

### scientific-visualization: 默认配色

```python
# Okabe-Ito 色盲安全调色板 (所有图表默认)
COLORBLIND_SAFE = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7']
```

### pytorch-lightning: 实验回调模式

```python
# 实验引擎的回调钩子 (学自 Lightning Callbacks)
class ExperimentCallbacks:
    on_iteration_start(run, iteration)
    on_iteration_end(run, iteration, metrics)
    on_metric_plateau(run, metric_key, patience)    # → 自动早停
    on_checkpoint_saved(run, path)                   # → 上传到 SeaweedFS
    on_best_metric_update(run, metric_key, value)    # → 通知用户
```

---

## 五、优先级排序

### P0 — 立即可做，影响最大

| # | 改进 | 来源 | 工作量 | 影响 |
|---|------|------|--------|------|
| 1 | 引用图谱切换到 react-force-graph-3d | 3d-force-graph | 1天 | 减少 350 行代码 + 新特性 |
| 2 | 报告内联引用 `[1][3]` | STORM | 2天 | 报告质量质变 |
| 3 | 规范化 experiment_metrics 表 | MLflow | 1天 | 解锁对比和高效查询 |

### P1 — 本迭代完成

| # | 改进 | 来源 | 工作量 |
|---|------|------|--------|
| 4 | 分节并行报告生成 | STORM | 2天 |
| 5 | 批量指标日志端点 | MLflow | 0.5天 |
| 6 | 跨 run 对比端点 | MLflow | 1天 |
| 7 | 3 层论文去重 | LabClaw | 0.5天 |

### P2 — 后续优化

| # | 改进 | 来源 |
|---|------|------|
| 8 | 多视角分析 (persona) | STORM |
| 9 | 统计检验决策树嵌入报告 | LabClaw |
| 10 | 色盲安全调色板默认化 | LabClaw |
| 11 | 实验回调钩子架构 | LabClaw/Lightning |
| 12 | 两阶段大纲生成 | STORM |

---

*文档路径: `/Users/admin/ai/self-dev/study-community/docs/reference-adoption-plan.md`*
