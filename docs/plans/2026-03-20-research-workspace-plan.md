# Research Workspace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a VSCode-style workspace page at `/research/:taskId/workspace` where users can browse, edit, and version-control all deep research artifacts.

**Architecture:** Backend manages a Git repo per task under `/data/workspaces/{task_id}/`. A new `workspace` FastAPI router exposes file tree, CRUD, and Git log/diff APIs. Frontend uses Monaco Editor + react-resizable-panels for a three-panel layout (file tree | editor | markdown preview) with a collapsible bottom Git panel.

**Tech Stack:** Monaco Editor (`@monaco-editor/react`), `react-resizable-panels`, `react-markdown` (already installed), server-side Git CLI via `asyncio.subprocess`.

---

### Task 1: Install frontend dependencies

**Files:**
- Modify: `project-7411174/package.json`

**Step 1: Install packages**

Run:
```bash
cd /Users/admin/ai/self-dev/study-community/project-7411174 && npm install @monaco-editor/react react-resizable-panels
```

**Step 2: Verify installation**

Run: `cd /Users/admin/ai/self-dev/study-community/project-7411174 && node -e "require('@monaco-editor/react'); require('react-resizable-panels'); console.log('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
cd /Users/admin/ai/self-dev/study-community/project-7411174 && git add package.json package-lock.json && git commit -m "chore: add monaco-editor and react-resizable-panels"
```

---

### Task 2: Backend workspace service (Git operations)

**Files:**
- Create: `backend/app/services/workspace_service.py`

**Step 1: Write the workspace service**

```python
"""Workspace Git repository management for deep research artifacts.

Each research task gets an isolated Git repo under WORKSPACE_ROOT.
Provides init, read, write, list, and Git history operations.

Reference: OpenWork workspace pattern.
"""

import asyncio
import csv
import io
import json
import logging
from pathlib import Path

from app.config import get_settings

logger = logging.getLogger(__name__)

WORKSPACE_ROOT = Path(get_settings().workspace_root if hasattr(get_settings(), "workspace_root") else "/data/workspaces")


async def _run_git(cwd: Path, *args: str) -> str:
    """Execute a git command in the given directory."""
    proc = await asyncio.create_subprocess_exec(
        "git", *args,
        cwd=str(cwd),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"git {args[0]} failed: {stderr.decode().strip()}")
    return stdout.decode()


def _workspace_path(task_id: str) -> Path:
    """Get the workspace directory for a task. Validates task_id to prevent path traversal."""
    safe_id = task_id.replace("/", "").replace("..", "").replace("\\", "")
    return WORKSPACE_ROOT / safe_id


async def init_workspace(task_id: str) -> Path:
    """Initialize a Git repo for the given task."""
    workspace = _workspace_path(task_id)
    workspace.mkdir(parents=True, exist_ok=True)

    git_dir = workspace / ".git"
    if git_dir.exists():
        return workspace

    await _run_git(workspace, "init")
    await _run_git(workspace, "config", "user.name", "StudyHub")
    await _run_git(workspace, "config", "user.email", "system@studyhub.local")

    # Create notes directory with .gitkeep
    notes_dir = workspace / "notes"
    notes_dir.mkdir(exist_ok=True)
    (notes_dir / ".gitkeep").touch()

    await _run_git(workspace, "add", ".")
    await _run_git(workspace, "commit", "-m", "init: workspace created")

    logger.info("Initialized workspace for task %s at %s", task_id, workspace)
    return workspace


async def write_and_commit(
    task_id: str, path: str, content: str, message: str,
) -> str:
    """Write a file and commit it. Returns the commit SHA."""
    workspace = _workspace_path(task_id)
    file_path = workspace / path
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding="utf-8")
    await _run_git(workspace, "add", path)
    await _run_git(workspace, "commit", "-m", message, "--allow-empty")
    sha = await _run_git(workspace, "rev-parse", "HEAD")
    return sha.strip()


async def read_file(task_id: str, path: str) -> str:
    """Read a file from the workspace."""
    workspace = _workspace_path(task_id)
    file_path = workspace / path
    if not file_path.exists() or not file_path.is_file():
        raise FileNotFoundError(f"File not found: {path}")
    # Prevent path traversal
    if not file_path.resolve().is_relative_to(workspace.resolve()):
        raise PermissionError("Path traversal detected")
    return file_path.read_text(encoding="utf-8")


async def delete_file(task_id: str, path: str, message: str) -> str:
    """Delete a file and commit. Returns commit SHA."""
    workspace = _workspace_path(task_id)
    file_path = workspace / path
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    if not file_path.resolve().is_relative_to(workspace.resolve()):
        raise PermissionError("Path traversal detected")
    file_path.unlink()
    await _run_git(workspace, "add", path)
    await _run_git(workspace, "commit", "-m", message)
    sha = await _run_git(workspace, "rev-parse", "HEAD")
    return sha.strip()


async def list_files(task_id: str) -> list[dict]:
    """List all tracked files in the workspace as a flat list."""
    workspace = _workspace_path(task_id)
    if not workspace.exists():
        return []

    raw = await _run_git(workspace, "ls-files")
    files = []
    for line in raw.strip().split("\n"):
        if not line or line == ".gitkeep":
            continue
        rel = line.strip()
        full = workspace / rel
        if full.exists() and full.is_file():
            stat = full.stat()
            files.append({
                "path": rel,
                "type": "file",
                "size": stat.st_size,
                "modified": stat.st_mtime,
            })
    return sorted(files, key=lambda f: f["path"])


async def get_log(task_id: str, limit: int = 50) -> list[dict]:
    """Get git log as structured list."""
    workspace = _workspace_path(task_id)
    if not workspace.exists():
        return []

    raw = await _run_git(
        workspace, "log",
        f"--max-count={limit}",
        "--format=%H|%s|%aI|%an",
    )
    commits = []
    for line in raw.strip().split("\n"):
        if not line:
            continue
        parts = line.split("|", 3)
        if len(parts) < 4:
            continue
        sha, message, date, author = parts
        # Get files changed in this commit
        try:
            diff_raw = await _run_git(workspace, "diff-tree", "--no-commit-id", "--name-only", "-r", sha)
            files_changed = [f for f in diff_raw.strip().split("\n") if f]
        except RuntimeError:
            files_changed = []

        commits.append({
            "sha": sha,
            "message": message,
            "date": date,
            "author": author,
            "files_changed": files_changed,
        })
    return commits


async def get_diff(task_id: str, from_sha: str, to_sha: str) -> list[dict]:
    """Get diff between two commits."""
    workspace = _workspace_path(task_id)
    raw = await _run_git(workspace, "diff", from_sha, to_sha, "--name-only")
    changed_files = [f for f in raw.strip().split("\n") if f]

    diffs = []
    for file_path in changed_files:
        try:
            old_content = await _run_git(workspace, "show", f"{from_sha}:{file_path}")
        except RuntimeError:
            old_content = ""
        try:
            new_content = await _run_git(workspace, "show", f"{to_sha}:{file_path}")
        except RuntimeError:
            new_content = ""
        diffs.append({
            "path": file_path,
            "old_content": old_content,
            "new_content": new_content,
        })
    return diffs


async def get_file_at_commit(task_id: str, sha: str, path: str) -> str:
    """Read a file at a specific commit."""
    workspace = _workspace_path(task_id)
    return await _run_git(workspace, "show", f"{sha}:{path}")
```

**Step 2: Add workspace_root to config**

In `backend/app/config.py`, add:
```python
workspace_root: str = "/data/workspaces"
```

**Step 3: Commit**

```bash
git add backend/app/services/workspace_service.py backend/app/config.py && git commit -m "feat: add workspace service with Git operations"
```

---

### Task 3: Backend workspace router (REST API)

**Files:**
- Create: `backend/app/routers/workspace.py`
- Modify: `backend/app/main.py` (register router)

**Step 1: Write the workspace router**

```python
"""Workspace file and Git management REST endpoints.

Exposes file CRUD with automatic Git commits, plus Git log and diff.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services import workspace_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


class FileContent(BaseModel):
    content: str
    commit_message: str | None = None


class NewFile(BaseModel):
    path: str
    content: str
    commit_message: str | None = None


class FileEntry(BaseModel):
    path: str
    type: str
    size: int
    modified: float


class CommitEntry(BaseModel):
    sha: str
    message: str
    date: str
    author: str
    files_changed: list[str]


class DiffEntry(BaseModel):
    path: str
    old_content: str
    new_content: str


# ── File Operations ─────────────────────────────────────────────

@router.get("/{task_id}/tree", response_model=ApiResponse[list[FileEntry]])
async def get_file_tree(
    task_id: str,
    _user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[list[FileEntry]]:
    """List all files in the workspace."""
    files = await workspace_service.list_files(task_id)
    return ApiResponse(success=True, data=files)


@router.get("/{task_id}/files/{path:path}", response_model=ApiResponse[dict])
async def get_file(
    task_id: str,
    path: str,
    _user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[dict]:
    """Read a file's content."""
    try:
        content = await workspace_service.read_file(task_id, path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {path}")
    except PermissionError:
        raise HTTPException(status_code=403, detail="Access denied")
    return ApiResponse(success=True, data={"content": content, "path": path})


@router.put("/{task_id}/files/{path:path}", response_model=ApiResponse[dict])
async def update_file(
    task_id: str,
    path: str,
    body: FileContent,
    _user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[dict]:
    """Update a file and auto-commit."""
    message = body.commit_message or f"edit: {path}"
    try:
        sha = await workspace_service.write_and_commit(task_id, path, body.content, message)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return ApiResponse(success=True, data={"commit_sha": sha, "path": path})


@router.post("/{task_id}/files", response_model=ApiResponse[dict], status_code=201)
async def create_file(
    task_id: str,
    body: NewFile,
    _user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[dict]:
    """Create a new file and commit."""
    message = body.commit_message or f"create: {body.path}"
    try:
        sha = await workspace_service.write_and_commit(task_id, body.path, body.content, message)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return ApiResponse(success=True, data={"commit_sha": sha, "path": body.path})


@router.delete("/{task_id}/files/{path:path}", response_model=ApiResponse[dict])
async def remove_file(
    task_id: str,
    path: str,
    _user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[dict]:
    """Delete a file and commit."""
    try:
        sha = await workspace_service.delete_file(task_id, path, f"delete: {path}")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {path}")
    return ApiResponse(success=True, data={"commit_sha": sha})


# ── Git Operations ──────────────────────────────────────────────

@router.get("/{task_id}/git/log", response_model=ApiResponse[list[CommitEntry]])
async def get_git_log(
    task_id: str,
    _user: Annotated[User, Depends(get_current_user)],
    limit: int = 50,
) -> ApiResponse[list[CommitEntry]]:
    """Get git commit history."""
    commits = await workspace_service.get_log(task_id, limit=limit)
    return ApiResponse(success=True, data=commits)


@router.get("/{task_id}/git/diff", response_model=ApiResponse[list[DiffEntry]])
async def get_git_diff(
    task_id: str,
    from_sha: str,
    to_sha: str,
    _user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[list[DiffEntry]]:
    """Get diff between two commits."""
    try:
        diffs = await workspace_service.get_diff(task_id, from_sha, to_sha)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ApiResponse(success=True, data=diffs)


@router.get("/{task_id}/git/show/{sha}/{path:path}", response_model=ApiResponse[dict])
async def get_file_at_commit(
    task_id: str,
    sha: str,
    path: str,
    _user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[dict]:
    """Read a file at a specific commit."""
    try:
        content = await workspace_service.get_file_at_commit(task_id, sha, path)
    except RuntimeError:
        raise HTTPException(status_code=404, detail="File not found at this commit")
    return ApiResponse(success=True, data={"content": content, "path": path, "sha": sha})
```

**Step 2: Register router in main.py**

Add to `backend/app/main.py`:
```python
from app.routers.workspace import router as workspace_router
# ... in app setup:
app.include_router(workspace_router, prefix="/api/v1")
```

**Step 3: Commit**

```bash
git add backend/app/routers/workspace.py backend/app/main.py && git commit -m "feat: add workspace REST API (file CRUD + git log/diff)"
```

---

### Task 4: Hook workspace into deep research pipeline

**Files:**
- Modify: `backend/app/workflows/activities.py` (add workspace writes after each stage)

**Step 1: Add workspace commit calls**

After each major activity completes, write results to workspace:

```python
# At end of search_papers_activity:
from app.services.workspace_service import init_workspace, write_and_commit

await init_workspace(task_id)

# Write papers.csv
csv_lines = ["id,title,authors,year,venue,citations,quality_score"]
for p in persisted_papers:
    csv_lines.append(f'"{p.id}","{p.title}","{",".join(p.authors or [])}",{p.year or ""},"{p.venue or ""}",{p.citation_count or 0},{p.quality_score or 0}')
await write_and_commit(task_id, "papers.csv", "\n".join(csv_lines), f"stage: search — found {len(persisted_papers)} papers")

# Write papers.json
papers_json = json.dumps([{
    "id": p.id, "title": p.title, "authors": p.authors,
    "year": p.year, "venue": p.venue, "abstract": p.abstract,
    "doi": p.doi, "citations": p.citation_count, "quality_score": p.quality_score,
} for p in persisted_papers], ensure_ascii=False, indent=2)
await write_and_commit(task_id, "papers.json", papers_json, "stage: search — papers detail")
```

Similarly for analyze, classify, gaps, trends, report stages — each writes its output and commits.

**Step 2: Commit**

```bash
git add backend/app/workflows/activities.py && git commit -m "feat: hook workspace git commits into deep research pipeline stages"
```

---

### Task 5: Frontend workspace API client

**Files:**
- Modify: `project-7411174/src/lib/api.ts`

**Step 1: Add workspace API types and client**

Append to `api.ts`:

```typescript
// ── Workspace API ────────────────────────────────────────────────

export interface WorkspaceFile {
  path: string;
  type: "file" | "dir";
  size: number;
  modified: number;
}

export interface GitCommit {
  sha: string;
  message: string;
  date: string;
  author: string;
  files_changed: string[];
}

export interface GitDiff {
  path: string;
  old_content: string;
  new_content: string;
}

export const workspaceApi = {
  getTree: (taskId: string) =>
    apiGet<WorkspaceFile[]>(`/api/v1/workspaces/${taskId}/tree`),

  getFile: (taskId: string, path: string) =>
    apiGet<{ content: string; path: string }>(`/api/v1/workspaces/${taskId}/files/${path}`),

  updateFile: (taskId: string, path: string, content: string, commitMessage?: string) =>
    apiPut<{ commit_sha: string }>(`/api/v1/workspaces/${taskId}/files/${path}`, {
      content, commit_message: commitMessage,
    }),

  createFile: (taskId: string, path: string, content: string) =>
    apiPost<{ commit_sha: string }>(`/api/v1/workspaces/${taskId}/files`, { path, content }),

  deleteFile: (taskId: string, path: string) =>
    apiDelete<{ commit_sha: string }>(`/api/v1/workspaces/${taskId}/files/${path}`),

  getGitLog: (taskId: string, limit = 50) =>
    apiGet<GitCommit[]>(`/api/v1/workspaces/${taskId}/git/log?limit=${limit}`),

  getGitDiff: (taskId: string, fromSha: string, toSha: string) =>
    apiGet<GitDiff[]>(`/api/v1/workspaces/${taskId}/git/diff?from_sha=${fromSha}&to_sha=${toSha}`),

  getFileAtCommit: (taskId: string, sha: string, path: string) =>
    apiGet<{ content: string }>(`/api/v1/workspaces/${taskId}/git/show/${sha}/${path}`),
};
```

**Step 2: Add apiDelete helper if missing**

```typescript
async function apiDelete<T>(path: string): Promise<T> {
  const res = await apiFetch<ApiResponse<T>>(path, { method: "DELETE" });
  if (!res.success) throw new Error(res.error || "API error");
  return res.data;
}
```

**Step 3: Commit**

```bash
cd /Users/admin/ai/self-dev/study-community/project-7411174 && git add src/lib/api.ts && git commit -m "feat: add workspace API client (file CRUD + git)"
```

---

### Task 6: Frontend workspace types and hooks

**Files:**
- Create: `project-7411174/src/pages/research/workspace/types.ts`
- Create: `project-7411174/src/pages/research/workspace/hooks/useWorkspaceFiles.ts`
- Create: `project-7411174/src/pages/research/workspace/hooks/useGitHistory.ts`

**Step 1: Create types**

```typescript
// types.ts
export interface OpenTab {
  path: string;
  content: string;
  language: string;
  isDirty: boolean;
}

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: TreeNode[];
}

export function buildTree(files: { path: string }[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isFile = i === parts.length - 1;
      const existing = current.find((n) => n.name === name);
      if (existing && !isFile) {
        current = existing.children!;
      } else if (!existing) {
        const node: TreeNode = {
          name,
          path: parts.slice(0, i + 1).join("/"),
          type: isFile ? "file" : "dir",
          children: isFile ? undefined : [],
        };
        current.push(node);
        if (!isFile) current = node.children!;
      }
    }
  }
  return root;
}

export function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    md: "markdown", json: "json", csv: "plaintext",
    py: "python", ts: "typescript", tsx: "typescript",
    js: "javascript", jsx: "javascript", txt: "plaintext",
  };
  return map[ext] ?? "plaintext";
}
```

**Step 2: Create useWorkspaceFiles hook**

```typescript
// hooks/useWorkspaceFiles.ts
import { useCallback, useEffect, useState } from "react";
import { workspaceApi, type WorkspaceFile } from "../../../../lib/api";
import { type OpenTab, type TreeNode, buildTree, detectLanguage } from "../types";

export function useWorkspaceFiles(taskId: string) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await workspaceApi.getTree(taskId);
    setFiles(result);
    setTree(buildTree(result));
  }, [taskId]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const openFile = useCallback(async (path: string) => {
    // If already open, just switch tab
    if (tabs.some((t) => t.path === path)) {
      setActiveTab(path);
      return;
    }
    const { content } = await workspaceApi.getFile(taskId, path);
    const tab: OpenTab = { path, content, language: detectLanguage(path), isDirty: false };
    setTabs((prev) => [...prev, tab]);
    setActiveTab(path);
  }, [taskId, tabs]);

  const closeTab = useCallback((path: string) => {
    setTabs((prev) => prev.filter((t) => t.path !== path));
    setActiveTab((current) => {
      if (current === path) {
        const remaining = tabs.filter((t) => t.path !== path);
        return remaining.length > 0 ? remaining[remaining.length - 1].path : null;
      }
      return current;
    });
  }, [tabs]);

  const updateContent = useCallback((path: string, content: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.path === path ? { ...t, content, isDirty: true } : t))
    );
  }, []);

  const saveFile = useCallback(async (path: string) => {
    const tab = tabs.find((t) => t.path === path);
    if (!tab) return;
    await workspaceApi.updateFile(taskId, path, tab.content);
    setTabs((prev) =>
      prev.map((t) => (t.path === path ? { ...t, isDirty: false } : t))
    );
    await refresh();
  }, [taskId, tabs, refresh]);

  const createFile = useCallback(async (path: string, content = "") => {
    await workspaceApi.createFile(taskId, path, content);
    await refresh();
    await openFile(path);
  }, [taskId, refresh, openFile]);

  const deleteFile = useCallback(async (path: string) => {
    await workspaceApi.deleteFile(taskId, path);
    closeTab(path);
    await refresh();
  }, [taskId, closeTab, refresh]);

  return {
    files, tree, tabs, activeTab, loading,
    openFile, closeTab, updateContent, saveFile,
    setActiveTab, createFile, deleteFile, refresh,
  };
}
```

**Step 3: Create useGitHistory hook**

```typescript
// hooks/useGitHistory.ts
import { useCallback, useEffect, useState } from "react";
import { workspaceApi, type GitCommit, type GitDiff } from "../../../../lib/api";

export function useGitHistory(taskId: string) {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [diffs, setDiffs] = useState<GitDiff[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshLog = useCallback(async () => {
    const result = await workspaceApi.getGitLog(taskId);
    setCommits(result);
  }, [taskId]);

  useEffect(() => {
    refreshLog();
  }, [refreshLog]);

  const viewCommitDiff = useCallback(async (commit: GitCommit) => {
    setSelectedCommit(commit);
    setLoading(true);
    try {
      // Diff against parent (previous commit)
      const idx = commits.findIndex((c) => c.sha === commit.sha);
      const parent = commits[idx + 1];
      if (!parent) {
        setDiffs([]);
        return;
      }
      const result = await workspaceApi.getGitDiff(taskId, parent.sha, commit.sha);
      setDiffs(result);
    } finally {
      setLoading(false);
    }
  }, [taskId, commits]);

  const clearSelection = useCallback(() => {
    setSelectedCommit(null);
    setDiffs([]);
  }, []);

  return {
    commits, selectedCommit, diffs, loading,
    refreshLog, viewCommitDiff, clearSelection,
  };
}
```

**Step 4: Commit**

```bash
cd /Users/admin/ai/self-dev/study-community/project-7411174 && git add src/pages/research/workspace/ && git commit -m "feat: add workspace types and hooks (files + git)"
```

---

### Task 7: Frontend FileTree component

**Files:**
- Create: `project-7411174/src/pages/research/workspace/components/FileTree.tsx`

**Step 1: Write FileTree**

```tsx
import { useState, useCallback } from "react";
import type { TreeNode } from "../types";

interface Props {
  tree: TreeNode[];
  activeFile: string | null;
  onSelect: (path: string) => void;
  onNewFile: (path: string) => void;
  onDelete: (path: string) => void;
}

const FILE_ICONS: Record<string, string> = {
  md: "ri-markdown-line",
  json: "ri-braces-line",
  csv: "ri-table-line",
  py: "ri-code-s-slash-line",
  txt: "ri-file-text-line",
};

function getIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return FILE_ICONS[ext] ?? "ri-file-line";
}

function TreeItem({
  node, depth, activeFile, onSelect, onDelete,
}: {
  node: TreeNode; depth: number; activeFile: string | null;
  onSelect: (path: string) => void; onDelete: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isActive = activeFile === node.path;

  if (node.type === "dir") {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center gap-1.5 px-2 py-1 text-xs hover:bg-white/[0.06] rounded transition-colors cursor-pointer`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <i className={expanded ? "ri-arrow-down-s-line" : "ri-arrow-right-s-line"} />
          <i className="ri-folder-line text-amber-400/70" />
          <span className="text-text-secondary truncate">{node.name}</span>
        </button>
        {expanded && node.children?.map((child) => (
          <TreeItem
            key={child.path} node={child} depth={depth + 1}
            activeFile={activeFile} onSelect={onSelect} onDelete={onDelete}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="group relative">
      <button
        onClick={() => onSelect(node.path)}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
          isActive
            ? "bg-accent-cyan/10 text-accent-cyan"
            : "text-text-secondary hover:bg-white/[0.06]"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <i className={`${getIcon(node.name)} text-[10px]`} />
        <span className="truncate">{node.name}</span>
      </button>
      {/* Delete button on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(node.path); }}
        className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex w-5 h-5 items-center justify-center rounded text-text-muted hover:text-red-400 hover:bg-red-400/10 cursor-pointer"
      >
        <i className="ri-close-line text-[10px]" />
      </button>
    </div>
  );
}

export default function FileTree({ tree, activeFile, onSelect, onNewFile, onDelete }: Props) {
  const [newFileName, setNewFileName] = useState("");
  const [showNewInput, setShowNewInput] = useState(false);

  const handleCreate = useCallback(() => {
    if (newFileName.trim()) {
      onNewFile(newFileName.startsWith("notes/") ? newFileName : `notes/${newFileName}`);
      setNewFileName("");
      setShowNewInput(false);
    }
  }, [newFileName, onNewFile]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">文件</span>
        <button
          onClick={() => setShowNewInput(!showNewInput)}
          className="w-5 h-5 flex items-center justify-center rounded text-text-muted hover:text-accent-cyan hover:bg-accent-cyan/10 cursor-pointer"
          title="新建笔记"
        >
          <i className="ri-add-line text-xs" />
        </button>
      </div>

      {showNewInput && (
        <div className="px-2 py-1.5 border-b border-white/[0.06]">
          <input
            autoFocus
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="notes/my-note.md"
            className="w-full bg-white/[0.04] border border-white/[0.1] rounded px-2 py-1 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan/50"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        {tree.map((node) => (
          <TreeItem
            key={node.path} node={node} depth={0}
            activeFile={activeFile} onSelect={onSelect} onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
cd /Users/admin/ai/self-dev/study-community/project-7411174 && git add src/pages/research/workspace/components/FileTree.tsx && git commit -m "feat: add FileTree component for workspace"
```

---

### Task 8: Frontend EditorTabs + MonacoWrapper

**Files:**
- Create: `project-7411174/src/pages/research/workspace/components/EditorTabs.tsx`
- Create: `project-7411174/src/pages/research/workspace/components/MonacoWrapper.tsx`

**Step 1: Write EditorTabs**

```tsx
import type { OpenTab } from "../types";

interface Props {
  tabs: OpenTab[];
  activeTab: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

export default function EditorTabs({ tabs, activeTab, onSelect, onClose }: Props) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center gap-0 border-b border-white/[0.06] bg-bg-primary/50 overflow-x-auto">
      {tabs.map((tab) => {
        const name = tab.path.split("/").pop() ?? tab.path;
        const isActive = tab.path === activeTab;
        return (
          <div
            key={tab.path}
            className={`group flex items-center gap-1.5 px-3 py-2 text-xs border-r border-white/[0.06] cursor-pointer select-none transition-colors ${
              isActive
                ? "bg-white/[0.06] text-text-primary border-b-2 border-b-accent-cyan"
                : "text-text-muted hover:bg-white/[0.04]"
            }`}
            onClick={() => onSelect(tab.path)}
          >
            <span className="truncate max-w-[120px]">{name}</span>
            {tab.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan flex-shrink-0" />}
            <button
              onClick={(e) => { e.stopPropagation(); onClose(tab.path); }}
              className="w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-white/[0.1] cursor-pointer"
            >
              <i className="ri-close-line text-[10px]" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Write MonacoWrapper**

```tsx
import { useCallback, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

interface Props {
  content: string;
  language: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export default function MonacoWrapper({ content, language, onChange, onSave }: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Ctrl+S / Cmd+S save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave();
    });
  }, [onSave]);

  return (
    <Editor
      height="100%"
      language={language}
      value={content}
      theme="vs-dark"
      onChange={(val) => onChange(val ?? "")}
      onMount={handleMount}
      options={{
        fontSize: 13,
        lineHeight: 20,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        padding: { top: 12 },
        smoothScrolling: true,
        cursorSmoothCaretAnimation: "on",
        renderLineHighlight: "line",
        bracketPairColorization: { enabled: true },
      }}
    />
  );
}
```

**Step 3: Commit**

```bash
cd /Users/admin/ai/self-dev/study-community/project-7411174 && git add src/pages/research/workspace/components/EditorTabs.tsx src/pages/research/workspace/components/MonacoWrapper.tsx && git commit -m "feat: add EditorTabs and MonacoWrapper components"
```

---

### Task 9: Frontend MarkdownPreview component

**Files:**
- Create: `project-7411174/src/pages/research/workspace/components/MarkdownPreview.tsx`

**Step 1: Write MarkdownPreview**

```tsx
import ReactMarkdown from "react-markdown";

interface Props {
  content: string;
}

export default function MarkdownPreview({ content }: Props) {
  return (
    <div className="h-full overflow-y-auto p-6 prose prose-invert prose-sm max-w-none
      prose-headings:text-text-primary prose-headings:font-semibold
      prose-p:text-text-secondary prose-p:leading-relaxed
      prose-a:text-accent-cyan prose-a:no-underline hover:prose-a:underline
      prose-code:text-accent-cyan/80 prose-code:bg-white/[0.06] prose-code:px-1 prose-code:py-0.5 prose-code:rounded
      prose-pre:bg-white/[0.04] prose-pre:border prose-pre:border-white/[0.08]
      prose-table:border-collapse
      prose-th:border prose-th:border-white/[0.1] prose-th:px-3 prose-th:py-1.5 prose-th:bg-white/[0.04]
      prose-td:border prose-td:border-white/[0.08] prose-td:px-3 prose-td:py-1.5
      prose-blockquote:border-accent-cyan/30 prose-blockquote:text-text-secondary
      prose-strong:text-text-primary
      prose-li:text-text-secondary
    ">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
```

**Step 2: Commit**

```bash
cd /Users/admin/ai/self-dev/study-community/project-7411174 && git add src/pages/research/workspace/components/MarkdownPreview.tsx && git commit -m "feat: add MarkdownPreview component"
```

---

### Task 10: Frontend GitPanel component

**Files:**
- Create: `project-7411174/src/pages/research/workspace/components/GitPanel.tsx`

**Step 1: Write GitPanel**

```tsx
import { useState } from "react";
import { DiffEditor } from "@monaco-editor/react";
import type { GitCommit, GitDiff } from "../../../../lib/api";

interface Props {
  commits: GitCommit[];
  selectedCommit: GitCommit | null;
  diffs: GitDiff[];
  loading: boolean;
  onSelectCommit: (commit: GitCommit) => void;
  onClear: () => void;
}

function shortenSha(sha: string): string {
  return sha.slice(0, 7);
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

export default function GitPanel({ commits, selectedCommit, diffs, loading, onSelectCommit, onClear }: Props) {
  const [activeDiffPath, setActiveDiffPath] = useState<string | null>(null);
  const activeDiff = diffs.find((d) => d.path === activeDiffPath);

  if (selectedCommit && activeDiff) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.06]">
          <button onClick={() => setActiveDiffPath(null)} className="text-text-muted hover:text-text-primary cursor-pointer">
            <i className="ri-arrow-left-line text-xs" />
          </button>
          <span className="text-xs text-text-secondary truncate">{activeDiff.path}</span>
          <span className="text-[10px] text-text-muted font-mono ml-auto">{shortenSha(selectedCommit.sha)}</span>
        </div>
        <div className="flex-1">
          <DiffEditor
            original={activeDiff.old_content}
            modified={activeDiff.new_content}
            language={activeDiff.path.endsWith(".md") ? "markdown" : activeDiff.path.endsWith(".json") ? "json" : "plaintext"}
            theme="vs-dark"
            options={{ fontSize: 12, readOnly: true, renderSideBySide: true, minimap: { enabled: false } }}
          />
        </div>
      </div>
    );
  }

  if (selectedCommit) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.06]">
          <button onClick={onClear} className="text-text-muted hover:text-text-primary cursor-pointer">
            <i className="ri-arrow-left-line text-xs" />
          </button>
          <span className="text-xs text-text-primary font-medium truncate">{selectedCommit.message}</span>
          <span className="text-[10px] text-text-muted font-mono ml-auto">{shortenSha(selectedCommit.sha)}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <i className="ri-loader-4-line animate-spin text-text-muted" />
            </div>
          ) : diffs.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-4">无文件变更（初始提交）</p>
          ) : (
            <div className="space-y-1">
              {diffs.map((d) => (
                <button
                  key={d.path}
                  onClick={() => setActiveDiffPath(d.path)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-text-secondary hover:bg-white/[0.06] cursor-pointer"
                >
                  <i className="ri-file-edit-line text-amber-400/60 text-[10px]" />
                  <span className="truncate">{d.path}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Commit list view
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.06]">
        <i className="ri-git-commit-line text-accent-cyan text-xs" />
        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Git 历史</span>
        <span className="text-[10px] text-text-muted ml-auto">{commits.length} commits</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {commits.map((commit) => (
          <button
            key={commit.sha}
            onClick={() => onSelectCommit(commit)}
            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.04] border-b border-white/[0.04] cursor-pointer"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-primary truncate">{commit.message}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-text-muted font-mono">{shortenSha(commit.sha)}</span>
                <span className="text-[10px] text-text-muted">{relativeDate(commit.date)}</span>
                {commit.files_changed.length > 0 && (
                  <span className="text-[10px] text-text-muted">{commit.files_changed.length} 文件</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
cd /Users/admin/ai/self-dev/study-community/project-7411174 && git add src/pages/research/workspace/components/GitPanel.tsx && git commit -m "feat: add GitPanel with commit log and diff viewer"
```

---

### Task 11: Frontend WorkspacePage (main layout)

**Files:**
- Create: `project-7411174/src/pages/research/workspace/page.tsx`

**Step 1: Write the workspace page**

```tsx
import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import Navbar from "../../../components/feature/Navbar";
import FileTree from "./components/FileTree";
import EditorTabs from "./components/EditorTabs";
import MonacoWrapper from "./components/MonacoWrapper";
import MarkdownPreview from "./components/MarkdownPreview";
import GitPanel from "./components/GitPanel";
import { useWorkspaceFiles } from "./hooks/useWorkspaceFiles";
import { useGitHistory } from "./hooks/useGitHistory";

export default function WorkspacePage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [gitPanelOpen, setGitPanelOpen] = useState(true);

  const ws = useWorkspaceFiles(taskId!);
  const git = useGitHistory(taskId!);

  const activeTabData = ws.tabs.find((t) => t.path === ws.activeTab);
  const isMarkdown = activeTabData?.language === "markdown";

  const handleSave = useCallback(() => {
    if (ws.activeTab) {
      ws.saveFile(ws.activeTab).then(() => git.refreshLog());
    }
  }, [ws, git]);

  const handleDelete = useCallback(async (path: string) => {
    if (confirm(`确定删除 ${path}？`)) {
      await ws.deleteFile(path);
      await git.refreshLog();
    }
  }, [ws, git]);

  if (!taskId) return null;

  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-bg-primary/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-text-muted hover:text-text-primary cursor-pointer"
          >
            <i className="ri-arrow-left-line" />
          </button>
          <h1 className="text-sm font-semibold text-text-primary">研究工作区</h1>
          <span className="text-[10px] text-text-muted font-mono">{taskId.slice(0, 8)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGitPanelOpen(!gitPanelOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs cursor-pointer transition-colors ${
              gitPanelOpen
                ? "bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30"
                : "text-text-muted hover:text-text-primary border border-white/[0.08] hover:border-white/[0.15]"
            }`}
          >
            <i className="ri-git-branch-line" />
            Git
          </button>
          <button
            onClick={() => navigate(`/research/${taskId}`)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-text-muted hover:text-text-primary border border-white/[0.08] hover:border-white/[0.15] cursor-pointer"
          >
            <i className="ri-mind-map" />
            论文地图
          </button>
          <button
            onClick={() => navigate(`/research/${taskId}/report`)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-text-muted hover:text-text-primary border border-white/[0.08] hover:border-white/[0.15] cursor-pointer"
          >
            <i className="ri-file-chart-line" />
            报告
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="vertical">
          {/* Editor Area */}
          <Panel defaultSize={gitPanelOpen ? 70 : 100}>
            <PanelGroup direction="horizontal">
              {/* File Tree */}
              <Panel defaultSize={18} minSize={12} maxSize={30}>
                <div className="h-full bg-bg-primary/50 border-r border-white/[0.06]">
                  <FileTree
                    tree={ws.tree}
                    activeFile={ws.activeTab}
                    onSelect={ws.openFile}
                    onNewFile={ws.createFile}
                    onDelete={handleDelete}
                  />
                </div>
              </Panel>

              <PanelResizeHandle className="w-1 bg-transparent hover:bg-accent-cyan/20 transition-colors" />

              {/* Editor + Preview */}
              <Panel defaultSize={isMarkdown ? 50 : 82}>
                <div className="h-full flex flex-col">
                  <EditorTabs
                    tabs={ws.tabs}
                    activeTab={ws.activeTab}
                    onSelect={ws.setActiveTab}
                    onClose={ws.closeTab}
                  />
                  {activeTabData ? (
                    <div className="flex-1">
                      <MonacoWrapper
                        content={activeTabData.content}
                        language={activeTabData.language}
                        onChange={(val) => ws.updateContent(activeTabData.path, val)}
                        onSave={handleSave}
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <i className="ri-code-s-slash-line text-4xl text-text-muted/30 mb-3" />
                        <p className="text-sm text-text-muted">选择左侧文件开始编辑</p>
                        <p className="text-xs text-text-muted/60 mt-1">Ctrl+S 保存并提交</p>
                      </div>
                    </div>
                  )}
                </div>
              </Panel>

              {/* Markdown Preview (only for .md files) */}
              {isMarkdown && activeTabData && (
                <>
                  <PanelResizeHandle className="w-1 bg-transparent hover:bg-accent-cyan/20 transition-colors" />
                  <Panel defaultSize={32} minSize={20}>
                    <div className="h-full border-l border-white/[0.06]">
                      <div className="px-3 py-1.5 border-b border-white/[0.06] flex items-center gap-1.5">
                        <i className="ri-eye-line text-text-muted text-xs" />
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">预览</span>
                      </div>
                      <MarkdownPreview content={activeTabData.content} />
                    </div>
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          {/* Git Panel */}
          {gitPanelOpen && (
            <>
              <PanelResizeHandle className="h-1 bg-transparent hover:bg-accent-cyan/20 transition-colors" />
              <Panel defaultSize={30} minSize={15} maxSize={50}>
                <div className="h-full border-t border-white/[0.06]">
                  <GitPanel
                    commits={git.commits}
                    selectedCommit={git.selectedCommit}
                    diffs={git.diffs}
                    loading={git.loading}
                    onSelectCommit={git.viewCommitDiff}
                    onClear={git.clearSelection}
                  />
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
cd /Users/admin/ai/self-dev/study-community/project-7411174 && git add src/pages/research/workspace/page.tsx && git commit -m "feat: add WorkspacePage with three-panel layout"
```

---

### Task 12: Register route and update CompleteStep navigation

**Files:**
- Modify: `project-7411174/src/router/config.tsx`
- Modify: `project-7411174/src/pages/research/page.tsx`

**Step 1: Add workspace route**

In `router/config.tsx`, add import and route:

```typescript
import WorkspacePage from "../pages/research/workspace/page";

// Add in routes array, after the report route:
{ path: "/research/:taskId/workspace", element: auth(<WorkspacePage />) },
```

**Step 2: Update CompleteStep to navigate to workspace**

In `research/page.tsx`, change the primary CTA in CompleteStep:

```tsx
// Change "查看论文地图" button to "进入工作区"
<button
  onClick={() => navigate(`/research/${task.id}/workspace`)}
  className="w-full py-4 rounded-xl text-base font-semibold bg-accent-cyan text-bg-primary hover:bg-accent-cyan-dim transition-all cursor-pointer whitespace-nowrap cyan-glow flex items-center justify-center gap-2"
>
  <span className="w-5 h-5 flex items-center justify-center"><i className="ri-code-box-line text-base" /></span>
  进入研究工作区
</button>

// Keep map and report as secondary buttons
```

**Step 3: Verify TypeScript**

Run: `cd /Users/admin/ai/self-dev/study-community/project-7411174 && npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

**Step 4: Commit**

```bash
cd /Users/admin/ai/self-dev/study-community/project-7411174 && git add src/router/config.tsx src/pages/research/page.tsx && git commit -m "feat: register workspace route and update CompleteStep navigation"
```

---

### Task 13: Type check and final integration

**Step 1: Full type check**

Run: `cd /Users/admin/ai/self-dev/study-community/project-7411174 && npx tsc --noEmit`
Expected: Clean — no errors

**Step 2: Fix any type errors found**

Address individually.

**Step 3: Final commit**

```bash
cd /Users/admin/ai/self-dev/study-community && git add -A && git commit -m "feat: research workspace — VSCode-style editor with git version management

- Monaco Editor with multi-tab, Ctrl+S save
- File tree with new/delete operations
- Markdown live preview for .md files
- Git panel with commit log and diff viewer
- Backend workspace service with per-task Git repos
- Auto-commits at each deep research pipeline stage"
```
