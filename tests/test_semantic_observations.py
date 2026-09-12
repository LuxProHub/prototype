# Semantic reading of fields whose value is clear and whose meaning is not
"""Tests for the semantic layer: which kind of date, which unit, which locality.

Three of the 23 canonical fields carry an unambiguous value and an ambiguous
meaning, and the old pipeline resolved all three by picking one reading and
writing it into a flat column. `record_date` cannot say which kind of date it
holds; a sq.m column read as sq.ft is wrong by 10.76x with nothing left to
detect it by; AREA was mapped to Community on every sheet in the corpus.

These tests are behavioural in the same spirit as test_engine_correctness.py:
each one names the specific collapse it prevents.
"""
from engine import semantics as S
from engine import validation as V
from engine.mapping import ColumnPlan, resolve_ambiguities


# --------------------------------------------------------------------------
# Dates: four source semantics that must not become one
# --------------------------------------------------------------------------

def test_a_transaction_date_is_recognised_from_its_companions():
    r = S.infer("Date", "Transaction Date", neighbours={"Procedure Value"})
    assert r["semantic_type"] == "transaction_date"
    assert not r["needs_review"]


def test_registration_and_handover_dates_stay_distinct():
    reg = S.infer("Date", "Registration Date", neighbours={"Plot Reg. No"})
    hand = S.infer("Date", "Handover Date", neighbours={"Project"})
    assert reg["semantic_type"] == "registration_date"
    assert hand["semantic_type"] == "handover_date"
    assert reg["semantic_type"] != hand["semantic_type"]


def test_lease_start_and_end_do_not_collapse_into_each_other():
    """Both headers contain "lease" and both end in "date".

    The longer, more specific phrase has to win, or every tenancy in the corpus
    ends up with two identical dates.
    """
    start = S.infer("Date", "Lease Start Date", companions=["Lease End Date"])
    end = S.infer("Date", "Lease End Date", companions=["Lease Start Date"])
    assert start["semantic_type"] == "lease_start_date"
    assert end["semantic_type"] == "lease_end_date"


def test_a_bare_date_header_is_never_guessed():
    """The case the whole model exists for.

    A column called just "Date", on a sheet that says nothing else about it,
    is genuinely unknowable. Picking one of the four readings would be the
    silent collapse that made record_date uninterpretable in the first place.
    """
    r = S.infer("Date", "Date")
    assert r["semantic_type"] == S.UNRESOLVED
    assert r["needs_review"]
    assert r["confidence"] == 0.0


def test_an_unresolved_reading_still_explains_itself():
    r = S.infer("Date", "Date")
    assert r["evidence"]["reason"]
    assert "scores" in r["evidence"]


def test_evidence_names_the_signal_that_decided_it():
    r = S.infer("Date", "Handover Date", neighbours={"Project"})
    signals = " ".join(r["evidence"]["signals"]).lower()
    assert "handover" in signals
    assert r["evidence"]["rule"] == "signal_scoring"


# --------------------------------------------------------------------------
# Size: the 10.76x error
# --------------------------------------------------------------------------

def test_a_unit_stated_in_the_value_is_read_from_the_value():
    """"Area" says nothing; "1,250 sq.m" says everything."""
    r = S.infer("Size", "Area", value_hint="1,250 sq.m")
    assert r["semantic_type"] == "sqm"


def test_a_sqft_header_reads_as_sqft():
    assert S.infer("Size", "Size (sq.ft)")["semantic_type"] == "sqft"


def test_an_unsignalled_size_takes_the_market_default_but_is_flagged():
    """sq ft is the UAE convention, so it is the documented house rule.

    It is still only a house rule, so the reading goes to review instead of
    being presented as though the source had said so.
    """
    r = S.infer("Size", "Size")
    assert r["semantic_type"] == "sqft"
    assert r["needs_review"]
    assert r["evidence"]["rule"] == "default_type"


# --------------------------------------------------------------------------
# AREA: 685 occurrences, and the two curated workbooks disagree
# --------------------------------------------------------------------------

def _plan(headers, targets):
    return ColumnPlan(index_to_target=dict(targets), header=list(headers))


def test_area_becomes_sub_community_when_the_sheet_has_its_own_community():
    """The per-file rule, on the shape that makes it obvious.

    A sheet carrying both COMMUNITY and AREA is not using them for the same
    level; AREA is the one below. Mapping both to Community -- which is what
    the engine did for every sheet in the corpus -- silently discarded the
    finer locality.
    """
    plan = _plan(["COMMUNITY", "AREA"], {0: "Community", 1: "Community"})
    resolve_ambiguities(plan, {0: ["Business Bay"], 1: ["Executive Towers"]})
    assert plan.index_to_target[1] == "Sub-Community"
    assert plan.index_to_target[0] == "Community"


def test_area_stays_community_when_it_is_the_only_locality_on_the_sheet():
    """No sibling geography means no evidence, so behaviour is unchanged.

    Preserving the historical reading matters: changing it would move data
    between columns on files that gave no reason to.
    """
    plan = _plan(["NAME", "AREA"], {0: "Name", 1: "Community"})
    resolve_ambiguities(plan, {0: ["Ali"], 1: ["Business Bay"]})
    assert plan.index_to_target[1] == "Community"


def test_an_unevidenced_area_reading_is_marked_for_review():
    plan = _plan(["NAME", "AREA"], {0: "Name", 1: "Community"})
    resolve_ambiguities(plan, {0: ["Ali"], 1: ["Business Bay"]})
    assert plan.semantic_decisions[1]["needs_review"]


def test_a_numeric_area_is_still_a_size_not_a_locality():
    """The pre-existing numeric branch must survive the change."""
    plan = _plan(["AREA"], {0: "Community"})
    resolve_ambiguities(plan, {0: [1200, 980, 1450, 2300]})
    assert plan.index_to_target[0] == "Size"
    # A size reading is not a locality decision, so it records none.
    assert 0 not in plan.semantic_decisions


def test_the_area_decision_reaches_the_mapping_report():
    """The decision has to be visible to a reviewer without reading the rows."""
    plan = _plan(["COMMUNITY", "AREA"], {0: "Community", 1: "Community"})
    resolve_ambiguities(plan, {0: ["Business Bay"], 1: ["Executive Towers"]})
    report = plan.report()
    assert "AREA" in report["semantic_decisions"]
    assert report["semantic_decisions"]["AREA"]["semantic_type"] == "sub_community"
    assert report["semantic_decisions"]["AREA"]["confidence"] > 0


# --------------------------------------------------------------------------
# Backward compatibility: the 23-field contract is untouched
# --------------------------------------------------------------------------

def test_transform_still_produces_the_flat_record_date():
    """The semantic layer sits alongside the canonical columns, not in front.

    Every existing consumer -- the API, exports, search -- reads record_date,
    and none of them had to change.
    """
    row, flags = V.transform({"Date": "2024-03-15", "Name": "Ali"}, {})
    assert row["record_date"] is not None
    assert row["record_date"].year == 2024
    assert row["record_date"].month == 3


def test_an_unparseable_date_still_flags_and_still_keeps_the_row():
    row, flags = V.transform({"Date": "not a date", "Name": "Ali"}, {})
    assert row["record_date"] is None
    assert "date_unparseable" in flags


# --------------------------------------------------------------------------
# Config, not code
# --------------------------------------------------------------------------

def test_date_types_come_from_configuration():
    """Adding a date_type must be an edit to JSON, never to Python."""
    names = S.type_names("Date")
    assert "transaction_date" in names
    assert "registration_date" in names
    assert "handover_date" in names
    assert len(names) >= 4


def test_an_unknown_field_resolves_to_nothing_rather_than_raising():
    r = S.infer("Bedroom", "BEDS")
    assert r["semantic_type"] == S.UNRESOLVED
    assert r["needs_review"]
