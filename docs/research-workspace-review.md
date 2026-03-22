# Research Workspace — 需求 · 设计 · 实现 Review 文档

> 更新时间: 2026-03-20
> 状态: 已实现，待部署验证
> 参考项目: OpenWork (different-ai/openwork)

---

## 一、需求

### 1.1 用户需求

在深度研究任务完成后，提供一个类似 VSCode 的工作区页面，让用户能够：
1. **浏览** 研究过程中产生的所有文件（报告、论文列表、分析结果、引用网络等）
2. **编辑** 文件内容（特别是 Markdown 报告和笔记）
3. **新建** 个人笔记文件
4. **版本管理** — 使用 Git 管理所有变更，可查看历史、对比差异

### 1.2 用户流程

```
/research/new (ConfigStep 配置研究参数)
    ↓
ProgressStep（7 阶段执行，每阶段完成后后端自动 git add + git commit）
    ↓ 完成
/research/:taskId/workspace（独立的工作区页面）
```

- 研究完成后自动跳转到工作区
- 工作区可从研究历史列表随时重新进入
- 编辑保存也会产生 git commit

### 1.3 功能清单

| 功能 | 优先级 | 状态 |
|------|--------|------|
| 文件树浏览（递归目录结构） | P0 | ✅ 已实现 |
| Monaco Editor 代码/文档编辑（多 tab） | P0 | ✅ 已实现 |
| Markdown 实时预览 | P0 | ✅ 已实现 |
| Ctrl+S 保存 → 自动 git commit | P0 | ✅ 已实现 |
| Git commit 历史查看 | P0 | ✅ 已实现 |
| 两版本间 diff 对比（Monaco DiffEditor） | P0 | ✅ 已实现 |
| 新建笔记文件 | P1 | ✅ 已实现 |
| 删除文件 | P1 | ✅ 已实现 |
| 可拖拽调整面板大小 | P1 | ✅ 已实现 |
| 研究管道各阶段自动产生文件和 commit | P0 | ✅ 已实现 |
| 导出工作区为 .zip | P2 | ❌ 未实现 |
| git revert 回退到历史版本 | P2 | ❌ 未实现 |

---

## 二、设计

### 2.1 页面布局

```
┌──────── Top Bar ────────────────────────────────────────────┐
│  [←] 研究工作区 {taskId:8}     [Git] [论文地图] [报告]      │
├──────────┬───────────────────────┬──────────────────────────┤
│          │ Tab1 | Tab2 | Tab3   │                          │
│ FILE     │                      │  MARKDOWN PREVIEW        │
│ TREE     │ MONACO EDITOR        │  (仅 .md 文件显示)       │
│ (18%)    │                      │  (32%)                   │
│          │ (50%)                │                          │
├──────────┴───────────────────────┴──────────────────────────┤
│  GIT PANEL: commit log → file list → diff viewer (可折叠)   │
└─────────────────────────────────────────────────────────────┘
```

**分栏方案:** `react-resizable-panels` v4，支持拖拽调整大小
- 外层: 垂直分割 — 编辑区(70%) + Git 面板(30%, 可折叠)
- 内层: 水平分割 — 文件树(18%) + 编辑器(50%) + Markdown 预览(32%, 仅 .md 激活)

### 2.2 工作区文件结构

每个研究任务在后端 `/data/workspaces/{task_id}/` 下创建一个独立 Git 仓库：

```
{task_id}/
├── .studyhub              # 工作区标识文件
├── report.md              # 文献综述报告（STORM 式内联引用）
├── papers.csv             # 论文元数据 (id, title, authors, year, venue, citations, quality_score)
├── papers.json            # 论文完整数据（含 abstract）
├── analysis/              # 每篇论文的 AI 分析
│   ├── {paper_id_1}.md    # TL;DR, 方法, 贡献, 数据集
│   └── ...
├── gaps.md                # 研究空白分析
├── trends.md              # 趋势分析
├── network/
│   └── citations.json     # 引用网络数据 (nodes + edges)
└── notes/                 # 用户自建笔记目录
```

### 2.3 Git Commit 时间线

| 阶段 | 自动 Commit 的文件 | Commit Message 格式 |
|------|-------------------|---------------------|
| 初始化 | .studyhub | `Initialize workspace` |
| 搜索完成 | papers.csv, papers.json | `stage: search — found {n} papers` |
| 引用扩展 | network/citations.json | `stage: citations — {n} nodes, {m} edges` |
| 分析完成 | analysis/*.md | `stage: analysis — analyzed {n} papers` |
| 聚类完成 | papers.csv (更新 cluster 列) | `stage: classification — {n} papers classified` |
| 空白/趋势检测 | gaps.md, trends.md | `stage: gaps — ...` / `stage: trends — ...` |
| 报告生成 | report.md | `stage: report — literature review generated` |
| 用户编辑 | 修改的文件 | `Update {filename}` 或自定义 |

### 2.4 后端 API 设计

**文件 CRUD:**
```
GET    /api/v1/workspaces/{task_id}/tree              → 文件列表
GET    /api/v1/workspaces/{task_id}/files/{path}       → 读取文件
PUT    /api/v1/workspaces/{task_id}/files/{path}       → 更新并 commit
POST   /api/v1/workspaces/{task_id}/files              → 新建并 commit
DELETE /api/v1/workspaces/{task_id}/files/{path}       → 删除并 commit
```

**Git 操作:**
```
GET    /api/v1/workspaces/{task_id}/git/log                    → commit 历史
GET    /api/v1/workspaces/{task_id}/git/diff?from_sha=&to_sha= → 两版本 diff
GET    /api/v1/workspaces/{task_id}/git/show/{sha}/{path}      → 历史版本文件
```

所有端点需认证（JWT），响应使用 `ApiResponse<T>` 信封格式。

### 2.5 前端组件架构

```
src/pages/research/workspace/
├── page.tsx                    # 主页面，三栏布局组装
├── types.ts                    # OpenTab, TreeNode, buildTree, detectLanguage
├── hooks/
│   ├── useWorkspaceFiles.ts    # 文件树 + CRUD + tab 管理
│   └── useGitHistory.ts        # Git log + diff 查看
└── components/
    ├── FileTree.tsx            # 递归文件树（展开/折叠/新建/删除）
    ├── EditorTabs.tsx          # 多 tab 栏（dirty 指示器/关闭按钮）
    ├── MonacoWrapper.tsx       # Monaco Editor 封装（Ctrl+S 保存）
    ├── MarkdownPreview.tsx     # react-markdown 实时预览
    └── GitPanel.tsx            # commit 列表 → 文件列表 → DiffEditor
```

### 2.6 技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 编辑器 | Monaco Editor (`@monaco-editor/react` v4.7) | VSCode 同款内核，Markdown/JSON/CSV 语法高亮 + 内置 diff 对比 |
| 分栏 | `react-resizable-panels` v4.7 | 轻量，拖拽调整，v4 API (Group/Panel/Separator) |
| Markdown 预览 | `react-markdown` v10 | 已安装，无 XSS 风险，Tailwind prose 样式兼容 |
| 版本管理 | 服务器 Git CLI (asyncio subprocess) | 最可靠，用户无需本地安装，原生 diff/log/show 支持 |
| 文件存储 | 本地文件系统 | 简单直接，Git 原生支持 |
| 工作区隔离 | 每任务一个独立 Git 仓库 | 互不干扰，可独立导出 |

---

## 三、实现

### 3.1 后端: workspace_service.py

**路径**: `backend/app/services/workspace_service.py` (328 行)

核心函数:

| 函数 | 功能 | 安全措施 |
|------|------|---------|
| `_workspace_path(task_id)` | 获取工作区目录 | 拒绝 `..` / `/` / `\` 防路径穿越，双重 resolve 校验 |
| `_validate_file_path(workspace, path)` | 校验文件路径 | 拒绝 `..`，resolve 后检查是否在 workspace 内 |
| `_run_git(cwd, *args)` | 执行 git 命令 | asyncio subprocess，`GIT_TERMINAL_PROMPT=0` 防挂起 |
| `init_workspace(task_id)` | 初始化 Git 仓库 | 幂等（已存在则跳过），创建 .studyhub 标识文件 |
| `write_and_commit(task_id, path, content, message)` | 写文件 + commit | 自动 mkdir -p，不可变 commit（每次新提交） |
| `read_file(task_id, path)` | 读取文件 | 路径穿越检查 + FileNotFoundError |
| `delete_file(task_id, path, message)` | 删除 + commit | `git rm` + commit |
| `list_files(task_id)` | 列出所有追踪文件 | `git ls-files`，返回 path/type/size/modified |
| `get_log(task_id, limit)` | 获取 commit 历史 | 自定义分隔符解析，含 files_changed |
| `get_diff(task_id, from_sha, to_sha)` | 两版本 diff | `git diff --name-only` + `git show` 获取新旧内容 |
| `get_file_at_commit(task_id, sha, path)` | 历史版本文件 | `git show {sha}:{path}` |

**安全设计重点:**
- 双重路径穿越防护（task_id 级 + file_path 级）
- `GIT_TERMINAL_PROMPT=0` 防止 git 命令等待用户输入
- 所有 git 命令通过 `asyncio.create_subprocess_exec`（非 shell=True）

### 3.2 后端: workspace router

**路径**: `backend/app/routers/workspace.py` (283 行)

| 端点 | 方法 | 路径 | 功能 |
|------|------|------|------|
| `get_file_tree` | GET | `/{task_id}/tree` | 列出文件树 |
| `get_file` | GET | `/{task_id}/files/{path:path}` | 读取文件内容 |
| `update_file` | PUT | `/{task_id}/files/{path:path}` | 更新文件 + commit |
| `create_file` | POST | `/{task_id}/files` | 新建文件 + commit |
| `delete_file` | DELETE | `/{task_id}/files/{path:path}` | 删除文件 + commit |
| `get_git_log` | GET | `/{task_id}/git/log` | commit 历史 (limit 参数 1-500) |
| `get_git_diff` | GET | `/{task_id}/git/diff` | 两版本 diff |
| `get_file_at_commit` | GET | `/{task_id}/git/show/{sha}/{path:path}` | 历史版本文件 |

**错误处理**: 统一的 helper 函数将 ValueError→400, FileNotFoundError→404, RuntimeError→500。

**Pydantic Schemas**: `FileEntry`, `CommitEntry`, `DiffEntry`, `WriteFileBody`, `CreateFileBody`, `CommitResult`, `FileContent`, `FileContentWithSha`。

### 3.3 后端: 管道集成

**路径**: `backend/app/workflows/activities.py` (修改)

在深度研究管道的 6 个 Temporal activity 中加入了 workspace 写入：

| Activity | 写入文件 | 时机 |
|----------|---------|------|
| `search_papers_activity` | papers.csv, papers.json | 论文持久化到 DB 后 |
| `expand_citations_activity` | network/citations.json | 引用网络构建后 |
| `analyze_papers_activity` | analysis/{paper_id}.md | 每篇分析完成后 |
| `classify_relationships_activity` | papers.csv (更新) | 聚类完成后 |
| `detect_gaps_activity` | gaps.md, trends.md | 检测完成后 |
| `generate_report_activity` | report.md | 报告生成后 |

**容错设计**: 所有 workspace 写入都包裹在 `try/except` 中，失败只 log warning 不影响主管道。workspace_service import 在函数体内（避免 Temporal worker 导入问题）。

### 3.4 前端: API Client

**路径**: `project-7411174/src/lib/api.ts` (新增部分)

```typescript
// 类型
export interface WorkspaceFile { path, type, size, modified }
export interface GitCommit { sha, message, date, author, files_changed }
export interface GitDiff { path, old_content, new_content }

// API 对象
export const workspaceApi = {
  getTree, getFile, updateFile, createFile, deleteFile,
  getGitLog, getGitDiff, getFileAtCommit
}
```

### 3.5 前端: types.ts

**路径**: `project-7411174/src/pages/research/workspace/types.ts` (49 行)

- `OpenTab` — 编辑器标签页状态 (path, content, language, isDirty)
- `TreeNode` — 文件树节点 (name, path, type, children)
- `buildTree(files)` — 将扁平文件列表转为嵌套树结构
- `detectLanguage(path)` — 根据文件扩展名返回 Monaco 语言标识

### 3.6 前端: useWorkspaceFiles Hook

**路径**: `project-7411174/src/pages/research/workspace/hooks/useWorkspaceFiles.ts` (133 行)

管理文件树和编辑器 tab 状态：

| 方法 | 功能 |
|------|------|
| `refresh()` | 从 API 获取文件树 |
| `openFile(path)` | 获取内容，打开新 tab 或切换到已有 tab |
| `closeTab(path)` | 关闭 tab，自动切换到最后一个剩余 tab |
| `updateContent(path, content)` | 本地更新内容，标记 isDirty |
| `saveFile(path)` | 调用 API 保存 → 清除 isDirty → 刷新文件树 |
| `createFile(path, content)` | 调用 API 新建 → 刷新 → 自动打开 |
| `deleteFile(path)` | 调用 API 删除 → 关闭 tab → 刷新 |

**不可变模式**: 所有 state 更新通过 `setTabs(prev => prev.map(...))` 创建新数组，不直接修改。

### 3.7 前端: useGitHistory Hook

**路径**: `project-7411174/src/pages/research/workspace/hooks/useGitHistory.ts`

| 方法 | 功能 |
|------|------|
| `refreshLog()` | 获取 commit 列表 |
| `viewCommitDiff(commit)` | 查找父 commit，获取两者间的 diff |
| `clearSelection()` | 重置选中状态 |

### 3.8 前端: UI 组件

#### FileTree.tsx
- 递归 `TreeItem` 组件渲染目录和文件
- 文件图标根据扩展名切换: .md → ri-markdown-line, .json → ri-braces-line, .csv → ri-table-line
- 活动文件 accent-cyan 高亮
- hover 显示删除按钮
- 顶部 "+" 按钮展开内联输入框新建文件，默认路径前缀 `notes/`

#### EditorTabs.tsx
- 水平 tab 栏，显示文件名
- isDirty 时显示 cyan 圆点指示器
- hover 显示关闭按钮
- 活动 tab 底部 accent-cyan 边框

#### MonacoWrapper.tsx
- 封装 `@monaco-editor/react` Editor 组件
- 主题: vs-dark
- 注册 Ctrl+S / Cmd+S 快捷键调用 `onSave` 回调
- 配置: fontSize 13, 无 minimap, wordWrap on, 平滑滚动

#### MarkdownPreview.tsx
- 使用 `react-markdown` 渲染
- Tailwind `prose prose-invert prose-sm` 暗色主题
- 自定义: 标题 text-primary, 链接 accent-cyan, 代码块暗色背景, 表格边框

#### GitPanel.tsx
- **三层导航**: commit 列表 → 文件变更列表 → DiffEditor
- commit 列表: SHA(7位) + message + 相对时间("X分钟前") + 文件数
- 文件变更列表: 点击进入 diff
- DiffEditor: Monaco `DiffEditor` 组件，并排对比，只读模式

### 3.9 前端: WorkspacePage 主页面

**路径**: `project-7411174/src/pages/research/workspace/page.tsx` (211 行)

- 全屏布局（无 Navbar），`h-screen`
- 顶部栏: 返回按钮 + "研究工作区" + taskId 片段 + Git 切换 + 论文地图链接 + 报告链接
- `react-resizable-panels` v4: `Group` (alias PanelGroup) + `Panel` + `Separator` (alias PanelResizeHandle)
- 垂直方向: 编辑区(70%) / Git 面板(30%, 可折叠)
- 水平方向: 文件树(18%) / 编辑器(50%) / Markdown 预览(32%, 仅 .md)
- 空状态: 代码图标 + "选择左侧文件开始编辑" + "Ctrl+S 保存并提交"

### 3.10 路由集成

**router/config.tsx 新增:**
```typescript
import WorkspacePage from "../pages/research/workspace/page";
{ path: "/research/:taskId/workspace", element: auth(<WorkspacePage />) }
```

**CompleteStep 修改:**
- 主按钮从 "查看论文地图" 改为 "进入研究工作区"（导航到 `/research/{taskId}/workspace`）
- "论文地图" 和 "文献报告" 降级为并排的次级按钮

---

## 四、文件清单

### 新建文件 (11)

| 文件 | 行数 | 说明 |
|------|------|------|
| `backend/app/services/workspace_service.py` | 328 | Git 操作服务 |
| `backend/app/routers/workspace.py` | 283 | REST API 端点 |
| `project-7411174/src/pages/research/workspace/page.tsx` | 211 | 主页面 |
| `project-7411174/src/pages/research/workspace/types.ts` | 49 | 类型和工具函数 |
| `project-7411174/src/pages/research/workspace/hooks/useWorkspaceFiles.ts` | 133 | 文件管理 hook |
| `project-7411174/src/pages/research/workspace/hooks/useGitHistory.ts` | ~60 | Git 历史 hook |
| `project-7411174/src/pages/research/workspace/components/FileTree.tsx` | ~130 | 文件树组件 |
| `project-7411174/src/pages/research/workspace/components/EditorTabs.tsx` | ~50 | 标签栏组件 |
| `project-7411174/src/pages/research/workspace/components/MonacoWrapper.tsx` | ~40 | 编辑器封装 |
| `project-7411174/src/pages/research/workspace/components/MarkdownPreview.tsx` | ~30 | 预览组件 |
| `project-7411174/src/pages/research/workspace/components/GitPanel.tsx` | ~200 | Git 面板组件 |

### 修改文件 (5)

| 文件 | 修改内容 |
|------|---------|
| `backend/app/config.py` | 添加 `workspace_root` 配置项 |
| `backend/app/main.py` | 注册 workspace router |
| `backend/app/workflows/activities.py` | 6 个 activity 添加 workspace 写入 |
| `project-7411174/src/lib/api.ts` | 添加 workspaceApi + 3 个类型 |
| `project-7411174/src/router/config.tsx` | 添加 workspace 路由 |
| `project-7411174/src/pages/research/page.tsx` | CompleteStep 导航改为工作区 |

---

## 五、待 Review 关注点

### 安全
1. workspace_service 的路径穿越防护是否充分？（双重校验: task_id 级 + file_path 级）
2. Git 命令是否存在注入风险？（使用 `create_subprocess_exec` 非 shell=True）
3. 是否需要限制单个工作区的文件总大小？
4. 是否需要验证 task_id 属于当前用户？（当前 `_user` 依赖仅做认证未做授权）

### 性能
5. `get_log` 使用 `--name-only` 获取每个 commit 的文件列表，commit 数量大时可能慢
6. `get_diff` 逐文件调用 `git show` 获取内容，变更文件多时可能慢
7. Monaco Editor 打开大文件（>1MB 的 papers.json）时的性能

### 可靠性
8. 管道 activity 中 workspace 写入失败是否真的不影响主流程？（try/except 包裹）
9. 并发编辑同一工作区时的 Git 冲突处理？（当前未处理）
10. Git 仓库磁盘空间管理（长期运行后 .git 目录膨胀）

### 功能完整性
11. 缺少 git revert API（设计文档中有，实现中未做）
12. 缺少 .zip 导出功能
13. 文件重命名功能缺失
14. `createFile` 的默认路径前缀 `notes/` 是否合理？用户可能想在根目录创建文件

### 前端
15. `react-resizable-panels` v4 的 `Separator` 是否需要 `id` 和 `aria-label`（无障碍）
16. `useWorkspaceFiles` 中 `tabs` 在 `openFile` 依赖中可能导致 stale closure
17. Git 面板默认关闭 (`useState(false)`) — 用户可能不知道有这个功能
