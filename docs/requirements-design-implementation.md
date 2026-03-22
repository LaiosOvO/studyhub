# StudyHub — 需求、设计与实现全景文档

> 最后更新: 2026-03-20
> 涵盖范围: 本轮会话完成的 4 大功能模块 + 全面代码审计修复

---

## 一、内测码注册系统

### 1.1 需求

用户注册时需要内测码准入。数据库中手动维护邀请码（beta 阶段），保留永久码 `6666`。注册流程收集学术身份信息（院校、专业、导师、研究方向），并支持上传论文（PDF/MD）自动提取研究领域关键词。

### 1.2 设计

#### 数据模型

```
invite_codes 表
├── id (UUID PK)
├── code (VARCHAR 50, UNIQUE, INDEXED)
├── max_uses (INT, 0=无限)
├── current_uses (INT)
├── is_active (BOOL)
├── created_by, note, expires_at, created_at
```

- `is_valid()` 方法检查 active + 使用量 + 过期时间
- 使用量递增采用 **SQL 级原子操作**（防止并发竞争）:
  ```python
  sql_update(InviteCode).where(InviteCode.id == invite.id)
      .values(current_uses=InviteCode.current_uses + 1)
  ```

#### 注册流程

```
[Step 1: 内测码 + 账号信息] → [Step 2: 学术身份] → [Step 3: 论文上传] → [Step 4: 关键词展示]
```

- Step 1: 内测码、显示名称、邮箱、密码（带强度指示器）
- Step 2: 身份选择（7 种角色）、院校、专业、导师、研究方向
- Step 3: 拖拽上传 PDF/MD/TXT，可跳过
- Step 4: 若上传论文并成功提取关键词，展示提取结果再跳转首页

#### 论文解析

- PDF: PyMuPDF (`fitz`) 提取全文 → 正则匹配 Keywords/关键词 段落
- MD/TXT: 正则匹配关键词段落，回退到 `##`/`###` 标题提取
- 提取结果更新到 `ResearcherProfile.research_directions`

### 1.3 实现

| 文件 | 变更 |
|------|------|
| `backend/app/models/invite_code.py` | **新建** InviteCode 模型 |
| `backend/alembic/versions/017_create_invite_codes_table.py` | **新建** 表迁移 + 种子码 "6666" |
| `backend/app/schemas/auth.py` | RegisterRequest 增加 invite_code, institution, major, advisor, role, research_directions |
| `backend/app/services/auth_service.py` | `validate_invite_code()` + `register_user()` 增加学术信息处理 + 原子计数 |
| `backend/app/routers/auth.py` | register 传递新字段 + **新增** `POST /auth/upload-papers` 端点 |
| `backend/app/models/__init__.py` | 导出 InviteCode |
| `backend/pyproject.toml` | 添加 `pymupdf>=1.25.0` |
| `project-7411174/src/lib/api.ts` | `authApi.register()` 接受 `extra` 参数 + `authApi.uploadPapers()` |
| `project-7411174/src/contexts/AuthContext.tsx` | `RegisterExtra` 接口 + `register()` 签名扩展 |
| `project-7411174/src/pages/auth/register/page.tsx` | **重写** 4 步注册流程（含论文上传 + 关键词预览） |

#### 关键代码片段

后端注册（`auth_service.py`）:
```python
async def register_user(session, email, password, full_name, invite_code, institution, major, advisor, role, research_directions):
    invite = await validate_invite_code(session, invite_code)
    # 检查邮箱 → 创建 User → flush 获取 user.id → 创建 ResearcherProfile
    profile = ResearcherProfile(
        user_id=user.id,
        display_name=full_name,
        institution=institution,
        title=role,
        research_directions=research_directions or [],
        expertise_tags=expertise,  # 含 major + "导师: {advisor}"
    )
    # 原子递增邀请码使用次数
    await session.execute(sql_update(InviteCode)...)
```

前端注册 Step 4 关键词展示:
```tsx
// 上传论文后，若提取到关键词则展示 "done" 步骤
if (result.extracted_keywords?.length > 0) {
    setExtractedKeywords(result.extracted_keywords);
    setStep("done");  // 展示关键词标签
    return;
}
navigate("/");  // 无关键词则直接跳转
```

---

## 二、Agent Runtime（文档生成 Agent）

### 2.1 需求

基于 Deep Research 结果，通过 AI Agent 自动生成文献综述、实验方案等学术文档。采用 Plan → Approve → Execute 工作流，支持 WebSocket 实时进度推送和完整执行日志。

### 2.2 设计

#### 架构参考

- **Kuse Cowork**: Plan → Step → Execute 执行模式
- **LabClaw**: Markdown skill 文件定义 Agent 能力

#### 执行流程

```
用户选择技能 → LLM 生成计划 → 用户审批/拒绝
                                    ↓ 批准
                            逐步执行（工具调用 + LLM 生成章节）
                                    ↓
                            组装文档 → 输出
```

#### 状态机

```
PENDING → PLANNING → AWAITING_APPROVAL → EXECUTING → COMPLETED
                          ↓                   ↓
                      CANCELLED             FAILED
```

#### 数据模型

```
agent_runs 表
├── id (UUID PK)
├── user_id, skill_name, task_id
├── status (enum 上述状态)
├── plan (JSONB — 目标 + 步骤列表)
├── input_context, output_artifact, output_format
├── total_cost, total_steps, error
├── created_at, started_at, completed_at

agent_logs 表
├── id (SERIAL PK)
├── run_id (FK)
├── event_type (plan/step_start/step_done/tool_call/tool_result/text/error/complete)
├── step_number, message, data (JSONB)
├── timestamp
```

#### Skill 定义

技能以 Markdown 文件存储在 `backend/app/services/agent/skills/`，包含:
- `name`, `display_name`, `description`
- `output_format` (md)
- `system_prompt` (LLM 系统提示)

内置技能:
1. `literature_review` — 文献综述生成
2. `experiment_plan` — 实验方案生成

#### 工具系统

| 工具 | 用途 |
|------|------|
| `get_research_summary` | 获取 Deep Research 摘要 |
| `get_papers` | 获取论文列表（排序/筛选） |
| `get_paper_analyses` | 获取 AI 分析结果 |
| `get_gaps_and_trends` | 获取研究空白和趋势 |
| `get_existing_report` | 获取已有文献综述 |
| `write_section` | 写入文档章节到上下文 |

#### WebSocket 事件流

```
Client → ws://host/api/v1/agent/runs/{runId}/ws?token=JWT
Server → { event_type, message, step_number, data, timestamp }
```

事件类型: `plan` / `step_start` / `step_done` / `tool_call` / `tool_result` / `text` / `error` / `complete`

### 2.3 实现

| 文件 | 变更 |
|------|------|
| `backend/app/models/agent_run.py` | **新建** AgentRun + AgentLog 模型 |
| `backend/alembic/versions/016_create_agent_runs_and_logs_tables.py` | **新建** 表迁移 |
| `backend/app/services/agent/types.py` | **新建** AgentEventType, RunStatus, PlanStep, AgentPlan, AgentEvent, ToolResult |
| `backend/app/services/agent/skill_loader.py` | **新建** Markdown 技能文件解析器 |
| `backend/app/services/agent/tools.py` | **新建** 6 个工具实现 + 注册表 |
| `backend/app/services/agent/agent_loop.py` | **新建** 核心执行引擎 (527 行) |
| `backend/app/services/agent/skills/literature_review.skill.md` | **新建** 文献综述技能定义 |
| `backend/app/services/agent/skills/experiment_plan.skill.md` | **新建** 实验方案技能定义 |
| `backend/app/routers/agent.py` | **新建** REST 端点 + WebSocket (432 行) |
| `backend/app/main.py` | 注册 agent router |
| `project-7411174/src/lib/api.ts` | **新增** `agentApi` 完整封装 + 类型定义 |
| `project-7411174/src/pages/agent/page.tsx` | **新建** AgentNewRunPage + AgentRunPage (590 行) |
| `project-7411174/src/router/config.tsx` | 添加 `/agent/new` + `/agent/runs/:runId` 路由 |

#### 关键设计决策

**1. 后台任务 Session 隔离**

审批后执行在 `asyncio.create_task()` 中运行。FastAPI 的请求作用域 Session 在响应后关闭，因此后台任务必须创建独立 Session:

```python
async def _bg_execute():
    factory = get_session_factory()
    async with factory() as bg_session:
        loop = AgentLoop(session=bg_session, ...)
        await loop.execute()
        await bg_session.commit()

asyncio.create_task(_bg_execute())
```

**2. WebSocket 身份验证**

JWT 通过 query parameter 传递（WebSocket 不支持 Authorization header），连接前验证用户拥有该 run:

```python
@router.websocket("/runs/{run_id}/ws")
async def ws_run_progress(websocket, run_id, token=Query("")):
    payload = jwt.decode(token, ...)
    # 验证 run 所有权
    run = await ws_session.get(AgentRun, run_id)
    if not run or run.user_id != user_id:
        await websocket.close(code=4003)
        return
```

**3. Agent 入口集成**

Deep Research 完成后，用户可从多个入口启动 Agent:
- 研究任务完成页: "生成文献综述" / "生成实验方案" 按钮 → `/agent/new?taskId={taskId}`
- 研究报告页侧边栏: "AI 文档生成" 区域

---

## 三、研究报告页重写

### 3.1 需求

研究报告页原有 100% 硬编码 mock 数据（一个完整的伪造报告），需替换为从后端 API 加载真实数据。

### 3.2 设计

- 调用 `researchApi.getReport(taskId)` 获取 Markdown 报告
- 自实现 Markdown 分块解析器（tokenizer），支持: h2/h3/blockquote/bullet/numbered/table/hr/warning/paragraph
- 自动生成目录（TOC），侧边栏统计（字符数、章节数）
- 导出 MD 功能（Blob 下载）

### 3.3 实现

| 文件 | 变更 |
|------|------|
| `project-7411174/src/pages/research/report/page.tsx` | **完全重写** 413 行 |

变更要点:
- 删除硬编码的 `const reportContent = "..."` (约 200 行假数据)
- 新增 `useEffect` 从 API 加载报告
- 新增 Loading / Error 状态
- 统计数据从实际内容计算（字符数、标题数）
- 新增侧边栏 "AI 文档生成" 入口（连接到 Agent Runtime）
- 自实现 `tokenize()` + `groupListItems()` + `RenderBlock()` 安全渲染

---

## 四、代码审计与修复

### 4.1 需求

用户要求: "自己 review 不要遗漏任何东西看下前端的每个按钮和界面串联的流程是否完整"。全面检查所有代码，修复假实现、断联功能、安全漏洞。

### 4.2 发现与修复

#### CRITICAL (全部已修复)

| # | 问题 | 修复 |
|---|------|------|
| C1 | 研究报告页 100% mock 数据 | 重写为 `researchApi.getReport(taskId)` + loading/error |
| C2 | Logout 发送空 body，后端 422 | 发送 `{ refresh_token: getRefreshToken() }` |
| C3 | 邀请码使用量非原子递增 | `sql_update(InviteCode).values(current_uses=InviteCode.current_uses + 1)` |

#### HIGH (全部已修复)

| # | 问题 | 修复 |
|---|------|------|
| H1 | 导师信息存为假论文 `publications=[{type:"advisor"}]` | 改存 `expertise_tags` 为 `"导师: {advisor}"` |
| H3 | Agent 后台任务共享请求作用域 Session | 创建独立 Session via `get_session_factory()` |

#### MEDIUM (已修复 3 项)

| # | 问题 | 修复 |
|---|------|------|
| M2 | `InviteCode.is_valid()` 时区比较可能 naive | 统一 `datetime.now(timezone.utc)` |
| M4 | Migration 用 `default` 而非 `server_default` | 改为 `server_default="0"` / `server_default=sa.text("true")` |
| M5 | Agent WebSocket 无 run 所有权验证 | 连接前查 DB 验证 `run.user_id == user_id` |
| M3 | `upload-papers` 端点缺 `response_model` | 添加 `response_model=ApiResponse` |

#### LOW (已修复 3 项)

| # | 问题 | 修复 |
|---|------|------|
| L1 | 注册页提取关键词后立即跳转，用户看不到结果 | 新增 "done" 步骤展示关键词标签 |
| L2 | 注册页 `uploading` state 从未使用 | 删除 |
| L5 | 注册页两个按钮（"完成注册" + "跳过"）都调同一函数 | 合并为单按钮，动态标签 |
| L6 | Agent `run_id` 截断为 12 字符 hex | 改为 `str(uuid.uuid4())` 完整 UUID |

#### 保留不改（设计合理）

| # | 问题 | 理由 |
|---|------|------|
| M1 | `write_section` 工具 in-place 修改 context | 设计为可变累加器，生命周期限于单次 run |
| M6 | `PlanStep.status` 执行中 in-place 修改 | 瞬态执行状态，不共享不外泄 |
| L4 | `API_URL` fallback 硬编码生产 IP | 环境变量优先覆盖，dev 便利 |
| L7 | Logout 端点 bare `ApiResponse` | 无 data 返回的端点标准写法 |

---

## 五、前端路由与页面总览

### 5.1 完整路由表 (17 条)

| 路径 | 页面 | 认证 | 数据源 |
|------|------|------|--------|
| `/` | 首页 (HeroSection) | 否 | 静态 |
| `/search` | 论文搜索 | 否 | `searchApi` + Meilisearch |
| `/papers/:paperId` | 论文详情 | 否 | `papersApi` |
| `/scholars` | 学者列表 | 否 | `scholarsApi` |
| `/login` | 登录 | 否 | `authApi.login()` |
| `/register` | 注册 (4 步) | 否 | `authApi.register()` + `uploadPapers()` |
| `/research/new` | 新建研究任务 | 是 | `researchApi.createTask()` |
| `/research/:taskId` | 论文地图 (3D) | 是 | `citation-fetcher.ts` + OpenAlex/S2 |
| `/research/:taskId/report` | 研究报告 | 是 | `researchApi.getReport()` |
| `/plans` | 实验方案列表 | 是 | `plansApi` |
| `/experiments` | 实验仪表盘 | 是 | `experimentsApi` |
| `/community` | 社区协作 | 是 | `communityApi` |
| `/reading-lists` | 阅读列表 | 是 | `readingListsApi` |
| `/profile/:userId` | 用户画像 | 是 | `profilesApi` |
| `/agent/new` | Agent 技能选择 | 是 | `agentApi.listSkills()` |
| `/agent/runs/:runId` | Agent 运行详情 | 是 | `agentApi` + WebSocket |
| `*` | 404 | 否 | 静态 |

### 5.2 关键用户流程

**完整研究闭环:**
```
首页 → 搜索论文 → 选中论文 → 新建研究任务 → Deep Research 执行
  → 研究报告页（查看报告 + 导出 MD）
  → 论文地图（3D 引用图谱 + 详情面板 + 阅读列表）
  → Agent Runtime（选择技能 → 审批计划 → 实时执行 → 导出文档）
```

**注册流程:**
```
注册页 Step 1（内测码 + 账号） → Step 2（学术身份） → Step 3（论文上传） → Step 4（关键词展示） → 首页
```

---

## 六、后端 API 端点总览

### 6.1 认证 (`/auth`)

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/auth/register` | 注册（含内测码 + 学术信息） |
| POST | `/auth/login` | 登录，返回 JWT pair |
| POST | `/auth/refresh` | 刷新 access token |
| POST | `/auth/logout` | 注销（黑名单 refresh token） |
| GET | `/auth/me` | 当前用户信息 |
| POST | `/auth/upload-papers` | 上传论文提取研究方向 |

### 6.2 Agent Runtime (`/api/v1/agent`)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/agent/skills` | 列出可用技能 |
| POST | `/agent/runs` | 创建运行（生成计划） |
| POST | `/agent/runs/{id}/approve` | 批准计划，开始执行 |
| POST | `/agent/runs/{id}/reject` | 拒绝计划 |
| GET | `/agent/runs/{id}` | 获取运行状态 |
| GET | `/agent/runs/{id}/output` | 获取输出文档 |
| GET | `/agent/runs/{id}/logs` | 获取执行日志 |
| GET | `/agent/runs` | 列出用户的所有运行 |
| WS | `/agent/runs/{id}/ws?token=JWT` | 实时事件推送 |

---

## 七、依赖变更

### 后端新增

| 包 | 版本 | 用途 |
|----|------|------|
| `pymupdf` | >=1.25.0 | PDF 文本提取（论文上传） |
| `litellm` | (已有) | Agent LLM 调用 |

### 前端新增

| 包 | 用途 |
|----|------|
| `react-force-graph-3d` | 引用图谱 3D 可视化（已安装，待完整集成） |

---

## 八、已知遗留与后续计划

### 8.1 待实现 (P0)

| # | 项目 | 说明 | 参考方案 |
|---|------|------|---------|
| 1 | CitationGraph3D 重写 | raw Three.js → react-force-graph-3d，425→60 行 | `docs/reference-adoption-plan.md` 第一节 |
| 2 | Deep Research 内联引用 | Jinja2 模板 → STORM 式 `[1][3]` 引用管道 | 同上第二节 |
| 3 | experiment_metrics 规范化表 | JSON blob → 独立指标表，解锁对比查询 | 同上第三节 |

### 8.2 待实现 (P1)

| # | 项目 | 说明 |
|---|------|------|
| 4 | 分节并行报告生成 | asyncio.gather 并行各章节 LLM 生成 |
| 5 | 批量指标日志端点 | `POST /metrics/batch` 最多 1000 条/次 |
| 6 | 跨 run 对比端点 | 多 run 同指标降采样查询 |
| 7 | 3 层论文去重 | DOI + 模糊标题 + 作者年份组合 |

### 8.3 已知风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| localStorage 存 JWT | XSS 可窃取 token | 后续迁移 httpOnly cookie |
| UserResponse 无 `name` 字段 | 前端 fallback `user.name` 取不到 | 使用 `full_name` |
| 部分页面仍用 mock 数据 | 社区/实验/方案页 | 后续逐步替换 |
| 前端 SPA 无 SSR | SEO 差 | v1 可接受，v2 评估 |

---

*文档路径: `docs/requirements-design-implementation.md`*
*生成时间: 2026-03-20*
