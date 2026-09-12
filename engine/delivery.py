"""Delivery templates: turning canonical records into a client's format.

A template is configuration, never code. It declares which canonical fields go
out, under what names, in what order, in what unit, deduplicated how, validated
how, and what the covering summary says. Core logic never references a client's
column names -- see ADR-005 for why, and for the Park Gate evidence.

The three things this module is built to refuse:

  1. A unit conversion nobody declared. `SIZE` in the Noor artifact is square
     metres with nothing in the file saying so. Canonical storage is square
     feet. A template that wants metres says so; a template that says nothing
     gets the canonical value untouched and a lineage flag, never a guess.
     Getting this wrong is a 10.76x error that looks like a plausible number.

  2. A dedup rule nobody declared. The rule that produced the historical
     Park Gate delivery could not be recovered from the artifacts (no tested
     key reproduces 434 rows). The template states its key; the summary reports
     counts under THAT rule, by name, and never claims to match history.

  3. A statistic nobody computed. Every number in the covering note is emitted
     by the run that produced the file. Nothing is typed in.

Every output row carries lineage back to the canonical record it came from, and
every excluded row carries the reason it was excluded. A delivery that discards
its own rejects cannot be audited.

Pure: takes dicts, returns dicts. Reading records and writing .xlsx belong to
the API layer.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from .cleaning import SQM_TO_SQFT_MULT

TEMPLATES_DIR = Path(__file__).parent / "resources" / "templates"

# Every conversion this module will perform. Declared, finite, and symmetric.
# Anything not in this table is not a conversion the engine knows how to do,
# and asking for it is a template error, not a silent pass-through.
_CONVERSIONS = {
    ("sqm", "sqft"): SQM_TO_SQFT_MULT,
    ("sqft", "sqm"): 1.0 / SQM_TO_SQFT_MULT,
}
# The unit every canonical size is stored in. Templates converting FROM
# canonical start here; see cleaning.clean_size_detailed.
CANONICAL_SIZE_UNIT = "sqft"

_DIGITS = re.compile(r"\D+")


class TemplateError(ValueError):
    """A template asked for something the engine will not do."""


# --------------------------------------------------------------------------
# template shape
# --------------------------------------------------------------------------
@dataclass
class ColumnSpec:
    output: str                     # the client's column name, verbatim
    canonical_field: str | None     # which of the 23 (None = literal/blank)
    source_unit: str | None = None  # unit of the canonical value
    delivery_unit: str | None = None
    rounding: int | None = None     # decimal places after conversion
    null_value: str = ""            # what an absent value is written as
    literal: str | None = None      # constant column, when canonical_field is None


@dataclass
class DedupSpec:
    key: list[str] = field(default_factory=list)   # canonical fields
    keep: str = "first"                            # first | last
    # A row missing every one of these is excluded BEFORE dedup, with its own
    # reason, so "no contact" and "duplicate" stay distinguishable in the stats.
    require_any: list[str] = field(default_factory=list)


@dataclass
class ValidationSpec:
    required: list[str] = field(default_factory=list)      # canonical fields
    phone_fields: list[str] = field(default_factory=list)  # validated as UAE mobiles


@dataclass
class Template:
    name: str
    version: int
    description: str
    columns: list[ColumnSpec]
    dedup: DedupSpec
    validation: ValidationSpec
    filters: list[dict] = field(default_factory=list)      # [{field, op, value}]
    summary: dict = field(default_factory=dict)            # greeting + label fields
    filename_pattern: str = "{template}_{area}.xlsx"
    output_format: str = "xlsx"

    def output_columns(self) -> list[str]:
        return [c.output for c in self.columns]


def load_template(name_or_path: str | Path) -> Template:
    """Read a template from JSON and validate it against what the engine can do."""
    p = Path(name_or_path)
    if not p.exists():
        p = TEMPLATES_DIR / f"{name_or_path}.json"
    raw = json.loads(p.read_text(encoding="utf8"))
    return template_from_dict(raw)


def template_from_dict(raw: dict) -> Template:
    cols = [ColumnSpec(**c) for c in raw["columns"]]
    for c in cols:
        if c.canonical_field is None and c.literal is None:
            # A blank column is allowed, but only if the template says so:
            # literal "" rather than a missing field.
            c.literal = ""
        if (c.source_unit or c.delivery_unit) and not (c.source_unit and c.delivery_unit):
            raise TemplateError(
                f"column {c.output!r}: a unit conversion needs BOTH source_unit "
                f"and delivery_unit (got {c.source_unit!r} -> {c.delivery_unit!r}). "
                "A one-sided unit is exactly how a 10.76x error enters a delivery.")
        if c.source_unit and c.delivery_unit and c.source_unit != c.delivery_unit \
                and (c.source_unit, c.delivery_unit) not in _CONVERSIONS:
            raise TemplateError(
                f"column {c.output!r}: no known conversion {c.source_unit} -> "
                f"{c.delivery_unit}. Known: {sorted(_CONVERSIONS)}")
    t = Template(
        name=raw["name"], version=int(raw.get("version", 1)),
        description=raw.get("description", ""),
        columns=cols,
        dedup=DedupSpec(**raw.get("dedup", {})),
        validation=ValidationSpec(**raw.get("validation", {})),
        filters=list(raw.get("filters", [])),
        summary=dict(raw.get("summary", {})),
        filename_pattern=raw.get("filename_pattern", "{template}_{area}.xlsx"),
        output_format=raw.get("output_format", "xlsx"),
    )
    if not t.dedup.key:
        # Deliberate: a delivery with no dedup rule at all is legal, but it has
        # to be visibly legal. An empty key means "no deduplication", and the
        # summary will say "Duplicate: 0 (no dedup rule)" rather than a number
        # that looks like a finding.
        pass
    return t


# --------------------------------------------------------------------------
# the run
# --------------------------------------------------------------------------
@dataclass
class DeliveryResult:
    template: str
    template_version: int
    rows: list[dict]                 # output rows, keyed by output column name
    lineage: list[dict]              # parallel to rows: where each came from
    excluded: list[dict]             # {index, record_id, reason, detail, key}
    stats: dict                      # every number the summary uses
    summary_text: str
    filename: str
    warnings: list[str] = field(default_factory=list)


def deliver(records: list[dict], template: Template, *, context: dict | None = None) -> DeliveryResult:
    """Run one delivery.

    `records` are dicts keyed by CANONICAL field name ("Name", "Mobile 1"...)
    plus optional provenance keys: `_record_id`, `_source_file`,
    `_source_sheet`, `_source_row`. Nothing in `records` is mutated.
    """
    context = dict(context or {})
    warnings: list[str] = []
    raw_count = len(records)

    # 1. filters ------------------------------------------------------------
    kept, excluded = [], []
    for i, r in enumerate(records):
        why = _filter_reason(r, template.filters)
        if why:
            excluded.append(_excl(i, r, "filtered", why))
        else:
            kept.append((i, r))
    after_filter = len(kept)

    # 2. require_any: rows with no usable contact go out BEFORE dedup ----------
    if template.dedup.require_any:
        still = []
        for i, r in kept:
            if any(_present(r.get(f)) for f in template.dedup.require_any):
                still.append((i, r))
            else:
                excluded.append(_excl(i, r, "missing_required_any",
                                      f"none of {template.dedup.require_any} present"))
        kept = still
    after_require = len(kept)

    # 3. dedup under the DECLARED key -----------------------------------------
    unique: list[tuple[int, dict]] = []
    if template.dedup.key:
        seen: dict[tuple, int] = {}
        for i, r in kept:
            k = tuple(_norm_key(r.get(f)) for f in template.dedup.key)
            if all(x == "" for x in k):
                # A key made entirely of blanks is not a duplicate of anything;
                # it is a row the key cannot see. Kept, and said so.
                unique.append((i, r))
                continue
            if k in seen:
                if template.dedup.keep == "last":
                    # replace the survivor, and record the displaced one
                    prev = seen[k]
                    pi, pr = unique[prev]
                    excluded.append(_excl(pi, pr, "duplicate",
                                          f"superseded by later row on {template.dedup.key}", k))
                    unique[prev] = (i, r)
                else:
                    excluded.append(_excl(i, r, "duplicate",
                                          f"duplicate of earlier row on {template.dedup.key}", k))
                continue
            seen[k] = len(unique)
            unique.append((i, r))
    else:
        unique = list(kept)
        warnings.append("template declares no dedup key; no rows were deduplicated")
    unique_count = len(unique)

    # 4. validation ---------------------------------------------------------
    rows, lineage = [], []
    valid = invalid = 0
    for i, r in unique:
        problems = _validate(r, template.validation)
        out, transforms = _project(r, template)
        lin = {
            "output_index": len(rows), "source_index": i,
            "record_id": r.get("_record_id"),
            "source_file": r.get("_source_file"), "source_sheet": r.get("_source_sheet"),
            "source_row": r.get("_source_row"),
            "transformations": transforms,
            "validation": "valid" if not problems else "invalid",
            "problems": problems,
        }
        if problems:
            invalid += 1
        else:
            valid += 1
        rows.append(out)
        lineage.append(lin)

    stats = {
        "raw": raw_count,
        "filtered": after_filter, "excluded_by_filter": raw_count - after_filter,
        "excluded_missing_required_any": after_filter - after_require,
        "excluded_duplicate": after_require - unique_count,
        "excluded_total": raw_count - unique_count,
        "unique": unique_count,
        "valid": valid, "invalid": invalid,
        "dedup_key": list(template.dedup.key),
        "dedup_rule": (f"one row per distinct {template.dedup.key}, keep {template.dedup.keep}"
                       if template.dedup.key else "none"),
        "require_any": list(template.dedup.require_any),
        "validation_required": list(template.validation.required),
        "phone_fields": list(template.validation.phone_fields),
    }
    assert stats["raw"] == stats["unique"] + stats["excluded_total"], "row accounting drifted"
    assert stats["unique"] == stats["valid"] + stats["invalid"], "validation accounting drifted"

    area = context.get("area") or _infer_area(records) or "delivery"
    fmt_args = {k: _slug(v) for k, v in context.items() if isinstance(v, str)}
    fmt_args["template"] = template.name       # the run's own values win over
    fmt_args["area"] = _slug(area)             # anything the context supplied
    filename = template.filename_pattern.format(**fmt_args)
    return DeliveryResult(
        template=template.name, template_version=template.version,
        rows=rows, lineage=lineage, excluded=excluded, stats=stats,
        summary_text=render_summary(template, stats, area=area),
        filename=filename, warnings=warnings,
    )


# --------------------------------------------------------------------------
# projection: canonical -> client columns, with declared conversions only
# --------------------------------------------------------------------------
def _project(r: dict, t: Template) -> tuple[dict, list[dict]]:
    out, transforms = {}, []
    for c in t.columns:
        if c.canonical_field is None:
            out[c.output] = c.literal if c.literal is not None else ""
            continue
        v = r.get(c.canonical_field)
        if not _present(v):
            out[c.output] = c.null_value
            continue
        if c.source_unit and c.delivery_unit:
            converted, tr = convert_unit(v, c.source_unit, c.delivery_unit, c.rounding)
            out[c.output] = converted if converted is not None else c.null_value
            tr["column"] = c.output
            tr["canonical_field"] = c.canonical_field
            transforms.append(tr)
        else:
            out[c.output] = v
            if c.canonical_field == "Size":
                # A size going out with no unit declared is the exact shape of
                # the Noor artifact. It is passed through unchanged, and the
                # lineage says a human never told us what unit it is in.
                transforms.append({"column": c.output, "canonical_field": "Size",
                                   "kind": "passthrough", "unit_declared": False,
                                   "note": "no unit declared on template; value "
                                           "emitted in canonical unit "
                                           f"({CANONICAL_SIZE_UNIT})"})
    return out, transforms


def convert_unit(value, source_unit: str, delivery_unit: str, rounding: int | None):
    """Convert one value between DECLARED units, recording exactly what happened.

    Returns (converted_value, transformation_record). A value that will not
    parse converts to None and says so; it is never silently zeroed.
    """
    record = {"kind": "unit_conversion", "source_unit": source_unit,
              "delivery_unit": delivery_unit, "raw_value": value,
              "factor": 1.0, "rounding": rounding}
    try:
        f = float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        record["result"] = None
        record["error"] = "not numeric"
        return None, record
    if source_unit == delivery_unit:
        record["result"] = f
        return (round(f, rounding) if rounding is not None else f), record
    factor = _CONVERSIONS.get((source_unit, delivery_unit))
    if factor is None:
        raise TemplateError(f"no conversion {source_unit} -> {delivery_unit}")
    out = f * factor
    if rounding is not None:
        out = round(out, rounding)
    record["factor"] = factor
    record["result"] = out
    return out, record


# --------------------------------------------------------------------------
# validation
# --------------------------------------------------------------------------
def _validate(r: dict, v: ValidationSpec) -> list[str]:
    problems = []
    for f in v.required:
        if not _present(r.get(f)):
            problems.append(f"missing {f}")
    for f in v.phone_fields:
        val = r.get(f)
        if _present(val) and not is_uae_mobile(val):
            problems.append(f"{f} not a valid UAE mobile")
    return problems


def is_uae_mobile(v) -> bool:
    """Syntactic UAE mobile check. Says nothing about whether it rings."""
    d = _DIGITS.sub("", str(v or ""))
    if d.startswith("00971"):
        d = d[2:]
    if d.startswith("971") and len(d) == 12 and d[3] == "5":
        return True
    if d.startswith("05") and len(d) == 10:
        return True
    return False


# --------------------------------------------------------------------------
# summary: numbers from the run, wording from the template
# --------------------------------------------------------------------------
def render_summary(t: Template, stats: dict, *, area: str) -> str:
    s = t.summary or {}
    lines = [s.get("greeting", "Here is the data you requested"), ""]
    lines.append(f"{s.get('area_label', 'Area')}: {area}")
    lines.append("")
    lines.append(f"Raw: {stats['raw']}")
    if stats["excluded_by_filter"]:
        lines.append(f"Filtered out: {stats['excluded_by_filter']}")
    if t.dedup.key:
        # Named after the rule that produced it -- never after a rule that
        # might have produced a historical file.
        label = s.get("duplicate_label", "Duplicate, No number")
        lines.append(f"{label}: {stats['excluded_missing_required_any'] + stats['excluded_duplicate']}")
    else:
        lines.append("Duplicate: 0 (template declares no dedup rule)")
    lines.append(f"Unique: {stats['unique']}")
    lines.append(f"Valid: {stats['valid']}")
    lines.append(f"Invalid: {stats['invalid']}")
    lines.append("")
    lines.append(f"[rule: {stats['dedup_rule']}; validation: "
                 f"required={stats['validation_required'] or 'none'}, "
                 f"phones={stats['phone_fields'] or 'none'}]")
    return "\n".join(lines)


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def _present(v) -> bool:
    return v is not None and str(v).strip() != "" and str(v).strip() != "0"


def _norm_key(v) -> str:
    if not _present(v):
        return ""
    s = str(v).strip().upper()
    # phone-shaped values compare on digits so +971 50, 00971 50 and 971 50
    # all collide. Same prefix handling as is_uae_mobile, or the dedup key
    # and the validator would disagree about which rows are the same person.
    d = _DIGITS.sub("", s)
    if d and len(d) >= 7 and len(d) >= len(s) * 0.6:
        if d.startswith("00"):
            d = d[2:]
        return d
    return " ".join(s.split())


def _filter_reason(r: dict, filters: list[dict]) -> str | None:
    for f in filters:
        fld, op, val = f.get("field"), f.get("op", "eq"), f.get("value")
        actual = r.get(fld)
        ok = {
            "eq": lambda: _norm_key(actual) == _norm_key(val),
            "ne": lambda: _norm_key(actual) != _norm_key(val),
            "contains": lambda: _norm_key(val) in _norm_key(actual),
            "present": lambda: _present(actual),
            "absent": lambda: not _present(actual),
            "in": lambda: _norm_key(actual) in {_norm_key(x) for x in (val or [])},
        }.get(op)
        if ok is None:
            raise TemplateError(f"unknown filter op {op!r}")
        if not ok():
            return f"{fld} {op} {val!r}"
    return None


def _excl(i: int, r: dict, reason: str, detail: str, key=None) -> dict:
    return {"source_index": i, "record_id": r.get("_record_id"),
            "source_file": r.get("_source_file"), "source_row": r.get("_source_row"),
            "reason": reason, "detail": detail,
            "key": list(key) if key is not None else None}


def _infer_area(records: list[dict]) -> str | None:
    """Most common Community/Project across the batch, for the filename only."""
    from collections import Counter
    c = Counter()
    for r in records:
        for f in ("Sub-Community", "Project", "Community"):
            v = r.get(f)
            if _present(v):
                c[str(v).strip()] += 1
                break
    return c.most_common(1)[0][0] if c else None


def _slug(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", str(s)).strip("_") or "delivery"
