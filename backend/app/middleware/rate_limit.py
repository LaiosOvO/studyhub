"""Rate limiting configuration using slowapi.

Provides a shared limiter instance and middleware setup
for per-IP request throttling on API endpoints.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Shared limiter instance -- uses in-memory storage by default.
# When Valkey is available, configure: Limiter(key_func=..., storage_uri=valkey_url)
limiter = Limiter(key_func=get_remote_address)

# Default rate limit for auth endpoints: 60 requests per minute per IP
AUTH_RATE_LIMIT = "60/minute"
