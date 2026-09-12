"""Building semantic field observations during ingestion.

An observation is one observed value of one field, together with the meaning
read into it, the evidence for that reading, and where it came from. It is what
makes `record_date` interpretable: the flat column holds a timestamp, the
observation says which kind of date that timestamp is and why we think so.

Two kinds of observation are produced, from the two places ambiguity lives:

COLUMN-LEVEL   A header whose target depends on context. AREA is the example:
               it becomes Community on one sheet and Sub-Community on another.
               The decision is made once per sheet in mapping.resolve_ambiguities
               and recorded on the plan; here it is attached to each row.

VALUE-LEVEL    A field whose target is certain but whose meaning is not. Date
               (which kind of date) and Size (which unit) are the examples. The
               reading is resolved once per sheet from the column's header,
               values, neighbours and the sheet name; the raw and parsed values
               are captured per row.

Both go into the same table. Adding a third field of either kind is a change to
resources/semantic_types.json, not to this module.

Nothing here writes to the database -- these are plain dicts, so the pipeline
stays testable without one, and persistence stays in the API layer where the
transaction boundary already is.
"""
from __future__ import annotations

from datetime import datetime

from . import ENGINE_VERSION
from . import cleaning as C
from . import semantics as S
from .mapping import norm_header

# Canonical fields whose observations are value-level, mapped to the DB column
# the parsed value lands in. Driven by semantic_types.json rather than declared
# here, so this stays a lookup and not a second source of truth.
_VALUE_LEVEL = {
    "Date": ("record_date", "date"),
    "Size": ("size", "number"),
}

# Observations travel to the persistence layer on the row dict, because that is
# the only place they stay aligned with the record they describe -- an
# observation needs a record_id, and that id does not exist until the row is
# written. The key is private and is NOT a Record column, so any caller that
# turns a pipeline row into a Record must take it off first. Use pop_from();
# `Record(**row)` raises TypeError otherwise, which is the intended loud
# failure rather than a silently dropped observation.
OBSERVATIONS_KEY = "_observations"


def pop_from(row: dict) -> list[dict]:
    """Take the observations off a pipeline row, leaving only Record columns."""
    return row.pop(OBSERVATIONS_KEY, None) or []


def resolve_sheet(plan, samples: dict, *, sheet_name: str | None = None,
                  workbook_name: str | None = None) -> dict:
    """Resolve the value-level semantics for one sheet, once.

    A column's meaning is a property of the column, not of each row, so this
    runs per sheet and the per-row work is only capturing values. Returns
    {canonical_field: decision}, where decision is what semantics.resolve
    returned.
    """
    out = {}
    for field in _VALUE_LEVEL:
        idx = _index_for(plan, field)
        if idx is None:
            continue
        header = plan.header[idx] if idx < len(plan.header) else None
        out[field] = S.resolve(field, S.SemanticContext(
            header=header,
            values=samples.get(idx, []),
            neighbours={t for i, t in plan.index_to_target.items() if i != idx},
            companions=[str(h) for i, h in enumerate(plan.header)
                        if i != idx and h not in (None, "")],
            sheet_name=sheet_name,
            workbook_name=workbook_name,
        ))
        out[field]["_column_index"] = idx
        out[field]["_header"] = header
    return out


def _index_for(plan, target: str) -> int | None:
    """Lowest column index feeding `target`, or None."""
    for i, t in sorted(plan.index_to_target.items()):
        if t == target:
            return i
    return None


def _mapping_confidence(plan) -> float:
    """How much we trust that this column means what we mapped it to.

    Mapping here is a deterministic alias lookup -- there is no fuzzy matching
    -- so a header that matched an alias is certain. A headerless sheet matched
    by column position is a structural guess and says so.
    """
    return 0.4 if plan.positional else 1.0


def build_for_row(plan, sheet_semantics: dict, raw_row: list, fields: dict, row: dict,
                  *, source_file: str | None, sheet_name: str | None,
                  row_no: int | None) -> list[dict]:
    """Observations for one source row. Returns dicts without `record_id`.

    The caller attaches record_id after insert, because the id does not exist
    until the record is written.
    """
    obs: list[dict] = []
    map_conf = _mapping_confidence(plan)
    now = datetime.now().astimezone()

    def base(canonical_field, idx, header, raw):
        return {
            "canonical_field": canonical_field,
            "raw_value": None if raw is None else str(raw)[:4000],
            "original_header": None if header is None else str(header)[:512],
            "source_file": source_file, "source_sheet": sheet_name,
            "source_row": row_no, "source_column": idx,
            "engine_version": ENGINE_VERSION, "observed_at": now,
        }

    # --- column-level: headers whose target depended on sheet context --------
    for idx, decision in (plan.semantic_decisions or {}).items():
        raw = raw_row[idx] if idx is not None and idx < len(raw_row) else None
        if raw in (None, ""):
            continue
        header = plan.header[idx] if idx < len(plan.header) else None
        o = base(_label_for(plan, idx), idx, header, raw)
        o.update({
            "semantic_type": decision.get("semantic_type", S.UNRESOLVED),
            "parsed_value": C.clean_text(raw),
            "confidence": float(decision.get("confidence", 0.0)),
            "needs_review": bool(decision.get("needs_review", True)),
            "evidence": _evidence(decision, map_conf, resolved_target=plan.index_to_target.get(idx)),
        })
        obs.append(o)

    # --- value-level: Date and Size -----------------------------------------
    for field, (column, kind) in _VALUE_LEVEL.items():
        raw = fields.get(field)
        if raw in (None, ""):
            continue
        decision = sheet_semantics.get(field) or {}
        idx = decision.get("_column_index")
        header = decision.get("_header")
        o = base(field, idx, header, raw)
        o.update({
            "semantic_type": decision.get("semantic_type", S.UNRESOLVED),
            "confidence": float(decision.get("confidence", 0.0)),
            "needs_review": bool(decision.get("needs_review", True)),
        })

        parsed = row.get(column)
        o["parsed_value"] = None if parsed is None else str(parsed)
        if kind == "date":
            o["parsed_date"] = parsed if isinstance(parsed, datetime) else None
            # A date that arrived but would not parse is a defect worth seeing,
            # not a silent NULL. raw_value still holds the original.
            if parsed is None:
                o["needs_review"] = True
            o["evidence"] = _evidence(decision, map_conf,
                                      extra={"parsed": parsed is not None})
        else:
            detail = C.clean_size_detailed(raw, header)
            o["parsed_number"] = detail["value"]
            o["parsed_value"] = None if detail["value"] is None else str(detail["value"])
            # The unit actually applied beats the header-derived reading: the
            # value stating its own unit is the source speaking about that cell.
            if detail["original_unit"]:
                o["semantic_type"] = detail["original_unit"]
            # An assumed unit is a house rule, not a measurement. Say so, and
            # keep it reviewable however confident the header reading looked.
            if detail["unit_source"] == "assumed":
                o["needs_review"] = True
            o["evidence"] = _evidence(decision, map_conf, extra={
                "original_unit": detail["original_unit"],
                "normalized_unit": detail["normalized_unit"],
                "unit_source": detail["unit_source"],
                "converted": detail["converted"],
                "conversion_factor": detail["conversion_factor"],
                "conversion_rule_version": detail["rule_version"],
            })
        obs.append(o)

    return obs


def _label_for(plan, idx: int) -> str:
    """The raw header, normalised, as the observation's canonical_field.

    Column-level ambiguity is about the HEADER ("AREA"), not about a canonical
    field -- the whole question is which canonical field it should become -- so
    the header is what identifies the observation.
    """
    h = plan.header[idx] if idx < len(plan.header) else None
    return (norm_header(h) if h not in (None, "") else f"col{idx}")[:64]


def _evidence(decision: dict, mapping_confidence: float, *, extra: dict | None = None,
              resolved_target: str | None = None) -> dict:
    """Merge the semantic evidence with the mapping evidence.

    Kept as two numbers rather than one blended score: they answer different
    questions -- "is this column what we think it is" and "does this value mean
    what we think it means" -- and averaging them would hide a confident mapping
    of an unreadable value, which is exactly the case worth seeing.
    """
    ev = dict(decision.get("evidence") or {})
    ev["mapping_confidence"] = mapping_confidence
    ev["semantic_confidence"] = float(decision.get("confidence", 0.0))
    if resolved_target:
        ev["resolved_target"] = resolved_target
    if extra:
        ev.update(extra)
    return ev
