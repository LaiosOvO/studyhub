"""Multi-source academic paper search pipeline.

Provides clients for OpenAlex, Semantic Scholar, PubMed, arXiv, CNKI,
and Wanfang, with fan-out aggregation and three-tier deduplication.
"""

from .browser_pool import BrowserPool
from .cnki_client import CnkiCaptchaError, CnkiClient
from .wanfang_client import WanfangBlockedError, WanfangClient

__all__ = [
    "BrowserPool",
    "CnkiCaptchaError",
    "CnkiClient",
    "WanfangBlockedError",
    "WanfangClient",
]
