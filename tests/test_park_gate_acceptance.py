# Park Gate: the real delivery workflow, as a regression fixture
"""Acceptance test against the anonymised Park Gate / Noor artifacts.

The fixtures are the two real delivery files with every personal value
deterministically pseudonymised (equal inputs -> equal fakes), so the duplicate
structure, the verbatim overlap between the two files and every row count are
the real ones, while no name, phone or email from the source is in the repo.

The numbers below are NOT hardcoded expectations that the pipeline is bent to
produce. They are DERIVED from the fixture at test time and then checked
against what the directive stated -- the same three figures, from the data.

What this test refuses to do is reconstruct the historical dedup rule. No
tested key reproduces the 434 delivered rows (ADR-005), so the test asserts
that our declared rule does NOT match history, and that we say so.
"""
from pathlib import Path

import openpyxl
import pytest

from engine.delivery import deliver, load_template

FX = Path(__file__).parent / "fixtures"
RAW = FX / "park_gate_noor_raw.xlsx"
UNIQUE = FX / "park_gate_noor_unique.xlsx"

# The Noor columns, mapped back to canonical so the delivery engine can run
# over the raw artifact as though it were canonical records.
NOOR_TO_CANONICAL = {
    "Contact Phone": "Mobile 1", "Contact NAME": "Name", "Contact Email": "Email Address",
    "Second Phone": "Mobile 2", "PROJECT": "Project", "BUILDING NAME": "Building/Cluster",
    "FLAT ": "Unit Number", "PLOT NUMBER": "Plot Number", "SIZE": "Size",
    "ROOMS DESCRIPTION": "Bedroom",
}


def _load(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb["Sheet1"]
    rows = list(ws.iter_rows(min_row=1, values_only=True))
    wb.close()
    return list(rows[0]), [list(r) for r in rows[1:]]


def _norm_row(r):
    return tuple("" if c is None else str(c).strip().upper() for c in r)


@pytest.fixture(scope="module")
def artifacts():
    if not (RAW.exists() and UNIQUE.exists()):
        pytest.skip("Park Gate fixtures not present")
    hdr_r, raw = _load(RAW)
    hdr_u, uni = _load(UNIQUE)
    return hdr_r, raw, hdr_u, uni


# --------------------------------------------------------------------------
# The three figures, derived from the data
# --------------------------------------------------------------------------

def test_raw_count_is_derived_from_the_raw_artifact(artifacts):
    _, raw, _, _ = artifacts
    derived_raw = len(raw)
    assert derived_raw == 2348, f"raw artifact has {derived_raw} rows"


def test_unique_count_is_derived_from_the_delivered_artifact(artifacts):
    _, _, _, uni = artifacts
    derived_unique = len(uni)
    assert derived_unique == 434


def test_removed_count_is_the_difference_not_a_typed_number(artifacts):
    _, raw, _, uni = artifacts
    derived_removed = len(raw) - len(uni)
    assert derived_removed == 1914


def test_both_artifacts_share_the_same_eleven_columns(artifacts):
    hdr_r, _, hdr_u, _ = artifacts
    assert hdr_r == hdr_u
    assert len(hdr_r) == 11
    assert "FLAT " in hdr_r, "the trailing space is part of the client format"


# --------------------------------------------------------------------------
# Traceability: retained rows come from raw, unchanged
# --------------------------------------------------------------------------

def test_every_delivered_row_exists_verbatim_in_raw(artifacts):
    """The historical step was a filter, not a transform. No raw value was
    rewritten on the way through."""
    _, raw, _, uni = artifacts
    raw_set = {_norm_row(r) for r in raw}
    missing = [r for r in uni if _norm_row(r) not in raw_set]
    assert not missing, f"{len(missing)} delivered rows do not trace to a raw row"


def test_no_delivered_row_was_altered_relative_to_raw(artifacts):
    _, raw, _, uni = artifacts
    raw_norm = {_norm_row(r): r for r in raw}
    for u in uni:
        src = raw_norm[_norm_row(u)]
        assert [("" if c is None else str(c)) for c in src] == \
               [("" if c is None else str(c)) for c in u]


# --------------------------------------------------------------------------
# The declared rule runs, accounts for every row, and does NOT claim history
# --------------------------------------------------------------------------

def _as_canonical(hdr, rows):
    out = []
    for i, r in enumerate(rows):
        rec = {"_record_id": i, "_source_file": RAW.name, "_source_sheet": "Sheet1",
               "_source_row": i + 2}
        for h, v in zip(hdr, r):
            cf = NOOR_TO_CANONICAL.get(h)
            if cf:
                rec[cf] = v
        out.append(rec)
    return out


def test_the_declared_rule_accounts_for_every_raw_row(artifacts):
    hdr, raw, _, _ = artifacts
    res = deliver(_as_canonical(hdr, raw), load_template("noor_park_gate"),
                  context={"area": "Al Kifaf - Park Gate Residences"})
    s = res.stats
    assert s["raw"] == len(raw) == 2348
    assert s["raw"] == s["unique"] + s["excluded_total"]
    assert s["unique"] == s["valid"] + s["invalid"]
    assert len(res.rows) == s["unique"]
    assert len(res.excluded) == s["excluded_total"]


def test_every_excluded_raw_row_has_a_reason(artifacts):
    hdr, raw, _, _ = artifacts
    res = deliver(_as_canonical(hdr, raw), load_template("noor_park_gate"))
    for e in res.excluded:
        assert e["reason"] in {"duplicate", "missing_required_any", "filtered"}
        assert e["detail"]
        assert e["record_id"] is not None and e["source_row"] is not None


def test_nothing_is_silently_deleted_every_raw_row_is_delivered_or_excluded(artifacts):
    hdr, raw, _, _ = artifacts
    res = deliver(_as_canonical(hdr, raw), load_template("noor_park_gate"))
    delivered = {l["source_index"] for l in res.lineage}
    excluded = {e["source_index"] for e in res.excluded}
    assert not (delivered & excluded)
    assert delivered | excluded == set(range(len(raw)))


def test_the_declared_rule_does_not_falsely_reconstruct_history(artifacts):
    """The single most important assertion in this file.

    The rule that produced the 434-row delivery is NOT recoverable from the
    artifacts (ADR-005). If our declared rule happened to produce 434, that
    would be a coincidence to investigate, not a success. It does not, and the
    summary names OUR rule rather than implying it is theirs.
    """
    hdr, raw, _, uni = artifacts
    res = deliver(_as_canonical(hdr, raw), load_template("noor_park_gate"))
    assert res.stats["unique"] != len(uni), (
        "declared rule reproduced the historical count exactly -- verify this "
        "is not a coincidence before trusting it")
    assert "one row per distinct ['Mobile 1']" in res.summary_text
    assert "history" not in res.summary_text.lower()
    assert res.stats["dedup_rule"].startswith("one row per distinct")


def test_the_summary_numbers_are_the_runs_numbers(artifacts):
    hdr, raw, _, _ = artifacts
    res = deliver(_as_canonical(hdr, raw), load_template("noor_park_gate"),
                  context={"area": "Al Kifaf - Park Gate Residences"})
    s = res.stats
    assert f"Raw: {s['raw']}" in res.summary_text
    assert f"Unique: {s['unique']}" in res.summary_text
    assert f"Valid: {s['valid']}" in res.summary_text
    assert f"Invalid: {s['invalid']}" in res.summary_text
    assert "Al Kifaf - Park Gate Residences" in res.summary_text


# --------------------------------------------------------------------------
# SIZE: unlabelled square metres, and we never pretend otherwise
# --------------------------------------------------------------------------

def test_the_artifacts_size_column_behaves_like_square_metres(artifacts):
    """Formalises the discovery. Median 2-bedroom SIZE is impossible as sq ft
    and ordinary as sq m. This is a property of THIS artifact, recorded here so
    the template's declared unit is evidence-backed -- not a rule about every
    unlabelled SIZE everywhere."""
    import statistics
    hdr, raw, _, _ = artifacts
    H = {h: i for i, h in enumerate(hdr)}
    two_br = [float(r[H["SIZE"]]) for r in raw
              if str(r[H["ROOMS DESCRIPTION"]] or "").strip() == "2 B/R"
              and r[H["SIZE"]] not in (None, "")]
    assert len(two_br) > 500
    med = statistics.median(two_br)
    assert 100 < med < 250, f"median 2 B/R SIZE {med} is not in the sq m band"
    assert not (900 < med < 2500), "would be sq ft"


def test_the_fixture_contains_no_real_personal_data(artifacts):
    """The reason the fixture can exist in the repo at all."""
    import re
    _, raw, _, uni = artifacts
    email = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
    for r in raw + uni:
        for c in r:
            s = "" if c is None else str(c)
            m = email.search(s)
            assert not m or m.group(0).endswith("@example.com"), s
            if s.startswith("PERSON "):
                assert len(s) == len("PERSON ") + 8
