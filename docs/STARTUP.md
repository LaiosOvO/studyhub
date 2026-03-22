# StudyHub 启动指南

## 前置条件

| 工具 | 版本要求 | 安装 |
|------|---------|------|
| Docker & Docker Compose | 24+ | https://docs.docker.com/get-docker/ |
| Python | 3.12+ | `brew install python@3.12` |
| uv (Python包管理) | 0.5+ | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Node.js | 20+ | `brew install node` |
| pnpm | 9+ | `npm install -g pnpm` |
| Rust + Cargo (Phase 8 桌面端) | 1.75+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |

**可选（生产环境）：**
- NVIDIA Container Toolkit（GPU实验执行）
- WeasyPrint 系统依赖（PDF报告生成）：`brew install cairo pango`

## 快速启动（开发环境）

### 1. 环境配置

```bash
cd /Users/admin/ai/self-dev/study-community

# 复制环境变量模板
cp infra/.env.example infra/.env

# 编辑 .env，设置 LLM API keys（必需）
# ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...（备用）
```

**必须配置的环境变量：**

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ANTHROPIC_API_KEY` | Claude API 密钥 | 无（必填） |
| `OPENAI_API_KEY` | GPT 备用密钥 | 无（可选） |
| `JWT_SECRET` | JWT 签名密钥 | `change-me-in-production` |
| `POSTGRES_PASSWORD` | 数据库密码 | `studyhub_dev` |
| `NEO4J_AUTH_PASSWORD` | Neo4j密码 | `neo4j_dev` |
| `MEILI_MASTER_KEY` | Meilisearch密钥 | `meili_dev_key` |

### 2. 启动基础设施服务

```bash
# 启动全部8个服务（PostgreSQL, Neo4j, Meilisearch, Valkey, SeaweedFS, GROBID, Temporal, Temporal UI）
cd infra
docker compose up -d

# 验证所有服务健康
docker compose ps
```

**服务端口一览：**

| 服务 | 端口 | 用途 | 管理界面 |
|------|------|------|---------|
| PostgreSQL | 5432 | 应用数据库 | — |
| Neo4j | 7687 (bolt), 7474 (http) | 引用图谱 | http://localhost:7474 |
| Meilisearch | 7700 | 全文搜索 | http://localhost:7700 |
| Valkey | 6379 | 缓存/消息 | — |
| SeaweedFS | 8333 (S3), 8888 (filer) | 对象存储 | http://localhost:8888 |
| GROBID | 8070 | PDF解析 | http://localhost:8070 |
| Temporal | 7233 | 工作流引擎 | — |
| Temporal UI | 8080 | 工作流管理 | http://localhost:8080 |

### 3. 启动后端 (FastAPI)

```bash
cd /Users/admin/ai/self-dev/study-community/backend

# 安装 Python 依赖
uv sync

# 运行数据库迁移
uv run alembic upgrade head

# 启动 API 服务器（开发模式，热重载）
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API 文档地址: http://localhost:8000/docs (Swagger) | http://localhost:8000/redoc (ReDoc)

### 4. 启动 Temporal Worker

```bash
# 新终端窗口
cd /Users/admin/ai/self-dev/study-community/backend
uv run python -m app.worker
```

> **注意：** Worker 是执行 Deep Research、Plan Generation 等异步任务的必要进程。

### 5. 启动前端 (React SPA / Vite)

```bash
cd /Users/admin/ai/self-dev/study-community/project-7411174

# 安装前端依赖
npm install

# 启动开发服务器
npm run dev
```

前端地址: http://localhost:5173

### 6. 启动桌面端 (Tauri, 可选)

```bash
cd /Users/admin/ai/self-dev/study-community/apps/desktop

# 安装前端依赖
pnpm install

# 开发模式启动（需要 Rust 工具链）
pnpm tauri dev
```

## 完整启动命令（一键版）

```bash
# 终端 1: 基础设施
cd /Users/admin/ai/self-dev/study-community/infra && docker compose up -d

# 终端 2: 后端 API
cd /Users/admin/ai/self-dev/study-community/backend && uv sync && uv run alembic upgrade head && uv run uvicorn app.main:app --reload --port 8000

# 终端 3: Temporal Worker
cd /Users/admin/ai/self-dev/study-community/backend && uv run python -m app.worker

# 终端 4: 前端
cd /Users/admin/ai/self-dev/study-community/project-7411174 && npm install && npm run dev
```

## 项目结构

```
study-community/
├── backend/                    # FastAPI 后端
│   ├── app/
│   │   ├── main.py            # 应用入口, 路由注册
│   │   ├── worker.py          # Temporal Worker
│   │   ├── config.py          # 环境配置
│   │   ├── models/            # SQLAlchemy 模型
│   │   ├── schemas/           # Pydantic 请求/响应
│   │   ├── routers/           # API 路由 (15个)
│   │   ├── services/          # 业务逻辑
│   │   │   ├── auth/          # JWT认证
│   │   │   ├── search/        # 多源论文搜索
│   │   │   ├── citation_network/ # Neo4j引用图谱
│   │   │   ├── deep_research/ # AI深度研究
│   │   │   ├── plan_generation/ # 实验方案生成
│   │   │   ├── experiment/    # 实验执行引擎
│   │   │   └── community/     # 社区匹配/消息
│   │   ├── workflows/         # Temporal 工作流
│   │   └── middleware/        # CORS, 限流
│   ├── alembic/               # 数据库迁移 (10个版本)
│   ├── templates/             # Jinja2 模板 (报告/骨架)
│   └── pyproject.toml         # Python 依赖
│
├── project-7411174/              # React SPA 前端 (Vite)
│   ├── src/
│   │   ├── pages/             # 页面组件
│   │   │   ├── search/        # 论文搜索
│   │   │   ├── papers/        # 论文详情
│   │   │   ├── research/      # Deep Research + 论文地图
│   │   │   ├── plans/         # 实验方案
│   │   │   ├── experiments/   # 实验仪表盘
│   │   │   ├── community/     # 社区协作
│   │   │   └── auth/          # 登录/注册
│   │   ├── components/        # 共享组件
│   │   ├── lib/               # API客户端, 工具函数
│   │   ├── hooks/             # React hooks
│   │   ├── i18n/              # 国际化 (i18next)
│   │   └── mocks/             # 模拟数据 (待替换)
│   └── package.json
│
├── apps/
│   └── desktop/               # Tauri 桌面端
│       ├── src-tauri/         # Rust 后端
│       │   ├── src/
│       │   │   ├── lib.rs     # Tauri 入口
│       │   │   └── commands/  # experiment.rs, gpu.rs, sync.rs
│       │   └── Cargo.toml
│       └── src/               # React 前端
│           ├── components/    # ExperimentControl, GpuMonitor等
│           └── hooks/         # useGpuMetrics, useExperimentState
│
├── infra/                     # 基础设施
│   ├── docker-compose.yml     # 8个服务定义
│   ├── docker-compose.dev.yml # 开发覆盖
│   └── .env.example           # 环境变量模板
│
├── data/seed/                 # 种子数据
│   └── ecg_scholars.json      # ECG领域学者 (10人)
│
└── .planning/                 # GSD 项目管理
    ├── ROADMAP.md             # 10 个 Phase
    ├── REQUIREMENTS.md        # 112 个需求
    └── phases/                # 各阶段计划/研究/验证
```

## API 端点概览

| 前缀 | 模块 | 认证 | 说明 |
|------|------|------|------|
| `/health` | health | 否 | 健康检查 |
| `/auth/*` | auth | 部分 | 注册/登录/刷新/注销 |
| `/llm/*` | llm | 是 | LLM代理（LiteLLM） |
| `/search/*` | search | 否 | 多源论文搜索 |
| `/papers/*` | papers | 否 | 论文详情/PDF解析 |
| `/citations/*` | citations | 否 | 引用图谱扩展/查询 |
| `/scholars/*` | scholars | 否 | 学者管理/爬取 |
| `/api/reading-lists/*` | reading_lists | 是 | 阅读列表CRUD |
| `/api/v1/deep-research/*` | deep_research | 是 | 深度研究任务+WebSocket |
| `/api/v1/plans/*` | plans | 是 | 实验方案CRUD+生成 |
| `/api/v1/experiments/*` | experiments | 是 | 实验运行+仪表盘+报告 |
| `/api/v1/profiles/*` | profiles | 是 | 研究者档案CRUD |
| `/api/v1/matching/*` | matching | 是 | 协作者匹配 |
| `/api/v1/needs/*` | needs | 是 | 研究需求市场 |
| `/api/v1/messages/*` | messages | 是 | 站内消息+WebSocket |

## 数据库迁移版本

| 版本 | 说明 |
|------|------|
| 001 | 用户表 (users) |
| 002 | 论文表 (papers) |
| 003 | 学者表 (scholars) |
| 004 | 深度研究任务表 (deep_research_tasks) |
| 005 | 论文分析表 (paper_analyses) |
| 006 | 研究报告表 (research_reports) |
| 007 | 实验方案表 (experiment_plans) |
| 008 | 阅读列表表 (reading_lists) |
| 009 | 实验运行表 (experiment_runs) |
| 010 | 实验运行添加 queue_position 字段 |

## 已知问题（v1.0 审计）

详见 `.planning/v1.0-MILESTONE-AUDIT.md`，3个关键问题：

1. **`(auth)` 路由组布局反转** — 登录用户无法访问实验/社区/地图页面
2. **Temporal Worker 缺少活动注册** — 深度研究和方案生成工作流无法执行
3. **缺少前端搜索页面** — 后端搜索API已完成但无前端调用

## 技术栈版本

| 组件 | 版本 |
|------|------|
| FastAPI | 0.115+ |
| Vite | 7.x (React SPA) |
| React | 19.2 |
| Tauri | 2.x |
| PostgreSQL | 17 |
| Neo4j | 2025 |
| Meilisearch | 1.12 |
| Valkey | 8.1 |
| Temporal | latest |
| Python | 3.12+ |
| Node.js | 20+ |
