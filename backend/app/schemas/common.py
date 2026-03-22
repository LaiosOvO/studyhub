"""Shared API response envelope for consistent API responses."""

from typing import Generic, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """Standard API response wrapper.

    All API endpoints return this envelope for consistent
    client-side handling of success and error states.
    """

    success: bool = True
    data: Optional[T] = None
    error: Optional[str] = None
    message: Optional[str] = None
