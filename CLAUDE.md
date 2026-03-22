# StudyHub 项目规范

## 强制要求：参考项目

**每次实现代码前，必须先参考以下核心开源项目。这是硬性要求，不可跳过。**

### 核心参考项目

| 项目 | 路径 | 用途 | 关键文件 |
|------|------|------|---------|
| **autoresearch** | `/Users/admin/ai/ref/autoresearch` | 实验循环模式 (Karpathy) | `train.py`, `prepare.py` |
| **gpt-researcher** | `/Users/admin/ai/ref/gpt-researcher` | FastAPI 架构、async agent 模式 | `gpt_researcher/`, `backend/` |
| **deep-research** | `/Users/admin/ai/ref/deep-research` | 最简 deep research 实现 | `src/` |
| **AI-Scientist** | `/Users/admin/ai/ref/AI-Scientist` | 全自动科学发现流水线 | `ai_scientist/`, `launch_scientist.py` |
| **MLE-agent** | `/Users/admin/ai/ref/MLE-agent` | AI 工程助手、arXiv 集成 | `mle/` |
| **khoj** | `/Users/admin/ai/ref/khoj` | 自托管 AI 平台、Docker Compose、多 LLM | `src/khoj/`, `docker-compose.yml` |
| **LabClaw** | `/Users/admin/ai/ref/LabClaw` | 240+ AI agent skills（引用管理、实验训练、统计分析、科学可视化） | `skills/literature/citation-management/`, `skills/general/pytorch-lightning/`, `skills/general/statistics/`, `skills/visualization/scientific-visualization/` |
| **Kuse Cowork** | (GitHub: kuse-ai/kuse_cowork) | **Agent Runtime 架构参考** — Plan→Step→Execute 模式，AgentEvent 流式推送，bundled-skills markdown 技能文件 | 桌面 agent 核心逻辑 |

### 参考项目索引（GitNexus）

所有参考项目已通过 GitNexus 索引，可用以下命令分析和搜索：

```bash
# 查看已索引的项目
gitnexus list

# 搜索代码模式（按概念分组的执行流）
gitnexus query <repo-name> "<搜索关键词>"

# 查看符号的 360 度视图（引用、所属流程）
gitnexus context <repo-name> "<符号名>"

# 影响分析（改动 X 会影响什么）
gitnexus impact <repo-name> "<符号名>"

# 原始图查询
gitnexus cypher <repo-name> "<Cypher 查询>"
```

### 实现流程

1. **搜索**：用 `gitnexus query` 搜索与当前任务相关的模式
2. **阅读**：读取参考项目中的相关源文件
3. **参照**：基于参考项目的模式编写代码
4. **标注**：在代码注释或 commit message 中标注参考来源

### 各阶段对应的核心参考

| 阶段 | 主要参考 | 参考什么 |
|------|---------|---------|
| Phase 1: 基础设施 | khoj, gpt-researcher | Docker Compose, FastAPI 架构, 认证 |
| Phase 2: 论文搜索 | gpt-researcher, deep-research | 多源搜索、async 数据获取 |
| Phase 3: 中文学术源 | (CNKI/万方爬虫见 open-source-references.md) | 反爬策略、会话管理 |
| Phase 4: 引用网络 | AI-Scientist, deep-research | 图谱构建、引用分析 |
| Phase 5: Deep Research | gpt-researcher, deep-research, AI-Scientist | 研究流水线、LLM 分析 |
| Phase 6: 论文地图 | khoj (前端), MLE-agent (可视化) | React 组件、图谱可视化 |
| Phase 7: 方案生成 | AI-Scientist, MLE-agent, LabClaw (statistics) | SOTA 分析、方案设计、统计方法选择 |
| Phase 8: 实验执行 | autoresearch, AI-Scientist, LabClaw (pytorch-lightning) | 实验循环、训练模式、多后端日志 |
| Phase 9: 实验仪表盘 | khoj (前端), MLE-agent, LabClaw (scientific-visualization) | 实时监控、报告生成、期刊级图表 |
| Phase 10: 社区协作 | khoj (用户系统) | 用户画像、匹配算法 |
| Agent Runtime | Kuse Cowork, LabClaw (skills) | Plan→Execute agent 架构, markdown 技能定义 |
| 跨阶段: 引用管理 | LabClaw (citation-management) | 5 阶段引用工作流（发现→提取→格式化→验证→去重） |

## 技术栈

- **后端**: FastAPI + Python 3.12+ (uv 管理)
- **前端**: React 19 + Vite 7 + Tailwind CSS 3 + React Router 7 + i18next (SPA)
- **桌面**: Tauri (Phase 8)
- **数据库**: PostgreSQL 17 + Neo4j + Meilisearch
- **缓存**: Valkey 8.1+ (不是 Redis)
- **存储**: SeaweedFS (不是 MinIO，已归档)
- **工作流**: Temporal Server
- **LLM**: LiteLLM (Claude + GPT fallback)
- **分析**: ClickHouse (延后到 Phase 6+)

## GSD 工作流

项目使用 GSD (Get Shit Done) 管理开发流程：
- 配置: `.planning/config.json` (YOLO 模式, comprehensive 深度, parallel 执行)
- 路线图: `.planning/ROADMAP.md` (10 个 phase)
- 需求: `.planning/REQUIREMENTS.md` (108 个 v1 需求)
- 状态: `.planning/STATE.md`

## 前端项目

- 路径: `project-7411174/` (React 19 + Vite 7 + Tailwind + React Flow + react-force-graph-3d + i18next)
- 开发: `cd project-7411174 && npm run dev` (默认 localhost:3001)
- 构建: `npm run build` → 输出到 `project-7411174/out/`

## 部署

- 服务器: 101.126.141.165 (root)
- 部署路径: /opt/studyhub/
- 后端: /opt/studyhub/backend/ + /opt/studyhub/infra/docker-compose.yml
- 前端: /opt/studyhub/frontend/ (Nginx 静态文件)
- 命令: `docker-compose` (旧版，不是 `docker compose`)
- 重建后端: `cd /opt/studyhub/infra && docker-compose up -d --build api`

## node 路径

```
"/Users/admin/Library/Application Support/easyclaw/ai/tool_cache/resources/tools/mac/node-24.13.0-arm64/bin/node"
```
