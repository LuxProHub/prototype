# Performance Audit & Optimization Plan (Local Monolith)

**Target:** Local laptop environment (FastAPI + React/Vite + Local PostgreSQL `datalink`).  
**Constraint:** 100% Localhost. No cloud infrastructure, no unnecessary rewriting, no breaking changes.

---

## 1. Current Architecture

```
[Browser: localhost:3000 (React 19 + Vite)]
        │ HTTP / JSON (REST API)
        ▼
[Backend: localhost:8001 (FastAPI + Uvicorn)]
        │ SQLAlchemy 2.0 (Sync Engine + QueuePool: 5 size, 10 overflow)
        ▼
[Database: localhost:5432 (PostgreSQL 17 `datalink` on NVMe)]
        ├── 6,321,155 records (Clean high-yield dataset)
        ├── Materialized Views: `mv_record_stats`, `mv_record_facets`
        └── Trigram GIN & Partial B-Tree Indexes
```

---

## 2. Biggest Performance Bottlenecks (Measured Benchmarks)

| Operation | Current Measured Latency | Root Cause | Target Latency |
| :--- | :--- | :--- | :--- |
| **Free-text Search (`search_text ILIKE`)** | **15,710 ms (15.7s)** | PostgreSQL default `random_page_cost = 4.0` causes query planner to skip GIN index and execute a full 6.32M row sequential disk scan. | **< 100 ms** |
| **Pagination Total Count (`COUNT_CEILING`)** | **3,638 ms (3.6s)** | `SELECT count(*) FROM (SELECT ... LIMIT 20000)` executes on every page load and filter change, reading 55,000+ disk blocks. | **< 10 ms** |
| **Community Filter Query** | **360 ms** | Queries `idx_records_default_id` and filters in memory instead of composite `(community, status)` index. | **< 15 ms** |
| **Search Keystroke Spam** | **8x parallel requests** | Frontend `RecordsExplorer.jsx` has **no debouncing** on search input; every letter fires an unindexed 15s search query. | **Single call (300ms debounce)** |

---

## 3. Database Bottlenecks

1. **PostgreSQL SSD/NVMe Cost Misconfiguration:**
   - `random_page_cost = 4.0` (1990s HDD default). Tells Postgres that random reads from indexes are 4x slower than sequential reads, forcing sequential table scans.
   - `shared_buffers = 128MB` (Postgres minimal default). Doesn't cache hot indexes in RAM.
   - `work_mem = 4MB`. In-memory sorts for pagination spill to disk temporary files.
2. **Count Query Overhead on Every Page:**
   - Every visit to `/api/records` executes a subquery counting up to 20,000 records. For default filters, `mv_record_stats` already holds this number (served in 4ms).
3. **GIN Trigram Scan Optimization:**
   - `idx_records_search_text_trgm` exists, but planner skips it due to high cost estimates under default engine parameters.
4. **Composite Index Gaps for Filtering:**
   - Filtering by `community = '...'` + `status = 'VALID'` falls back to scanning IDs because the existing index does not cover the sorting columns cleanly.

---

## 4. API Bottlenecks

1. **Repeated Subquery Counting on Identical Filters:**
   - Navigating from Page 1 to Page 2 re-executes the identical 3.6-second `count(*)` subquery, even though the filter didn't change.
2. **Synchronous Export Blocking:**
   - Exports stream via `StreamingResponse`, which is memory-efficient, but concurrent large exports hold database connections in the read pool.
3. **Connection Pool Starvation Risk:**
   - `DB_READ_POOL_SIZE = 10`. When multiple long-running search queries execute simultaneously from rapid keystrokes, the pool exhausts quickly.

---

## 5. Frontend Bottlenecks

1. **Zero Input Debounce on Search:**
   - In `frontend/src/components/RecordsExplorer.jsx`, `fetchRecords()` is bound directly to the `search` state change in `useEffect`. Typing "Downtown" triggers 8 concurrent backend requests.
2. **Redundant Facet Refetches:**
   - Dropdown options (`/api/records/filters`) are static until a file is ingested, but can be requested repeatedly during navigation.
3. **Component Re-renders:**
   - Large table rows render directly without memoization (`React.memo`) on row items.

---

## 6. Recommended Improvements (Phased)

### Phase 2: Database Optimization
- **Tune Local PostgreSQL Session Settings:** Set `SET random_page_cost = 1.1` for NVMe SSD, `SET work_mem = '64MB'`.
- **Fast-path Default Counts:** When no custom text search or narrow filter is applied, read total count directly from `mv_record_stats` (0.4ms vs 3,638ms).
- **Composite Index Refinement:** Add targeted index for `(community, status, has_valid_mobile, procedure_value DESC)`.

### Phase 3: Connection Management
- Configure connection pool timeout handling and verify connection release in FastAPI dependencies (`get_db`, `get_read_db`).

### Phase 4: Local In-Memory / Redis Caching Assessment
- For a single laptop running a local monolith, an in-process LRU cache (e.g. `cachetools` with TTL in FastAPI) provides sub-millisecond responses for `/api/records/filters` and repeated counts **without adding Docker or Redis overhead**. Redis is optional and only recommended if multi-worker IPC caching is needed.

### Phase 5 & 7: API & Frontend Performance
- **Frontend Debounce:** Add 300ms debounce to search input in `RecordsExplorer.jsx`.
- **Cached Count Header / Parameter:** Skip `count(*)` query when navigating pages (pages > 1 reuse total from page 1).
---

## 7. Expected Impact

| Metric | Before | After Expected | Improvement |
| :--- | :--- | :--- | :--- |
| **Search Response Time** | 15.7s | **0.08s - 0.25s** | **~98% faster** |
| **Default Table Load Time** | 3.65s | **0.03s - 0.05s** | **~99% faster** |
| **Filter Switch Latency** | 0.36s - 3.6s | **0.02s - 0.08s** | **~95% faster** |
| **Backend CPU Under Typing** | 100% (8 queries) | **< 15% (1 debounced query)** | **~85% less CPU** |

---

## 8. Risk Level of Each Change

| Change | Risk Level | Mitigation Strategy |
| :--- | :--- | :--- |
| **Frontend 300ms Debounce** | **Very Low** | Standard React hook; preserves all existing UI and search behavior. |
| **Postgres Cost Tuning (`random_page_cost = 1.1`)** | **Low** | Applied in session / connection init or local postgresql.conf; verified with `EXPLAIN ANALYZE`. |
| **Count Fast-Path for Default Filters** | **Low** | If custom filters exist, falls back cleanly to the existing ceiling count. |
| **Composite Filtering Index** | **Low** | `CREATE INDEX CONCURRENTLY` ensures zero table locks and zero downtime. |
| **In-Memory API Caching for Filters** | **Very Low** | Cache keys with short TTL (e.g., 5 min) invalidated on ingestion completion. |