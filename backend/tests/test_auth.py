"""Tests for authentication endpoints.

Covers registration, login, token refresh, logout,
and protected endpoint access.
"""

import pytest
from httpx import AsyncClient


# ─── Registration ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_register_success(test_client: AsyncClient):
    """POST /auth/register with valid data returns 201 and user profile."""
    response = await test_client.post(
        "/auth/register",
        json={
            "email": "alice@example.com",
            "password": "securepass123",
            "full_name": "Alice Zhang",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True
    assert body["data"]["email"] == "alice@example.com"
    assert body["data"]["full_name"] == "Alice Zhang"
    assert body["data"]["language_preference"] == "zh-CN"
    assert "id" in body["data"]


@pytest.mark.asyncio
async def test_register_duplicate_email(test_client: AsyncClient):
    """POST /auth/register with existing email returns 409."""
    payload = {
        "email": "dup@example.com",
        "password": "securepass123",
        "full_name": "First User",
    }
    await test_client.post("/auth/register", json=payload)

    response = await test_client.post(
        "/auth/register",
        json={**payload, "full_name": "Second User"},
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_register_invalid_email(test_client: AsyncClient):
    """POST /auth/register with bad email returns 422."""
    response = await test_client.post(
        "/auth/register",
        json={
            "email": "not-an-email",
            "password": "securepass123",
            "full_name": "Bad Email",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_register_short_password(test_client: AsyncClient):
    """POST /auth/register with password < 8 chars returns 422."""
    response = await test_client.post(
        "/auth/register",
        json={
            "email": "short@example.com",
            "password": "abc",
            "full_name": "Short Pass",
        },
    )
    assert response.status_code == 422


# ─── Login ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_login_success(test_client: AsyncClient):
    """POST /auth/login with valid credentials returns 200 and tokens."""
    await test_client.post(
        "/auth/register",
        json={
            "email": "bob@example.com",
            "password": "bobspassword",
            "full_name": "Bob Li",
        },
    )

    response = await test_client.post(
        "/auth/login",
        json={
            "email": "bob@example.com",
            "password": "bobspassword",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert "access_token" in body["data"]
    assert "refresh_token" in body["data"]
    assert body["data"]["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_invalid_password(test_client: AsyncClient):
    """POST /auth/login with wrong password returns 401."""
    await test_client.post(
        "/auth/register",
        json={
            "email": "carol@example.com",
            "password": "carolspass1",
            "full_name": "Carol",
        },
    )

    response = await test_client.post(
        "/auth/login",
        json={
            "email": "carol@example.com",
            "password": "wrongpassword",
        },
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(test_client: AsyncClient):
    """POST /auth/login with unknown email returns 401."""
    response = await test_client.post(
        "/auth/login",
        json={
            "email": "nobody@example.com",
            "password": "somepassword",
        },
    )
    assert response.status_code == 401


# ─── Token Refresh ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_refresh_token_success(test_client: AsyncClient):
    """POST /auth/refresh with valid refresh token returns new tokens."""
    await test_client.post(
        "/auth/register",
        json={
            "email": "dave@example.com",
            "password": "davespassword",
            "full_name": "Dave",
        },
    )

    login_resp = await test_client.post(
        "/auth/login",
        json={
            "email": "dave@example.com",
            "password": "davespassword",
        },
    )
    refresh_token = login_resp.json()["data"]["refresh_token"]

    response = await test_client.post(
        "/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert "access_token" in body["data"]
    assert "refresh_token" in body["data"]


@pytest.mark.asyncio
async def test_refresh_token_invalid(test_client: AsyncClient):
    """POST /auth/refresh with invalid token returns 401."""
    response = await test_client.post(
        "/auth/refresh",
        json={"refresh_token": "not.a.valid.token"},
    )
    assert response.status_code == 401


# ─── Logout ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_logout_success(test_client: AsyncClient):
    """POST /auth/logout invalidates refresh token."""
    await test_client.post(
        "/auth/register",
        json={
            "email": "eve@example.com",
            "password": "evespassword",
            "full_name": "Eve",
        },
    )

    login_resp = await test_client.post(
        "/auth/login",
        json={
            "email": "eve@example.com",
            "password": "evespassword",
        },
    )
    tokens = login_resp.json()["data"]

    response = await test_client.post(
        "/auth/logout",
        json={"refresh_token": tokens["refresh_token"]},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json()["success"] is True


# ─── Protected Endpoint ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_protected_endpoint_no_token(test_client: AsyncClient):
    """GET /auth/me without token returns 401."""
    response = await test_client.get("/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoint_with_token(test_client: AsyncClient):
    """GET /auth/me with valid token returns user data."""
    await test_client.post(
        "/auth/register",
        json={
            "email": "fiona@example.com",
            "password": "fionaspassword",
            "full_name": "Fiona Wang",
        },
    )

    login_resp = await test_client.post(
        "/auth/login",
        json={
            "email": "fiona@example.com",
            "password": "fionaspassword",
        },
    )
    access_token = login_resp.json()["data"]["access_token"]

    response = await test_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["email"] == "fiona@example.com"
    assert body["data"]["full_name"] == "Fiona Wang"


# ─── Health ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_health_endpoint(test_client: AsyncClient):
    """GET /health returns 200 with status ok."""
    response = await test_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
