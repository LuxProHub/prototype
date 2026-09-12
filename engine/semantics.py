"""Contextual semantic resolution for fields whose value is clear and whose meaning is not.

Some canonical fields carry an unambiguous value with an ambiguous reading:

    Date   a date, but transaction / registration / handover / lease?
    Size   a number, but square feet or square metres?  (a 10.76x error)
    AREA   a place, but Community or Sub-Community?     (685 occurrences)

The old pipeline answered all three by picking one and writing it into a flat
column, which is why `record_date` cannot say which kind of date it holds.

This module is the general framework, not three special cases. A reading is
resolved from every signal the source offers:

    HEADER          the original column header -- what the author wrote
    VALUES          sample values, when the values state their own unit
    NEIGHBOURS      canonical fields mapped elsewhere on the same sheet
    COMPANIONS      other raw headers on the same sheet
    SHEET           the worksheet name
    WORKBOOK        the source filename
    VOCABULARY      known value vocabularies (community names, party types)
    DOMAIN RULES    per-field defaults that are documented house rules

Adding a field to the framework is an edit to resources/semantic_types.json
plus an ENGINE_VERSION bump -- never a change to this code. See
docs/SEMANTIC_RESOLUTION.md for the framework, and ADR-002/ADR-003 for the two
decisions that drove it.

Nothing here touches the database or mutates its inputs: `resolve` is pure, so
tests drive it on plain dicts.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field as dc_field
from pathlib import Path

RESOURCES = Path(__file__).parent / "resources"
_VOCAB = json.loads((RESOURCES / "semantic_types.json").read_text(encoding="utf8"))

UNRESOLVED = "unresolved"

# Signal weights. The header is the strongest evidence because it is what the
# source author actually wrote about that column. Everything else is
# corroboration: individually too weak to decide a reading on its own, which is
# deliberate -- "this sheet mentions rent somewhere" must not be enough to
# declare a date a lease date. Values carry header-strength weight when they
# state a unit, because that is the source speaking about that exact cell.
_WEIGHTS = {
    "header": 0.60,
    "value": 0.60,
    "neighbour": 0.22,
    "companion": 0.14,
    "sheet": 0.18,
    "workbook": 0.12,
    "vocabulary": 0.25,
}

_PUNCT = re.compile(r"[^a-z0-9]+")


def _norm(s) -> str:
    """Lowercase and collapse punctuation, so 'Sq.Ft' and 'sq ft' compare equal."""
    return _PUNCT.sub(" ", str(s or "").lower()).strip()


@dataclass
class SemanticContext:
    """Everything known about one column, from the narrowest signal outward.

    Only `header` is usually present. Every other field is optional, and a
    resolution made from fewer signals simply scores lower -- which is what
    routes it to review rather than into a confident wrong answer.
    """
    header: str | None = None
    values: list = dc_field(default_factory=list)      # sample values from the column
    neighbours: set = dc_field(default_factory=set)    # canonical fields on this sheet
    companions: list = dc_field(default_factory=list)  # other raw headers on this sheet
    sheet_name: str | None = None
    workbook_name: str | None = None

    def haystacks(self) -> dict:
        """Normalised text per signal kind, ready for phrase matching."""
        return {
            "header": _norm(self.header),
            # Values are joined so a unit stated in any sampled cell is seen.
            # Capped: a whole column of text would swamp the phrase match.
            "value": " ".join(_norm(v) for v in list(self.values)[:25] if v not in (None, "")),
            "companion": " || ".join(_norm(c) for c in self.companions),
            "sheet": _norm(self.sheet_name),
            "workbook": _norm(self.workbook_name),
        }


def fields_with_semantics() -> list[str]:
    """Canonical field names (and raw labels) this module can reason about."""
    return [k for k in _VOCAB if not k.startswith("_")]


def type_names(field: str) -> list[str]:
    spec = _VOCAB.get(field) or {}
    return [t["name"] for t in spec.get("types", [])]


def min_confidence(field: str) -> float:
    return float((_VOCAB.get(field) or {}).get("min_confidence", 0.70))


def target_column(field: str) -> str | None:
    return (_VOCAB.get(field) or {}).get("target_column")


def _longest_phrase_hit(phrases, hay: str) -> str | None:
    """Longest configured phrase present in `hay`, or None.

    Longest wins so a more specific reading beats a more general one: "lease
    end" must not lose to "end date" on the same header, and "sq m" must not be
    outscored by a stray "m".
    """
    best = None
    for p in phrases or ():
        n = _norm(p)
        if n and n in hay and (best is None or len(n) > len(best)):
            best = n
    return best


def _score_type(tspec: dict, ctx: SemanticContext, hay: dict) -> tuple[float, list]:
    """Score one candidate reading against every available signal."""
    sig = tspec.get("signals", {})
    score, hits = 0.0, []

    for kind in ("header", "value", "sheet", "workbook"):
        hit = _longest_phrase_hit(sig.get(kind), hay[kind])
        if hit:
            score += _WEIGHTS[kind]
            hits.append(f"{kind} contains {hit!r}")

    for n in sig.get("neighbour", ()):
        if n in ctx.neighbours:
            score += _WEIGHTS["neighbour"]
            hits.append(f"sheet has canonical field {n!r}")

    for c in sig.get("companion", ()):
        if _norm(c) and _norm(c) in hay["companion"]:
            score += _WEIGHTS["companion"]
            hits.append(f"sheet has companion header {c!r}")

    # Known value vocabularies: the column's own values matching a configured
    # list. Distinct from `value` phrase matching, which looks for units.
    vocab = sig.get("vocabulary") or []
    if vocab:
        vals = {_norm(v) for v in ctx.values if v not in (None, "")}
        overlap = vals & {_norm(x) for x in vocab}
        if overlap:
            score += _WEIGHTS["vocabulary"]
            hits.append(f"values match known vocabulary ({len(overlap)} of {len(vals)})")

    return min(score, 1.0), hits


def resolve(field: str, ctx: SemanticContext, decisions=None) -> dict:
    """Read the meaning of one column from its full context.

    Returns {semantic_type, confidence, needs_review, evidence}. Never raises
    and never invents a reading: below the field's threshold it returns
    UNRESOLVED with needs_review set, which is what routes the column to a
    human instead of into a plausible wrong answer.

    `decisions` is any object with a `lookup()` returning the same shape --
    normally backend.app.core.decision_index.DecisionIndex. A recorded human
    decision outranks inference, because somebody who looked at the source
    knows more than a phrase-match score. It does not SILENCE inference: the
    inferred reading is computed either way and carried in the evidence, so a
    decision that contradicts the data stays visible instead of hiding it.
    """
    spec = _VOCAB.get(field)
    if not spec:
        return _unresolved("field has no semantic vocabulary", {})

    inferred = _infer_from_signals(field, ctx, spec)

    if decisions is not None:
        try:
            decided = decisions.lookup(field, header=ctx.header,
                                       source_file=ctx.workbook_name,
                                       sheet_name=ctx.sheet_name)
        except Exception:
            decided = None          # a broken lookup must not stop ingestion
        if decided:
            ev = dict(decided.get("evidence") or {})
            ev["inferred_semantic_type"] = inferred["semantic_type"]
            ev["inferred_confidence"] = inferred["confidence"]
            # Worth seeing in the data rather than in anecdote: a decision that
            # keeps contradicting a confident inference means one of the two is
            # systematically wrong.
            ev["contradicts_inference"] = (
                inferred["semantic_type"] != UNRESOLVED
                and inferred["semantic_type"] != decided["semantic_type"]
            )
            decided = dict(decided)
            decided["evidence"] = ev
            return decided

    return inferred


def _infer_from_signals(field: str, ctx: SemanticContext, spec: dict) -> dict:
    """The signal-scoring reading, with no human decision consulted."""

    hay = ctx.haystacks()
    scores, evidence = {}, {}
    for tspec in spec.get("types", []):
        sc, hits = _score_type(tspec, ctx, hay)
        scores[tspec["name"]] = round(sc, 4)
        if hits:
            evidence[tspec["name"]] = hits

    if not scores or max(scores.values()) <= 0.0:
        # No signal at all. A configured default is a documented house rule
        # (Size defaults to sq ft, the UAE market convention), not a guess --
        # but it still carries reduced confidence and goes to review.
        default = spec.get("default_type")
        if default:
            return {
                "semantic_type": default, "confidence": 0.50, "needs_review": True,
                "evidence": {"reason": "no signal; applied configured default",
                             "rule": "default_type", "signals": [], "scores": scores},
            }
        return _unresolved("no signal matched", scores)

    best = max(scores, key=lambda k: (scores[k], -_order(spec, k)))
    top = scores[best]
    rivals = sorted((v for k, v in scores.items() if k != best), reverse=True)
    runner = rivals[0] if rivals else 0.0

    # Two readings that score identically are a real ambiguity, not a close call
    # to be broken by list order. Say so rather than picking one.
    if runner >= top:
        return {
            "semantic_type": UNRESOLVED, "confidence": round(top, 4), "needs_review": True,
            "evidence": {"reason": "two readings scored equally", "rule": "tie",
                         "signals": evidence.get(best, []), "scores": scores},
        }

    # Confidence is the winning score discounted by how close the runner-up
    # came: a clear win reads at full strength, a near-tie is damped toward the
    # review threshold even when the winner scored well.
    confidence = round(min(top, 1.0) * (1.0 - 0.5 * (runner / top if top else 0)), 4)
    needs_review = confidence < min_confidence(field)
    return {
        "semantic_type": best,
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


def infer(field: str, header: str | None = None, *, neighbours=None, companions=None,
          value_hint: str | None = None, values=None, sheet_name: str | None = None,
          workbook_name: str | None = None, decisions=None) -> dict:
    """Convenience facade over `resolve` for callers with loose arguments.

    `value_hint` is the single-sample form of `values`, kept because a caller
    that has one representative cell should not have to build a list.
    """
    vals = list(values or ())
    if value_hint is not None:
        vals.append(value_hint)
    return resolve(field, SemanticContext(
        header=header, values=vals, neighbours=set(neighbours or ()),
        companions=list(companions or ()), sheet_name=sheet_name,
        workbook_name=workbook_name,
    ), decisions=decisions)


def _order(spec: dict, name: str) -> int:
    """Position in the configured type list -- the documented tie-break order."""
    for i, t in enumerate(spec.get("types", [])):
        if t["name"] == name:
            return i
    return 999


def _unresolved(reason: str, scores: dict) -> dict:
    return {
        "semantic_type": UNRESOLVED, "confidence": 0.0, "needs_review": True,
        "evidence": {"reason": reason, "rule": "none", "signals": [], "scores": scores},
    }


if __name__ == "__main__":
    # Self-check: the readings this module exists to get right.
    r = infer("Date", "Transaction Date", neighbours={"Procedure Value"})
    assert r["semantic_type"] == "transaction_date" and not r["needs_review"], r

    # "Lease Start" and "Lease End" share the word lease; the longer, more
    # specific phrase has to win or every tenancy gets two identical dates.
    assert infer("Date", "Lease Start Date", companions=["Lease End Date"]
                 )["semantic_type"] == "lease_start_date"
    assert infer("Date", "Lease End Date", companions=["Lease Start Date"]
                 )["semantic_type"] == "lease_end_date"

    # A bare "Date" with nothing around it is exactly the case that must NOT be
    # guessed -- this is the collapse the whole model exists to prevent.
    r = infer("Date", "Date")
    assert r["semantic_type"] == UNRESOLVED and r["needs_review"], r

    # ...but the same bare header on a sheet that names itself resolves.
    r = infer("Date", "Date", sheet_name="JBR Seller to Buyer 2017")
    assert r["semantic_type"] == "transaction_date", r

    # The 10.76x error: unit stated in the value, not the header.
    assert infer("Size", "Area", value_hint="1,250 sq.m")["semantic_type"] == "sqm"
    assert infer("Size", "Size (sq.ft)")["semantic_type"] == "sqft"
    r = infer("Size", "Size")
    assert r["semantic_type"] == "sqft" and r["needs_review"], r

    # AREA: resolved by what the sheet already carries, per ADR-003.
    assert infer("AREA", "AREA", neighbours={"Community"}, companions=["COMMUNITY"]
                 )["semantic_type"] == "sub_community"
    assert infer("AREA", "AREA", neighbours={"Sub-Community"}, companions=["SUB COMMUNITY"]
                 )["semantic_type"] == "community"
    r = infer("AREA", "AREA")
    assert r["semantic_type"] == UNRESOLVED and r["needs_review"], r

    print("engine/semantics.py self-check OK")
