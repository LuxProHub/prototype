"""In-process thread-safe LRU/TTL cache for local read acceleration.

Used for static or slowly-changing datasets (like facet dropdowns and aggregate stats)
without introducing Redis or any external networking dependencies.
"""
import threading
from typing import Any
from cachetools import TTLCache

# Thread-safe lock for local concurrent FastAPI workers/threads
_lock = threading.Lock()

# Bounded in-memory TTLCache: max 128 keys, 5-minute (300s) default TTL
_filters_cache: TTLCache[str, Any] = TTLCache(maxsize=128, ttl=300)


def get_cached_filters() -> Any | None:
    """Retrieve cached filter options if available and not expired."""
    with _lock:
        return _filters_cache.get("filter_options")


def set_cached_filters(data: Any) -> None:
    """Store computed filter options in the in-process cache."""
    with _lock:
        _filters_cache["filter_options"] = data


def invalidate_filters_cache() -> None:
    """Explicitly purge cached filter options upon ingestion or schema update."""
    with _lock:
        _filters_cache.pop("filter_options", None)
