# Enrichment Policy

What this system may research externally, what it must not, and what it has to
record when it does.

**Status:** Policy accepted; enrichment pipeline not yet implemented.
This document is the contract the implementation must satisfy.

---

## 1. The governing constraint

This database holds **personal data of identifiable private individuals** at
scale: names, mobile numbers, email addresses, nationalities, and the properties
they own. It is subject to UAE **PDPL** (Federal Decree-Law No. 45 of 2021), and
the codebase already implements erasure requests, RBAC and privileged-action
auditing on that basis.

Enrichment is the one subsystem that *adds* personal data rather than processing
what was supplied. That makes it the highest-risk component in the platform, and
the policy is correspondingly restrictive.

> **The test is not "is it findable?" It is "do we have a lawful, necessary
> reason to hold it?"**
>
> A mobile number exposed on a public listing page is still personal data. That
> it can be scraped is not a reason to scrape it.

---

## 2. Category A — permitted (public corporate and project facts)

Facts about **organisations, developments and regulatory records**. These are
about legal entities and physical assets, not private individuals.

| Canonical field | Enrichable | Notes |
|---|---|---|
| `Developer` (#22) | Yes | Legal entity name, canonical form, parent group |
| `Project` (#23) | Yes | Official project name, alternate and marketing names |
| `Property Type` (#19) | Yes | Apartment / villa / plot classification |
| `Community` (#2) | Yes | Master community, official spelling |
| `Sub-Community` (#3) | Yes | Area within a community |
| `Building/Cluster` (#4) | Yes | Tower or cluster name, official spelling |

Also permitted as **entity-level** attributes (stored against the developer or
project, never against a person):

- project status (announced / under construction / completed / handed over)
- completion or handover dates as **publicly announced**
- developer registration and licence numbers
- RERA / DLD project registration where published
- official project location and coordinates
- publicly stated project attributes (unit counts, plot area, amenities)
- corporate identity: registered name, trade licence, parent company, website

**Condition:** the fact must be about the organisation or the development. The
moment a fact identifies a private individual, it is Category B regardless of
where it was found.

---

## 3. Category B — prohibited (personal data)

**Never collected from external sources, under any circumstances**, no matter how
public the page:

| Canonical field | Why |
|---|---|
| `Name` (#1) | Identifies a private individual |
| `Mobile 1/2/3` (#13–15) | Personal contact data |
| `Email Address` (#16) | Personal contact data |
| `Nationality` (#18) | Personal data, and a special-category risk |
| `Type (Buyer/Seller)` (#12) | Reveals an individual's transaction position |

Also prohibited:

- linking an individual to a property from an external source
- building a profile of a person across sites
- ownership history attributed to a named individual
- household composition, family relationships, age, gender, identity documents
- social-media profiles, employer, income or any financial circumstance
- photographs of people
- anything from a data broker or a leaked/scraped contact dataset

These fields are populated **only** from the customer's own supplied files,
which is data the customer already holds and is accountable for.

### Why this is not over-cautious

The commercial value of enrichment here is knowing that *Project X is by
Developer Y and completes in 2027*. That is Category A. Enriching owner contact
details would add little the supplied registers do not already contain, while
converting a controlled dataset into an unlawfully assembled one.

---

## 4. Category C — restricted (case-by-case, off by default)

| Data | Condition |
|---|---|
| Named company directors / signatories | Only from official registries, only when the record is a corporate owner |
| Named agents or brokers | Only as an entity attribute, never merged into `Name` (see ADR-004) |
| Transaction values (#21) | Only aggregate or officially published indices; never an individual's price |
| Community sentiment (Reddit, forums) | Never a fact. Stored as an unverified claim, entity-level only, never attributed to an individual |

Requires explicit configuration to enable, and every use is audited.

---

## 5. Source hierarchy

Adapted to the UAE market. A higher tier wins a conflict; a lower tier may
corroborate but never overrides.

| Tier | Source | Trust | Use |
|---|---|---|---|
| 1 | Dubai Land Department, Dubai Municipality, Abu Dhabi DMT, RERA | Authoritative | Registration, official project data |
| 2 | Federal/emirate licensing registries | Authoritative | Corporate identity |
| 3 | Developer official websites | High | Project facts, subject to marketing bias |
| 4 | Stock exchange / regulatory filings (DFM, ADX) | High | Corporate structure |
| 5 | Established portals (Bayut, Property Finder) | Medium | Project attributes, corroboration |
| 6 | Reputable business press (Gulf News, The National, Zawya) | Medium | Announcements, status changes |
| 7 | Community sources (Reddit, forums, reviews) | **Low — never authoritative** | Leads only; stored as claims |

**Rules.**
- A Tier 1–2 fact is not overridden by anything below it.
- A Tier 5–6 fact needs corroboration from a second independent source before it
  is treated as verified.
- Tier 7 never becomes a fact. It is stored as a claim with its own sentiment
  and corroboration status, and is never merged into a canonical field.

---

## 6. Provenance requirements

Every externally derived value records:

| Field | Why |
|---|---|
| `source_url` | The exact page, not the domain |
| `source_domain`, `source_type`, `source_tier` | For conflict resolution |
| `retrieved_at` | Freshness is per field (§7) |
| `extracted_value` | Before normalisation |
| `extraction_method` | Which parser or prompt produced it |
| `confidence` | Evidence-based, never a model's self-report |
| `corroborating_sources` | What else agreed |
| `verification_status` | unverified / corroborated / authoritative / **disputed** |

No enriched value is written without provenance. A fact whose source cannot be
recorded is not stored.

**Conflicts are preserved, never silently resolved.** Two sources disagreeing
produces two observations and a conflict record. If neither is authoritative and
neither is newer, the value is marked `disputed` and routed to review.

---

## 7. Freshness

Not all facts decay at the same rate. Re-research is driven by per-field TTL:

| Field | TTL | Rationale |
|---|---|---|
| Developer legal name | 365 days | Rarely changes |
| Project official name | 365 days | Rarely changes |
| Project location | 365 days | Fixed |
| Property type | 180 days | Stable |
| Project status | 30 days | Changes through construction |
| Handover date (announced) | 30 days | Slips routinely |
| Corporate structure | 180 days | Occasional |
| Community sentiment | 90 days | Decays in relevance |

Expiry does not delete the old observation. It marks it stale and schedules
re-research; the previous observation stays as history.

---

## 8. Security

External content is **untrusted input**.

- Retrieved text is **data, never instruction.** It is never concatenated into a
  system prompt, and any instruction-shaped content within it is inert. This is
  the same boundary the platform applies to spreadsheet cell contents.
- Fetches are SSRF-guarded: allowlisted schemes, no private or link-local
  address ranges, no redirect chains into internal hosts, bounded response size
  and timeout.
- Fetched HTML is never rendered in the UI unsanitised.
- Every enrichment fetch is logged with URL, status and byte count. Secrets never
  appear in logs.
- Robots directives and rate limits are respected; a source that forbids
  automated access is not used.

---

## 9. Cost and volume controls

- **Cache first.** A fact already researched and still fresh is never re-fetched.
  Cache is keyed by (entity, field), not by row — researching "DAMAC Properties"
  once serves every record that references it.
- **Entity-level, not row-level.** Enrichment targets developers and projects.
  A 24,000-row file with 40 distinct developers is 40 research tasks, not 24,000.
- **Budgets.** Per-job and per-period ceilings, enforced before dispatch.
- **Tiered escalation.** Deterministic lookup → cached index → targeted search →
  LLM extraction, in that order, stopping at the first that answers.
- **Retry limits** with backoff; a persistently failing source is disabled and
  reported, never retried indefinitely.

---

## 10. Pipeline

Enrichment runs as a controlled sequence. Each stage can decline, and declining
is a normal outcome.

```
 1 candidate discovery    which (entity, field) pairs are missing, disputed or stale?
 2 policy gate            Category A only. Category B is refused here, unconditionally.
 3 cache check            fresh answer already held? -> stop
 4 source selection       which tiers can answer this field at all?
 5 retrieval              SSRF-guarded fetch, rate-limited, logged
 6 extraction             value + the exact text it came from
 7 normalisation          same rules as ingest; no separate dialect
 8 cross-verification     independent corroboration for Tier 5-7
 9 conflict detection     disagreement -> conflict record, never a silent pick
10 confidence scoring     from source tier, corroboration, recency, extraction quality
11 provenance             §6, mandatory
12 persistence            append-only observation; canonical columns unchanged
13 review routing         low confidence, disputed, or policy-uncertain -> queue
```

**Stage 2 is not advisory.** A Category B field never reaches stage 3, whatever
the caller asks for.

---

## 11. Confidence is evidence, not assertion

A model reporting "99% confident" contributes nothing. Confidence is computed
from source tier, number of independent corroborating sources, recency against
the field's TTL, extraction quality, and consistency with existing verified
data. An LLM's self-reported certainty is not an input.

---

## 12. Retention

- Enriched **Category A** values persist with the entity, superseded by newer
  observations rather than overwritten.
- Cached raw source content is retained only as long as needed to re-extract,
  then discarded; the extracted value and its provenance persist.
- An **erasure request** removes the individual's personal data. Category A
  facts about developers and projects are unaffected — they are not personal
  data and are not attributed to the erased individual.
- Any Category B data found to have entered the system is deleted, not
  quarantined, and the ingress path is closed.

---

## 13. Open questions

1. **Which Tier 1 sources are programmatically accessible?** DLD/RERA public
   endpoints need survey; several are portal-only and may be off limits.
2. **Corporate owners.** Some `Name` values are companies, not individuals.
   Company names are Category A. A reliable classifier is needed before
   enriching any of them — misclassifying a person as a company would breach §3.
3. **Handover dates** are announced, then slip. Whether to store the announced
   date, the revised date, or every announcement as its own observation.

---

## Related

- [ADR-004](adr/ADR-004-two-party-rows-and-name.md) — third-party contacts are not merged into owner fields
- [SEMANTIC_RESOLUTION.md](SEMANTIC_RESOLUTION.md) — the observation and confidence model enrichment will reuse
- [DATA_DICTIONARY.md](DATA_DICTIONARY.md) — canonical field reference
