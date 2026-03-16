"""Pydantic schemas for direct messaging between researchers.

Provides Create, Response, and ConversationListItem schemas.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    """Input schema for sending a direct message."""

    recipient_id: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)


class MessageResponse(BaseModel):
    """Message response with all stored fields."""

    model_config = {"from_attributes": True}

    id: str
    sender_id: str
    recipient_id: str
    content: str
    read_at: datetime | None = None
    created_at: datetime


class ConversationListItem(BaseModel):
    """Summary of a conversation with another user."""

    other_user_id: str
    other_user_name: str
    last_message: str
    last_message_at: datetime
    unread_count: int = 0
