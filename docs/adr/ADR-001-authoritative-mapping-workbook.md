# ADR-001 — Which header-mapping workbook is authoritative

**Status:** Accepted
**Date:** 2026-09-12
**Related:** [ADR-002](ADR-002-date-semantics.md), [ADR-003](ADR-003-area-locality-level.md)

---

## Context

Three workbooks in `C:\Users\USER\Music\All excel\Header\` describe the mapping
from raw source headers to the 23 canonical fields. They disagree, and the
filenames are misleading about which came last.

| File | Modified | Sheets | Mapping rows | Character |
|---|---|---|---|---|
| `header_mapping.xlsx` | Aug 19 **10:27** | 2 | — | Raw machine scan: 3,081 header rows, 24,307 raw rows, no assignments |
| `header_mapping_completed_updated.xlsx` | Aug 19 **11:01** | 4 | 2,387 | Full inventory including 1,766 unmapped/junk labels with diagnostic notes |
| `header_mapping_completed.xlsx` | Aug 19 **11:28** | 6 | 746 | Curated subset: 653 "alias confirmed", 93 "needs review" |

`header_mapping_completed.xlsx` is the **newest** file, despite `_updated`
appearing in the other's name.

All three agree exactly on the 23 canonical field names and their order, and
`engine/resources/column_mapping.json` matches them identically. **The canonical
schema itself is not in dispute.** Only the alias assignments are.

## Problem

122 raw labels are assigned to different canonical fields by the two curated
workbooks. Picking one file wholesale would import that file's specific errors.

## Analysis

Neither file is uniformly better.

**`_updated` is more correct on mobile-slot ordering.** `completed.xlsx` maps
`mobile no.2 → Mobile 1` and `mobile no.3 → Mobile 1`, collapsing every phone on
such a sheet into slot 1. `_updated` assigns them to Mobile 2 and Mobile 3.

**`_updated` is more correct on junk rejection.** `completed.xlsx` accepts
misdetected data values as headers — `amfoil@hotmail.com → Email Address`,
`11 EAskari Housing Society Gulberg → Building/Cluster`. These are cell values
from a misidentified header row. `_updated` flags them as junk.

**`completed.xlsx` is more correct on curation.** It carries an explicit
confirmed / needs-review status per row, which `_updated` lacks entirely.

## Decision

**No single workbook is authoritative. Each is authoritative for what it is good at:**

- `header_mapping_completed.xlsx` — **confirmation status**. Its
  confirmed/needs-review column is the human judgement signal.
- `header_mapping_completed_updated.xlsx` — **coverage and junk detection**. Its
  1,766 unmapped labels and diagnostic notes are the fullest inventory.
- `header_mapping.xlsx` — **raw evidence corpus**. The unjudged scan, kept for
  re-derivation.

`engine/resources/column_mapping.json` remains the single runtime source of
truth. The workbooks are inputs to curating it, never read at runtime.

Measured against the full 2,387-label inventory, the current `column_mapping.json`
already covers **97.4% of occurrences on labels the workbooks assigned to a
canonical field** (30,277 of 31,100), and 89.4% of all 40,103 occurrences
including deliberate ignores. Wholesale replacement from either workbook would
be a regression.

## Consequences

- Alias curation is a merge with per-row judgement, not a file import. Slower,
  and the only option that does not import known errors.
- The 122 conflicts are catalogued and resolved individually; where neither
  reading is clearly right, resolution moves to the semantic layer (ADR-002)
  rather than being forced in the alias table. `AREA` is the worked example
  (ADR-003).
- The workbooks are point-in-time artefacts from Aug 19 and will drift as
  ingestion meets new sources. `column_mapping.json` is what evolves.
