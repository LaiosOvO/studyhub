# AutoResearch 设计文档评审（代码对照）

评审对象：`/Users/admin/ai/self-dev/study-community/docs/autoresearch-design.md`  
评审时间：2026-03-22  
评审范围：前端 `project-7411174`、后端 `backend`、桌面端 `apps/desktop`

---

## 1) 结论摘要

- **总体结论**：设计文档与当前实现整体方向一致，核心链路（program.md → prepare.py → baseline → loop keep/discard → paper stages）已落地。
- **主要问题**：存在若干“文档表述 > 实际实现”的偏差，优先级最高的是：
  1. **“无超时限制”与实现不一致**（代码里有显式超时）
  2. **路径可移植性不足**（LabClaw 路径硬编码到本机绝对路径）
  3. **一处实现细节存在兼容风险**（基线 commit 读取固定 `master` 分支）

---

## 2) 对齐项（文档与代码一致）

### 2.1 主流程与阶段设计基本一致

- 文档描述的 Phase A/B/C 在前端编排中可见：
  - `project-7411174/src/pages/autoresearch/page.tsx:340+`（`handleStart`）
  - `Step 1` program.md 生成：`407+`
  - `Step 3` prepare.py 生成与执行：`511+`
  - baseline：`647+`
  - loop keep/discard：`710+`
  - 论文 8 阶段：`950+`

### 2.2 prepare.py 分隔符解析与回退策略已实现

- 与文档“分隔符优先 + code block 回退 + 整体兜底”一致：
  - `page.tsx:561-580`

### 2.3 maxTokens 动态化已实现

- `fetchModelMaxTokens()` + `dynamicMaxTokens`（25%，夹在 8192~16384）：
  - `page.tsx:355-361`
  - `project-7411174/src/lib/deep-research/llm-client.ts:47+`

### 2.4 实验循环的 keep/discard 与结果追踪已实现

- 前端 loop 中调用 `localExec.decide()` 进行 keep/discard：`page.tsx:870+ / 884+`
- 桌面端 `local_ar_decide` 会 `git reset --hard HEAD~1` 并追加 `results.tsv`：
  - `apps/desktop/src-tauri/src/commands/autoresearch.rs:505+`
- 后端也有同名语义：
  - `backend/app/services/autoresearch/executor.py:250+`

### 2.5 文档列出的关键文件大多数存在且职责匹配

- 前端页：`project-7411174/src/pages/autoresearch/page.tsx`
- 技能加载：`project-7411174/src/lib/labclaw-skills.ts`
- 本地执行抽象：`project-7411174/src/lib/local-exec.ts`
- Tauri 命令：`apps/desktop/src-tauri/src/commands/autoresearch.rs`
- 后端执行器/路由：
  - `backend/app/services/autoresearch/executor.py`
  - `backend/app/routers/autoresearch.py`

---

## 3) 不一致与风险项

###[高] 3.1 “无超时”声明与实际实现冲突

- 文档写法：
  - `docs/autoresearch-design.md` 第 9 条需求：“无超时（LLM 调用和代码执行不设人为超时限制）”。
- 代码现状：
  - 前端默认超时 `timeoutSec = 300`：`page.tsx:294`
  - baseline/loop 执行使用 `timeout_seconds: timeoutSec`：`page.tsx:654+`, `820+`
  - prepare 与 pip 也固定 300s：`page.tsx:599-617`
  - 后端执行器有上限 `MAX_TIMEOUT = 1800`：`executor.py:35`
  - Tauri 默认 24h 超时（并非无限）：`autoresearch.rs:346`

**影响**：设计预期与运行行为不一致，会导致排障和期望管理偏差。  
**建议**：文档改为“默认有超时、可配置”，并标注各执行面（Web/Tauri/Backend）默认值。

###[中] 3.2 LabClaw 技能路径硬编码，不可移植

- 前端技能路径硬编码：
  - `project-7411174/src/lib/labclaw-skills.ts:58` (`/Users/admin/ai/ref/LabClaw/skills`)
- 桌面端同样硬编码：
  - `apps/desktop/src-tauri/src/commands/autoresearch.rs:658`

**影响**：换机器/部署环境后高概率找不到技能文件。  
**建议**：改为配置项（env 或设置页）+ 运行时校验与降级提示。

###[中] 3.3 baseline commit 读取假设 `master` 分支

- `page.tsx:673-674` 通过读取 `.git/refs/heads/master` 获取 commit。

**影响**：若仓库默认分支不是 `master`（常见为 `main`），会得到空值，导致展示/日志不准确。  
**建议**：统一通过 `git rev-parse --short HEAD`（现有本地执行接口已能扩展支持）。

###[中] 3.4 文档“✅ (修复中)”语义冲突

- 文档需求表第 3 条状态写法为：`✅ (修复中)`。

**影响**：状态不可判定（到底完成还是未完成）。  
**建议**：改为明确状态枚举：`已完成 / 部分完成 / 修复中 / 未开始`。

###[中] 3.5 桌面端默认打开 devtools（非生产友好）

- `apps/desktop/src-tauri/src/lib.rs:54-58` 在 setup 中强制 `open_devtools()`。

**影响**：生产构建暴露调试入口，不符合发布规范。  
**建议**：仅在 dev/profile 开启。

---

## 4) 基础设施一致性矩阵（与该文档上下文相关）

基于代码证据可归纳为：

- **已实现**：FastAPI、Temporal、PostgreSQL、Meilisearch、LiteLLM
- **部分实现**：Valkey、SeaweedFS、Neo4j（某些路径仍有占位/待完善）

关键证据：

- FastAPI 入口与路由挂载：`backend/app/main.py`
- Temporal 客户端/Worker/Workflow：
  - `backend/app/services/temporal_service.py`
  - `backend/app/worker.py`
  - `backend/app/workflows/deep_research.py`
- Valkey 注入与使用（但限流仍内存）：
  - `backend/app/dependencies.py`
  - `backend/app/services/auth_service.py`
  - `backend/app/middleware/rate_limit.py`
- SeaweedFS 为可选/部分链路：
  - `backend/app/services/pdf_parser/parser_service.py`
  - `backend/app/services/experiment/environment.py:159-160`（注释 TODO）
- Neo4j 读写存在一处接口期望不一致风险：
  - workflow 活动调用 `execute_read/execute_write`：`backend/app/workflows/activities.py:517,565`
  - `Neo4jClient` 当前未定义同名公开方法：`backend/app/services/citation_network/neo4j_client.py`

---

## 5) 与外部参考模式的偏差（简要）

参考 `autoresearch / gpt-researcher / deep-research / AI-Scientist` 的共性后，本项目最需要补齐的是：

1. **失败策略分层**（I/O 重试 vs 训练快失败）要在文档中明确，不要只写“失败回退”。
2. **硬边界参数**（最大轮次、单次超时、失败清理）需要成为一等配置，避免无限循环失控。
3. **策略开关化**（fast/deep/strict）优于写死参数，便于不同资源场景稳定运行。

---

## 6) 建议落地清单（按优先级）

### P0（今天可做）

1. 修改文档“无超时”表述为“默认超时 + 可配置”，并补充三端默认值。  
2. 文档状态表改成清晰状态枚举，去掉“✅(修复中)”混合状态。

### P1（本周）

3. LabClaw 路径改配置化（前端 + Tauri），并增加路径不存在时的明确提示。  
4. baseline commit 获取方式改为 `git rev-parse --short HEAD`，移除 `master` 假设。

### P2（后续）

5. 统一 Neo4j 客户端在 workflow 活动中的读写接口，消除潜在调用不一致。  
6. 将“实验硬边界参数”显式入文档与配置项（max iterations / timeout policy / cleanup policy）。

---

## 7) 最终判断

`autoresearch-design.md` 不是“脱离实现的空文档”，核心流程已落地；但它目前更像“目标态 + 部分现状混写”。  
建议先按本评审的 P0/P1 进行一次文档与实现同步，避免后续团队把“设计承诺”误当“已实现行为”。
