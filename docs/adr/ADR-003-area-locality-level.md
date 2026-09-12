# ADR-003 — `AREA` resolves to a locality level per sheet, not globally

**Status:** Accepted
**Date:** 2026-09-12
**Related:** [ADR-001](ADR-001-authoritative-mapping-workbook.md), [ADR-002](ADR-002-date-semantics.md)

---

## Context

`AREA` is the most common ambiguous raw header in the corpus: **685 occurrences**,
the largest single unresolved mapping.

It is used for three different things across the source files:

1. a **number** — a size in sq ft or sq m
2. a **master community** — Business Bay, JBR, Dumatn Marina
3. an **area within a community** — Executive Towers, JLT Cluster D

The two curated mapping workbooks disagree outright: `header_mapping_completed.xlsx`
reads it as `Community`, `header_mapping_completed_updated.xlsx` as `Sub-Community`
(see ADR-001).

`engine/mapping.resolve_ambiguities` already separated case 1 correctly —
a column whose values are >70% numeric becomes `Size`. For the text case it
hardcoded `Community`, on every sheet, with no confidence and no record that a
decision had been made.

## Problem

Case 2 and case 3 are both text and both real. A global rule is wrong for
whichever half it does not describe, and the corpus contains both.

## Options considered

**A. Always `Community`.** Status quo. Wrong wherever the sheet already has its
own Community column, which is where the finer locality is silently discarded.

**B. Always `Sub-Community`.** Wrong in the opposite direction, and worse:
promotes every standalone AREA column into a level that has no parent.

**C. Ask a human for all 685.** Accurate and unusable; they recur across ~100
files and new files keep arriving.

**D. Decide per sheet from the surrounding columns. — CHOSEN**

## Decision

Resolve `AREA` per sheet, using the sheet's own structure as evidence:

- The numeric branch is unchanged — `>70%` numeric values still mean `Size`, and
  a size is not a locality decision, so none is recorded.
- For the text case, if the sheet **already carries its own Community column**,
  then AREA is being used for the level below it → `Sub-Community`.
- If the sheet's only geography signal points the other way (it has a
  Sub-Community column, or companion headers naming one) → `Community`.
- **If the sheet gives no signal at all, the reading stays `Community`** — the
  historical behaviour, so no data moves between columns on files that gave no
  reason to move it — and the decision is recorded with `needs_review` set.

Inference runs through `engine/semantics.infer`, so the AREA vocabulary lives in
`engine/resources/semantic_types.json` alongside the Date and Size vocabularies
rather than as a special case in code.

The decision — type, confidence, and the signals that fired — is attached to the
column plan and surfaces in the job's mapping report, so a reviewer can see what
was decided for each file without reading the resulting rows.

## Consequences

**Good.**
- Sheets carrying both `COMMUNITY` and `AREA` now populate both locality levels
  instead of overwriting one with the other.
- Files that gave no signal behave exactly as before — the change cannot move
  data on a file that offered no reason to move it.
- The decision is inspectable per file and reviewable in bulk.

**Costs.**
- Pipeline output changes for a subset of sheets, so **ENGINE_VERSION is bumped
  to 3** and rows below it are stale until reprocessed.
- Per-sheet resolution means the same raw header can map differently in two
  files. That is a true reflection of the sources, but it makes cross-file
  comparison of "AREA" meaningless — the canonical fields are what should be
  compared, which is the point of having them.
- Sheets with no signal still resolve to `Community` under review. The 685
  occurrences are not all resolved by this ADR; they are made *visible* and
  correctly resolved wherever the source gave enough to resolve them.

## Verification

`tests/test_semantic_observations.py` pins each branch: the sub-community
promotion, the unchanged no-signal default, the review flag on an unevidenced
reading, the surviving numeric→Size branch, and the decision reaching the
mapping report.
