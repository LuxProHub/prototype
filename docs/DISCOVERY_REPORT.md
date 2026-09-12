# PROJECT ATLAS — Discovery Report

**Date:** 2026-09-12
**Phase:** 0 — Discovery (no implementation code written)
**Author:** Lead Architect

---

## 0. Executive summary — read this first

Discovery produced one finding that outranks everything else:

> **The working directory `C:\Users\USER\Downloads\trial` is completely empty.
> A working, tested, deployed implementation of this exact system already exists at
> `C:\Users\USER\Downloads\Prototype` ("DataLink Engine") — 189 passing tests,
> the identical 23-field canonical schema, 535 curated aliases, Alembic migrations,
> a React frontend and Railway deployment config.**

Building Project Atlas from scratch in `trial/` would re-create roughly 80% of an asset that
already works. The remaining ~20% — external web enrichment, per-fact provenance, conflict
records, and a human review queue — is genuinely missing, and is where the real value lies.

**Recommendation: extend `Prototype/`, do not rebuild in `trial/`.** Rationale in §12; the
single decision I need from you is in §14.

---

## 1. Repository assessment

### 1.1 The nominal working directory

| Property | Value |
|---|---|
| Path | `C:\Users\USER\Downloads\trial` |
| Contents | **Empty** (0 files) |
| Git repository | No |

The three Excel files named in the directive are **not** in this directory. They live at
`C:\Users\USER\Music\All excel\Header\` (confirmed by your attachments mid-session).

### 1.2 Prior work found on disk

Four distinct prior efforts at this problem exist:

| # | Location | Nature | Assessment |
|---|---|---|---|
| 1 | `Downloads\Prototype` | **Full working app** — git repo, backend, frontend, engine, tests, deploy | **Authoritative. This is the real project.** |
| 2 | `Downloads\LPH_Real_Estate_Data_Platform` | Documentation only (27 `.md` files, Aug 16) | Superseded planning docs |
| 3 | `Downloads\consolidation_engine_phase1_handoff` | Python `header_mapping.py` (Aug 15) | Early handoff, superseded by #1 |
| 4 | `Downloads\Proeprties data{, - Copy, - Master}` | Data folders (`cleaned/`, `reports/`) | Source / output data |

### 1.3 `Prototype/` in detail — "DataLink Engine"

| Aspect | Finding |
|---|---|
| Git | Active repo, `main` + 3 local + 5 remote branches, 2 remotes (`origin`, `personal`) |
| Latest commit | `935c904` — light-mode UI design pass |
| Working tree | 3 modified files, uncommitted (`records.py`, `RecordInspector.jsx`, `RecordsExplorer.jsx`) |
| Backend | FastAPI, 34 Python modules |
| Engine | 10 modules: `cleaning` (26KB), `mapping` (20KB), `processor` (20KB), `property_reference` (19KB), `reference` (19KB), `detection`, `inspection`, `validation`, `dedup` |
| Frontend | React 18, 45 components, Vite, built `dist/` present |
| Database | PostgreSQL + Alembic (head `a7b4e9f1c260`), trigram GIN search indexes |
| Tables | `users`, `source_files`, `processing_jobs`, `processing_errors`, `records`, `leads`, `lead_activities`, `erasure_requests`, plus 3 audit tables |
| **Tests** | **189 passed** — verified this session, 67s runtime |
| Deployment | Railway (`railway.json`, `nixpacks.toml`, `Procfile`), Docker, GitHub Actions |
| Compliance | RBAC role hierarchy, erasure API (UAE PDPL) |

**This is not a toy.** It substantially implements directive sections 3–8 and 14–21.

---

## 2. Domain correction (important)

The directive's examples reference Indian real estate — *DLF, Gurgaon, Noida, RERA*.

**The actual data is UAE property-ownership and contact data**: Business Bay, JBR, JLT,
Dubai Marina, Abu Dhabi (Al Reeman, Saadiyat, Al Raha), DMNO/DMsubno (Dubai Municipality
numbers), Emirates-format plot registration, and PDPL compliance already in the code.

The 23 canonical fields are **owner/contact plus property-identity fields** — closer to a
land-registry-backed CRM than a project-listings catalogue. Several directive assumptions
(RERA lookups, launch/possession dates, amenities, pricing volatility) do not map onto this
schema. I have designed against the **actual** data and flagged the divergence in §13.

---

## 3. The canonical 23 fields — determined, not guessed

Extracted from the `Standard Fields` sheet of both completed workbooks. **Both files agree
exactly — same 23 names, same order.** The `Prototype/column_mapping.json` `target_fields`
array is **identical in name and order** as well. Three independent sources concur.

| # | Canonical field | Semantic type | Notes |
|---|---|---|---|
| 1 | Name | Person / entity | Owner, contact, or occupier. 45 aliases. |
| 2 | Community | Geography L1 | Master location (e.g. Business Bay, JBR) |
| 3 | Sub-Community | Geography L2 | Area / sector within community |
| 4 | Building/Cluster | Geography L3 | Tower, cluster, building name |
| 5 | Unit Number | Property identity | Flat / villa / shop number |
| 6 | Size | Measure | Area — **unit-ambiguous** (sq ft / sq m) |
| 7 | Plot Reg. No | Registry identifier | Plot registration number |
| 8 | Plot Number | Property identity | Plot number (distinct from #7) |
| 9 | DMNO | Registry identifier | Dubai Municipality number |
| 10 | DMsubno | Registry identifier | DM sub-number |
| 11 | Bedroom | Attribute | Bed count / configuration |
| 12 | Type (Buyer/Seller) | Classification | **Value-contaminated — see §5** |
| 13 | Mobile 1 | Contact | Primary. 75 aliases — the messiest field. |
| 14 | Mobile 2 | Contact | Secondary |
| 15 | Mobile 3 | Contact | Tertiary |
| 16 | Email Address | Contact | |
| 17 | PI number | Identifier | Property / instance identifier |
| 18 | Nationality | Attribute | Only 6 aliases — thinnest coverage |
| 19 | Property Type | Classification | Apartment / villa / shop / office / plot |
| 20 | Date | Temporal | **Under-specified — which date? See §11** |
| 21 | Procedure Value | Monetary | Transaction / procedure value |
| 22 | Developer | Organisation | |
| 23 | Project | Organisation / asset | |

---

## 4. The three mapping workbooks — which is authoritative?

**The filenames are misleading. Verify by timestamp, not by name.**

| File | Modified | Sheets | Mapping rows | Character |
|---|---|---|---|---|
| `header_mapping.xlsx` | Aug 19 **10:27** | 2 | — | Raw machine scan. 3,081 header rows, 24,307 raw rows. No standard-field assignments. |
| `header_mapping_completed_updated.xlsx` | Aug 19 **11:01** | 4 | 2,387 | **Full inventory**, including 1,766 unmapped/junk labels with diagnostic notes |
| `header_mapping_completed.xlsx` | Aug 19 **11:28** | 6 | 746 | **Curated subset** — 653 "alias confirmed", 93 "needs review" |

### Verdict: neither is solely authoritative — they are complementary

`header_mapping_completed.xlsx` is the **newest** file, despite `_updated` appearing in the
other's name. But newest does not mean better on every row. Of the 122 labels where the two
disagree:

- **`_updated` is more correct on mobile-slot ordering.** `completed.xlsx` maps
  `mobile no.2 → Mobile 1` and `mobile no.3 → Mobile 1`, collapsing every phone into slot 1.
  `_updated` correctly assigns them to Mobile 2 and Mobile 3.
- **`_updated` is more correct on junk rejection.** `completed.xlsx` accepts misdetected data
  values as headers — e.g. `amfoil@hotmail.com → Email Address` and
  `11 EAskari Housing Society Gulberg → Building/Cluster`. `_updated` flags these as
  "junk/misdetected header".
- **`completed.xlsx` is more correct on curation** — it carries an explicit
  confirmed / needs-review status per row, which `_updated` lacks.

**Resolution adopted:** use `completed.xlsx` for *confirmation status*, `_updated.xlsx` for
*coverage and junk detection*, and `header_mapping.xlsx` as the raw evidence corpus. To be
recorded as ADR-001.

---

## 5. Conflicts requiring human decision

These are real semantic conflicts, not noise. Per directive §45 I am not resolving them silently.

| Conflict | Evidence | Impact |
|---|---|---|
| **`AREA` → Community or Sub-Community?** | `completed.xlsx` says Community; `_updated.xlsx` says Sub-Community; `Prototype` deliberately leaves it **unmapped** | **685 occurrences — the single largest unresolved mapping in the corpus.** Blocks correct geography for ~2% of all columns. |
| **`Type (Buyer/Seller)` contamination** | `column_mapping.json` `value_warnings`: mostly Buyer/Seller across 3,851 rows, but **141 rows hold A/B/C/D block codes** | Header is trustworthy; values are not. Needs value-level validation. |
| **Composite `Premise 1` field** | Format `p1 \| p2 \| p3 \| p4`, ~55 sheets / ~24k rows. Part 3 is the literal string `NA` in **13,667 of 24,033 rows** | Requires a splitter, and over half the unit numbers are simply absent. |
| **`Size` unit ambiguity** | No unit recorded in source headers | sq ft vs sq m is a ~10.76× error if guessed wrong. |
| **Buyer/Seller name labels** | `SELLER NAME`, `BUYERS NAME`, `NEW BUYER` mapped to *Type (Buyer/Seller)* in the sheet | Arguably wrong — these are **Name** values whose *role* is buyer or seller. Conflates identity with classification. |

---

## 6. Mapping coverage — quantified

Measured `Prototype/column_mapping.json` (535 aliases + 81 ignore/exclude rules) against the
full 2,387-label spreadsheet inventory:

| Metric | Value |
|---|---|
| Distinct raw labels in corpus | 2,387 |
| Total column occurrences | 40,103 |
| Covered by existing JSON (alias or explicit ignore) | **35,868 = 89.4%** |
| Occurrences on labels the sheet assigned to a standard field | 31,100 |
| — of those, covered by JSON | **30,277 = 97.4%** |

**The existing mapping is 97.4% complete against known-good assignments.** The single largest
gap is `AREA` (685 occurrences), unmapped *deliberately* because of the conflict in §5 — a
defensible engineering decision, not an oversight.

The rest is a long tail of labels occurring ≤6 times (`POA NAME`, `LEASE START DATE`,
`EMERGENCY CONTACT NUMBER`, …) — roughly 2–3 hours of curation.

---

## 7. Gap analysis — directive vs. existing system

### Already built and tested (do not rebuild)

| Directive § | Requirement | Status in `Prototype/` |
|---|---|---|
| §3 | Canonical 23 fields | Done — exact match |
| §5 | Ingestion (XLSX/CSV, multi-sheet, header detection) | Done — `detection.py`, `inspection.py` |
| §6 | Semantic header mapping + confidence | Done — `mapping.py` (20KB) |
| §7 | Normalization | Done — `cleaning.py` (26KB): phone, size, reference |
| §8 | Entity resolution / dedup | Done — `dedup.py`, cross-register dedup tests |
| §14 | Database architecture | Done — 11 tables, Alembic, GIN indexes |
| §15 | API architecture | Done — FastAPI + RBAC |
| §16 | Frontend | Done — React 18, 45 components |
| §19 | Idempotency | Done — `test_reprocess.py` |
| §21 | Observability | Done — `processing_jobs`, `processing_errors`, `logs/` |
| §23 | Security | Done — RBAC, erasure/PDPL, `harden/` branch |
| §28 | Testing | Done — 189 passing |

### Genuinely missing — this is the real work

| Directive § | Requirement | Status |
|---|---|---|
| **§9** | **External web research / enrichment engine** | **Absent.** Existing "enrich" code is *internal* reference lookup only. |
| **§10** | **Multi-source verification, conflict records** | **Absent.** No conflicts table. |
| **§11** | **Per-fact provenance** (source_url, retrieval_ts, confidence) | **Partial** — file-level only (`source_files`), not fact-level. |
| **§13** | **Human review queue** | **Partial** — referenced in `jobs.py`, no dedicated table or UI. |
| **§12** | **Quality scoring** (completeness / consistency / freshness) | **Partial** — validation exists, composite scores do not. |
| **§26** | **Community / Reddit intelligence** | **Absent.** |
| **§41** | **Field-level freshness policy** | **Absent.** |

**Net: roughly 80% built, 20% remaining — and the remaining 20% is the highest-value part.**

---

## 8. Architecture recommendation

**Extend `Prototype/`. Add an enrichment and provenance layer alongside the proven pipeline.**

```
EXISTING (keep — proven by 189 tests)
  upload → detection → inspection → mapping → cleaning → dedup → validation → records
                                                                                |
NEW (build)                                                                     v
  +--------------------------------------------------------------------------------+
  |  fact_observations   one row per (record, field, value, source) — never         |
  |                      overwritten. This is the zero-data-loss primitive.         |
  |  sources             url, domain, type, tier, retrieved_at                      |
  |  conflicts           two or more observations disagree -> row created, no merge |
  |  review_queue        why a human is needed, and what the options are            |
  |  enrichment_cache    keyed by (entity, field) + per-field freshness TTL (§41)   |
  +--------------------------------------------------------------------------------+
```

The key design decision: **`fact_observations` is append-only.** A "current value" is a
*view* — the highest-confidence non-disputed observation — not a stored mutable cell. This
satisfies directive §4 (zero data loss) and §11 (provenance first-class) structurally rather
than by convention, which is the only way those rules survive contact with a deadline.

**Stack:** keep FastAPI + PostgreSQL + React + Alembic + Railway. No new stack. The existing
choices are sound and already deployed; changing them would be cost with no benefit.

---

## 9. Strategy summaries

**Mapping.** Keep the existing deterministic alias dictionary as tier 1 — it is 97.4%
effective and free. Add fuzzy plus sample-value inference as tier 2 for the unmatched long
tail only. Reserve LLM classification for tier 3, the genuinely novel headers. This is
directive §39 (cheapest reliable method first) applied literally.

**Normalization.** Already config-driven via `column_mapping.json`. Extend that file; do not
add hardcoded rules to application code.

**Enrichment.** Targeted, never speculative. Enrich a field only when (a) it is null or
disputed, (b) a source tier exists that can actually answer it, and (c) the cache holds no
fresh entry.

**Source hierarchy (adapted to UAE):** Dubai Land Department / Dubai Municipality / Abu Dhabi
DMT → developer official sites → Bayut and Property Finder → business press → community
sources (leads only, never authoritative).

**Testing.** The existing 189 tests are the regression baseline; every change keeps them
green. New work is TDD per §28, plus the deliberately ugly corpus of §29 — for which the
1,766 junk labels already catalogued in `_updated.xlsx` are a ready-made fixture.

**Security.** External web content is untrusted (§25); enrichment text must never re-enter a
prompt as instruction. The existing RBAC/PDPL posture carries over. Add SSRF protection on
any fetch-by-URL path.

---

## 10. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Rebuilding from scratch in `trial/`** discards 189 tests and a deployed app | **Critical** | Decision in §14 |
| `AREA` mis-resolution corrupts geography across 685 columns | High | Human decision — do not auto-resolve |
| `Size` unit guessed wrong → 10.76× errors | High | Store unit explicitly; refuse to normalize without it |
| Uncommitted changes in `Prototype/` working tree | Medium | Commit or stash before new work begins |
| Directive assumes Indian market; data is UAE | Medium | Documented in §2; schema follows the data |
| Enrichment cost unbounded | Medium | Cache, budget, tiered escalation (§39/§40) |
| Personal data (names, mobiles, emails, nationality) at scale | High | PDPL already implemented; must not regress |

---

## 11. Unresolved questions (need your input)

1. **`AREA` → Community or Sub-Community?** 685 occurrences are blocked on this.
2. **What is `Date`?** Transaction, registration, handover, or lease date? The corpus contains all four.
3. **`Size` unit** — is the source consistently sq ft, or does it vary by file?
4. **Buyer/Seller names** — should `SELLER NAME` populate `Name`, with the role recorded separately, rather than `Type (Buyer/Seller)`?
5. **Enrichment scope** — which of the 23 fields are genuinely worth researching externally? Owner names and mobile numbers cannot and must not be web-researched (privacy and PDPL); `Developer`, `Project`, and `Property Type` plausibly can.

---

## 12. What I recommend

1. **Adopt `Prototype/` as the Project Atlas codebase.** Do not rebuild in `trial/`.
2. Commit or stash the 3 dirty files; branch `feat/atlas-enrichment`.
3. Build the missing 20%: `fact_observations` → `sources` → `conflicts` → `review_queue` →
   enrichment with cache and budget.
4. Resolve the five questions in §11 — several block correctness, not merely polish.
5. Keep the 189 tests green as a hard gate throughout.

---

## 13. Where I am deliberately diverging from the directive

Stated plainly, per §45 (make uncertainty visible):

- **Not rebuilding from scratch.** §50 says inspect before coding; inspection revealed the
  thing largely exists. Rebuilding would violate §35 ("do not vibe-code blindly") far more
  than reusing does.
- **Not producing all 20 documents from §30 up front.** I will write the ones that encode real
  decisions — `CANONICAL_SCHEMA`, `DATA_DICTIONARY`, ADRs, `IMPLEMENTATION_PLAN`. Generating
  20 template files before the architecture is agreed is documentation theatre, not
  documentation.
- **Domain corrected to UAE**, as evidenced by the data (§2).

---

## 14. The one decision I need before implementing

**Does Project Atlas continue inside `Downloads\Prototype`, or must it be built fresh in
`Downloads\trial`?**

Everything downstream depends on this. I recommend `Prototype/`, and I have written no
implementation code pending your answer.
