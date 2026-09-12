# ADR-005 — Delivery templates are configuration, not schema

**Status:** Accepted — implemented in `engine/delivery.py` + `engine/resources/templates/noor_park_gate.json`
**Date:** 2026-09-12
**Related:** [ADR-001](ADR-001-authoritative-mapping-workbook.md), [ADR-002](ADR-002-date-semantics.md)

---

## Context

Two Park Gate workbooks describe how data leaves the system:

| File | Rows | Role |
|---|---|---|
| `Park_Gate_Residences_-Noor_standardised.xlsx` | 2,348 | the raw consolidated set |
| `Al_Kifaf_Park_Gate_Residences_UNIQUE.xlsx` | 434 | the delivered set |

Both carry the same 11 columns, which are **not** the 23 canonical fields:

```
Contact Phone | Contact NAME | Contact Email | Second Phone | PROJECT
| BUILDING NAME | FLAT  | PLOT NUMBER | SIZE | ROOMS DESCRIPTION | FLOOR
```

The risk this ADR exists to prevent is treating that column list as a schema.
It is one client's output format. `FLOOR` is not a canonical field at all
(it sits in `ignore_or_extras`); `FLAT ` carries a trailing space; `Contact
Phone` and `Second Phone` are Mobile 1 and Mobile 2 under different names.

A previous generation of this problem is already recorded in ADR-001: mapping
workbooks were treated as authoritative and imported wholesale, carrying their
curation errors with them. Hard-coding a delivery format into core logic would
be the same mistake at the other end of the pipeline.

## Decision

**Delivery templates are configuration. Core logic never references a client's
column names.**

A template declares:

| Property | Why it must be declared |
|---|---|
| column order, display names | the client's format, including quirks like `FLAT ` |
| canonical field per column | the only link to the 23-field contract |
| **`size_unit`** | see below — this is the load-bearing one |
| dedup rule | explicit key and tie-break, never inferred |
| required fields, validation rules | what makes a row `Valid` vs `Invalid` |
| filename convention | how the artifact is named |
| summary wording | the covering note, with numbers computed not typed |

### `size_unit` is mandatory, not optional

Median `SIZE` by room count in the Noor file:

| Rooms | n | Median | × 10.7639 |
|---|---|---|---|
| 1 B/R | 246 | 92.77 | 998.6 |
| 2 B/R | 812 | 146.16 | 1,573.3 |
| 3 B/R | 199 | 200.66 | 2,159.9 |

A 2-bedroom of 146 sq ft is impossible. At 1,573 sq ft it is ordinary. **The
column is square metres and nothing in the file says so.**

The engine currently handles this correctly, but only by declining: no unit
appears in the header or the values, so `clean_size_detailed` records
`unit_source='assumed'` and flags the row. It does not silently convert — and it
also does not get the right answer. A template that does not declare its unit
cannot produce correct sizes, so the field is required rather than defaulted.

### The dedup rule must be supplied, because it cannot be recovered

Reconstruction attempts against the two artifacts:

| Candidate key | Distinct in raw | 434? |
|---|---|---|
| Contact Phone | 388 | no |
| Contact NAME | 503 | no |
| Name + Phone | 651 | no |
| Flat + Building | 782 | no |
| Whole row | 2,048 | no |

The closest — first occurrence of each distinct non-blank `Contact NAME` —
gives 502 rows, overlapping the kept set on 426 of 434. Nothing reproduces 434
exactly.

All 434 delivered rows appear verbatim in the raw file, so the step is a filter
and no row was rewritten. But the precise key, normalisation and tie-breaks are
not visible in the output. **The rule is therefore configuration supplied by a
human, not something the engine infers.** Guessing it would silently change what
a client receives.

### Summary statistics are computed, never typed

The covering note takes the form:

```
Area: Al Kifaf – Park Gate Residences
Raw: 2348   Duplicate, No number: 1914   Unique: 434   Valid: 423   Invalid: 11
```

Every number is emitted by the run that produced the file, labelled with the
rule that produced it. The first three reconcile exactly against the artifacts
(2,348 − 434 = 1,914). `Valid`/`Invalid` depend on the validation rule the
template declares, and are reported against that rule by name.

Rejected rows stay inspectable and exportable. A delivery that discards its own
rejects cannot be audited.

## Consequences

**Good.**
- One client's format cannot leak into core logic.
- The 10.76× risk is closed by declaration rather than inference.
- Summary numbers are auditable, and reconcile against real artifacts.
- Adding a client is a config file, not a code change.

**Costs.**
- A template cannot be created from an example file alone: the unit and the
  dedup rule must be stated by someone who knows them. That is the intended
  cost — both were unrecoverable here, and both change what a client receives.
- Templates will accumulate. They need their own review, versioning and tests,
  the same as normalisation rules.

## Open

- Whether `FLOOR` should become a canonical field or stay a template-only
  passthrough from `extras`. It appears in this template and in
  `ignore_or_extras`; one of those is wrong, and the evidence does not yet say
  which.
- Whether `SIZE` in sq m holds for every client template or only this one. It is
  declared per template precisely because that is unknown.

## Implementation notes (quality gate)

`engine/delivery.py` implements this contract. What it enforces, in order of
how badly getting it wrong would hurt:

- **Both sides or neither.** A column declaring `delivery_unit` without
  `source_unit` (or vice versa) fails at template load. A one-sided unit is the
  precise shape of a 10.76x error entering a delivery.
- **Only known conversions.** `sqft <-> sqm`, declared in one table. Anything
  else is a `TemplateError`, not a pass-through.
- **Undeclared size is passed through and flagged.** The Noor artifact's shape —
  `SIZE` with no unit anywhere — emits the canonical value unchanged with a
  `passthrough / unit_declared: false` lineage entry. Never converted, never
  guessed.
- **Accounting must balance.** `raw = unique + excluded` and
  `unique = valid + invalid`, asserted on every run.
- **The summary names the rule.** `one row per distinct ['Mobile 1'], keep first`
  — and the Park Gate acceptance test asserts the declared rule does **not**
  reproduce the historical 434, so a coincidental match would be caught rather
  than trusted.

Fixture: the two Park Gate artifacts, deterministically pseudonymised
(`tests/fixtures/park_gate_noor_*.xlsx`). Equal inputs map to equal fakes, so
the duplicate structure, the 434-in-2,348 verbatim overlap and every count are
the real ones, with no real name, phone or email in the repo.
