"""Workspace service for Git-backed file management.

Provides async Git operations for experiment workspaces.
Each task gets an isolated Git repository under WORKSPACE_ROOT.

Reference: autoresearch (experiment file management patterns).
"""

import asyncio
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)


def _workspace_root() -> Path:
    """Return the configured workspace root directory."""
    settings = get_settings()
    return Path(settings.workspace_root)


def _workspace_path(task_id: str) -> Path:
    """Return the workspace directory for a task, with path traversal protection.

    Raises ValueError if task_id contains path traversal sequences.
    """
    # Reject any task_id that could escape the workspace root
    if not task_id or ".." in task_id or "/" in task_id or "\\" in task_id:
        raise ValueError(f"Invalid task_id: {task_id!r}")

    workspace = _workspace_root() / task_id
    # Double-check resolved path is under workspace root
    resolved = workspace.resolve()
    root_resolved = _workspace_root().resolve()
    if not str(resolved).startswith(str(root_resolved)):
        raise ValueError(f"Path traversal detected for task_id: {task_id!r}")

    return workspace


def _validate_file_path(workspace: Path, file_path: str) -> Path:
    """Validate and resolve a file path within a workspace.

    Raises ValueError if the path escapes the workspace directory.
    """
    if not file_path or ".." in file_path:
        raise ValueError(f"Invalid file path: {file_path!r}")

    full_path = (workspace / file_path).resolve()
    workspace_resolved = workspace.resolve()
    if not str(full_path).startswith(str(workspace_resolved)):
        raise ValueError(f"Path traversal detected: {file_path!r}")

    return full_path


async def _run_git(cwd: Path, *args: str) -> str:
    """Execute a git command via asyncio subprocess.

    Returns stdout as a string. Raises RuntimeError on non-zero exit.
    """
    cmd = ["git", *args]
    logger.debug("Running git command: %s in %s", cmd, cwd)

    process = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=str(cwd),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
    )
    stdout, stderr = await process.communicate()

    if process.returncode != 0:
        error_msg = stderr.decode().strip()
        raise RuntimeError(
            f"Git command failed (exit {process.returncode}): {' '.join(cmd)}\n{error_msg}"
        )

    return stdout.decode().strip()


async def init_workspace(task_id: str) -> Path:
    """Create a new workspace directory with an initialized Git repository.

    Returns the workspace path. Idempotent: skips if already initialized.
    """
    workspace = _workspace_path(task_id)

    if (workspace / ".git").exists():
        logger.info("Workspace already initialized: %s", workspace)
        return workspace

    workspace.mkdir(parents=True, exist_ok=True)
    await _run_git(workspace, "init")
    await _run_git(workspace, "config", "user.email", "studyhub@localhost")
    await _run_git(workspace, "config", "user.name", "StudyHub")

    # Create initial commit so we have a valid HEAD
    readme_path = workspace / ".studyhub"
    readme_path.write_text(f"workspace: {task_id}\n")
    await _run_git(workspace, "add", ".studyhub")
    await _run_git(workspace, "commit", "-m", "Initialize workspace")

    logger.info("Workspace initialized: %s", workspace)
    return workspace


async def write_and_commit(
    task_id: str,
    path: str,
    content: str,
    message: str | None = None,
) -> str:
    """Write a file and commit it. Returns the commit SHA.

    Creates parent directories as needed. Uses an immutable commit approach:
    each write produces a new commit.
    """
    workspace = _workspace_path(task_id)
    full_path = _validate_file_path(workspace, path)

    # Ensure workspace is initialized
    if not (workspace / ".git").exists():
        await init_workspace(task_id)

    # Write file (create parent dirs)
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_text(content, encoding="utf-8")

    # Stage and commit (skip if no changes)
    await _run_git(workspace, "add", path)

    # Check if there are staged changes before committing
    try:
        await _run_git(workspace, "diff", "--cached", "--quiet")
        # No error means no changes — return current HEAD
        sha = await _run_git(workspace, "rev-parse", "HEAD")
        return sha
    except RuntimeError:
        # diff --quiet exits non-zero when there ARE changes — proceed with commit
        pass

    commit_msg = message or f"Update {path}"
    await _run_git(workspace, "commit", "-m", commit_msg)

    sha = await _run_git(workspace, "rev-parse", "HEAD")
    return sha


async def read_file(task_id: str, path: str) -> str:
    """Read a file from the workspace. Validates against path traversal.

    Returns the file content as a string. Raises FileNotFoundError if missing.
    """
    workspace = _workspace_path(task_id)
    full_path = _validate_file_path(workspace, path)

    if not full_path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    return full_path.read_text(encoding="utf-8")


async def delete_file(
    task_id: str,
    path: str,
    message: str | None = None,
) -> str:
    """Delete a file and commit the removal. Returns the commit SHA.

    Raises FileNotFoundError if the file does not exist.
    """
    workspace = _workspace_path(task_id)
    full_path = _validate_file_path(workspace, path)

    if not full_path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    await _run_git(workspace, "rm", path)
    commit_msg = message or f"Delete {path}"
    await _run_git(workspace, "commit", "-m", commit_msg)

    sha = await _run_git(workspace, "rev-parse", "HEAD")
    return sha


async def list_files(task_id: str) -> list[dict[str, Any]]:
    """List tracked files in the workspace.

    Returns a list of dicts with keys: path, type, size, modified.
    """
    workspace = _workspace_path(task_id)

    if not (workspace / ".git").exists():
        return []

    output = await _run_git(workspace, "ls-files")
    if not output:
        return []

    files: list[dict[str, Any]] = []
    for line in output.splitlines():
        file_path = line.strip()
        if not file_path:
            continue

        full_path = workspace / file_path
        stat = full_path.stat() if full_path.exists() else None

        entry: dict[str, Any] = {
            "path": file_path,
            "type": "file",
            "size": stat.st_size if stat else 0,
            "modified": (
                datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
                if stat
                else None
            ),
        }
        files.append(entry)

    return files


async def get_log(task_id: str, limit: int = 50) -> list[dict[str, Any]]:
    """Return the git log for a workspace.

    Returns a list of dicts with keys: sha, message, date, author, files_changed.
    """
    workspace = _workspace_path(task_id)

    if not (workspace / ".git").exists():
        return []

    # Use a delimiter that won't appear in normal commit messages
    sep = "---STUDYHUB_SEP---"
    fmt = f"%H{sep}%s{sep}%aI{sep}%an"

    output = await _run_git(
        workspace, "log", f"--max-count={limit}", f"--format={fmt}", "--name-only"
    )
    if not output:
        return []

    commits: list[dict[str, Any]] = []
    # Split by double newline to separate commit blocks
    blocks = output.split("\n\n")

    for block in blocks:
        lines = block.strip().splitlines()
        if not lines:
            continue

        header = lines[0]
        parts = header.split(sep)
        if len(parts) < 4:
            continue

        sha, message, date, author = parts[0], parts[1], parts[2], parts[3]
        changed_files = [f for f in lines[1:] if f.strip()]

        commits.append({
            "sha": sha,
            "message": message,
            "date": date,
            "author": author,
            "files_changed": changed_files,
        })

    return commits


async def get_diff(
    task_id: str,
    from_sha: str,
    to_sha: str,
) -> list[dict[str, str | None]]:
    """Return file-level diffs between two commits.

    Returns a list of dicts with keys: path, old_content, new_content.
    """
    workspace = _workspace_path(task_id)

    # Get list of changed files
    name_output = await _run_git(
        workspace, "diff", "--name-only", from_sha, to_sha
    )
    if not name_output:
        return []

    diffs: list[dict[str, str | None]] = []
    for file_path in name_output.splitlines():
        file_path = file_path.strip()
        if not file_path:
            continue

        old_content: str | None = None
        new_content: str | None = None

        try:
            old_content = await _run_git(
                workspace, "show", f"{from_sha}:{file_path}"
            )
        except RuntimeError:
            old_content = None

        try:
            new_content = await _run_git(
                workspace, "show", f"{to_sha}:{file_path}"
            )
        except RuntimeError:
            new_content = None

        diffs.append({
            "path": file_path,
            "old_content": old_content,
            "new_content": new_content,
        })

    return diffs


async def get_file_at_commit(task_id: str, sha: str, path: str) -> str:
    """Retrieve file content at a specific commit.

    Returns the file content as a string. Raises RuntimeError if not found.
    """
    workspace = _workspace_path(task_id)
    _validate_file_path(workspace, path)

    return await _run_git(workspace, "show", f"{sha}:{path}")
