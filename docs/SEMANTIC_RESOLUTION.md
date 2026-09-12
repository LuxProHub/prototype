# Semantic Resolution Framework

How the engine decides what a column *means* when its values alone cannot say.

Implemented in `engine/semantics.py`. Vocabularies in
`engine/resources/semantic_types.json`. Observations produced by
`engine/observations.py`, persisted by `backend/app/core/persistence.py`.

---

## The problem class

Most columns are unambiguous: `Email Address` holds emails, `DMNO` holds a Dubai
Municipality number. A minority carry a value that is perfectly clear and a
*meaning* that is not:

| Field | Value is | Meaning in doubt | Cost of guessing |
|---|---|---|---|
| `Date` | a valid date | transaction / registration / handover / lease | a lease expiry counted as a sale |
| `Size` | a valid number | square feet or square metres | **10.76× wrong**, and invisible |
| `AREA` | a real place | Community or Sub-Community | geography collapses a level |
| `Name` | a real person | which party on a two-party row | the wrong owner |

The failure mode they share: **the wrong answer looks exactly like the right
one.** A date is still a date. A size is still a plausible number. Nothing
downstream can detect the error, because the distinguishing information — the
original header, the sheet it came from, what sat beside it — was discarded at
map time.

This framework keeps that information and records the reading made from it.

---

## Signals

A reading is scored against every signal the source offers, strongest first.

| Signal | What it is | Weight | Why that weight |
|---|---|---|---|
| `header` | the original column header | 0.60 | what the source author actually wrote about this column |
| `value` | sample values from the column | 0.60 | the source stating its own unit (`1,250 sq.m`) is as direct as a header |
| `vocabulary` | column values matching a known list | 0.25 | strong when it fires, but vocabularies are always incomplete |
| `neighbour` | canonical fields mapped elsewhere on the sheet | 0.22 | structural corroboration |
| `sheet` | the worksheet name | 0.18 | `JBR Seller to Buyer 2017` is highly indicative |
| `companion` | other raw headers on the sheet | 0.14 | weakest — mentioning "rent" somewhere is not evidence a date is a lease date |
| `workbook` | the source filename | 0.12 | weakest context, often just a date stamp |

Corroborating signals are deliberately too weak to decide a reading alone. One
companion hit cannot clear the 0.70 threshold; it takes a header match, or
several signals agreeing.

### Longest match wins

Within a signal, the longest configured phrase present wins. `Lease End Date`
matches both `lease` and `lease end`; without this rule every tenancy would get
two identical dates. Likewise `sq m` must not lose to a stray `m`.

---

## Scoring

```
score(type)  = Σ weight(signal) for every signal that fired, capped at 1.0
best         = highest-scoring type
runner       = next highest
confidence   = best × (1 − 0.5 × runner/best)
```

The discount matters: a reading that only just beat its rival is damped toward
the review threshold even when its raw score was high. A clear win reads at
nearly full strength.

### Three ways to refuse

The framework is built to decline, not to always produce an answer.

1. **No signal at all** → `unresolved` at confidence 0.0, flagged. A bare `Date`
   column on a sheet that says nothing else about it returns this. It is never
   assigned one of the four date types.
2. **A tie** → `unresolved`, flagged. Two readings scoring identically is a real
   ambiguity, not a close call to be broken by list order.
3. **Below `min_confidence`** (default 0.70) → the best reading is recorded, but
   `needs_review` is set. It is a lead, not a conclusion.

A configured `default_type` is the one exception: `Size` falls back to `sqft`,
the UAE market convention. It is applied at reduced confidence (0.50) and always
flagged, because it is a documented house rule and not something the source
said.

---

## Two levels of observation

**Column-level.** The *target* of a header depends on context. `AREA` becomes
`Community` on one sheet and `Sub-Community` on another. Decided once per sheet
in `mapping.resolve_ambiguities`, recorded on `ColumnPlan.semantic_decisions`,
and surfaced in the job's mapping report.

**Value-level.** The target is certain but the meaning is not. `Date` (which
kind) and `Size` (which unit) are decided once per sheet — a column's meaning is
a property of the column, not of each row — and the raw and parsed values are
captured per row.

Both land in the same `field_observations` table.

---

## Adding a field

Config, not code:

1. Add a top-level key to `semantic_types.json`, named for the canonical field
   (or the raw label, for column-level cases like `AREA`).
2. Give it `target_column`, `min_confidence`, optional `default_type`, and a
   `types` list. Order matters: it is the documented tie-break order, so put the
   most common reading first.
3. For a value-level field, add it to `_VALUE_LEVEL` in `engine/observations.py`
   with the DB column its parsed value lands in.
4. Bump `ENGINE_VERSION` — pipeline output has changed, and existing rows are
   now stale and re-derivable.

Column-level fields need no code change at all.

### Vocabulary entry shape

```json
{
  "name": "handover_date",
  "display": "Handover / Possession Date",
  "description": "Date the unit was handed over to the owner.",
  "signals": {
    "header":     ["handover", "possession", "completion date"],
    "value":      [],
    "neighbour":  ["Project", "Developer"],
    "companion":  ["project", "completion", "status"],
    "sheet":      ["handover", "snagging"],
    "workbook":   [],
    "vocabulary": []
  }
}
```

---

## What this framework does not do

- **It does not resolve everything.** `AREA` on a sheet with no sibling
  geography stays `Community` under review. That is 685 occurrences made
  *visible*, not 685 resolved.
- **It does not overrule the source.** Where `clean_size_detailed` finds a unit
  stated in the value, that beats the header-derived reading — the cell speaking
  about itself outranks inference about its column.
- **It does not blend confidences.** Mapping confidence ("is this column what we
  think it is") and semantic confidence ("does this value mean what we think")
  are recorded separately. Averaging them would hide a confident mapping of an
  unreadable value, which is exactly the case worth seeing.
- **It is not machine learning.** Every reading is a deterministic sum of
  configured phrase matches, reproducible from the evidence stored on the row.

---

## Related

- [ADR-002](adr/ADR-002-date-semantics.md) — Date semantics and the observation table
- [ADR-003](adr/ADR-003-area-locality-level.md) — AREA resolved per sheet
- [ADR-004](adr/ADR-004-two-party-rows-and-name.md) — party roles on two-party rows
- [DATA_DICTIONARY.md](DATA_DICTIONARY.md) — field-by-field reference

---

## The decision loop

A refusal to guess is only worth its cost if somebody can resolve it and the
resolution sticks. That is what `review_decisions` and the review API are for.

```
ingest ──> resolver declines ──> needs_review on the observation
                                          │
                              GET /api/review/queue   grouped by QUESTION
                                          │
                              POST /api/review/decide  answer + rationale + scope
                                          │
                                  review_decisions (append-only)
                                          │
next ingest ──> DecisionIndex.lookup() ──> resolved, attributed to the decision
```

### Grouped by question, not by row

A 24,000-row file with one ambiguous `Date` column produces 24,000 flagged
observations and asks exactly **one** question. The queue groups on
(field, header, file, sheet, current reading) and orders by affected rows, so
the decision with the largest blast radius surfaces first. Answering it once is
enough.

### Scope

| Scope | Applies to | When |
|---|---|---|
| `sheet` | one worksheet in one file | the reading is specific to that sheet |
| `workbook` | every sheet in one file | **default** — a file's conventions are internally consistent |
| `global` | that header everywhere | only when the reading is a property of the header itself |

Lookup prefers the narrowest match. This is the mechanism that stops one
reviewer's call about one file rewriting the reading for the whole corpus —
the failure mode Part 35 of the directive names explicitly.

A `sheet` or `workbook` decision without a `scope_file` is rejected at the API,
because a scope that does not say what it is narrow *to* silently becomes
global at lookup time.

### A decision outranks inference; it never silences it

`resolve()` computes the inferred reading **whether or not** a decision exists,
and carries it in the decision's evidence:

```json
{ "rule": "human_decision", "decision_id": 7, "scope": "workbook",
  "inferred_semantic_type": "handover_date", "inferred_confidence": 0.78,
  "contradicts_inference": true }
```

A person who looked at the source knows more than a phrase-match score, so the
decision wins — at confidence 0.95, deliberately not 1.0, because people are
wrong too. But a pattern of decisions contradicting confident inferences is
visible in the data rather than in somebody's memory, and one of the two is
then systematically wrong.

### Decisions do not rewrite history

Recording a decision changes how the column is read from the **next ingest**.
It does not touch stored rows: re-deriving what is already there is what
`POST /api/maintenance/reprocess` is for. A review click that silently rewrote
thousands of rows would be a bulk data change disguised as an annotation.

### Append-only, and not re-derivable

Changing an answer writes a new row and stamps `superseded_by` on the old one.
Revoking deactivates rather than deletes: a decision that turned out wrong is
part of how the data got the way it is, and removing it would make the rows it
produced inexplicable.

Note the asymmetry with observations: observations are re-derivable from the
stored source files, **decisions are not.** They are the one thing in this
schema that cannot be recomputed, which is why the migration's `downgrade()`
says so.

---

## Quality-gate additions (2026-09-12)

### A decision cannot suppress a contradiction forever

A decision wins the reading. It does not win the argument. `resolve()` always
computes the inferred reading, and when a decision is applied it checks whether
the source's own evidence — header, neighbours, values, sheet — would have
cleared the review threshold **on its own** for a *different* reading.

| Inference strength | Agrees with decision | Result |
|---|---|---|
| any | yes | decision applied, `needs_review = False` |
| weak (< `min_confidence`) | no | decision applied, contradiction recorded, `needs_review = False` |
| **strong (≥ `min_confidence`)** | **no** | **decision applied, `needs_review = True`, reason states the contradiction** |

The third row is the guarantee. A future workbook with strong contrary evidence
puts the column back in the queue with the old answer still applied and the
disagreement stated, so a human sees it rather than the decision quietly
winning against new data. A bare `Date` column — weak evidence for anything —
does not re-question a decision on every ingest.

### Stale decisions are detectable, not auto-invalidated

Every decision records the `ENGINE_VERSION` it was made under. A decision from
an older engine is still applied (the vocabulary rarely changes) but every
observation it produces carries `decision_stale: true` and
`decision_engine_version`, and `GET /api/review/decisions?stale=true` lists
them. Auto-invalidating would re-flag every decided column after every engine
bump — review noise that trains people to click through.

### A failed lookup is inference-only, and says so

If the decision store cannot be read, ingestion continues on inference alone —
the pre-review-queue behaviour — but never silently. Two surfaces:

- the **job** gets a `DECISIONS_UNAVAILABLE` warning from `DecisionIndex.degraded_reason`
- each affected **observation** gets `decision_lookup_failed` in its evidence and `needs_review = True`

A run that ignored every human decision cannot pass as a run that had none to apply.

### Scope integrity is structural

The API rejects a sheet- or workbook-scoped decision without its `scope_file`.
So does the database: three `CHECK` constraints on `review_decisions` make it
impossible to store, whatever code tries. The failure mode — a narrow scope
with nothing to be narrow *to*, silently behaving as global at lookup — is
closed at the layer that cannot be bypassed.

### Privacy in review

The grouped queue decides what a **column** means. That never requires showing
a person: a reviewer choosing whether `Seller Name` is a seller or a buyer is
reading the header. So the list view masks raw values for personal fields
(`Name`, `Mobile 1-3`, `Email Address`, `Nationality`) — `A***n E***n`,
`+9715*****67`, `a***@example.com` — and marks them `example_value_masked`.

The single-item endpoint returns the full value, because deterministic review
sometimes needs it, and a deliberate per-item fetch by an authenticated user is
a narrower exposure than a page of them. Every such fetch is logged with the
observation id, the field, and who opened it.

Non-personal fields (`Date`, `Size`, `AREA`) are shown in full in both views.

### Historical immutability

Recording a decision changes how a column is read from the next ingest. It
touches no stored row — pinned by
`test_recording_a_decision_does_not_touch_rows_already_ingested`. Applying a
decision to rows already stored is `POST /api/maintenance/reprocess`, which
routes through the same `run_job` path that now constructs the `DecisionIndex`.
Decisions are superseded, never edited; revoked, never deleted.
