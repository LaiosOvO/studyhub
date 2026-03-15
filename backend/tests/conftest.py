"""Shared test fixtures for the backend test suite.

Uses an in-memory SQLite database for fast, isolated testing.
Each test gets a fresh database and HTTP client.
"""

import asyncio
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base
from app.dependencies import get_db
from app.main import create_app

# In-memory SQLite for testing (avoids needing PostgreSQL)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    """Create a session-scoped event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def test_engine():
    """Create a test database engine with all tables."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Yield a test database session."""
    factory = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with factory() as session:
        yield session


@pytest_asyncio.fixture
async def test_client(test_engine) -> AsyncGenerator[AsyncClient, None]:
    """Create an async HTTP test client with overridden DB dependency."""
    factory = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with factory() as session:
            yield session

    application = create_app()
    application.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=application)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def sample_user_id() -> str:
    """Return a consistent test user ID."""
    return "test-user-001"


@pytest.fixture
def sample_messages() -> list[dict]:
    """Return sample chat messages for LLM tests."""
    return [{"role": "user", "content": "Say hello"}]
