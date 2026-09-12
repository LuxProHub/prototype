# Data Dictionary

Canonical schema for the DataLink Engine. The 23 fields below are the external
contract: the API, exports, search and frontend all read them, and their names
and order are fixed.

Source of truth for aliases and normalisation: `engine/resources/column_mapping.json`.
Source of truth for semantic vocabularies: `engine/resources/semantic_types.json`.

---

## The 23 canonical fields

| # | Canonical name | DB column (`records`) | Type | Notes |
|---|---|---|---|---|
| 1 | Name | `name` | string(512) | Owner, contact or occupier. 55 aliases. **Semantic: party.** See below. |
| 2 | Community | `community` | string(255) | Master community. See [ADR-003](adr/ADR-003-area-locality-level.md). |
| 3 | Sub-Community | `sub_community` | string(255) | Area/sector within a community. |
| 4 | Building/Cluster | `building_cluster` | string(255) | Tower, cluster, building. |
| 5 | Unit Number | `unit_number` | string(128) | Flat/villa/shop number. |
| 6 | Size | `size` | float | **Semantic: unit.** Stored in sq ft. See below. |
| 7 | Plot Reg. No | `plot_reg_no` | string(128) | Registry number. |
| 8 | Plot Number | `plot_number` | string(128) | Distinct from #7. |
| 9 | DMNO | `dmno` | string(64) | Dubai Municipality number. |
| 10 | DMsubno | `dmsubno` | string(64) | DM sub-number. |
| 11 | Bedroom | `bedroom` | string(64) | Rejected values preserved in `extras`. |
| 12 | Type (Buyer/Seller) | `party_type` | string(32) | Value-contaminated; see below. |
| 13 | Mobile 1 | `mobile_1` | string(32) | 75 aliases — the messiest field. |
| 14 | Mobile 2 | `mobile_2` | string(32) | |
| 15 | Mobile 3 | `mobile_3` | string(32) | |
| 16 | Email Address | `email_address` | string(320) | |
| 17 | PI number | `pi_number` | string(64) | Property/instance identifier. |
| 18 | Nationality | `nationality` | string(128) | Only 6 aliases — thinnest coverage. |
| 19 | Property Type | `property_type` | string(128) | Normalised to market vocabulary (v2). |
| 20 | **Date** | `record_date` | datetime | **Semantic: which date.** See below. |
| 21 | Procedure Value | `procedure_value` | float | Transaction value. |
| 22 | Developer | `developer` | string(255) | Canonicalised (v2). |
| 23 | Project | `project` | string(255) | |

Every business field is nullable. Absent data is stored as NULL, never as an
invented value.

---

## Field #20 — `Date`

**Decision: [ADR-002](adr/ADR-002-date-semantics.md).**

`record_date` remains a single timestamp and remains the canonical external
contract. It is written exactly as before, by the same line of
`validation.transform`, and no consumer had to change.

What it does **not** do is say which *kind* of date it holds. The corpus contains
at least four distinct date semantics mapped into this one field:

| `semantic_type` | Meaning | Example raw headers |
|---|---|---|
| `transaction_date` | Sale, transfer or procedure executed | `TRANSACTION DATE`, `TRANSFER DATE`, `DEAL DATE` |
| `registration_date` | Recorded in the land registry | `REGISTRATION DATE`, `TITLE DEED DATE` |
| `handover_date` | Unit handed over to the owner | `HANDOVER DATE`, `POSSESSION` |
| `lease_start_date` | Tenancy began | `LEASE START DATE`, `EJARI START` |
| `lease_end_date` | Tenancy ends/expires | `LEASE END DATE`, `EXPIRY` |
| `listing_date` | Listed, or contact enquired | `LISTED`, `ENQUIRY DATE` |
| `unresolved` | Could not be determined from the source | a bare `DATE` column |

The kind is recorded per observation in `field_observations.semantic_type`,
together with the evidence and a confidence. **A bare `Date` header on a sheet
that says nothing else about it is recorded as `unresolved` at confidence 0.0 —
it is never assigned a type.**

The vocabulary is configuration (`semantic_types.json`), not code. Adding a date
type is a JSON edit plus an `ENGINE_VERSION` bump.

---

## Field #6 — `Size`

Stored in **square feet**. Sources state square metres as often, and where the
unit appears only in the column header (`Area (Sqm)`) the value alone cannot be
interpreted — this was the 10.76× defect fixed in ENGINE_VERSION 2.

| `semantic_type` | Meaning |
|---|---|
| `sqft` | Square feet — the UAE market default |
| `sqm` | Square metres — converted to sq ft on write |

Where neither the header nor the values state a unit, `sqft` is applied as a
documented house rule, at reduced confidence and flagged for review. It is a
convention, not a claim the source made.

---

## Field #12 — `Type (Buyer/Seller)`

The header is trustworthy; the values are not. Across 3,851 rows the values are
mostly `Buyer`/`Seller`, but **141 rows hold A/B/C/D block codes**.
`resolve_ambiguities` unmaps the column and preserves it in `extras` when its
values contain no Buyer/Seller at all, rather than writing block codes into a
party-type field.

---

## Field #1 — `Name` on two-party rows

**Decision: [ADR-004](adr/ADR-004-two-party-rows-and-name.md).**

Eight sheets carry a seller *and* a buyer on the same row, each with their own
nationality, contact and email. `SELLER NAME` / `BUYERS NAME` hold **person
names** — verified against source values — so they are aliases of `Name`, not of
`Type (Buyer/Seller)` where both mapping workbooks filed them.

The schema has one `Name` slot. `apply_plan` awards it deterministically by
column preference and preserves the other party in `extras`. Which party *should*
own it depends on whether this is a current-owner registry or a transaction
history — a question the data cannot answer — so it is not decided. Each name
column on a multi-party sheet gets an observation carrying its party role
(`seller_party`, `buyer_party`, `joint_owner`, `sole_party`) with `needs_review`
set.

**Deliberately not mapped** — these belong to someone other than the owner, and
stay in `extras` attributed to nobody: `Emergency Contact Number` (next of kin),
`POA Contact #` (attorney), `Agent Name` (broker), `Short Lease Tourism Company
Name` (a company).

---

## `AREA` — not a canonical field

**Decision: [ADR-003](adr/ADR-003-area-locality-level.md).**

The largest ambiguous raw label in the corpus (685 occurrences), used for three
different things. It was previously **not an alias of anything** and fell through
to `extras`, reaching no canonical field at all. It is now entered as `Community`
and refined per sheet:

- values >70% numeric → `Size`
- sheet already has its own Community column → `Sub-Community`
- sheet signals the other way → `Community`
- no signal → `Community` (historical behaviour), recorded with `needs_review`

---

## `field_observations`

One row per observed value of a field whose meaning is in doubt. **Append-only:**
a better reading is a new row, never an update, so what was previously believed
and why stays on the record.

| Column | Type | Meaning |
|---|---|---|
| `record_id` | FK → `records.id` CASCADE | The row this describes |
| `canonical_field` | string(64) | Canonical field *name* (`"Date"`), or a raw label (`"AREA"`) |
| `semantic_type` | string(48) | The reading. `unresolved` when undetermined — never NULL |
| `raw_value` | text | Source string, untouched. Never normalised in place |
| `parsed_value` | text | Canonical text form. NULL when parsing failed |
| `parsed_date` | datetime | Typed form for date fields |
| `parsed_number` | float | Typed form for numeric fields |
| `original_header` | string(512) | The source header this came from |
| `source_file` | string(512) | Provenance — denormalised, survives reprocess |
| `source_sheet` | string(255) | |
| `source_row` | int | |
| `source_column` | int | Not present on `records` at all |
| `job_id` | FK → `processing_jobs.id` SET NULL | Ingestion job |
| `confidence` | float | 0.0–1.0 |
| `evidence` | JSON | `{reason, rule, signals, scores}` — why this reading |
| `needs_review` | bool | Below threshold, or a tie between readings |
| `engine_version` | int | Which ruleset read it. NULL = predates versioning = stale |
| `observed_at` | datetime | |

Confidence threshold is per field (`min_confidence`, default 0.70). Below it the
reading is flagged, never upgraded to a guess. Two readings that score equally
are reported as a tie rather than broken by ordering.

---

## Engine versioning

`engine.ENGINE_VERSION` identifies the ruleset that produced a row. Bump it
whenever a change alters pipeline **output** for the same input. After a bump,
existing rows are stale until reprocessed:
`GET /api/maintenance/engine-status` reports how many,
`POST /api/maintenance/reprocess` re-derives them from stored source files.

Current version: **3** — see `engine/__init__.py` for the changelog.

---

## Related

- [SEMANTIC_RESOLUTION.md](SEMANTIC_RESOLUTION.md) — how ambiguous columns are read
- [ENRICHMENT_POLICY.md](ENRICHMENT_POLICY.md) — what may and may not be researched externally
- [ADR-001](adr/ADR-001-authoritative-mapping-workbook.md) — which mapping workbook is authoritative
- [ADR-002](adr/ADR-002-date-semantics.md) — Date semantics and the observation table
- [ADR-003](adr/ADR-003-area-locality-level.md) — AREA resolved per sheet
- [ADR-004](adr/ADR-004-two-party-rows-and-name.md) — two-party rows and the Name slot
