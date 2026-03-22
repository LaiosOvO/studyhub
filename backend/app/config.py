"""Application configuration via Pydantic Settings.

Loads configuration from environment variables and .env files.
All settings have sensible development defaults.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ─── Database ─────────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://studyhub:studyhub_dev@localhost:5432/studyhub"

    # ─── Authentication ───────────────────────────────────────────────
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # ─── Valkey (Cache) ──────────────────────────────────────────────
    valkey_url: str = "valkey://localhost:6379"

    # ─── LLM Configuration ───────────────────────────────────────────
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    default_llm_model: str = "claude-sonnet-4-20250514"
    llm_fallback_model: str = "gpt-4o"

    # ─── SeaweedFS (Object Storage) ──────────────────────────────────
    seaweedfs_s3_endpoint: str = "http://localhost:8333"

    # ─── Temporal (Workflow Orchestration) ────────────────────────────
    temporal_host: str = "localhost:7233"
    temporal_namespace: str = "default"

    # ─── Neo4j (Knowledge Graph) ─────────────────────────────────────
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "neo4j_dev"

    # ─── Meilisearch (Full-Text Search) ──────────────────────────────
    meilisearch_url: str = "http://localhost:7700"
    meilisearch_api_key: str = "meili_dev_key"

    # ─── Academic Paper Sources ───────────────────────────────────────
    openalex_api_key: str = ""
    s2_api_key: str = ""
    pubmed_api_key: str = ""

    # ─── GROBID (PDF Parsing) ─────────────────────────────────────────
    grobid_url: str = "http://localhost:8070"

    # ─── Workspaces (Git-backed file storage) ──────────────────────
    workspace_root: str = "/data/workspaces"

    # ─── Server ──────────────────────────────────────────────────────
    cors_origins: list[str] = ["*"]
    debug: bool = True

    model_config = {
        "env_file": "../infra/.env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
