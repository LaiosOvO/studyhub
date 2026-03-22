"""CORS middleware configuration.

Applies Cross-Origin Resource Sharing headers based on
application settings to allow frontend-to-backend requests.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings


def setup_cors(app: FastAPI) -> None:
    """Add CORS middleware to the FastAPI application."""
    settings = get_settings()
    origins = settings.cors_origins
    allow_all = origins == ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=not allow_all,
        allow_methods=["*"],
        allow_headers=["*"],
    )
