"""Reading list CRUD endpoints.

Provides create, list, get, update, delete for user reading lists,
plus add/remove paper operations. All endpoints require authentication
and enforce per-user ownership.
"""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.reading_list import ReadingList
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.reading_list import (
    AddPaperRequest,
    ReadingListCreate,
    ReadingListResponse,
    ReadingListUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reading-lists", tags=["reading-lists"])


async def _get_owned_list(
    list_id: str,
    user: User,
    session: AsyncSession,
) -> ReadingList:
    """Fetch a reading list and verify ownership. Raises 404 if not found or not owned."""
    result = await session.execute(
        select(ReadingList).where(ReadingList.id == list_id)
    )
    reading_list = result.scalar_one_or_none()

    if reading_list is None or reading_list.user_id != user.id:
        raise HTTPException(status_code=404, detail="Reading list not found")

    return reading_list


@router.post(
    "",
    response_model=ApiResponse[ReadingListResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_reading_list(
    body: ReadingListCreate,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[ReadingListResponse]:
    """Create a new reading list for the current user."""
    reading_list = ReadingList(
        id=uuid.uuid4().hex,
        user_id=user.id,
        name=body.name,
        description=body.description,
        paper_ids=list(body.paper_ids),
    )
    session.add(reading_list)
    await session.commit()
    await session.refresh(reading_list)

    return ApiResponse(
        success=True,
        data=ReadingListResponse.model_validate(reading_list),
        message="Reading list created",
    )


@router.get(
    "",
    response_model=ApiResponse[list[ReadingListResponse]],
)
async def list_reading_lists(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
) -> ApiResponse[list[ReadingListResponse]]:
    """List the current user's reading lists, newest first."""
    result = await session.execute(
        select(ReadingList)
        .where(ReadingList.user_id == user.id)
        .order_by(ReadingList.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    lists = list(result.scalars().all())

    return ApiResponse(
        success=True,
        data=[ReadingListResponse.model_validate(rl) for rl in lists],
    )


@router.get(
    "/{list_id}",
    response_model=ApiResponse[ReadingListResponse],
)
async def get_reading_list(
    list_id: str,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[ReadingListResponse]:
    """Get a single reading list by ID. Requires ownership."""
    reading_list = await _get_owned_list(list_id, user, session)

    return ApiResponse(
        success=True,
        data=ReadingListResponse.model_validate(reading_list),
    )


@router.put(
    "/{list_id}",
    response_model=ApiResponse[ReadingListResponse],
)
async def update_reading_list(
    list_id: str,
    body: ReadingListUpdate,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[ReadingListResponse]:
    """Update a reading list. Requires ownership. Immutable update pattern."""
    reading_list = await _get_owned_list(list_id, user, session)

    if body.name is not None:
        reading_list.name = body.name
    if body.description is not None:
        reading_list.description = body.description
    if body.paper_ids is not None:
        reading_list.paper_ids = list(body.paper_ids)

    await session.commit()
    await session.refresh(reading_list)

    return ApiResponse(
        success=True,
        data=ReadingListResponse.model_validate(reading_list),
        message="Reading list updated",
    )


@router.delete(
    "/{list_id}",
    response_model=ApiResponse[None],
)
async def delete_reading_list(
    list_id: str,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[None]:
    """Delete a reading list. Requires ownership."""
    reading_list = await _get_owned_list(list_id, user, session)

    await session.delete(reading_list)
    await session.commit()

    return ApiResponse(success=True, message="Reading list deleted")


@router.post(
    "/{list_id}/papers",
    response_model=ApiResponse[ReadingListResponse],
)
async def add_paper_to_list(
    list_id: str,
    body: AddPaperRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[ReadingListResponse]:
    """Add a paper to a reading list. Immutable: creates new list, skips duplicates."""
    reading_list = await _get_owned_list(list_id, user, session)

    current_ids: list[str] = reading_list.paper_ids or []
    if body.paper_id not in current_ids:
        # Immutable update: create new list with the added paper
        reading_list.paper_ids = [*current_ids, body.paper_id]
        await session.commit()
        await session.refresh(reading_list)

    return ApiResponse(
        success=True,
        data=ReadingListResponse.model_validate(reading_list),
        message="Paper added to reading list",
    )


@router.delete(
    "/{list_id}/papers/{paper_id}",
    response_model=ApiResponse[ReadingListResponse],
)
async def remove_paper_from_list(
    list_id: str,
    paper_id: str,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[ReadingListResponse]:
    """Remove a paper from a reading list. Immutable: creates new list without the paper."""
    reading_list = await _get_owned_list(list_id, user, session)

    current_ids: list[str] = reading_list.paper_ids or []
    # Immutable update: create new list without the removed paper
    reading_list.paper_ids = [pid for pid in current_ids if pid != paper_id]

    await session.commit()
    await session.refresh(reading_list)

    return ApiResponse(
        success=True,
        data=ReadingListResponse.model_validate(reading_list),
        message="Paper removed from reading list",
    )
