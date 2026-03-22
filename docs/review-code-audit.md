# StudyHub 文档与代码一致性评审（2026-03-19）

> 评审范围: `docs/review-document.md` + 核心代码与规划文件
> 评审方式: analyze-mode（direct tools + explore + librarian + oracle）
> 评审目标: 校验“文档描述”与“实际实现”一致性，并给出文档优先修复清单

---

## 1. 结论

**结论：FAIL（当前文档不能作为可靠现状基线）**

基于 direct tools + explore/librarian + Oracle 复核，5 个关键核查点仅 1 个通过（前端 Vite SPA 事实），其余 4 个存在直接矛盾或契约不一致：

1. 前端形态（Next.js/SSR vs Vite/SPA）口径冲突。  
2. 认证实现描述（token 内存存储）与真实代码不一致。  
3. Deep Research WebSocket 前后端路径不一致。  
4. 测试覆盖描述“0%”与仓库事实不符。  
5. 阶段状态在 `REQUIREMENTS/ROADMAP/review-document` 三者间存在冲突。

---

## 2. 核心证据对账

| 主题 | 文档声明 | 代码/配置证据 | 判定 |
|---|---|---|---|
| 前端栈口径 | `review-document.md` 声明前端为 React+Vite SPA（L40），并指出 WAPP-01 的 SSR 要求与现状冲突（L416, L432） | `project-7411174/package.json` 明确 `vite` 与 React 19（L27-L30, L52）；`apps/` 目录仅有 `desktop/`，不存在 `apps/web/` | ⚠️ 文档内部已有冲突提示，但项目其余文档仍混用 Next.js 口径 |
| STARTUP 文档口径 | `docs/STARTUP.md` 仍要求启动 `apps/web` Next.js（L95, L98, L134, L164, L253） | 实际目录无 `apps/web`（`/apps` 仅 `desktop/`） | ❌ 明确不一致 |
| token 存储策略 | `review-document.md` 写“Access token 存内存（非 localStorage）”（L330） | `src/lib/api.ts` 使用 `localStorage` 读写 access/refresh token（L13, L17, L21-L22, L26-L27） | ❌ 明确不一致 |
| Deep Research WS 路径 | 前端 `researchApi.wsUrl` 生成 `/api/v1/deep-research/tasks/${taskId}/ws`（`api.ts` L349-L350） | 后端路由为 `include_router(... prefix="/api/v1")` + `APIRouter(prefix="/deep-research")` + `@router.websocket("/ws/{workflow_id}")`（`main.py` L124, `deep_research.py` L37, L433） => 实际路径 `/api/v1/deep-research/ws/{workflow_id}` | ❌ 明确不一致 |
| 测试覆盖状态 | `review-document.md` 写“集成测试: 0%”（L428） | `backend/tests/` 存在大量测试文件（40+），如 `test_temporal.py`, `test_search_index.py`, `test_paper_search.py` 等 | ⚠️ 描述失真（应区分“自动化测试存在”与“端到端集成覆盖不足”） |
| 阶段完成状态 | `review-document.md` 结尾写“10/10 Phases 代码完成”（L523） | `ROADMAP.md` 进度表写 Phase 9 为 `0/3 Not started`（L236），Phase 10 完成（L237） | ❌ 明确不一致 |
| 需求与路线图状态冲突 | `review-document.md` 已指出 pending 与 phase complete 不一致（L431） | `REQUIREMENTS.md` 中 SRCH/PARS/DEEP/ANAL/PMAP/PLAN 多项仍 `[ ]` pending（如 L19-L27, L61-L69, L79-L85, L88-L98, L101-L109）；`ROADMAP.md` 对应阶段多为 complete（L232-L235） | ⚠️ 问题识别正确，需统一标准 |

---

## 3. 代码质量与架构观察（补充）

### 3.1 后端实现结构

- 路由数量与文档接近：`backend/app/routers/*.py` 共 16 个。  
- 服务模块规模较大：`backend/app/services/**` 共 60+ 文件。  
- 模型数量与文档接近：`backend/app/models/*.py` 共 12 个（含 `__init__`）。

### 3.2 静态检查信号

- `backend/app/routers/llm.py` 存在基于 pyright 的类型告警与泛型缺失（`dict` 未标注类型参数等），说明该模块类型约束较弱。  
- 前端 `api.ts` 未检出 LSP 错误，但存在文档与实现偏差（token 存储、WS URL）。

### 3.3 前端 mock 依赖仍明显

`project-7411174/src` 多处仍引用 `mocks`，涉及 `plans/community/search/research map/profile/home` 等页面，说明“前端真实 API 连通”尚未全面完成。

---

## 4. 优先级修复清单（文档优先）

### P0（必须先修）

1. **统一前端形态单一事实源**：统一到 “Vite SPA + project-7411174” 或恢复 Next.js 并同步所有文档。  
2. **修正 Deep Research WebSocket 文档与前端调用**：明确真实路径与参数语义（`workflow_id` vs `task_id`）。  
3. **修正 token 存储描述**：文档必须与 `api.ts` 当前行为一致（或标注“目标态 vs 当前态”）。

### P1（本迭代完成）

1. **重写测试覆盖描述**：从“0%”改为“有后端单测、缺端到端集成回归”，避免误导。  
2. **统一 Phase 完成口径**：`review-document.md` 与 `ROADMAP.md` 以同一快照更新时间为准。  
3. **将 REQUIREMENTS 与 ROADMAP 状态同步机制写清**（例如“完成定义=代码+测试+联调”）。

### P2（后续优化）

1. 在评审文档中补充“已实现/部分实现/未实现”三态矩阵。  
2. 为关键路径（search→citation→deep-research→plan→experiment）增加可复现验收脚本链接。  
3. 将外部 API 限流与降级策略单独抽成运维 runbook。

---

## 5. 若不修正的风险

1. **协作风险**：开发、测试、运维会基于不同“系统版本认知”执行，造成重复返工。  
2. **验收风险**：里程碑通过标准不一致，容易出现“文档完成但功能不可用”的假完成。  
3. **联调风险**：WS 路径不一致将直接导致前端实时进度不可用。  
4. **安全风险误判**：token 存储策略描述不准，会误导安全审计结论。

---

## 6. 建议的下一步

1. 先完成 **文档对齐 PR**（不改业务逻辑）：统一栈口径、路由口径、状态口径。  
2. 再开 **连通性 PR**：优先修 Deep Research WS 前后端路径/ID 语义。  
3. 最后执行一次 **里程碑重审**：以同一时间点刷新 `REQUIREMENTS` / `ROADMAP` / `review-document`。
