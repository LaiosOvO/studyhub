"""Workspace file and Git history endpoints.

Provides CRUD for workspace files (backed by Git) and read access
to commit history and diffs. All endpoints require authentication.
"""

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.dependencies import get_current_user
from app.models.deep_research import DeepResearchTask
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services import workspace_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


async def _verify_task_owner(
    task_id: str,
    user: User,
    session: AsyncSession,
) -> None:
    """Verify the current user owns the task. Raises 403 if not."""
    result = await session.execute(
        select(DeepResearchTask.user_id).where(DeepResearchTask.id == task_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found",
        )
    if row != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this workspace",
        )


# ─── Request / Response Schemas ──────────────────────────────────────────


class FileContent(BaseModel):
    """Response: file content with path."""
    content: str
    path: str


class FileContentWithSha(BaseModel):
    """Response: file content with path and commit SHA."""
    content: str
    path: str
    sha: str


class CommitResult(BaseModel):
    """Response: result of a commit operation."""
    commit_sha: str


class FileEntry(BaseModel):
    """Response: a tracked file entry."""
    path: str
    type: str
    size: int
    modified: str | None = None


class CommitEntry(BaseModel):
    """Response: a single commit log entry."""
    sha: str
    message: str
    date: str
    author: str
    files_changed: list[str]


class DiffEntry(BaseModel):
    """Response: diff of a single file between two commits."""
    path: str
    old_content: str | None = None
    new_content: str | None = None


class WriteFileBody(BaseModel):
    """Request body for creating or updating a file."""
    content: str
    commit_message: str | None = None


class CreateFileBody(BaseModel):
    """Request body for creating a file (includes path)."""
    path: str
    content: str
    commit_message: str | None = None


# ─── Helpers ─────────────────────────────────────────────────────────────


def _handle_value_error(exc: ValueError) -> HTTPException:
    """Convert a ValueError (path traversal) to a 400 HTTP error."""
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


def _handle_file_not_found(exc: FileNotFoundError) -> HTTPException:
    """Convert a FileNotFoundError to a 404 HTTP error."""
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


def _handle_runtime_error(exc: RuntimeError) -> HTTPException:
    """Convert a RuntimeError (git failure) to a 500 HTTP error."""
    logger.error("Git operation failed: %s", exc)
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Git operation failed",
    )


# ─── Endpoints ───────────────────────────────────────────────────────────


@router.get(
    "/{task_id}/tree",
    response_model=ApiResponse[list[FileEntry]],
)
async def get_file_tree(
    task_id: str,
    _user: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> ApiResponse[list[FileEntry]]:
    """List all tracked files in the workspace."""
    await _verify_task_owner(task_id, _user, session)
    try:
        files = await workspace_service.list_files(task_id)
    except ValueError as exc:
        raise _handle_value_error(exc)
    except RuntimeError as exc:
        raise _handle_runtime_error(exc)

    entries = [FileEntry(**f) for f in files]
    return ApiResponse(success=True, data=entries)


@router.get(
    "/{task_id}/files/{path:path}",
    response_model=ApiResponse[FileContent],
)
async def get_file(
    task_id: str,
    path: str,
    _user: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> ApiResponse[FileContent]:
    """Read a file from the workspace."""
    await _verify_task_owner(task_id, _user, session)
    try:
        content = await workspace_service.read_file(task_id, path)
    except ValueError as exc:
        raise _handle_value_error(exc)
    except FileNotFoundError as exc:
        raise _handle_file_not_found(exc)

    return ApiResponse(success=True, data=FileContent(content=content, path=path))


@router.put(
    "/{task_id}/files/{path:path}",
    response_model=ApiResponse[CommitResult],
)
async def update_file(
    task_id: str,
    path: str,
    body: WriteFileBody,
    _user: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> ApiResponse[CommitResult]:
    """Create or update a file at the given path and commit."""
    await _verify_task_owner(task_id, _user, session)
    try:
        sha = await workspace_service.write_and_commit(
            task_id, path, body.content, body.commit_message
        )
    except ValueError as exc:
        raise _handle_value_error(exc)
    except RuntimeError as exc:
        raise _handle_runtime_error(exc)

    return ApiResponse(success=True, data=CommitResult(commit_sha=sha))


@router.post(
    "/{task_id}/files",
    response_model=ApiResponse[CommitResult],
    status_code=status.HTTP_201_CREATED,
)
async def create_file(
    task_id: str,
    body: CreateFileBody,
    _user: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> ApiResponse[CommitResult]:
    """Create a new file in the workspace and commit."""
    await _verify_task_owner(task_id, _user, session)
    try:
        sha = await workspace_service.write_and_commit(
            task_id, body.path, body.content, body.commit_message
        )
    except ValueError as exc:
        raise _handle_value_error(exc)
    except RuntimeError as exc:
        raise _handle_runtime_error(exc)

    return ApiResponse(
        success=True,
        data=CommitResult(commit_sha=sha),
        message="File created",
    )


@router.delete(
    "/{task_id}/files/{path:path}",
    response_model=ApiResponse[CommitResult],
)
async def delete_file(
    task_id: str,
    path: str,
    _user: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> ApiResponse[CommitResult]:
    """Delete a file from the workspace and commit."""
    await _verify_task_owner(task_id, _user, session)
    try:
        sha = await workspace_service.delete_file(task_id, path)
    except ValueError as exc:
        raise _handle_value_error(exc)
    except FileNotFoundError as exc:
        raise _handle_file_not_found(exc)
    except RuntimeError as exc:
        raise _handle_runtime_error(exc)

    return ApiResponse(success=True, data=CommitResult(commit_sha=sha))


@router.get(
    "/{task_id}/git/log",
    response_model=ApiResponse[list[CommitEntry]],
)
async def get_git_log(
    task_id: str,
    _user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(default=50, ge=1, le=500),
    session: AsyncSession = Depends(get_db_session),
) -> ApiResponse[list[CommitEntry]]:
    """Return the commit log for the workspace."""
    await _verify_task_owner(task_id, _user, session)
    try:
        log = await workspace_service.get_log(task_id, limit=limit)
    except ValueError as exc:
        raise _handle_value_error(exc)
    except RuntimeError as exc:
        raise _handle_runtime_error(exc)

    entries = [CommitEntry(**entry) for entry in log]
    return ApiResponse(success=True, data=entries)


@router.get(
    "/{task_id}/git/diff",
    response_model=ApiResponse[list[DiffEntry]],
)
async def get_git_diff(
    task_id: str,
    _user: Annotated[User, Depends(get_current_user)],
    from_sha: str = Query(..., description="Start commit SHA"),
    to_sha: str = Query(..., description="End commit SHA"),
    session: AsyncSession = Depends(get_db_session),
) -> ApiResponse[list[DiffEntry]]:
    """Return file-level diffs between two commits."""
    await _verify_task_owner(task_id, _user, session)
    try:
        diffs = await workspace_service.get_diff(task_id, from_sha, to_sha)
    except ValueError as exc:
        raise _handle_value_error(exc)
    except RuntimeError as exc:
        raise _handle_runtime_error(exc)

    entries = [DiffEntry(**d) for d in diffs]
    return ApiResponse(success=True, data=entries)


@router.get(
    "/{task_id}/git/show/{sha}/{path:path}",
    response_model=ApiResponse[FileContentWithSha],
)
async def get_file_at_commit(
    task_id: str,
    sha: str,
    path: str,
    _user: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> ApiResponse[FileContentWithSha]:
    """Retrieve file content at a specific commit."""
    await _verify_task_owner(task_id, _user, session)
    try:
        content = await workspace_service.get_file_at_commit(task_id, sha, path)
    except ValueError as exc:
        raise _handle_value_error(exc)
    except RuntimeError as exc:
        raise _handle_runtime_error(exc)

    return ApiResponse(
        success=True,
        data=FileContentWithSha(content=content, path=path, sha=sha),
    )
