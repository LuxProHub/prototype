# ATLAS — Current State & Gap Analysis

**Date:** 2026-09-12
**Branch:** `feat/atlas-semantic-observations` (HEAD `16fc1d9`)
**Method:** every figure below was measured from the running system this session,
not read from documentation.

---

## 1. Measured baseline

| Metric | Value |
|---|---|
| Tests passing | **226** (189 inherited + 18 semantic + 19 integration) |
| Canonical fields | 23 |
| Curated aliases | 575 |
| Fields with semantic vocabularies | 4 — `Date`, `Size`, `AREA`, `Name` |
| Semantic types configured | 14 |
| Engine modules | 12 |
| Database tables | 12 |
| Alembic migrations | 13, single linear head (`a1c5e8b23f70`) |
| API routers / endpoints | 8 / 47 |
| Frontend components | 21 |
| Frontend lint (oxlint) | Exit 0 |
| Frontend build (vite) | Exit 0 — 1,831 modules, 960 ms |
| `ENGINE_VERSION` | 3 |

---

## 2. What the Park Gate artifacts proved

Two delivery files were located and analysed this session. They are **delivery
artifacts, not source schema** — a distinction ADR-005 records.

`Park_Gate_Residences_-Noor_standardised.xlsx` (2,348 data rows)
`Al_Kifaf_Park_Gate_Residences_UNIQUE.xlsx` (434 data rows)

### The headline counts reconcile exactly

| Directive figure | Measured | Match |
|---|---|---|
| Raw: 2348 | 2,348 data rows in the Noor file | Yes |
| Unique: 434 | 434 data rows in the UNIQUE file | Yes |
| Duplicate, No number: 1914 | 2,348 − 434 = 1,914 | Yes |

All 434 kept rows appear **verbatim** in the raw file: the step is a filter, not
a transform. Nothing is rewritten on the way through.

### The Noor delivery template — 11 columns, recovered exactly

| # | Delivery column | Canonical field |
|---|---|---|
| 1 | `Contact Phone` | Mobile 1 |
| 2 | `Contact NAME` | Name |
| 3 | `Contact Email` | Email Address |
| 4 | `Second Phone` | Mobile 2 |
| 5 | `PROJECT` | Project |
| 6 | `BUILDING NAME` | Building/Cluster |
| 7 | `FLAT ` *(trailing space is real)* | Unit Number |
| 8 | `PLOT NUMBER` | Plot Number |
| 9 | `SIZE` | Size — **see below** |
| 10 | `ROOMS DESCRIPTION` | Bedroom |
| 11 | `FLOOR` | *not canonical* — currently in `ignore_or_extras` |

### `SIZE` in this template is unlabelled square metres

Median `SIZE` by room count in the Noor file:

| Rooms | n | Median SIZE | × 10.7639 |
|---|---|---|---|
| 1 B/R | 246 | 92.77 | 998.6 |
| 2 B/R | 812 | 146.16 | 1,573.3 |
| 3 B/R | 199 | 200.66 | 2,159.9 |
| 4 B/R | 25 | 340.04 | 3,660.2 |

A 2-bedroom apartment of 146 sq ft is impossible; 1,573 sq ft is ordinary. The
column is **square metres, with nothing in the file saying so.**

The engine's current behaviour is correct but only by refusing: no unit is
stated in the header or the values, so `clean_size_detailed` records
`unit_source='assumed'`, applies the sq ft market default, and sets
`needs_review`. It does **not** silently convert. But it also does not get the
right answer, and would not without the template declaring its unit.

A smaller population with differently formatted room labels (`"2"` rather than
`"2 B/R"`, 6 rows) carries values an order of magnitude larger. Whether those
are large plots in sq m or unit sizes in sq ft is **not determinable** from the
file, and is left unresolved rather than guessed.

### The historical dedup rule is NOT recoverable

Tested against the artifacts:

| Candidate key | Distinct in raw | vs 434 |
|---|---|---|
| Contact Phone | 388 | no |
| Contact NAME | 503 | no |
| Name + Phone | 651 | no |
| Flat + Building | 782 | no |
| Whole row | 2,048 | no |

The closest reconstruction — first occurrence of each distinct non-blank
`Contact NAME` — yields 502 rows and overlaps the kept set on 426 of 434. No
tested key reproduces 434.

**Conclusion: the exact rule that produced this file cannot be recovered from
the two artifacts alone.** It is approximately "one row per distinct contact
identity", with tie-breaks and normalisation that are not visible. Per Part 69,
this ambiguity is preserved rather than guessed: the delivery template engine
must take its dedup rule as **explicit configuration**, and the label
"Duplicate, No number" must be computed from the rule actually applied.

---

## 3. Gap analysis

Scale: **Strong** / **Partial** / **Absent**.
Risk is the consequence of leaving it as-is.

| # | Capability | Current state | Quality | Gap | Risk | Recommendation | Priority |
|---|---|---|---|---|---|---|---|
| 1 | Ingestion (XLSX/CSV, multi-sheet, header detection) | `detection`, `inspection`; streaming reader | Strong | None material | Low | Hold | — |
| 2 | Header mapping | Deterministic alias lookup, 575 aliases, preference ranking | Strong | No fuzzy/semantic tier; unknown headers get no *candidate suggestions* | Med | Add tiers 5–8 of Part 11 above the existing tier 1–4 | P2 |
| 3 | Alias library | 575 curated, workbook-reconciled | Strong | 63 workbook-assigned labels still uncovered (long tail ≤6 occurrences) | Low | Curate incrementally | P3 |
| 4 | Semantic observations | `field_observations`, append-only, wired into ingest, 4 fields | Strong | Per-**row** unit variance unsupported (resolution is per column) | Med | Extend when a real per-row case is confirmed | P2 |
| 5 | Normalization | `cleaning.py`, config-driven, unit-aware | Strong | Only sq ft/sq m; no acre/hectare | Low | Add units when encountered | P3 |
| 6 | Entity resolution | `dedup.py`, cross-register, fuzzy name score | Partial | **No entity table.** No stable entity IDs, aliases, merge history | **High** | Build `entities` + `entity_aliases` | **P1** |
| 7 | Deduplication | Detects, marks `DUPLICATE`, never deletes | Strong | No duplicate *group* record or survivor lineage | Med | Add `duplicate_groups` | P2 |
| 8 | Provenance / lineage | Row-level + observation-level, full | Strong | No value-level lineage **view** or API | Med | Lineage endpoint | P2 |
| 9 | Raw layer | `source_files` + stored originals + `extras` | Partial | No immutable **cell-level** raw store; raw survives only via `extras`/observations | Med | Acceptable for now; revisit at scale | P3 |
| 10 | Review queue | Flags written (`needs_review`), **nothing reads them** | **Absent** | No table, API or UI. Every flag this engine raises is currently invisible | **High** | Build it | **P1** |
| 11 | Continuous learning | — | **Absent** | Human decisions are not captured, so nothing improves | **High** | `review_decisions`, consulted on later ingests | **P1** |
| 12 | Conflict engine | — | **Absent** | No `conflicts` table; multi-source disagreement cannot be represented | High | After enrichment exists | P2 |
| 13 | External enrichment | Policy written; **no implementation** | **Absent** | Category A research not built | Med | Blocked on #6 and owner-type classifier | P2 |
| 14 | Verification | — | Absent | No verification states on facts | Med | With enrichment | P2 |
| 15 | Data quality engine | `validation_flags` per row | Partial | No composite scores (completeness/consistency/freshness) | Med | Derive from existing data | P2 |
| 16 | Search | Trigram GIN, `search_text`, mobile digits | Strong | Not entity- or alias-aware ("Park Gate" vs "Park Gate Residences") | Med | Depends on #6 | P2 |
| 17 | Data request engine | — | **Absent** | No structured request object | Med | After #6/#10 | P2 |
| 18 | Delivery templates | — | **Absent** | Noor format recovered but nothing consumes it | **High** | Build with explicit unit + dedup config | **P1** |
| 19 | Request summary stats | — | Absent | Must be computed, never fabricated | Med | With #18 | P2 |
| 20 | Exports | CSV/Excel export + audit log | Partial | Not template-driven | Med | With #18 | P2 |
| 21 | UI | 21 components, React 18, builds clean | Strong | No review, conflicts, lineage, templates or request surfaces | Med | Follows the APIs | P2 |
| 22 | Security | RBAC, role hierarchy, erasure, audit tables | Strong | No SSRF guard (nothing fetches yet); prompt-injection boundary documented only | Med | Harden with enrichment | P2 |
| 23 | Secrets | `.env.example` present, none committed | Strong | No API inventory doc | Low | Add when a third-party key exists | P3 |
| 24 | Observability | Jobs, errors, heartbeat, progress, logs | Strong | No confidence-distribution metric | Low | Cheap addition | P3 |
| 25 | Testing | 226 tests incl. ugly-data integration | Strong | **No browser/e2e framework installed**; no performance tests | Med | Add Playwright when UI work starts | P2 |
| 26 | Scale | Batching, streaming, indexes, idempotent ingest | Strong | `return_defaults` costs per-row inserts on observation batches | Med | Measure before optimising | P3 |
| 27 | Deployment | Railway, Docker, CI (pytest + PG migrations + frontend) | Strong | CI migration job unverifiable locally (no PostgreSQL/Docker) | Low | Rely on CI | P3 |

### The four P1s, and why they are one cluster

**#10 review queue**, **#11 continuous learning**, **#6 entity resolution** and
**#18 delivery templates**.

#10 and #11 are the same mechanism seen from two ends: a human resolves a flag,
and that resolution becomes structured knowledge the next ingest consults
(Parts 34–35). Right now the engine raises flags into a void — every
`needs_review` written this session is invisible, and the most defensible work
of the semantic layer (*declining to guess*) has no payoff without a surface to
resolve it on. That makes it the highest-value correctness work available.

---

## 4. Verified this session

- **Observations are written during real ingestion** — 19 integration tests
  drive real `.xlsx` files through the real `Processor` and the production
  `persist_batch`, then assert against the database.
- **Provenance is complete** — every observation carries raw value, parsed
  value, file, sheet, row, column, original header, both confidences, evidence,
  engine version and timestamp.
- **CASCADE works** — proven with `PRAGMA foreign_keys=ON`, since SQLite
  otherwise makes the test pass vacuously.
- **The 23-field contract is intact** — `record_date` is still written by the
  same line of `validation.transform`; no API, export or frontend change.

## 5. Corrections to earlier documentation

- **ADR-003** claimed `AREA` previously mapped to `Community` on every sheet.
  Wrong: `AREA` was not an alias at all, so `resolve_ambiguities` never saw it
  and all 685 occurrences fell into `extras`. Corrected in the file.
- **DISCOVERY_REPORT §6** reported 97.4% alias coverage counting `AREA` as a
  deliberate non-mapping. It was an outright gap, now closed.

---

## 6. Open questions — preserved, not guessed

1. **Which party owns the `Name` slot** on two-party rows — registry vs history.
2. **The Noor dedup rule** — not recoverable from the artifacts (§2).
3. **`SIZE` unit per delivery template** — the Noor file is sq m; whether that
   holds for every client template is unknown, so it must be declared per
   template, never inferred.
4. **Corporate vs individual owners** — blocks enrichment; company facts are
   researchable, personal data is not.
5. **Tier-1 source accessibility** — whether DLD/RERA expose anything
   programmatic is unsurveyed.

---

## Related

- [DISCOVERY_REPORT.md](DISCOVERY_REPORT.md) — Phase 0 findings
- [SEMANTIC_RESOLUTION.md](SEMANTIC_RESOLUTION.md) — the resolution framework
- [ENRICHMENT_POLICY.md](ENRICHMENT_POLICY.md) — what may be researched
- [DATA_DICTIONARY.md](DATA_DICTIONARY.md) — field reference
- ADRs [001](adr/ADR-001-authoritative-mapping-workbook.md) · [002](adr/ADR-002-date-semantics.md) · [003](adr/ADR-003-area-locality-level.md) · [004](adr/ADR-004-two-party-rows-and-name.md) · [005](adr/ADR-005-delivery-templates.md)
