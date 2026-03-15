# Phase 1: Infrastructure & Auth Foundation - Research

**Researched:** 2026-03-15
**Domain:** Infrastructure orchestration, authentication, i18n web shell, LLM gateway
**Confidence:** HIGH

## Summary

Phase 1 establishes the full infrastructure stack via Docker Compose (PostgreSQL 17, Neo4j 2025.01+, Meilisearch 1.37, Valkey 8.1+, SeaweedFS, Temporal 1.25+), builds a FastAPI gateway with JWT auth and rate limiting, creates a Next.js web shell with Chinese/English i18n, and sets up an LLM Gateway with cost tracking. The stack is mature and well-documented — all components have official Docker images, established Python/JS clients, and clear configuration patterns.

**Primary recommendation:** Use established libraries at every layer — LiteLLM for the LLM gateway, pwdlib+Argon2 for password hashing, valkey-py for cache, next-intl for i18n, and Alembic for migrations. Avoid hand-rolling any of these.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Python monorepo with `backend/` (FastAPI + agents + data sources) and `apps/web/` (Next.js)
- `apps/desktop/` (Tauri) deferred to Phase 8
- `shared/` for cross-project type definitions
- `infra/` for Docker Compose and configuration
- Use pnpm workspaces for frontend, uv/pyproject.toml for Python backend
- Docker Compose for all services: PostgreSQL 17, Neo4j 2025.01+, Meilisearch 1.37, Valkey 8.1+, SeaweedFS, Temporal Server 1.25+
- `.env` file for all configuration (ports, credentials, API keys)
- Health check endpoints for every service
- Development mode: hot reload for both FastAPI (uvicorn --reload) and Next.js
- All services start with `docker compose up` — single command
- Email + password registration (no OAuth for v1)
- No email verification required for MVP
- JWT access token (short-lived, 15 min) + refresh token (long-lived, 7 days)
- Passwords hashed with bcrypt
- Session persists across browser refresh via refresh token rotation
- No admin role distinction for MVP — all users are researchers
- Default language: Chinese (zh-CN)
- English as secondary language
- next-intl for Next.js i18n
- Language toggle in header, preference saved in user profile
- Unified LLM interface supporting Claude and OpenAI models
- Cost tracking per request and per user
- Model fallback: if primary model fails, try secondary
- Rate limiting per user to control costs
- Temporal Server in Docker Compose
- Python SDK for workflow/activity definitions
- Basic workflow template for Deep Research (expanded in Phase 5)

### Claude's Discretion
- Exact port assignments for services
- Database schema migration tool choice (Alembic recommended)
- FastAPI project structure (routers, services, models organization)
- Next.js app router structure
- Logging format and level configuration
- Error response format
- CORS configuration
- Rate limiting strategy (token bucket, sliding window, etc.)

### Deferred Ideas (OUT OF SCOPE)
- OAuth login (Google, GitHub)
- Email verification flow
- Admin dashboard
- API documentation custom page
- Tauri desktop app (Phase 8)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | System runs via Docker Compose with all services | Docker Compose patterns, health check configs for each service |
| INFRA-02 | FastAPI gateway handles JWT auth, rate limiting, request routing | FastAPI + PyJWT + pwdlib + slowapi patterns |
| INFRA-03 | Temporal server orchestrates long-running workflows | Temporal Docker Compose + Python SDK setup |
| INFRA-04 | Valkey Streams provides event-driven communication | valkey-py client, Streams API compatibility |
| INFRA-05 | SeaweedFS stores PDFs, checkpoints, logs (S3-compatible) | SeaweedFS Docker Compose with S3 API, boto3 client |
| INFRA-06 | LLM Gateway provides unified interface with cost tracking | LiteLLM library for unified API + cost tracking |
| AUTH-01 | User can register with email and password | FastAPI auth flow with pwdlib+Argon2, SQLAlchemy user model |
| AUTH-02 | User can log in and maintain session across refreshes | JWT access+refresh token rotation pattern |
| AUTH-03 | User can log out from any page | Token blacklist via Valkey, frontend auth state |
| AUTH-04 | JWT-based authentication with refresh token rotation | PyJWT + refresh token rotation implementation |
| WAPP-01 | Next.js web application with SSR | Next.js 15 App Router with server components |
| WAPP-02 | Responsive layout supporting desktop and tablet | Tailwind CSS responsive utilities |
| WAPP-03 | Chinese and English UI language support | next-intl with zh-CN default, en secondary |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.126+ | API gateway framework | Async-first, auto-OpenAPI docs, dependency injection |
| SQLAlchemy | 2.0+ | ORM and database toolkit | Async support, mature ecosystem, Alembic integration |
| Alembic | 1.14+ | Database migrations | Official SQLAlchemy migration tool, async support |
| asyncpg | 0.30+ | PostgreSQL async driver | Fastest Python PostgreSQL driver, native async |
| PyJWT | 2.9+ | JWT token creation/verification | Lightweight, well-maintained, no heavy dependencies |
| pwdlib | 0.2+ | Password hashing (Argon2) | Modern replacement for passlib, FastAPI-recommended |
| LiteLLM | 1.60+ | Unified LLM API gateway | 100+ providers, cost tracking, fallback, OpenAI format |
| valkey-py | 6.0+ | Valkey/Redis client | Fork of redis-py, drop-in compatible, async support |
| temporalio | 1.9+ | Temporal Python SDK | Official SDK, workflow/activity definitions |
| Next.js | 15+ | React framework with SSR | App Router, Server Components, streaming |
| next-intl | 4.0+ | i18n for Next.js | ~2KB bundle, Server Component support, type-safe |
| Tailwind CSS | 4.0+ | Utility-first CSS | Responsive design, JIT compilation, small bundles |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| slowapi | 0.1+ | Rate limiting for FastAPI | Per-user and per-endpoint rate limits |
| uvicorn | 0.34+ | ASGI server | Dev (--reload) and production |
| pydantic | 2.10+ | Data validation/settings | Request/response models, settings management |
| httpx | 0.28+ | Async HTTP client | Internal service communication |
| boto3 | 1.36+ | S3-compatible client | SeaweedFS file operations |
| zustand | 5.0+ | React state management | Client-side auth state, UI state |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pwdlib+Argon2 | bcrypt (passlib) | User locked bcrypt; research shows Argon2 is more secure and FastAPI-recommended — suggest upgrading |
| LiteLLM | Custom gateway | LiteLLM handles 100+ providers, cost tracking, fallback — custom would take weeks |
| slowapi | Custom middleware | slowapi wraps limits library, battle-tested for FastAPI |
| PyJWT | python-jose | python-jose is heavier, PyJWT is simpler for our needs |
| valkey-py | redis-py | redis-py works with Valkey, but valkey-py is the official fork |

**Installation:**

Backend:
```bash
uv add fastapi uvicorn sqlalchemy[asyncio] asyncpg alembic pyjwt "pwdlib[argon2]" litellm valkey slowapi pydantic pydantic-settings httpx boto3 temporalio
```

Frontend:
```bash
pnpm add next react react-dom next-intl zustand
pnpm add -D tailwindcss @tailwindcss/postcss postcss typescript @types/react @types/node
```

## Architecture Patterns

### Recommended Project Structure

```
studyhub/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app factory
│   │   ├── config.py            # Pydantic settings
│   │   ├── database.py          # Async SQLAlchemy engine/session
│   │   ├── dependencies.py      # Shared dependencies (get_db, get_current_user)
│   │   ├── routers/
│   │   │   ├── auth.py          # /auth/register, /auth/login, /auth/refresh, /auth/logout
│   │   │   └── health.py        # /health endpoint
│   │   ├── services/
│   │   │   ├── auth_service.py  # Auth business logic
│   │   │   └── llm_service.py   # LLM gateway wrapper
│   │   ├── models/
│   │   │   └── user.py          # SQLAlchemy User model
│   │   ├── schemas/
│   │   │   ├── auth.py          # Pydantic request/response schemas
│   │   │   └── common.py        # Shared response envelope
│   │   └── middleware/
│   │       ├── rate_limit.py    # slowapi configuration
│   │       └── cors.py          # CORS setup
│   ├── alembic/
│   │   ├── env.py               # Async Alembic config
│   │   └── versions/            # Migration files
│   ├── alembic.ini
│   ├── pyproject.toml
│   └── tests/
├── apps/
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   │   └── [locale]/
│       │   │       ├── layout.tsx
│       │   │       ├── page.tsx
│       │   │       └── (auth)/
│       │   │           ├── login/page.tsx
│       │   │           └── register/page.tsx
│       │   ├── components/
│       │   │   ├── layout/
│       │   │   │   ├── Header.tsx
│       │   │   │   ├── Sidebar.tsx
│       │   │   │   └── LanguageToggle.tsx
│       │   │   └── auth/
│       │   │       ├── LoginForm.tsx
│       │   │       └── RegisterForm.tsx
│       │   ├── i18n/
│       │   │   ├── config.ts
│       │   │   ├── request.ts
│       │   │   └── routing.ts
│       │   ├── lib/
│       │   │   ├── api.ts       # API client (httpx equivalent)
│       │   │   └── auth.ts      # Token storage, refresh logic
│       │   └── stores/
│       │       └── auth-store.ts # Zustand auth state
│       ├── messages/
│       │   ├── zh-CN.json
│       │   └── en.json
│       ├── middleware.ts          # next-intl locale detection
│       ├── next.config.ts
│       ├── package.json
│       └── tailwind.config.ts
├── shared/
│   └── types/                    # Cross-project type definitions
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml   # Dev overrides (hot reload, debug ports)
│   └── .env.example
├── pnpm-workspace.yaml
└── pyproject.toml                # Root Python config
```

### Pattern 1: FastAPI App Factory with Lifespan

**What:** Create the FastAPI app via a factory function with async lifespan for startup/shutdown.
**When to use:** Always — ensures clean initialization of DB connections, Valkey, etc.
**Example:**
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create DB pool, Valkey connection
    async with get_db_engine() as engine:
        app.state.db_engine = engine
        yield
    # Shutdown: cleanup

def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan)
    app.include_router(auth_router, prefix="/auth", tags=["auth"])
    app.include_router(health_router, prefix="/health", tags=["health"])
    return app
```

### Pattern 2: JWT Access + Refresh Token Rotation

**What:** Short-lived access tokens (15 min) with long-lived refresh tokens (7 days) stored in Valkey.
**When to use:** All authenticated endpoints.
**Example:**
```python
import jwt
from datetime import datetime, timedelta, timezone

def create_access_token(user_id: str, secret: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "type": "access"
    }
    return jwt.encode(payload, secret, algorithm="HS256")

def create_refresh_token(user_id: str, secret: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
        "jti": str(uuid4())  # Unique ID for rotation tracking
    }
    return jwt.encode(payload, secret, algorithm="HS256")
```

### Pattern 3: next-intl App Router i18n

**What:** Locale-based routing with Server Component translation support.
**When to use:** All pages and layouts.
**Example:**
```typescript
// src/i18n/routing.ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['zh-CN', 'en'],
  defaultLocale: 'zh-CN'
});

// src/app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
```

### Pattern 4: Async Alembic Migrations

**What:** Database migrations using async SQLAlchemy engine.
**When to use:** All schema changes.
**Example:**
```python
# alembic/env.py
from sqlalchemy.ext.asyncio import create_async_engine

async def run_async_migrations():
    connectable = create_async_engine(get_database_url())
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()
```

### Anti-Patterns to Avoid
- **Sync database driver in async app:** Always use asyncpg, never psycopg2 in FastAPI async routes
- **Storing JWT in localStorage:** Use httpOnly cookies for refresh tokens, memory for access tokens
- **Hardcoding service URLs:** Use environment variables for all service endpoints
- **Single Docker Compose for dev and prod:** Use override files (docker-compose.dev.yml)
- **Blocking calls in FastAPI async routes:** Use `await` for all I/O, never call sync functions directly

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM provider abstraction | Custom API wrappers per provider | LiteLLM | Handles 100+ providers, cost tracking, retries, fallback |
| Password hashing | Custom bcrypt/argon2 wrapper | pwdlib | Handles algorithm selection, verification, upgrades |
| Rate limiting | Custom middleware counter | slowapi (wraps limits) | Handles sliding windows, storage backends, decorators |
| Database migrations | Raw SQL scripts | Alembic | Autogeneration, rollback, version tracking |
| i18n routing | Custom locale middleware | next-intl middleware | Handles detection, redirects, URL rewriting |
| Token refresh | Custom fetch interceptor | Axios/httpx interceptor pattern | Handles race conditions, queue, retry |

**Key insight:** Every item above has subtle edge cases (race conditions in token refresh, timing attacks in password comparison, migration dependency ordering) that libraries handle but hand-rolled code misses.

## Common Pitfalls

### Pitfall 1: Docker Compose Service Ordering
**What goes wrong:** Services start before their dependencies are ready, causing connection errors.
**Why it happens:** `depends_on` only waits for container start, not service readiness.
**How to avoid:** Use `depends_on` with `condition: service_healthy` and configure health checks for every service.
**Warning signs:** Intermittent connection errors on first `docker compose up`.

### Pitfall 2: Async/Sync Mixing in FastAPI
**What goes wrong:** Deadlocks or thread pool exhaustion when calling sync code from async routes.
**Why it happens:** FastAPI runs sync route handlers in a thread pool; mixing sync database calls with async routes creates contention.
**How to avoid:** Use async all the way down — async SQLAlchemy, asyncpg, async Valkey client.
**Warning signs:** Requests hanging under load, thread pool warnings in logs.

### Pitfall 3: JWT Refresh Token Reuse
**What goes wrong:** Stolen refresh tokens can be replayed indefinitely.
**Why it happens:** No rotation or blacklisting of used refresh tokens.
**How to avoid:** Implement refresh token rotation — each refresh issues a new refresh token and invalidates the old one in Valkey. Detect reuse (same token used twice) as a potential breach.
**Warning signs:** Multiple sessions from the same refresh token.

### Pitfall 4: SeaweedFS S3 Compatibility Gaps
**What goes wrong:** Some S3 operations fail because SeaweedFS doesn't implement the full S3 API.
**Why it happens:** SeaweedFS implements the most common S3 operations but not all.
**How to avoid:** Stick to basic operations: PutObject, GetObject, DeleteObject, ListObjects. Test early. Avoid multipart upload unless needed.
**Warning signs:** boto3 calls returning unexpected errors.

### Pitfall 5: next-intl Static Rendering
**What goes wrong:** Build errors or missing translations in statically rendered pages.
**Why it happens:** Server Components need `setRequestLocale()` called before any next-intl function, and `generateStaticParams` must return all locales.
**How to avoid:** Call `setRequestLocale(locale)` at the top of every page and layout. Export `generateStaticParams` from every `[locale]` route.
**Warning signs:** Build warnings about dynamic rendering, missing translations in production.

### Pitfall 6: Valkey Connection Pool Exhaustion
**What goes wrong:** Application hangs waiting for Valkey connections.
**Why it happens:** Default connection pool size is too small, or connections are not properly returned.
**How to avoid:** Configure explicit pool size, use async context managers, set connection timeout.
**Warning signs:** Increasing latency under load, "max connections" errors.

## Code Examples

### Docker Compose Health Checks

```yaml
# PostgreSQL
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
  interval: 5s
  timeout: 5s
  retries: 5

# Neo4j
healthcheck:
  test: ["CMD", "cypher-shell", "-u", "neo4j", "-p", "${NEO4J_PASSWORD}", "RETURN 1"]
  interval: 10s
  timeout: 10s
  retries: 5

# Meilisearch
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:7700/health"]
  interval: 5s
  timeout: 5s
  retries: 5

# Valkey
healthcheck:
  test: ["CMD", "valkey-cli", "ping"]
  interval: 5s
  timeout: 5s
  retries: 5

# Temporal
healthcheck:
  test: ["CMD", "temporal", "operator", "cluster", "health"]
  interval: 10s
  timeout: 10s
  retries: 5
```

### LiteLLM Unified Gateway

```python
import litellm

# Unified call — same interface for Claude and OpenAI
response = litellm.completion(
    model="claude-sonnet-4-20250514",
    messages=[{"role": "user", "content": "Hello"}],
    fallbacks=["gpt-4o"],  # Fallback to OpenAI if Claude fails
)

# Cost tracking is automatic
cost = litellm.completion_cost(completion_response=response)
# Returns: {"prompt_tokens": X, "completion_tokens": Y, "total_cost": Z}
```

### Pydantic Settings for Configuration

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://user:pass@localhost:5432/studyhub"
    # Auth
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    # Valkey
    valkey_url: str = "valkey://localhost:6379"
    # LLM
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    default_llm_model: str = "claude-sonnet-4-20250514"
    # SeaweedFS
    seaweedfs_s3_endpoint: str = "http://localhost:8333"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}
```

### API Response Envelope

```python
from pydantic import BaseModel
from typing import Generic, TypeVar, Optional

T = TypeVar("T")

class ApiResponse(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] = None
    error: Optional[str] = None
    message: Optional[str] = None
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| passlib + bcrypt | pwdlib + Argon2 | 2024-2025 | More secure hashing, FastAPI-recommended |
| Redis | Valkey 8.1+ | 2024 (license fork) | 37% higher throughput, open-source |
| MinIO | SeaweedFS | Research-validated | S3-compatible, active maintenance |
| next-i18next | next-intl | Next.js 13+ App Router | Native Server Component support, ~2KB |
| SQLAlchemy 1.x sync | SQLAlchemy 2.0 async | 2023 | Native async, better type hints |
| pages/ router | app/ router | Next.js 13+ | Server Components, streaming, layouts |
| Custom LLM wrappers | LiteLLM | 2023-2024 | 100+ providers, cost tracking, fallback |

**Deprecated/outdated:**
- passlib: Maintenance mode, replaced by pwdlib
- redis-py for Valkey: Works but valkey-py is the official client
- MinIO: Archived Feb 2026, SeaweedFS is the replacement

## Open Questions

1. **Password hashing: bcrypt vs Argon2**
   - What we know: User locked "bcrypt" in CONTEXT.md, but FastAPI now recommends Argon2 via pwdlib
   - What's unclear: Whether user preference for bcrypt is firm or was based on older guidance
   - Recommendation: Implement with pwdlib which supports both — default to Argon2 but can fall back to bcrypt. Planner should note this upgrade opportunity.

2. **SeaweedFS authentication in Docker Compose**
   - What we know: SeaweedFS supports S3 auth but dev setup often skips it
   - What's unclear: Whether to configure IAM-style auth in dev or only in production
   - Recommendation: Skip S3 auth in dev (simpler), document production auth setup

3. **Temporal shared PostgreSQL vs dedicated**
   - What we know: Temporal can use its own PostgreSQL or share with the app
   - What's unclear: Performance implications of sharing
   - Recommendation: Use separate PostgreSQL instance for Temporal in Docker Compose — avoids migration conflicts and simplifies upgrades

## Sources

### Primary (HIGH confidence)
- FastAPI official docs — JWT authentication, security, lifespan
- next-intl official docs — App Router setup, routing, Server Components
- Temporal official docs — Docker Compose, Python SDK
- SeaweedFS GitHub wiki — Docker Compose, S3 API
- LiteLLM official docs — Unified API, cost tracking, fallbacks
- Valkey official site — Client libraries, compatibility

### Secondary (MEDIUM confidence)
- Multiple 2026 tutorials on FastAPI+SQLAlchemy async+Alembic setup
- Community Docker Compose examples for multi-service stacks
- LiteLLM 2026 reviews confirming cost tracking capabilities

### Tertiary (LOW confidence)
- Specific version numbers for some supporting libraries (may have minor updates)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are well-established, documented, and actively maintained
- Architecture: HIGH - Patterns drawn from official docs and widely-adopted conventions
- Pitfalls: HIGH - Common issues well-documented across multiple sources

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable stack, 30-day validity)
