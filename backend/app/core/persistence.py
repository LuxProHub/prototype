"""Writing a pipeline batch: records first, then the observations that point at them.

Extracted from the job runner so the integration tests exercise the same code
that production runs. A test that reimplements the insert proves only that the
reimplementation works.

The ordering is forced by the schema: a FieldObservation carries a record_id,
and that id does not exist until the Record is written. So the records go in
first with RETURNING enabled, and the ids come back into the mapping dicts.
"""
from __future__ import annotations

from engine import observations

from ..models.models import FieldObservation, Record


_RECORD_STRING_LIMITS: dict[str, int] = {
    col.name: col.type.length
    for col in Record.__table__.columns
    if hasattr(col.type, "length") and col.type.length is not None
}

_OBS_STRING_LIMITS: dict[str, int] = {
    col.name: col.type.length
    for col in FieldObservation.__table__.columns
    if hasattr(col.type, "length") and col.type.length is not None
}


def persist_batch(db, rows: list[dict], job_id: int) -> int:
    """Insert one batch of pipeline rows plus their semantic observations.

    Caller owns the transaction: this does not commit, so a failure rolls back
    the records and their observations together rather than leaving
    observations pointing at rows that were never written.

    Returns the number of records inserted.
    """
    for r in rows:
        r["job_id"] = job_id
        for col_name, max_len in _RECORD_STRING_LIMITS.items():
            val = r.get(col_name)
            if isinstance(val, str) and len(val) > max_len:
                r[col_name] = val[:max_len]

    # Observations are not Record columns, so they come off before the insert.
    pending = [(r, observations.pop_from(r)) for r in rows]
    has_obs = any(o for _, o in pending)

    # return_defaults makes the insert emit RETURNING id and writes the ids back
    # into the mapping dicts, which is what lets each observation find its own
    # record. It costs a per-row insert instead of one executemany, so it is
    # only paid on batches that actually carry observations.
    db.bulk_insert_mappings(Record, rows, return_defaults=has_obs)

    if has_obs:
        obs_rows = []
        for r, obs in pending:
            rid = r.get("id")
            if not rid or not obs:
                continue
            for o in obs:
                o["record_id"] = rid
                o["job_id"] = job_id
                for col_name, max_len in _OBS_STRING_LIMITS.items():
                    val = o.get(col_name)
                    if isinstance(val, str) and len(val) > max_len:
                        o[col_name] = val[:max_len]
                obs_rows.append(o)
        if obs_rows:
            db.bulk_insert_mappings(FieldObservation, obs_rows)

    return len(rows)

