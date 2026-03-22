# Research Workspace 文档与代码对照 Review（2026-03-20）

> 评审对象：
> - `docs/plans/2026-03-20-research-workspace-design.md`
> - `docs/plans/2026-03-20-research-workspace-plan.md`
> - `docs/research-workspace-review.md`
> - 对应后端/前端实现代码

## 1. 总结结论

当前实现已经覆盖了 Research Workspace 的主链路（页面、文件 CRUD、Git log/diff、管道阶段写入），可以算作 **可用 MVP**。  
但与设计/计划文档相比仍有明显缺口，且存在 3 个高优先级风险：**授权校验缺失、CSV 写入错误、前后端类型契约不一致**。

结论评级：**部分通过（Pass with major gaps）**。

---

## 2. 已对齐项（文档 vs 代码）

1. **工作区页面与路由已落地**
   - 前端路由：`/research/:taskId/workspace` 已注册（`project-7411174/src/router/config.tsx`）
   - 完成页 CTA 已改为“进入研究工作区”（`project-7411174/src/pages/research/page.tsx`）

2. **三栏工作区 + 可折叠 Git 面板已实现**
   - 主页面：`project-7411174/src/pages/research/workspace/page.tsx`
   - 组件：`FileTree.tsx`、`EditorTabs.tsx`、`MonacoWrapper.tsx`、`MarkdownPreview.tsx`、`GitPanel.tsx`

3. **后端工作区服务与 API 已实现**
   - 服务：`backend/app/services/workspace_service.py`
   - Router：`backend/app/routers/workspace.py`
   - main 注册：`backend/app/main.py`

4. **研究流程写入工作区并自动 commit 已实现**
   - `backend/app/workflows/activities.py` 中 search/citations/analysis/classify/gaps/trends/report 都有 `write_and_commit`

5. **前端 API 客户端已实现**
   - `project-7411174/src/lib/api.ts` 中 `workspaceApi` 已覆盖 tree/file/git 核心接口

---

## 3. 未对齐与缺失项

### 3.1 功能缺口（文档有、代码无）

1. **Git revert 未实现**
   - 设计文档包含 `POST /api/v1/workspaces/{task_id}/git/revert/{sha}`
   - 实际 `workspace.py` 无此端点

2. **导出 zip 未实现**
   - 设计有“导出工作区”要求
   - 前后端均未发现对应实现

3. **文件重命名未实现**
   - 目前仅有 create/delete/update，无 rename API 与 UI

### 3.2 行为偏差

1. **“Progress 完成后自动跳转 workspace”未实现为自动跳转**
   - 当前行为是进入 CompleteStep 后由用户点击按钮进入 workspace

2. **Git 面板默认状态与文档预期有偏差**
   - `workspace/page.tsx` 中 `gitPanelOpen` 默认 `false`

---

## 4. 高优先级风险（建议先修）

### P0-1 授权风险：仅鉴权、未鉴权属主

- 现状：`workspace.py` 依赖 `get_current_user`，但没有校验 `task_id` 是否属于当前用户
- 风险：已登录用户若猜到 task_id，可能读取/修改他人 workspace

### P0-2 数据一致性风险：classify 阶段 CSV 拼接错误

- 文件：`backend/app/workflows/activities.py`
- 问题：给 `papers.csv` 增加 `cluster_info` 时字符串拼接缺少分隔符，可能导致列错位和数据污染

### P1-1 前后端类型契约不一致

1. `modified` 字段：
   - 后端 `workspace_service.py` 返回 ISO 字符串
   - 前端 `api.ts` 类型 `WorkspaceFile.modified` 定义为 `number`

2. diff 内容字段：
   - 后端允许 `old_content/new_content` 为 `null`
   - 前端 `GitDiff` 定义为 `string`

### P1-2 同内容保存 commit 失败风险

- `write_and_commit` 未处理“无变更 commit”场景
- 用户重复保存可能触发 git commit 错误

---

## 5. 文档一致性问题

`docs/research-workspace-review.md` 整体结构完整，但部分描述已与代码现状不一致，建议按本次审查结果更新：

1. 把“已实现”与“待实现”状态改成**逐项证据化**（文件路径+函数/组件）
2. 明确标注以下缺失：revert、zip 导出、rename
3. 把风险清单中 P0/P1 分级前置，便于排期

---

## 6. 建议修复顺序

1. **先修安全与数据正确性（P0）**
   - 增加 task 属主授权校验
   - 修复 classify 写 CSV 逻辑

2. **再修契约稳定性（P1）**
   - 对齐 `modified` 和 `GitDiff` 类型
   - 处理空变更提交策略

3. **最后补齐功能缺口（P1/P2）**
   - Git revert API + UI
   - 工作区 zip 导出
   - 文件 rename
