"""Human review decisions, looked up at resolve time.

The semantic layer declines to guess, and every refusal writes `needs_review`.
This is what makes answering one worthwhile: a decision recorded here is
consulted on the next ingest, so the same question stops being asked.

Mirrors DedupIndex: constructed against a job's session and handed to the
Processor, so `engine/` stays free of database imports and the resolver remains
a pure function that can be tested on plain dicts.

Scope is resolved most-specific-first -- sheet, then workbook, then global.
A decision made while looking at one sheet applies to that sheet before it
applies to anything wider, which is what stops one reviewer's call about one
file rewriting the reading for the whole corpus.
"""
from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models.models import DecisionScope, ReviewDecision

log = logging.getLogger(__name__)


def _norm(s) -> str:
    return " ".join(str(s or "").strip().upper().split())


class DecisionIndex:
    """Active human decisions, loaded once per job and matched per column.

    Loaded eagerly rather than probed per column: decisions are curated by
    hand and number in the hundreds at most, unlike records. One query per job
    beats one per ambiguous column, and the set cannot change mid-job in a way
    that would make a partial read worse than a consistent one.
    """

    def __init__(self, db: Session):
        self._by_field: dict[str, list[ReviewDecision]] = {}
        try:
            rows = db.scalars(
                select(ReviewDecision)
                .where(ReviewDecision.active.is_(True))
                # Newest first, so an equally-scoped later decision wins.
                .order_by(ReviewDecision.decided_at.desc())
            ).all()
        except Exception:
            # A missing table (an environment that has not migrated yet) must
            # not take ingestion down. No decisions simply means the resolver
            # falls back to inference, which is the pre-existing behaviour.
            log.warning("review_decisions unavailable; resolving without them",
                        exc_info=True)
            rows = []
        for d in rows:
            self._by_field.setdefault(d.canonical_field, []).append(d)
        self._count = len(rows)

    def __len__(self) -> int:
        return self._count

    def lookup(self, canonical_field: str, *, header: str | None = None,
               source_file: str | None = None, sheet_name: str | None = None) -> dict | None:
        """The most specific active decision for this column, or None.

        Returns the shape `semantics.resolve` emits, so a decision and an
        inference are interchangeable to the caller.
        """
        candidates = self._by_field.get(canonical_field) or []
        if not candidates:
            return None

        h, f, s = _norm(header), _norm(source_file), _norm(sheet_name)
        best, best_rank = None, len(DecisionScope.ORDER)

        for d in candidates:
            # A decision tied to a header only applies to that header.
            if d.original_header and _norm(d.original_header) != h:
                continue
            if d.scope == DecisionScope.SHEET:
                if _norm(d.scope_file) != f or _norm(d.scope_sheet) != s:
                    continue
            elif d.scope == DecisionScope.WORKBOOK:
                if _norm(d.scope_file) != f:
                    continue
            # GLOBAL matches anything that got this far.

            rank = DecisionScope.ORDER.index(d.scope)
            if rank < best_rank:
                best, best_rank = d, rank
                if rank == 0:          # sheet-scoped: nothing can be narrower
                    break

        if best is None:
            return None

        return {
            "semantic_type": best.semantic_type,
            # A human who looked at the source outranks a phrase-match score,
            # but this is deliberately not 1.0: people are wrong too, and a
            # decision that later contradicts strong evidence should not be
            # indistinguishable from proof.
            "confidence": 0.95,
            "needs_review": False,
            "evidence": {
                "reason": "resolved by a recorded human decision",
                "rule": "human_decision",
                "signals": [f"decision #{best.id} at {best.scope} scope"],
                "decision_id": best.id,
                "decided_by": best.decided_by_email,
                "decided_at": best.decided_at.isoformat() if best.decided_at else None,
                "rationale": best.rationale,
                "scope": best.scope,
            },
        }
