# Delivery templates: configuration in, client format out, nothing invented
"""Tests for engine/delivery.py and the template contract in ADR-005.

The three refusals the module exists for are each pinned here:

  - no unit conversion that was not declared on BOTH sides (the 10.76x error)
  - no dedup rule that was not declared (and no claim to match history)
  - no summary number that was not computed by the run

Plus lineage: every output row traces to its record, every excluded row says
why, and nothing in the input is mutated.
"""
import copy

import pytest

from engine.cleaning import SQM_TO_SQFT_MULT
from engine.delivery import (
    TemplateError, convert_unit, deliver, is_uae_mobile, load_template,
    template_from_dict,
)

SQFT_PER_SQM = SQM_TO_SQFT_MULT  # 10.7639...


def _rec(i, **kw):
    base = {"_record_id": i, "_source_file": "f.xlsx", "_source_sheet": "S", "_source_row": i + 2,
            "Name": f"Person {i}", "Mobile 1": f"+9715012345{i:02d}", "Unit Number": str(100 + i),
            "Size": 1076.39, "Project": "Park Gate Residences"}
    base.update(kw)
    return base


def _template(**over):
    raw = {
        "name": "t", "version": 1, "description": "",
        "columns": [
            {"output": "Phone", "canonical_field": "Mobile 1"},
            {"output": "Name", "canonical_field": "Name"},
            {"output": "Unit", "canonical_field": "Unit Number"},
            {"output": "Size", "canonical_field": "Size"},
        ],
        "dedup": {"key": ["Mobile 1"], "keep": "first", "require_any": ["Mobile 1"]},
        "validation": {"required": ["Name"], "phone_fields": ["Mobile 1"]},
        "summary": {"greeting": "Hi", "area_label": "Area"},
    }
    raw.update(over)
    return template_from_dict(raw)


# --------------------------------------------------------------------------
# The 10.76x error
# --------------------------------------------------------------------------

def test_a_declared_sqft_to_sqm_conversion_is_exact():
    v, tr = convert_unit(1076.39, "sqft", "sqm", 2)
    assert v == pytest.approx(100.0, abs=0.01)
    assert tr["factor"] == pytest.approx(1 / SQFT_PER_SQM)
    assert tr["raw_value"] == 1076.39 and tr["result"] == v


def test_a_declared_sqm_to_sqft_conversion_is_exact():
    v, tr = convert_unit(100, "sqm", "sqft", 2)
    assert v == pytest.approx(1076.39, abs=0.01)
    assert tr["factor"] == pytest.approx(SQFT_PER_SQM)


def test_the_round_trip_does_not_drift():
    """sqft -> sqm -> sqft must land back on the input, or every reprocess drifts."""
    a, _ = convert_unit(1573.3, "sqft", "sqm", None)
    b, _ = convert_unit(a, "sqm", "sqft", None)
    assert b == pytest.approx(1573.3, rel=1e-9)


def test_an_undeclared_size_is_passed_through_and_flagged_never_converted():
    """The Noor artifact's shape: SIZE with no unit stated. Refuse to guess."""
    t = _template()  # Size column has no units declared
    res = deliver([_rec(0, Size=1076.39)], t)
    assert res.rows[0]["Size"] == 1076.39, "value was altered without a declared unit"
    tr = [x for x in res.lineage[0]["transformations"] if x["canonical_field"] == "Size"]
    assert tr and tr[0]["kind"] == "passthrough" and tr[0]["unit_declared"] is False


def test_a_one_sided_unit_declaration_is_rejected_at_load():
    """source_unit without delivery_unit (or vice versa) is exactly how a 10.76x
    error enters a delivery. It must not load."""
    with pytest.raises(TemplateError):
        template_from_dict({"name": "bad", "columns": [
            {"output": "Size", "canonical_field": "Size", "delivery_unit": "sqm"}]})
    with pytest.raises(TemplateError):
        template_from_dict({"name": "bad", "columns": [
            {"output": "Size", "canonical_field": "Size", "source_unit": "sqft"}]})


def test_an_unknown_conversion_is_rejected_at_load():
    with pytest.raises(TemplateError):
        template_from_dict({"name": "bad", "columns": [
            {"output": "Size", "canonical_field": "Size",
             "source_unit": "acre", "delivery_unit": "sqm"}]})


def test_a_non_numeric_size_converts_to_null_and_says_so():
    """Never silently zero. Never silently drop."""
    v, tr = convert_unit("n/a", "sqft", "sqm", 2)
    assert v is None and tr["error"] == "not numeric" and tr["raw_value"] == "n/a"


def test_the_noor_template_converts_canonical_sqft_to_sqm():
    """The actual client format, end to end: 1,573.3 sq ft -> 146.16 sq m,
    which is the median 2-bedroom in the real artifact."""
    t = load_template("noor_park_gate")
    res = deliver([_rec(0, Size=1573.3, **{"Unit Number": "1501"})], t)
    assert res.rows[0]["SIZE"] == pytest.approx(146.16, abs=0.01)
    tr = [x for x in res.lineage[0]["transformations"] if x["column"] == "SIZE"][0]
    assert tr["source_unit"] == "sqft" and tr["delivery_unit"] == "sqm"
    assert tr["raw_value"] == 1573.3


def test_the_catastrophic_double_conversion_cannot_happen():
    """Canonical is ALWAYS sqft. If a value were converted sqm->sqft on ingest
    and then sqft->sqm on delivery, it must come out where it went in -- and
    a template can never apply the ingest conversion a second time."""
    from engine.cleaning import clean_size
    stored = clean_size("100 sqm")                  # ingest: -> 1076.39 sqft
    assert stored == pytest.approx(1076.39, abs=0.01)
    t = load_template("noor_park_gate")
    out = deliver([_rec(0, Size=stored)], t).rows[0]["SIZE"]
    assert out == pytest.approx(100.0, abs=0.01)    # delivery: -> 100 sqm
    assert out != pytest.approx(1076.39 * SQFT_PER_SQM, rel=0.01), "converted twice"


# --------------------------------------------------------------------------
# Dedup is declared, counted, and never claims to be history
# --------------------------------------------------------------------------

def test_duplicates_are_excluded_with_a_reason_and_a_key_not_deleted():
    t = _template()
    res = deliver([_rec(0), _rec(1, **{"Mobile 1": "+971501234500"})], t)  # same phone as rec 0
    assert res.stats["unique"] == 1 and res.stats["excluded_duplicate"] == 1
    ex = res.excluded[0]
    assert ex["reason"] == "duplicate" and ex["record_id"] == 1
    assert ex["key"] == ["971501234500"]


def test_rows_with_no_contact_are_excluded_before_dedup_with_their_own_reason():
    t = _template()
    res = deliver([_rec(0), _rec(1, **{"Mobile 1": None})], t)
    reasons = {e["reason"] for e in res.excluded}
    assert reasons == {"missing_required_any"}
    assert res.stats["excluded_missing_required_any"] == 1
    assert res.stats["excluded_duplicate"] == 0


def test_phone_keys_collide_across_formatting():
    t = _template()
    res = deliver([_rec(0, **{"Mobile 1": "+971 50 123 4500"}),
                   _rec(1, **{"Mobile 1": "00971501234500"})], t)
    assert res.stats["unique"] == 1


def test_an_all_blank_key_is_not_a_duplicate_of_another_all_blank_key():
    t = _template(dedup={"key": ["Unit Number"], "keep": "first"})
    res = deliver([_rec(0, **{"Unit Number": None}), _rec(1, **{"Unit Number": ""})], t)
    assert res.stats["unique"] == 2, "blank keys were treated as equal"


def test_a_template_with_no_dedup_rule_says_so_rather_than_reporting_zero_findings():
    t = _template(dedup={"key": []})
    res = deliver([_rec(0), _rec(1, **{"Mobile 1": "+971501234500"})], t)
    assert res.stats["unique"] == 2
    assert any("no dedup key" in w for w in res.warnings)
    assert "no dedup rule" in res.summary_text


def test_the_summary_names_the_rule_it_used():
    res = deliver([_rec(0)], _template())
    assert "one row per distinct ['Mobile 1']" in res.summary_text
    assert "history" not in res.summary_text.lower()


# --------------------------------------------------------------------------
# Every number is computed; the accounting always balances
# --------------------------------------------------------------------------

def test_row_accounting_balances_on_a_messy_batch():
    recs = [_rec(i) for i in range(10)]
    recs[3]["Mobile 1"] = recs[0]["Mobile 1"]          # dup
    recs[4]["Mobile 1"] = None                          # no contact
    recs[5]["Name"] = None                              # invalid (required)
    recs[6]["Mobile 1"] = "12345"                       # invalid phone
    res = deliver(recs, _template())
    s = res.stats
    assert s["raw"] == 10
    assert s["raw"] == s["unique"] + s["excluded_total"]
    assert s["unique"] == s["valid"] + s["invalid"]
    assert s["excluded_duplicate"] == 1 and s["excluded_missing_required_any"] == 1
    assert s["invalid"] == 2
    for line in ("Raw: 10", "Unique: 8", "Valid: 6", "Invalid: 2"):
        assert line in res.summary_text


def test_invalid_rows_are_delivered_and_marked_not_hidden():
    res = deliver([_rec(0, Name=None)], _template())
    assert len(res.rows) == 1
    assert res.lineage[0]["validation"] == "invalid"
    assert "missing Name" in res.lineage[0]["problems"]


# --------------------------------------------------------------------------
# Lineage and immutability
# --------------------------------------------------------------------------

def test_every_output_row_traces_to_its_record():
    recs = [_rec(i) for i in range(5)]
    res = deliver(recs, _template())
    for out, lin in zip(res.rows, res.lineage):
        assert lin["record_id"] is not None
        assert lin["source_file"] == "f.xlsx" and lin["source_row"] is not None
        assert out["Name"] == recs[lin["source_index"]]["Name"]


def test_the_input_records_are_not_mutated():
    recs = [_rec(0, Size=1573.3)]
    before = copy.deepcopy(recs)
    deliver(recs, load_template("noor_park_gate"))
    assert recs == before


def test_client_column_quirks_are_reproduced_verbatim():
    """'FLAT ' with the trailing space is the client's header. So it is ours."""
    t = load_template("noor_park_gate")
    assert "FLAT " in t.output_columns()
    assert list(deliver([_rec(0)], t).rows[0].keys()) == t.output_columns()


def test_literal_columns_are_emitted_without_a_canonical_source():
    t = load_template("noor_park_gate")
    assert deliver([_rec(0)], t).rows[0]["FLOOR"] == ""


# --------------------------------------------------------------------------
# Filters and phone validation
# --------------------------------------------------------------------------

def test_filters_exclude_with_a_reason():
    t = _template(filters=[{"field": "Project", "op": "eq", "value": "Park Gate Residences"}])
    res = deliver([_rec(0), _rec(1, Project="Elsewhere")], t)
    assert res.stats["unique"] == 1
    assert res.excluded[0]["reason"] == "filtered"


def test_an_unknown_filter_op_is_an_error_not_a_silent_pass():
    t = _template(filters=[{"field": "Project", "op": "regex", "value": "x"}])
    with pytest.raises(TemplateError):
        deliver([_rec(0)], t)


@pytest.mark.parametrize("v,ok", [
    ("+971501234567", True), ("0501234567", True), ("00971501234567", True),
    ("+971 50 123 4567", True), ("4323766", False), ("971412345678", False),
    ("+966501234567", False), ("", False), (None, False),
])
def test_uae_mobile_shape(v, ok):
    assert is_uae_mobile(v) is ok
