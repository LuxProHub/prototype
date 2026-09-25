"""In-process thread-safe LRU/TTL cache for local read acceleration.

Used for static or slowly-changing datasets (like facet dropdowns and aggregate stats)
without introducing Redis or any external networking dependencies.
"""
import threading
from typing import Any
from cachetools import TTLCache

# Thread-safe lock for local concurrent FastAPI workers/threads
_lock = threading.Lock()

# Bounded in-memory TTLCache: max 128 keys, 1-hour (3600s) TTL
_filters_cache: TTLCache[str, Any] = TTLCache(maxsize=128, ttl=3600)
_counts_cache: TTLCache[str, int] = TTLCache(maxsize=128, ttl=3600)


def get_cached_filters() -> Any | None:
    """Retrieve cached filter options if available and not expired."""
    with _lock:
        return _filters_cache.get("filter_options")


def set_cached_filters(data: Any) -> None:
    """Store computed filter options in the in-process cache."""
    with _lock:
        _filters_cache["filter_options"] = data


def get_cached_default_count(status_key: str = "default") -> int | None:
    """Retrieve cached count for default/status unfiltered records view."""
    key = "default_records_count" if status_key == "default" else f"default_records_count_{status_key}"
    with _lock:
        return _counts_cache.get(key)


def set_cached_default_count(count: int, status_key: str = "default") -> None:
    """Store computed record count in the in-process cache."""
    key = "default_records_count" if status_key == "default" else f"default_records_count_{status_key}"
    with _lock:
        _counts_cache[key] = count


def invalidate_filters_cache() -> None:
    """Explicitly purge cached filter options and counts upon ingestion or record updates."""
    with _lock:
        _filters_cache.pop("filter_options", None)
        _counts_cache.clear()
