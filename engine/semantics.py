"""Semantic-type inference for fields whose value is clear and whose meaning is not.

Three of the 23 canonical fields carry an unambiguous value with an ambiguous
reading:

    Date   a date, but transaction / registration / handover / lease?
    Size   a number, but square feet or square metres?  (a 10.76x error)
    AREA   a place, but Community or Sub-Community?     (685 occurrences)

The old pipeline answered all three by picking one and writing it into a flat
column, which is why `record_date` cannot say which kind of date it holds. This
module answers instead with a type, a confidence and the evidence behind both,
and refuses to answer at all below the per-field threshold.

The vocabulary lives in resources/semantic_types.json. Adding a date_type is an
edit to that file plus an ENGINE_VERSION bump -- never a change to this code.

Nothing here writes to the database or mutates its inputs; `infer` is pure, so
the tests can drive it on plain dicts.
"""
import json
import re
from pathlib import Path

RESOURCES = Path(__file__).parent / "resources"
_VOCAB = json.loads((RESOURCES / "semantic_types.json").read_text(encoding="utf8"))

UNRESOLVED = "unresolved"

# Signal weights. Header text is the strongest evidence because it is what the
# source author actually wrote; neighbouring canonical fields and companion raw
# headers are corroboration, worth less on their own but decisive together.
# A single companion hit must stay below the review threshold on its own --
# otherwise "this sheet mentions rent somewhere" would be enough to declare a
# date a lease date.
_W_HEADER = 0.60
_W_NEIGHBOUR = 0.22
_W_COMPANION = 0.14
_W_VALUE = 0.30

_PUNCT = re.compile(r"[^a-z0-9]+")


def _norm(s) -> str:
    """Lowercase and collapse punctuation, so 'Sq.Ft' and 'sq ft' compare equal."""
    return _PUNCT.sub(" ", str(s or "").lower()).strip()


def fields_with_semantics() -> list[str]:
    """Canonical field names this module can reason about."""
    return [k for k in _VOCAB if not k.startswith("_")]


def type_names(field: str) -> list[str]:
    spec = _VOCAB.get(field) or {}
    return [t["name"] for t in spec.get("types", [])]


def min_confidence(field: str) -> float:
    return float((_VOCAB.get(field) or {}).get("min_confidence", 0.70))


def _score_type(tspec: dict, header_n: str, neighbours: set, companions: list) -> tuple[float, list]:
    """Score one candidate type. Returns (score, signals that fired)."""
    sig = _score_signals(tspec, header_n, neighbours, companions)
    score = 0.0
    hits = []

    if sig["header"]:
        # Longest match wins: "lease end" must beat "end date" on the same
        # header, and "sq m" must not be outscored by a stray "m".
        score += _W_HEADER
        hits.append(f"header contains {sig['header']!r}")

    for n in sig["neighbour"]:
        score += _W_NEIGHBOUR
        hits.append(f"sheet has canonical field {n!r}")

    for c in sig["companion"]:
        score += _W_COMPANION
        hits.append(f"sheet has companion header {c!r}")

    return min(score, 1.0), hits


def _score_signals(tspec: dict, header_n: str, neighbours: set, companions: list) -> dict:
    s = tspec.get("signals", {})
    # Longest header phrase that matches, so more specific beats more general.
    header_hit = None
    for phrase in s.get("header", []):
        p = _norm(phrase)
        if p and p in header_n:
            if header_hit is None or len(p) > len(header_hit):
                header_hit = p
    return {
        "header": header_hit,
        "neighbour": [n for n in s.get("neighbour", []) if n in neighbours],
        "companion": [c for c in s.get("companion", [])
                      if any(_norm(c) in ch for ch in companions)],
    }


def infer(field: str, header: str | None = None, *, neighbours=None,
          companions=None, value_hint: str | None = None) -> dict:
    """Read the meaning of one column.

    field       canonical field name, e.g. "Date" (or a raw label like "AREA")
    header      the ORIGINAL source header, which is the primary evidence
    neighbours  canonical field names mapped elsewhere in the same sheet
    companions  other raw headers in the same sheet
    value_hint  a sample value, when the values themselves carry the unit
                (e.g. "1,250 sq.m") -- treated as header-strength evidence
                because it is the source stating its own unit.

    Returns {semantic_type, confidence, needs_review, evidence}. Never raises,
    and never invents a type: below the field's threshold it returns
    UNRESOLVED with needs_review set, which is what routes the row to a human.
    """
    spec = _VOCAB.get(field)
    if not spec:
        return _unresolved(field, "field has no semantic vocabulary", {})

    header_n = _norm(header)
    neighbours = set(neighbours or ())
    companions = [_norm(c) for c in (companions or ())]
    # A unit stated in the value is the source speaking for itself, so it is
    # folded into the same text the header signals are matched against.
    if value_hint:
        header_n = (header_n + " " + _norm(value_hint)).strip()

    scores, evidence = {}, {}
    for tspec in spec.get("types", []):
        sc, hits = _score_type(tspec, header_n, neighbours, companions)
        scores[tspec["name"]] = round(sc, 4)
        if hits:
            evidence[tspec["name"]] = hits

    if not scores or max(scores.values()) <= 0.0:
        # No signal at all. A configured default is a documented house rule
        # (Size defaults to sq ft: the UAE market convention), not a guess --
        # but it still carries low confidence and goes to review.
        default = spec.get("default_type")
        if default:
            return {
                "semantic_type": default, "confidence": 0.50,
                "needs_review": True,
                "evidence": {"reason": "no signal; applied configured default",
                             "rule": "default_type", "signals": [],
                             "scores": scores},
            }
        return _unresolved(field, "no signal matched", scores)

    best = max(scores, key=lambda k: (scores[k], -_order(spec, k)))
    top = scores[best]
    rivals = sorted((v for k, v in scores.items() if k != best), reverse=True)
    runner = rivals[0] if rivals else 0.0

    # Two readings that score the same are a genuine ambiguity, not a close
    # call to be broken by ordering. Say so instead of picking one.
    if runner >= top:
        return {
            "semantic_type": UNRESOLVED, "confidence": round(top, 4),
            "needs_review": True,
            "evidence": {"reason": "two readings scored equally",
                         "rule": "tie", "signals": evidence.get(best, []),
                         "scores": scores},
        }

    # Confidence is the winning score discounted by how close the runner-up
    # came: a clear win reads at full strength, a near-tie is damped toward
    # the review threshold even when the winner scored well.
    confidence = round(min(top, 1.0) * (1.0 - 0.5 * (runner / top if top else 0)), 4)
    needs_review = confidence < min_confidence(field)
    return {
        "semantic_type": best if not needs_review else best,
        "confidence": confidence,
        "needs_review": needs_review,
        "evidence": {
            "reason": ("clear winner" if not needs_review
                       else "below confidence threshold; flagged for review"),
            "rule": "signal_scoring",
            "signals": evidence.get(best, []),
            "scores": scores,
        },
    }


def _order(spec: dict, name: str) -> int:
    """Position in the configured type list -- the documented tie-break order."""
    for i, t in enumerate(spec.get("types", [])):
        if t["name"] == name:
            return i
    return 999


def _unresolved(field: str, reason: str, scores: dict) -> dict:
    return {
        "semantic_type": UNRESOLVED, "confidence": 0.0, "needs_review": True,
        "evidence": {"reason": reason, "rule": "none", "signals": [],
                     "scores": scores},
    }


if __name__ == "__main__":
    # Self-check: the readings this module exists to get right.
    r = infer("Date", "Transaction Date", neighbours={"Procedure Value"})
    assert r["semantic_type"] == "transaction_date", r
    assert not r["needs_review"] and r["confidence"] >= 0.70, r

    r = infer("Date", "Lease End Date", companions=["Lease Start Date", "Tenant"])
    assert r["semantic_type"] == "lease_end_date", r

    # "Lease Start" and "Lease End" share the word lease; the longer, more
    # specific header phrase has to win or every tenancy date collapses to one.
    r = infer("Date", "Lease Start Date", companions=["Lease End Date"])
    assert r["semantic_type"] == "lease_start_date", r

    # A bare "Date" with nothing around it is exactly the case that must NOT
    # be guessed -- this is the collapse the whole model exists to prevent.
    r = infer("Date", "Date")
    assert r["semantic_type"] == UNRESOLVED and r["needs_review"], r

    # The 10.76x error: the unit stated in the value, not the header.
    r = infer("Size", "Area", value_hint="1,250 sq.m")
    assert r["semantic_type"] == "sqm", r
    r = infer("Size", "Size (sq.ft)")
    assert r["semantic_type"] == "sqft", r
    # No signal anywhere falls back to the documented market default, but only
    # under review -- never silently.
    r = infer("Size", "Size")
    assert r["semantic_type"] == "sqft" and r["needs_review"], r

    # AREA: resolved by what the sheet already has, per ADR-003.
    r = infer("AREA", "AREA", neighbours={"Community"}, companions=["COMMUNITY"])
    assert r["semantic_type"] == "sub_community", r
    r = infer("AREA", "AREA", neighbours={"Sub-Community"}, companions=["SUB COMMUNITY"])
    assert r["semantic_type"] == "community", r
    # Bare AREA with no sibling geography is the 685-occurrence ambiguity.
    r = infer("AREA", "AREA")
    assert r["semantic_type"] == UNRESOLVED and r["needs_review"], r

    print("engine/semantics.py self-check OK")
