# ADR-004 — `SELLER NAME` is a Name; which party owns the slot is not decided

**Status:** Accepted
**Date:** 2026-09-12
**Related:** [ADR-001](ADR-001-authoritative-mapping-workbook.md), [ADR-002](ADR-002-date-semantics.md)

---

## Context

Both curated mapping workbooks assign these raw labels to canonical field #12,
`Type (Buyer/Seller)`:

| Raw label | Occurrences | Workbook says |
|---|---|---|
| `Seller Name` | 6 | Type (Buyer/Seller) |
| `Buyers Name` | 6 | Type (Buyer/Seller) |
| `Buyer` | 5 | Type (Buyer/Seller) |
| `NEW BUYER` | 4 | Type (Buyer/Seller) |
| `Joint Buyer Name and Surname` | 2 | Type (Buyer/Seller) |

The question was whether they belong in `Name` or `Type (Buyer/Seller)`.

## Evidence

Eight sheets across four workbooks carry these headers. Their shared shape:

```
Project Name | Location | New unit Number | Old Unit Number | No. of Rooms/Bedrooms
  | Seller Name | Nationality | Contact Number | Email Address
  | Buyers Name | Nationality | Contact Number | Email Address
```

Actual values from `DP 3.xlsx`, sheet `Sheet2` (contacts redacted):

| Column | Values |
|---|---|
| `Seller Name` | Allan Howard Errington, Sampathawaduge Rajindra Anoj, Olga Burgova |
| `Buyers Name` | Mohammed Abdullah H Alzain, Eman Mohammed Samir Ali Mahm, Elmira Zaripova |
| `Nationality` (×2) | British / Saudi, Srilankan / Emirati, Russian / Kazakhstani |

These are **person names**, not the classification `Buyer`/`Seller`. The
workbooks filed them under `Type (Buyer/Seller)` by matching the words *buyer*
and *seller* in the label rather than by looking at the values — the same class
of curation error catalogued in ADR-001.

The genuine type-bearing labels are separate and far rarer:
`Type( Buyer and seller)` (2), `TYPE ( BUYER/SELLER)` (1),
`Type (Buyer or Seller)` (1).

### What the engine was actually doing

None of these labels were in `column_mapping.json` at all. They fell through to
`extras` — preserved, but not mapped. On these eight sheets the result was a
record with **no `Name` at all**, while both names sat in `extras`.

The duplicate `Nationality` / `Contact Number` / `Email Address` columns were
handled correctly already: `apply_plan.put()` gives the target to the
best-ranked column and preserves the loser in `extras`. Nothing was overwritten.

## Decision

**Two separate questions, answered separately.**

### 1. Are they Names? Yes — determinable from the data.

`SELLER NAME`, `BUYERS NAME`, `BUYER NAME`, `JOINT BUYER NAME AND SURNAME`,
`NEW BUYER`, `PURCHASER NAME`, `VENDOR NAME` and their spelling variants are
added as aliases of `Name`. The values are person names; the evidence is not
ambiguous.

The canonical schema is **not** modified. `Type (Buyer/Seller)` keeps its own
type-bearing aliases and its existing value-contamination guard.

### 2. Which party owns the single `Name` slot? Not determinable — preserved, not guessed.

A two-party row describes two people. The schema has one `Name`. Which party
should win it depends on what the database is *for*:

- a **current-owner registry** wants the buyer (the post-transfer owner)
- a **transaction history** wants both, with the seller equally real

The data cannot distinguish these intents, and the codebase supports both
readings — it has a leads/CRM layer (suggesting current owners) and ingests
sheets explicitly titled "Seller to Buyer 2017" (suggesting history). So the
choice is **not made here**.

Instead, when two or more columns on a sheet map to `Name`,
`mapping.resolve_multi_party` records a `FieldObservation` for each, carrying
its party role (`seller_party`, `buyer_party`, `joint_owner`, `sole_party`) with
`needs_review` set on every one. `apply_plan` continues to award the slot
deterministically by column preference and source order, and the other party is
preserved in `extras` as before.

The record now has a name, both people survive, and the choice is visible and
queryable rather than silent.

## What was deliberately NOT adopted from the workbooks

Four assignments were rejected because the value belongs to a **different person
than the record's owner**. Mapping them would attribute a third party's identity
or contact details to the owner — a data-integrity error and, for the contact
fields, a PDPL problem:

| Raw label | Workbook says | Why rejected |
|---|---|---|
| `Emergency Contact Number` | Mobile 1 | next of kin, not the owner |
| `POA Contact #` | Mobile 3 | power-of-attorney holder |
| `Agent Name` | Name | the broker, not the owner |
| `Short Lease Tourism Company Name` | Name | a company, not the owner |

These stay in `extras`: preserved in full, attributed to nobody.

## Consequences

**Good.**
- Eight sheets stop producing nameless records.
- Both parties to a transaction survive, one in `Name`, one in `extras`.
- The party role is recorded with evidence and flagged for review.
- Third-party contact details are not laundered into owner fields.

**Costs.**
- Pipeline output changes for these sheets, covered by the ENGINE_VERSION 3 bump.
- Every name column on a multi-party sheet is flagged for review, which will
  produce a queue with no automated resolution until the registry-vs-history
  question is answered. That is the intended cost of not guessing.
- A two-party row still becomes one record. Emitting two records would represent
  the source more faithfully but changes row cardinality across the whole
  pipeline — dedup, identity hashing, lead linkage — and is out of scope here.
  Recorded as an open question rather than done quietly.

## Verification

`tests/test_ingestion_integration.py`: a two-party row produces a named record,
both parties survive, and both party roles are recorded with `needs_review`.
