# Deep Research Workspace — VSCode 风格编辑器设计

> 生成时间: 2026-03-20
> 状态: 待实现

---

## 1. 概述

在深度研究任务完成后，进入一个类 VSCode 的工作区页面。研究过程中的所有产物（报告、论文列表、分析结果等）以文件形式展示在文件树中，用户可以浏览、编辑、新建笔记，并通过 Git 进行版本管理。

**参考项目**: OpenWork (different-ai/openwork) — Tauri + React 的 AI 工作区 GUI

---

## 2. 用户流程

```
/research/new (ConfigStep)
    ↓
ProgressStep（7 阶段执行，每阶段完成后后端 git add + git commit）
    ↓ 完成
/research/:taskId/workspace（新页面 — 本设计的核心）
```

- ProgressStep 结束后自动跳转到 workspace 页面
- workspace 页面可从研究列表随时重新进入
- 工作区内的编辑保存也会产生 git commit

---

## 3. 布局设计

```
┌──────────────────────────────────────────────────────────────────┐
│  Toolbar: [Git log] [Diff] [New file] [Export]    task: xxx     │
├────────────┬──────────────────────────┬──────────────────────────┤
│            │  Tab1 | Tab2 | Tab3      │                          │
│  FILE TREE │                          │   MARKDOWN PREVIEW       │
│            │  MONACO EDITOR           │   (实时渲染)              │
│  report.md │                          │                          │
│  papers.csv│  # 文献综述: LLM...      │   文献综述: LLM...        │
│  analysis/ │  ## 概述                 │   概述                    │
│    001.md  │  大语言模型[1]在...       │   大语言模型¹在...         │
│    002.md  │                          │                          │
│  gaps.md   │                          │                          │
│  trends.md │                          │                          │
│  network/  │                          │                          │
│  notes/    │                          │                          │
├────────────┴──────────────────────────┴──────────────────────────┤
│  GIT PANEL: commit log / diff view (可折叠)                      │
└──────────────────────────────────────────────────────────────────┘
```

**三栏 + 底部面板:**
- **左侧 (200px, 可拖拽)**: 文件树
- **中间 (flex-1)**: Monaco Editor，支持多 tab
- **右侧 (40%, 可拖拽)**: Markdown 实时预览（仅 .md 文件激活）
- **底部 (可折叠)**: Git commit 历史 + diff 查看器

---

## 4. 工作区文件结构

每个研究任务在后端 `/data/workspaces/{task_id}/` 下创建一个 Git 仓库：

```
{task_id}/
├── report.md              # 文献综述报告（STORM 式内联引用）
├── papers.csv             # 论文元数据列表 (id, title, authors, year, venue, citations, quality_score)
├── papers.json            # 论文完整数据（含 abstract）
├── analysis/              # 每篇论文的 AI 分析
│   ├── {paper_id_1}.md    # TL;DR, 方法, 贡献, 数据集
│   ├── {paper_id_2}.md
│   └── ...
├── gaps.md                # 研究空白分析
├── trends.md              # 趋势分析
├── network/
│   └── citations.json     # 引用网络图数据 (nodes + edges)
└── notes/                 # 用户自建笔记目录
    └── .gitkeep
```

### Git Commit 时间线

| 阶段 | 自动 Commit 内容 | Commit Message |
|------|-----------------|----------------|
| 搜索完成 | papers.csv, papers.json | `stage: search — found {n} papers` |
| 分析完成 | analysis/*.md | `stage: analysis — analyzed {n} papers` |
| 聚类完成 | papers.csv (更新 cluster 列) | `stage: classification — {n} clusters` |
| 空白检测 | gaps.md | `stage: gaps — {n} gaps identified` |
| 趋势分析 | trends.md | `stage: trends — analysis complete` |
| 报告生成 | report.md | `stage: report — literature review generated` |
| 引用网络 | network/citations.json | `stage: network — citation graph built` |
| 用户编辑 | 用户修改的文件 | `edit: {filename}` |

---

## 5. 后端 API

### 5.1 工作区文件 API

```
GET    /api/v1/workspaces/{task_id}/tree
       → { files: [{ path, type: "file"|"dir", size, modified }] }

GET    /api/v1/workspaces/{task_id}/files/{path}
       → { content: string, encoding: "utf-8" }

PUT    /api/v1/workspaces/{task_id}/files/{path}
       body: { content: string, commit_message?: string }
       → { success: true, commit_sha: string }
       # 自动 git add + git commit

POST   /api/v1/workspaces/{task_id}/files
       body: { path: string, content: string }
       → { success: true, commit_sha: string }
       # 新建文件 + git add + git commit

DELETE /api/v1/workspaces/{task_id}/files/{path}
       → { success: true, commit_sha: string }
```

### 5.2 Git 版本管理 API

```
GET    /api/v1/workspaces/{task_id}/git/log
       → { commits: [{ sha, message, author, date, files_changed }] }

GET    /api/v1/workspaces/{task_id}/git/diff?from={sha}&to={sha}
       → { diffs: [{ path, old_content, new_content }] }

GET    /api/v1/workspaces/{task_id}/git/show/{sha}/{path}
       → { content: string }
       # 查看历史版本的文件内容

POST   /api/v1/workspaces/{task_id}/git/revert/{sha}
       → { success: true, commit_sha: string }
       # 回退到某个版本
```

### 5.3 后端实现要点

```python
# backend/app/services/workspace_service.py

import asyncio
from pathlib import Path

WORKSPACE_ROOT = Path("/data/workspaces")

async def init_workspace(task_id: str) -> Path:
    """在研究任务开始时初始化 Git 仓库"""
    workspace = WORKSPACE_ROOT / task_id
    workspace.mkdir(parents=True, exist_ok=True)
    await _run_git(workspace, "init")
    await _run_git(workspace, "config", "user.name", "StudyHub")
    await _run_git(workspace, "config", "user.email", "system@studyhub.local")
    return workspace

async def write_and_commit(
    task_id: str, path: str, content: str, message: str
) -> str:
    """写入文件并 git add + commit，返回 commit SHA"""
    workspace = WORKSPACE_ROOT / task_id
    file_path = workspace / path
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding="utf-8")
    await _run_git(workspace, "add", path)
    await _run_git(workspace, "commit", "-m", message)
    sha = await _run_git(workspace, "rev-parse", "HEAD")
    return sha.strip()

async def get_log(task_id: str) -> list[dict]:
    """获取 git log"""
    workspace = WORKSPACE_ROOT / task_id
    raw = await _run_git(
        workspace, "log",
        "--format=%H|%s|%aI|%an", "--name-only"
    )
    # parse into structured commits
    ...

async def get_diff(task_id: str, from_sha: str, to_sha: str) -> str:
    workspace = WORKSPACE_ROOT / task_id
    return await _run_git(workspace, "diff", from_sha, to_sha)

async def _run_git(cwd: Path, *args: str) -> str:
    proc = await asyncio.create_subprocess_exec(
        "git", *args,
        cwd=str(cwd),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"git {args[0]} failed: {stderr.decode()}")
    return stdout.decode()
```

---

## 6. 前端组件结构

```
src/pages/research/workspace/
├── page.tsx                    # 主页面，组装三栏布局
├── components/
│   ├── FileTree.tsx            # 左侧文件树（递归展开）
│   ├── EditorTabs.tsx          # 多 tab 管理
│   ├── MonacoWrapper.tsx       # Monaco Editor 封装
│   ├── MarkdownPreview.tsx     # 右侧 Markdown 实时预览
│   ├── GitPanel.tsx            # 底部 Git 面板
│   ├── GitLogList.tsx          # Commit 列表
│   ├── DiffViewer.tsx          # Monaco Diff Editor 封装
│   └── WorkspaceToolbar.tsx    # 顶部工具栏
├── hooks/
│   ├── useWorkspaceFiles.ts    # 文件树 + CRUD
│   └── useGitHistory.ts        # Git log + diff
└── types.ts                    # 类型定义
```

### 关键依赖

```json
{
  "@monaco-editor/react": "^4.7",
  "react-resizable-panels": "^2.x",
  "react-markdown": "^9.x",
  "remark-gfm": "^4.x"
}
```

---

## 7. 核心交互

### 7.1 文件操作
- 点击文件树项 → 在编辑器打开新 tab
- 编辑后 Ctrl+S → 调用 PUT API → 自动 git commit → 刷新 Git 面板
- 右键文件树 → 新建/重命名/删除
- .md 文件打开时右侧自动显示预览；.json/.csv 文件隐藏预览栏

### 7.2 Git 操作
- 底部面板默认显示 commit 列表（SHA 缩写 + message + 时间）
- 点击某个 commit → 展示该 commit 的文件变更列表
- 点击变更文件 → Monaco Diff Editor 并排对比
- "回退到此版本" 按钮 → 确认弹窗 → POST revert API

### 7.3 导出
- 工具栏 "导出" → 下载整个工作区为 .zip
- 单文件右键 → 下载该文件

---

## 8. 与现有系统集成

### 路由
```typescript
// router/config.tsx 新增
{ path: "/research/:taskId/workspace", element: auth(<WorkspacePage />) }
```

### ProgressStep 跳转
```typescript
// research/page.tsx CompleteStep 修改
// "查看文献综述报告" 改为 "进入工作区"
navigate(`/research/${taskId}/workspace`);
```

### 深度研究管道集成
```python
# deep_research workflow 中每个阶段完成后调用 workspace_service
await workspace_service.write_and_commit(
    task_id=task.id,
    path="papers.csv",
    content=papers_to_csv(papers),
    message=f"stage: search — found {len(papers)} papers",
)
```

---

## 9. 工作量估算

| 模块 | 工作量 |
|------|--------|
| 后端 workspace_service（Git 操作封装） | 0.5天 |
| 后端 workspace router（文件 + Git API） | 0.5天 |
| 深度研究管道集成（各阶段写文件 + commit） | 0.5天 |
| 前端 MonacoWrapper + EditorTabs | 0.5天 |
| 前端 FileTree + 文件 CRUD | 0.5天 |
| 前端 MarkdownPreview | 0.5天 |
| 前端 GitPanel + DiffViewer | 1天 |
| 前端主页面布局 + 分栏拖拽 | 0.5天 |
| 路由集成 + ProgressStep 跳转 | 0.5天 |
| **合计** | **~5天** |

---

## 10. 技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 编辑器 | Monaco Editor | VSCode 同款内核，Markdown/JSON/CSV 语法高亮 + diff 内置 |
| 分栏 | react-resizable-panels | 轻量、支持拖拽、持久化布局 |
| Markdown 预览 | react-markdown + remark-gfm | 支持 GFM 表格/脚注，无 XSS 风险 |
| 版本管理 | 服务器 Git CLI | 最可靠的方案，用户无需安装任何东西 |
| 文件存储 | 本地文件系统 | 简单直接，Git 原生支持 |
| 工作区隔离 | 每任务一个 Git 仓库 | 互不干扰，可独立导出 |
