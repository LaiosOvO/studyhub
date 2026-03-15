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

### 参考项目索引

所有参考项目已通过 refindex-v2 索引，可用以下命令搜索：

```bash
NODE="/Users/admin/Library/Application Support/easyclaw/ai/tool_cache/resources/tools/mac/node-24.13.0-arm64/bin/node"
CLI="/Users/admin/ai/cli/gpt/prod/refindex-v2/src/cli.js"
NEXUS_SKILL_DIR="/Users/admin/.config/opencode/skills/nexus-mapper" "$NODE" "$CLI" search --query "<搜索关键词>" --limit 5
```

### 实现流程

1. **搜索**：用 refindex 搜索与当前任务相关的模式
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
| Phase 7: 方案生成 | AI-Scientist, MLE-agent | SOTA 分析、方案设计 |
| Phase 8: 实验执行 | autoresearch, AI-Scientist | 实验循环、代码修改、评估 |
| Phase 9: 实验仪表盘 | khoj (前端), MLE-agent | 实时监控、报告生成 |
| Phase 10: 社区协作 | khoj (用户系统) | 用户画像、匹配算法 |

## 技术栈

- **后端**: FastAPI + Python 3.12+ (uv 管理)
- **前端**: Next.js 16 + React + Tailwind CSS + next-intl
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

## node 路径

```
"/Users/admin/Library/Application Support/easyclaw/ai/tool_cache/resources/tools/mac/node-24.13.0-arm64/bin/node"
```
