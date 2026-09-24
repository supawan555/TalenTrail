"""STEP 5 - consistency / variance.

Each case is scored N times (--runs, default 5) and reported as mean, stddev, min, max.
A case whose spread exceeds --variance-threshold (default 15) is flagged: the model is
temperature=0, so a wide spread means the prompt leaves real room for interpretation.

Offline these are deterministic by construction, which is the point - they prove the
harness itself contributes no variance, so anything seen under --live is the model.
"""

from __future__ import annotations

import pytest

from tests.eval.fixtures.cases import CASES, CASES_BY_NAME, EvalCase
from tests.eval.harness import CaseStats, run_case_n

pytestmark = pytest.mark.variance

# TC-16..18. Deliberately unambiguous, so any drift is the scorer rather than a
# genuinely hard judgement call. Held to a tighter stddev than the general set.
CONSISTENCY_BASELINES = [
    "consistency_baseline_high",
    "consistency_baseline_borderline",
    "consistency_baseline_low",
]

CONSISTENCY_STDDEV_LIMIT = 5.0

# Repeating all 26 cases N times is expensive under --live, so the per-case variance
# test covers a representative slice: one from each behaviour we most need stable.
VARIANCE_CASE_NAMES = [
    "strong_senior_frontend",
    "partial_frontend_missing_testing",
    "wrong_domain_nurse_vs_frontend",
    "overqualified_principal_vs_junior_frontend",
    "underqualified_intern_vs_senior_frontend",
    "switcher_qa_to_frontend",
    "stuffed_frontend_keyword_list",
    "noisy_strong_frontend",
    "edge_one_line_resume",
]

VARIANCE_CASES = [c for c in CASES if c.name in VARIANCE_CASE_NAMES]


@pytest.fixture(scope="session")
def variance_stats(eval_mode, runs, pytestconfig) -> dict[str, CaseStats]:
    """Score every variance case N times, once per session."""
    stats = {c.name: run_case_n(c, runs, mode=eval_mode) for c in VARIANCE_CASES}
    pytestconfig._eval_variance = list(stats.values())  # type: ignore[attr-defined]
    return stats


@pytest.mark.parametrize("case", VARIANCE_CASES, ids=lambda c: c.name)
def test_spread_within_threshold(
    case: EvalCase, variance_stats: dict[str, CaseStats], variance_threshold: float
) -> None:
    stats = variance_stats[case.name]
    assert not stats.unstable(variance_threshold), (
        f"\ncase    : {case.name}"
        f"\nruns    : {len(stats.outcomes)}"
        f"\nscores  : {[round(s, 1) for s in stats.scores]}"
        f"\nmean    : {stats.mean:.1f}"
        f"\nstddev  : {stats.stdev:.2f}"
        f"\nmin/max : {stats.minimum:.1f} / {stats.maximum:.1f}"
        f"\nspread  : {stats.spread:.1f}  (threshold {variance_threshold})"
        "\nAt temperature=0 this much drift means the prompt is underspecified: "
        "it gives the model no rubric for converting a judgement into a number."
    )


@pytest.mark.parametrize("case", VARIANCE_CASES, ids=lambda c: c.name)
def test_mean_lands_in_band(
    case: EvalCase, variance_stats: dict[str, CaseStats]
) -> None:
    """Mean over N runs is a steadier band check than any single run."""
    stats = variance_stats[case.name]
    low, high = case.expected_band
    assert stats.mean_in_band, (
        f"\ncase     : {case.name}"
        f"\nexpected : {low}-{high}"
        f"\nmean     : {stats.mean:.1f} over {len(stats.outcomes)} runs"
        f"\nscores   : {[round(s, 1) for s in stats.scores]}"
        f"\nrationale: {case.rationale}"
    )


def test_offline_mode_is_deterministic(eval_mode, runs) -> None:
    """The harness must add no variance of its own.

    If this fails under --live it is skipped, because variance is then expected.
    """
    if eval_mode == "live":
        pytest.skip("determinism only guaranteed offline")
    stats = run_case_n(CASES[0], max(3, runs), mode="offline")
    assert stats.spread == 0.0, (
        f"offline harness produced varying scores: {stats.scores}"
    )


# --------------------------------------------------------------------------
# TC-16..18 consistency baselines
# --------------------------------------------------------------------------


@pytest.fixture(scope="session")
def consistency_stats(eval_mode, runs) -> dict[str, CaseStats]:
    return {
        name: run_case_n(CASES_BY_NAME[name], runs, mode=eval_mode)
        for name in CONSISTENCY_BASELINES
    }


@pytest.mark.parametrize("name", CONSISTENCY_BASELINES)
def test_consistency_baseline_stddev(
    name: str, consistency_stats: dict[str, CaseStats]
) -> None:
    """Tighter than the general variance test: stddev under 5 points.

    We request temperature=0 (some Gemini models ignore it and use fixed sampling
    defaults regardless), so drift here is not meant to be sampling. It means the
    prompt is underspecified enough that ordinary non-determinism in the inference
    stack changes the verdict.
    """
    stats = consistency_stats[name]
    assert stats.stdev < CONSISTENCY_STDDEV_LIMIT, (
        f"\ncase   : {name}"
        f"\nscores : {[round(s, 1) for s in stats.scores]}"
        f"\nstddev : {stats.stdev:.2f}  (limit {CONSISTENCY_STDDEV_LIMIT})"
        f"\nspread : {stats.spread:.1f}"
    )


@pytest.mark.parametrize("name", CONSISTENCY_BASELINES)
def test_consistency_baseline_never_changes_band(
    name: str, consistency_stats: dict[str, CaseStats]
) -> None:
    """Every run must land in the same band.

    A case that straddles a boundary across runs is a failure even when stddev is
    small - the verdict flips, which is what a downstream recruiter actually sees.
    """
    stats = consistency_stats[name]
    low, high = stats.expected_band
    outside = [round(s, 1) for s in stats.scores if not low <= s <= high]
    assert not outside, (
        f"\ncase     : {name}"
        f"\nexpected : {low}-{high}"
        f"\nscores   : {[round(s, 1) for s in stats.scores]}"
        f"\noutside  : {outside}"
    )


def test_borderline_is_the_variance_probe(
    consistency_stats: dict[str, CaseStats], eval_mode
) -> None:
    """Report where the instability actually sits.

    Variance peaks where the model is closest to indifferent between two verdicts.
    If the borderline case is unstable while the clear high and low are steady, the
    bands are fine and the middle of the rubric is undefined. If all three drift,
    the scale itself is unanchored.
    """
    if eval_mode != "live":
        pytest.skip("offline scores are deterministic by construction")

    spreads = {name: consistency_stats[name].spread for name in CONSISTENCY_BASELINES}
    borderline = spreads["consistency_baseline_borderline"]
    clear = max(
        spreads["consistency_baseline_high"], spreads["consistency_baseline_low"]
    )
    print(f"\nconsistency spreads: {spreads}")
    assert not (clear > borderline and clear > CONSISTENCY_STDDEV_LIMIT), (
        f"\nunambiguous cases drift more than the borderline one: {spreads}"
        "\nThat points at an unanchored scale rather than an undefined middle."
    )


def test_pass_rate_reported(variance_stats: dict[str, CaseStats]) -> None:
    """Surface per-case pass rate; a case passing 3/5 runs is not really passing."""
    flaky = {
        name: round(s.pass_rate, 2)
        for name, s in variance_stats.items()
        if 0.0 < s.pass_rate < 1.0
    }
    assert not flaky, (
        f"\ncases that pass only some of the time: {flaky}"
        "\nThese sit on a band edge - the score is not stable enough to act on."
    )
