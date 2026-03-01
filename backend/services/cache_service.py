"""
Simple in-memory TTL cache for expensive queries.
Thread-safe via asyncio (single-threaded event loop).
"""
import time
from typing import Any


class TTLCache:
    """Key-value store with per-entry time-to-live."""

    def __init__(self, default_ttl: int = 60):
        self._store: dict[str, tuple[Any, float]] = {}  # key -> (value, expiry_time)
        self._default_ttl = default_ttl

    def get(self, key: str) -> Any | None:
        """Get value if not expired. Returns None on miss."""
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expiry = entry
        if time.time() > expiry:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: Any, ttl: int | None = None):
        """Set a value with TTL in seconds."""
        t = ttl if ttl is not None else self._default_ttl
        self._store[key] = (value, time.time() + t)

    def invalidate(self, key: str):
        """Remove a specific key."""
        self._store.pop(key, None)

    def invalidate_prefix(self, prefix: str):
        """Remove all keys starting with prefix."""
        keys = [k for k in self._store if k.startswith(prefix)]
        for k in keys:
            del self._store[k]

    def clear(self):
        """Remove all entries."""
        self._store.clear()

    def cleanup(self):
        """Remove expired entries (call periodically for large caches)."""
        now = time.time()
        expired = [k for k, (_, exp) in self._store.items() if now > exp]
        for k in expired:
            del self._store[k]

    @property
    def size(self) -> int:
        return len(self._store)


# Shared cache instances
query_cache = TTLCache(default_ttl=60)       # 1 min for API responses
stats_cache = TTLCache(default_ttl=300)      # 5 min for aggregate stats
research_cache = TTLCache(default_ttl=120)   # 2 min for research data
