# ADR-002 — Canonical field #20 "Date" carries a semantic type, not one meaning

**Status:** Accepted
**Date:** 2026-09-12
**Supersedes:** nothing
**Related:** [ADR-001](ADR-001-authoritative-mapping-workbook.md), [ADR-003](ADR-003-area-locality-level.md)

---

## Context

The canonical schema has a single field at position 20 called `Date`, stored as
`records.record_date` — one nullable timestamp.

The source corpus does not contain one kind of date. It contains at least four,
all mapped into that single field by the alias dictionary:

| Source semantic | Example raw headers |
|---|---|
| Transaction / procedure | `TRANSACTION DATE`, `TRANSFER DATE`, `DEAL DATE` |
| Registration | `REGISTRATION DATE`, `TITLE DEED DATE` |
| Handover / possession | `HANDOVER DATE`, `UNIT HANDOVER DATE`, `POSSESSION` |
| Lease | `LEASE START DATE`, `LEASE END DATE` |

Once written to `record_date`, these are indistinguishable. A row cannot answer
"which kind of date is this?", and no amount of later analysis recovers the
answer, because the distinguishing information — the original header — was
discarded at map time. A dashboard filtering "sales in Q1" silently includes
lease expiries.

This is the same failure mode as the sq.m/sq.ft defect fixed in ENGINE_VERSION 2,
where a unit stated only in the header was dropped and every affected size was
stored 10.76× too small. That one was caught because the magnitudes looked
wrong. A wrong date semantic looks perfectly plausible, so nothing catches it.

## Problem

Preserve the meaning of each date without breaking the 23-field contract that
the API, exports, search and frontend all depend on.

## Options considered

**A. Pick one meaning for `Date` and document it.**
Simplest, and wrong. Whichever is chosen, the other three are silently
mislabelled. Rejected: this is the collapse, formalised.

**B. Split `Date` into four canonical columns.**
`transaction_date`, `registration_date`, `handover_date`, `lease_date`. Honest,
but it breaks the 23-field contract — every consumer, export and the external
schema change — and it still cannot represent a date whose kind is unknown,
which is the common case. Rejected.

**C. Keep `record_date`, add a `date_type` column on `records`.**
Cheap, and nearly right. Fails on the two cases that matter: a sheet with both
a lease start and a lease end produces two dates for one record, and a single
column cannot hold the evidence for why the type was chosen. Rejected.

**D. Append-only observation table alongside the flat column. — CHOSEN**
`record_date` stays exactly as it is and keeps being written exactly as before.
A new `field_observations` table records each observed value together with the
meaning read into it, the evidence behind that reading, and a confidence that is
allowed to be low.

## Decision

Adopt option D, with one refinement: **the table is not date-specific.**

`Date` is not the only field of this shape. Three of the 23 carry a clear value
and an unclear meaning:

| Field | Value is | Meaning in doubt |
|---|---|---|
| `Date` | a date | transaction / registration / handover / lease |
| `Size` | a number | square feet or square metres (10.76×) |
| `AREA`* | a place | Community or Sub-Community (685 occurrences) |

\* not a canonical field; the largest ambiguous raw label in the corpus.

A `date_observations` table would have been followed by `size_observations` and
`area_observations` — three tables with identical columns differing only in
which vocabulary they draw from. One table with `canonical_field` plus
`semantic_type` covers all three and is the *less* redundant structure, which is
the explicit requirement. Dates are simply its first consumer.

### Shape

`field_observations`, one row per observed value:

- `raw_value` — the source string untouched. Never normalised in place, so a
  failed parse stays diagnosable instead of becoming NULL.
- `parsed_value`, `parsed_date`, `parsed_number` — normalised forms, typed so
  dates sort and sizes compare without re-parsing text per query.
- `canonical_field`, `semantic_type` — what field, read as what.
- `original_header`, `source_file`, `source_sheet`, `source_row`,
  `source_column`, `job_id` — full provenance, denormalised so an observation
  stays interpretable after a reprocess replaces the record it describes.
  `source_column` does not exist on `records` at all.
- `confidence`, `evidence`, `needs_review` — how much we believe it and why.
- `engine_version`, `observed_at` — which ruleset read it, and when.

### Append-only

A better reading is a **new row**, never an update. What we previously believed,
and the evidence we believed it on, stays on the record. This is what makes the
zero-data-loss policy structural rather than a convention that erodes under
deadline.

### Vocabulary is configuration

Date types live in `engine/resources/semantic_types.json`. Adding one is an edit
to that file plus an `ENGINE_VERSION` bump — never a code change. The list ships
with six types (the four above plus `listing_date` and explicit `unresolved`)
and is expected to grow as ingestion meets new sources.

### Never guess

Inference uses the original header, neighbouring canonical fields, companion raw
headers on the same sheet, and sample values. Below the per-field confidence
threshold (0.70) the reading is recorded as `unresolved` with `needs_review`
set. **A bare `Date` header on a sheet that says nothing else about it returns
`unresolved` at confidence 0.0** — it is not assigned a type. Two readings that
score equally are reported as a tie, not broken by ordering.

## Consequences

**Good.**
- The 23-field contract is untouched: `record_date` is still written by the same
  line of `validation.transform`, and no API, export or frontend change was
  needed. Two regression tests pin this.
- Every date keeps its source meaning, its evidence and its provenance.
- The same structure resolves the Size unit and AREA locality ambiguities, so
  the next field of this shape needs config, not schema.
- Uncertainty is visible and queryable rather than hidden in a plausible value.

**Costs.**
- One row per ambiguous observation, not per record. On the ~24k-row families in
  the corpus this is a modest multiple, but it is unbounded in principle and the
  table will need a retention policy once enrichment also writes to it.
- "The current value" becomes a view over observations rather than a stored
  cell. That is more query work than reading a column, which is precisely why
  the flat columns were kept rather than replaced.
- Existing rows have no observations. They were produced by a pipeline that
  never recorded a reading, and back-filling one would invent evidence that was
  never gathered — the exact failure this table exists to prevent. They are
  re-derivable from their stored source files via the normal reprocess path.

**Engine version.** Bumped to 3. Pipeline output changes for sheets where AREA
now reads as Sub-Community (see ADR-003), so existing rows are stale until
reprocessed, reported by `GET /api/maintenance/engine-status`.
