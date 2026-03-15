"""Async SQLAlchemy database configuration.

Provides engine factory, session factory, and declarative base
for use across the application and in Alembic migrations.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""


def get_db_engine():
    """Create and return an async SQLAlchemy engine."""
    settings = get_settings()
    return create_async_engine(
        settings.database_url,
        echo=settings.debug,
    )


def get_session_factory():
    """Create and return an async session factory."""
    engine = get_db_engine()
    return async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session for dependency injection."""
    factory = get_session_factory()
    async with factory() as session:
        yield session
