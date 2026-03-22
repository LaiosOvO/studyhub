# StudyHub v1.0 — 需求、设计与实现 Review 文档

> 本文档供外部 AI/人工 review 使用，完整描述了项目的需求背景、架构设计、技术实现现状和已知问题。

---

## 1. 项目概述

### 1.1 核心价值主张

**输入一个研究方向 → 获得完整的论文版图 + AI 识别的研究空白 → 生成并自动执行实验方案，改进现有工作。**

StudyHub 是一个面向中国学术研究者的 AI 驱动研究平台，覆盖从论文发现到实验执行的完整闭环：

```
论文搜索 → 引用网络构建 → Deep Research → 论文地图可视化
                                    ↓
                              方案生成 (SOTA 分析)
                                    ↓
                              实验自动执行 (本地 GPU)
                                    ↓
                              实验报告 + 社区协作
```

### 1.2 目标用户

- 中国高校研究生 / 博士生 / 青年教师
- 需要快速了解某个研究方向的全景并找到创新点
- 有一定编程能力，但希望自动化实验循环
- 需要中英文双语支持（学术文献 + UI）

---

## 2. 技术架构

### 2.1 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| **前端 (Web)** | React 19 + Vite 7 + Tailwind CSS 3 + React Router 7 | SPA 架构，非 Next.js SSR |
| **前端 (桌面)** | Tauri v2 (Rust + React) | 实验执行 agent，管理本地 GPU |
| **后端 API** | FastAPI + Python 3.12+ (uv 管理) | JWT 认证，RESTful + WebSocket |
| **数据库** | PostgreSQL 17 (主库) + Neo4j 2025 (图谱) | 论文元数据 + 引用关系 |
| **搜索引擎** | Meilisearch v1.12 | 全文搜索，index-on-search 模式 |
| **缓存/消息** | Valkey 8.1 (Redis 替代) | 缓存 + 事件流 |
| **对象存储** | SeaweedFS (S3 兼容) | PDF、模型 checkpoint、日志 |
| **工作流** | Temporal Server | Deep Research 等长时任务编排 |
| **PDF 解析** | GROBID | 学术 PDF 结构化提取 |
| **LLM** | LiteLLM (Claude + GPT fallback) | 统一 LLM 网关 |
| **国际化** | i18next | 中英文 UI |

### 2.2 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器 / 前端                          │
│  React 19 SPA                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐ │
│  │ 论文搜索  │ │ 论文地图  │ │ 实验仪表盘│ │ 社区协作       │ │
│  │ (search) │ │(3D graph)│ │(dashboard)│ │(community)     │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬───────────┘ │
│       │  citation-fetcher.ts (浏览器端 API 调用)              │
│       │  (OpenAlex + Semantic Scholar 双源)                   │
└───────┼────────────────────────────────────────────────────── ┘
        │ HTTP/WS
┌───────┼────────────────────────────────────────────────────── ┐
│       ▼           FastAPI Backend                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │  routers │ │ services │ │ workflows│ │   models     │    │
│  │ 16 个    │ │ 10 个    │ │ 3 个     │ │ 11 个        │    │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────────┘    │
│       │            │            │             │               │
│  ┌────┴────────────┴────────────┴─────────────┴────────┐     │
│  │              数据层                                   │     │
│  │  PostgreSQL │ Neo4j │ Meilisearch │ Valkey │ SeaweedFS│     │
│  └──────────────────────────────────────────────────────┘     │
│                                                               │
│  Temporal Server ──── deep_research / plan_generation /       │
│                       scholar_refresh workflows               │
└────────────────────────────────────────────────────────────── ┘

┌────────────────────────────────────────────────────┐
│              Tauri Desktop Agent                    │
│  Rust 状态机 + React UI                             │
│  - 实验环境设置 (Docker sandbox)                     │
│  - GPU 监控 (pynvml)                                │
│  - 自主实验循环 (LLM → 改代码 → 训练 → 评估)         │
│  - WebSocket 同步到 Web 仪表盘                       │
└────────────────────────────────────────────────────┘
```

### 2.3 Docker Compose 服务清单

```yaml
services:
  postgres       # PostgreSQL 17 — 主应用数据库
  temporal-db    # PostgreSQL (独立) — Temporal 专用
  neo4j          # Neo4j 2025 — 引用图谱
  meilisearch    # Meilisearch v1.12 — 全文搜索
  valkey         # Valkey 8.1 — 缓存/消息
  seaweedfs      # SeaweedFS — 对象存储
  grobid         # GROBID — PDF 解析
  temporal       # Temporal Server — 工作流引擎
  api            # FastAPI — 后端 API
```

---

## 3. 功能模块详解

### 3.1 论文搜索与入库 (Phase 2)

**需求**: 用户输入关键词，从多个学术源获取论文，去重后展示。

**实现**:
- **数据源**: OpenAlex, Semantic Scholar, PubMed, arXiv
- **去重策略**: DOI 精确匹配 + 模糊标题/作者匹配，返回新合并对象（不可变模式）
- **搜索索引**: Meilisearch index-on-search（搜索时逐步填充索引，无批量导入）
- **PDF 解析**: GROBID 提取标题/摘要/方法论/实验/结果/参考文献
- **关键设计决策**:
  - Paper model 使用 JSON 列存储 authors/sources（非关联表）
  - pyalex (同步库) 通过 `asyncio.to_thread` 异步化
  - arXiv 速率限制: 模块级 `Semaphore(1)` + 3s sleep
  - Meilisearch 失败时降级为仅聚合模式

**后端文件**:
- `backend/app/services/paper_search/` — 多源搜索客户端
- `backend/app/services/search_index/` — Meilisearch 索引
- `backend/app/services/pdf_parser/` — GROBID 解析
- `backend/app/routers/search.py` — 搜索 API
- `backend/app/routers/papers.py` — 论文 CRUD

### 3.2 中文学术源 (Phase 3)

**需求**: 接入 CNKI 和万方，处理反爬机制。

**实现**:
- **浏览器自动化**: Patchright (Playwright fork with deeper CDP patching)
- **反爬策略**: BrowserPool 管理多浏览器实例，cookie 内存存储
- **CSS 选择器**: 模块级常量 + 备用字典，应对 DOM 变更
- **异常分类**: CnkiCaptchaError → SourceStatus.CAPTCHA_BLOCKED
- **超时**: 浏览器源 30s，API 源 10s
- **降级**: 单源不可用时其余源正常返回，附状态指示

### 3.3 学者画像采集 (Phase 3.1)

**需求**: 从百度百科 + Google Scholar 构建学者数据库。

**实现**:
- 百度百科爬虫提取姓名、机构、职称、出生年、研究方向、荣誉
- Google Scholar (`scholarly` 库) 补充 h-index、引用数、论文列表
- 学者-论文关联: CJK 精确匹配 + English `rapidfuzz ratio >= 80`
- 增量更新: PostgreSQL `ON CONFLICT` 幂等 upsert
- 定时刷新: Temporal workflow

### 3.4 引用网络与质量评分 (Phase 4)

**需求**: 递归扩展引用图谱，计算论文质量分。

**实现**:
- **图谱存储**: Neo4j async driver，事务函数
- **BFS 扩展**: 按引用数优先选择（深度 1-3 可配），预算控制
- **语义发现**: RELATED_TO 边与 CITES 边分开存储
- **质量评分算法**:
  - 引用数: `log10(citations) / 4.0` 归一化（处理幂律分布）
  - 引用速度: `citations / (current_year - pub_year + 1)`
  - 综合评分: 引用 + 速度 + 影响因子 + 作者 H-index
  - 纯函数 `compute_quality_score`，无副作用

### 3.5 Deep Research 引擎 (Phase 5)

**需求**: 用户提供研究方向/论文/作者，自动执行完整研究流水线。

**实现**:
- **Temporal 工作流编排**: 搜索 → 引用扩展 → 质量评分 → AI 分析
- **进度反馈**: Temporal query (非 signal) + WebSocket 轮询
- **AI 分析分层**:
  - Haiku: 摘要筛选 + 关系分类（低成本）
  - Sonnet: 深度分析 + 研究空白识别（高质量）
- **只分析有引用关系的论文对**（O(edges) 而非 O(n²)）
- **文献综述生成**: Jinja2 模板 + Sonnet，支持中英双语
- **结果精炼**: 过滤条件存入 `task.config`，支持可复现

**关键架构约束**:
- Activity 之间通过 JSON string I/O（Temporal 序列化限制）
- 每个 Activity 创建独立 DB session（隔离模式）
- WebSocket 认证: JWT 通过 query parameter

### 3.6 论文地图可视化 (Phase 6)

**需求**: 交互式引用图谱、主题地图、时间线三个视图。

**实现**:
- **引用图谱**: Three.js 3D 可视化
  - 节点: 球体 + 发光效果，大小 = 引用数，颜色 = 聚类
  - 边: 二次贝塞尔曲线
  - 交互: OrbitControls 旋转/缩放/平移
  - 3 个聚类: 当前论文(cyan) / 参考文献(blue) / 被引论文(yellow)
- **主题地图**: 计划使用 Deck.gl（当前待实现）
- **时间线**: vis-timeline（当前待实现）
- **数据获取**: 浏览器端双源 fetcher（见 3.6.1）

#### 3.6.1 引用数据获取 (citation-fetcher.ts)

**问题**: 后端 OpenAlex 批量请求被 429 限速（服务器 IP 每日预算耗尽）。

**解决方案**: 所有引用 API 调用在浏览器端执行，使用用户自己的 IP。

```
流程:
1. OpenAlex 单论文请求 (通常不限速) → 获取 seed paper
2. OpenAlex 批量请求 refs + cited-by (OR filter, cursor pagination)
   ↓ 如果 429
3. Semantic Scholar 回退:
   a. DOI → S2 paperId 解析 (DOI 优先, 比 OPENALEX: 前缀更可靠)
   b. /paper/{s2id}/references + /citations
```

**参考项目**: Local Citation Network (github.com/LocalCitationNetwork)

**关键文件**:
- `project-7411174/src/lib/citation-fetcher.ts` — 428 行，双源 fetcher
- `project-7411174/src/lib/api.ts` — papersApi.getCitations() 先尝试后端，回退到浏览器端
- `project-7411174/src/pages/research/map/page.tsx` — 地图页面，检测真实论文 ID vs demo
- `project-7411174/src/pages/research/map/components/CitationGraph3D.tsx` — Three.js 3D 图谱
- `project-7411174/src/pages/research/map/components/DetailPanel.tsx` — 论文详情面板

### 3.7 方案生成与 SOTA 分析 (Phase 7)

**需求**: AI 从研究空白生成可执行实验方案。

**实现**:
- SOTA 方法 + 指标识别
- 实验方案: 假设、方法、基线、指标、数据集、技术路线图、代码骨架
- 可行性评分: 计算需求、数据可用性、预期提升、难度
- 数据策略: 开源优先 / 自有数据 / 混合
- 三个入口: 研究方向 / 改进某论文 / AI 发现的研究空白
- Temporal workflow 编排生成流程

### 3.8 实验执行引擎 (Phase 8, Tauri 桌面端)

**需求**: 在用户本地 GPU 上自主执行实验循环。

**实现**:
- **Tauri v2** Rust 状态机 + React 前端
- **环境隔离**: Docker 容器沙箱，git 分支管理
- **自主循环**: LLM 分析 → 生成改进 → 修改代码 → 训练 → 评估 → 保留/丢弃
- **每轮迭代**: git commit 追踪，metrics 记录到 results.tsv
- **GPU 监控**: pynvml 实时采集使用率/显存/温度
- **用户控制**: 设置停止条件、手动引导、暂停/恢复/跳过
- **同步**: WebSocket 实时推送到 Web 仪表盘

### 3.9 实验仪表盘与报告 (Phase 9)

**需求**: Web 端实时监控实验进度，自动生成论文级报告。

**实现**:
- 训练曲线 + 指标演化（Recharts）
- 迭代对比表
- 实验队列管理（dnd-kit 拖拽排序）
- 桌面端状态实时同步
- 自动生成结构化报告: 摘要/方法论/结果表/训练曲线/消融分析/结论
- Markdown + PDF 双格式输出

### 3.10 社区协作 (Phase 10)

**需求**: 研究者发现互补协作者，发布研究需求，直接通讯。

**实现**:
- **研究者画像**: 注册 + 自动从学术数据库充实
- **匹配算法**: 技能互补性 (非相似性) + LLM 生成匹配解释
- **需求市场**: 结构化研究需求发布/浏览/筛选
- **即时通讯**: 私信 + 通知指示
- **API 端点**: profiles, matching, needs, messages

---

## 4. 前端架构

### 4.1 项目结构

```
project-7411174/src/
├── App.tsx                    # 根组件，路由 + 布局
├── main.tsx                   # 入口
├── router/config.tsx          # 路由配置 (13 路由)
├── contexts/AuthContext.tsx   # JWT 认证上下文
├── lib/
│   ├── api.ts                 # 576行，所有 API 调用封装
│   ├── citation-fetcher.ts    # 428行，浏览器端引用数据获取
│   └── utils.ts               # 工具函数
├── hooks/
│   ├── useWebSocket.ts        # WebSocket hook
│   └── useStreamingText.ts    # 流式文本 hook
├── i18n/                      # 国际化配置
├── components/
│   ├── base/                  # 基础 UI (Dialog, Toast, Button, etc.)
│   └── feature/               # 功能组件 (Navbar, Footer)
├── mocks/                     # 模拟数据 (graph, papers, experiments, community)
└── pages/
    ├── home/                  # 首页
    ├── search/                # 论文搜索
    ├── papers/                # 论文详情
    ├── research/              # Deep Research + 论文地图
    │   └── map/components/    # CitationGraph3D, DetailPanel, etc.
    ├── plans/                 # 实验方案
    ├── experiments/           # 实验仪表盘
    ├── community/             # 社区协作
    ├── scholars/              # 学者列表
    ├── profile/               # 用户画像
    └── reading-lists/         # 阅读列表
```

### 4.2 关键依赖

| 包 | 用途 |
|----|------|
| React 19 + Vite 7 | 框架 + 构建 |
| React Router 7 | 客户端路由 |
| Tailwind CSS 3 | 样式 |
| Three.js 0.179 | 3D 引用图谱 |
| @xyflow/react 12 | 2D 流程图（计划） |
| Recharts 3 | 训练曲线图表 |
| Radix UI | 无头 UI 组件 |
| i18next | 国际化 |
| @dnd-kit | 拖拽排序（实验队列） |

### 4.3 认证方案

- Access token 和 Refresh token 均存储在 `localStorage`（`api.ts` L13-L27）
- ⚠️ **安全风险**: localStorage 易受 XSS 攻击，建议迁移到 httpOnly cookie 或内存存储
- WebSocket 认证: JWT 通过 query parameter

---

## 5. 后端架构

### 5.1 模块结构

```
backend/app/
├── config.py              # 环境变量 + 配置
├── database.py            # SQLAlchemy async session
├── worker.py              # Temporal worker
├── middleware/
│   ├── cors.py            # CORS 中间件
│   └── rate_limit.py      # 速率限制
├── models/                # 11 个 SQLAlchemy 模型
│   ├── paper.py           # 论文 (JSON cols for authors/sources)
│   ├── deep_research.py   # Deep Research 任务
│   ├── experiment_plan.py # 实验方案
│   ├── experiment_run.py  # 实验运行
│   ├── scholar.py         # 学者
│   ├── user.py            # 用户
│   ├── reading_list.py    # 阅读列表
│   ├── researcher_profile.py  # 研究者画像
│   ├── research_need.py   # 研究需求
│   ├── message.py         # 私信
│   └── llm_usage.py       # LLM 用量追踪
├── routers/               # 16 个路由模块
│   ├── auth.py, search.py, papers.py, citations.py
│   ├── deep_research.py, plans.py, experiments.py
│   ├── scholars.py, profiles.py, matching.py
│   ├── needs.py, messages.py, reading_lists.py
│   ├── llm.py, health.py
│   └── __init__.py
├── services/              # 10 个服务模块
│   ├── paper_search/      # 多源搜索 + 去重
│   ├── citation_network/  # Neo4j 图谱操作
│   ├── search_index/      # Meilisearch 索引
│   ├── pdf_parser/        # GROBID 解析
│   ├── deep_research/     # AI 分析流水线
│   ├── plan_generation/   # 方案生成
│   ├── experiment/        # 实验管理
│   ├── scholar/           # 学者采集
│   ├── community/         # 社区功能
│   ├── auth_service.py    # 认证
│   ├── llm_service.py     # LLM 调用
│   └── temporal_service.py # Temporal 客户端
└── workflows/             # Temporal 工作流
    ├── deep_research.py   # Deep Research 工作流
    ├── plan_generation.py # 方案生成工作流
    ├── scholar_refresh.py # 学者刷新工作流
    └── activities.py      # 共享 Activity 定义
```

### 5.2 关键设计模式

1. **App Factory**: `create_app()` 工厂模式，测试友好
2. **Activity 隔离**: 每个 Temporal Activity 创建独立 DB session 和 HTTP client
3. **JSON I/O**: Temporal 活动间通过 JSON string 传递数据
4. **非致命启动**: Neo4j / Meilisearch / Temporal 连接失败不阻塞应用启动
5. **不可变合并**: Deduplicator 返回新对象，不修改原始数据
6. **分层 LLM**: Haiku 做筛选/分类，Sonnet 做深度分析/生成
7. **密码哈希**: Argon2 (pwdlib)

---

## 6. 已知问题与风险

### 6.1 已知 Bug / 待修复

| 问题 | 严重度 | 状态 | 说明 |
|------|-------|------|------|
| OpenAlex 服务器端 429 | 中 | 已缓解 | 已改为浏览器端调用，但用户 IP 仍可能被限速 |
| 学者数据采集只完成 750/2382 | 低 | 待恢复 | 速率限制，需等待重置后继续 |
| CNKI/万方爬虫未在线上测试 | 中 | 待验证 | 沙箱限制，需 `patchright install chromium` |
| Neo4j 包未安装 | 中 | 待验证 | 已加入 pyproject.toml 但 sandbox 中未 sync |
| 部分前端页面依赖 mock 数据 | 中 | 进行中 | 搜索结果、实验、社区等页面仍使用模拟数据 |
| 阅读列表仅前端状态 | 低 | 刚修复 | DetailPanel 阅读列表按钮已加 onClick，但仅保存在组件状态 |

### 6.2 架构风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| **前端是纯 SPA (Vite) 而非 SSR** | SEO 差，REQUIREMENTS 中要求 SSR (WAPP-01) | 需评估是否迁移回 Next.js 或使用 Vite SSR 插件 |
| **mock 数据散布在前端** | 上线前需逐一替换为真实 API | 已开始替换 (citation-fetcher.ts) |
| **Temporal 工作流未实际部署测试** | 复杂工作流可能有运行时问题 | 需集成测试 |
| **浏览器端 API 调用暴露速率限制** | 用户密集操作可能触发限速 | 考虑后端代理 + 缓存层 |
| **单一 Docker Compose 部署** | 无水平扩展能力 | v1 可接受，v2 考虑 K8s |
| **研究者匹配无基准评估** | 匹配质量无法量化 | 需用户反馈循环 |

### 6.3 需求覆盖度分析

**v1 需求共 108 个**:
- ✅ 后端代码已实现: ~90%（基于 Phase 标记全部 Complete）
- ⚠️ 前端实际连通: ~60%（部分页面仍使用 mock 数据）
- ⚠️ 后端单元测试: 已有 40+ 测试文件（`backend/tests/`），但缺少端到端集成测试和前端测试

**关键差距**:
- SRCH-01~08, PARS-01~04, DEEP-01~08, ANAL-01~06, PMAP-01~10, PLAN-01~08 在 REQUIREMENTS.md 中标记为 Pending，但 ROADMAP.md 标记为 Phase Complete — **状态不一致，需统一刷新**
- WAPP-01 要求 "Next.js SSR"，实际使用 Vite SPA — **不符合原始需求，需决策：修改需求 or 迁移前端**
- Phase 9 在 ROADMAP.md 中标记为 "0/3 Not started"，但 review 文档和 REQUIREMENTS 中标记为 Complete — **状态矛盾**
- Deep Research WebSocket 路径不一致：前端调用 `/api/v1/deep-research/tasks/${taskId}/ws`，后端路由为 `/api/v1/deep-research/ws/{workflow_id}`（参数语义也不同：taskId vs workflow_id）

---

## 7. 参考项目

### 7.1 核心参考

| 项目 | 路径 | 参考内容 |
|------|------|---------|
| autoresearch | `/Users/admin/ai/ref/autoresearch` | 实验循环模式 (Karpathy) |
| gpt-researcher | `/Users/admin/ai/ref/gpt-researcher` | FastAPI 架构, async agent |
| deep-research | `/Users/admin/ai/ref/deep-research` | 最简 deep research |
| AI-Scientist | `/Users/admin/ai/ref/AI-Scientist` | 全自动科学发现 |
| MLE-agent | `/Users/admin/ai/ref/MLE-agent` | AI 工程助手, arXiv |
| khoj | `/Users/admin/ai/ref/khoj` | 自托管 AI, Docker Compose |
| Local Citation Network | (GitHub) | 引用网络可视化双源模式 |
| **LabClaw (新增)** | `/Users/admin/ai/ref/LabClaw` | 240+ AI agent skills |

### 7.2 LabClaw 可参考的要点

| StudyHub 功能 | LabClaw Skill | 参考价值 |
|--------------|--------------|---------|
| 论文搜索 | `literature/citation-management` | 5 阶段引用管理工作流 |
| 引用图谱 | `general/networkx` | 网络构建 + 社区检测 |
| 实验执行 | `general/pytorch-lightning` | 训练模式 + 多后端日志 |
| ML 训练 | `general/scikit-learn` | 分类/回归/聚类流水线 |
| 统计分析 | `general/statistics` | 检验选择决策树 |
| 可视化 | `visualization/scientific-visualization` | 期刊级图表样式 |
| 数据探索 | `general/exploratory-data-analysis` | 200+ 格式检测 + 质量评估 |

---

## 8. 待 Review 的核心问题

请 Reviewer 重点关注以下问题：

### 8.1 架构合理性
1. **SPA vs SSR**: 当前 Vite SPA 是否满足需求？是否需要迁移到 Next.js / Nuxt？
2. **浏览器端 API 调用**: citation-fetcher.ts 在浏览器端直接调用 OpenAlex/S2，是否有更好方案？
3. **Temporal 工作流**: 对于 Deep Research 等长时任务，Temporal 是否过重？是否有更轻量替代？
4. **Neo4j 必要性**: 引用图谱存 Neo4j 是否值得维护成本？PostgreSQL + 递归 CTE 是否足够？

### 8.2 前端实现质量
1. **mock 数据清理**: 哪些页面仍使用 mock？替换策略是什么？
2. **Three.js 3D 图谱**: 性能如何？大图（>500 节点）是否可用？是否需要 WebGL 降级方案？
3. **状态管理**: 当前无全局状态管理（无 Zustand/Redux），是否影响复杂交互？
4. **类型安全**: TypeScript 使用是否充分？API 响应是否有类型校验？

### 8.3 后端实现质量
1. **服务隔离**: 所有服务在同一 FastAPI 进程中，是否需要微服务拆分？
2. **测试覆盖**: 后端有 40+ 测试文件但缺端到端集成，优先补哪些？
3. **安全性**: JWT 实现是否安全？SQL 注入风险？XSS 防护？
4. **数据一致性**: PostgreSQL + Neo4j 双写一致性如何保证？

### 8.4 产品完整性
1. **端到端流程是否通畅**: 搜索 → 引用图谱 → Deep Research → 方案 → 实验，哪些环节断裂？
2. **错误处理**: 各模块的错误处理是否完善？用户是否能看到有意义的错误信息？
3. **性能**: 首次搜索响应时间？引用网络展开时间？Deep Research 端到端时间？

---

## 9. 文件索引

### 9.1 规划文档
- `.planning/ROADMAP.md` — 10 个 Phase 路线图
- `.planning/REQUIREMENTS.md` — 108 个 v1 需求
- `.planning/STATE.md` — 项目状态
- `.planning/config.json` — GSD 工作流配置

### 9.2 前端源码
- `project-7411174/` — React SPA 前端
- `project-7411174/src/lib/api.ts` — 576 行 API 封装
- `project-7411174/src/lib/citation-fetcher.ts` — 428 行浏览器端引用获取

### 9.3 后端源码
- `backend/app/` — FastAPI 后端
- `backend/pyproject.toml` — Python 依赖
- `backend/Dockerfile` — 容器化配置

### 9.4 基础设施
- `infra/docker-compose.yml` — 开发环境编排
- `infra/docker-compose.prod.yml` — 生产环境编排

### 9.5 桌面端
- `apps/desktop/` — Tauri v2 桌面应用
- `apps/desktop/src-tauri/` — Rust 后端

---

*文档生成时间: 2026-03-19*
*项目状态: v1.0 Milestone, 10/10 Phases 代码完成, 端到端集成待验证*

---

## 附录 A: 代码审计发现 (2026-03-19)

> 来源: 外部 AI 审计 (`review-code-audit.md`)，以下为已验证的发现

| # | 问题 | 严重度 | 修复状态 |
|---|------|-------|---------|
| 1 | Token 存储：文档写"内存存储"，实际代码使用 localStorage | P0 | ✅ 文档已修正 |
| 2 | Deep Research WebSocket 前后端路径不匹配（`tasks/${taskId}/ws` vs `ws/${workflow_id}`） | P0 | ✅ 后端路由改为 `/tasks/{task_id}/ws`，内部派生 workflow_id |
| 3 | Phase 9 状态矛盾（ROADMAP: 0/3 Not started vs REQUIREMENTS: Complete） | P1 | ✅ ROADMAP 已更新为 3/3 Complete |
| 4 | 测试覆盖描述"0%"不准确（实际有 40+ 后端测试文件） | P1 | ✅ 文档已修正 |
| 5 | `docs/STARTUP.md` 仍引用已删除的 `apps/web` Next.js 目录 | P1 | ✅ 已修正为 `project-7411174` Vite SPA |
| 6 | 前端多数页面仍依赖 mock 数据（plans/community/search/profile/home） | P2 | 进行中 |
