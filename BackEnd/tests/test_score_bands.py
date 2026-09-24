"""STEP 3 - absolute expected-score-band assertions, one per eval case.

Bands are wide on purpose. A band miss is a weak signal on its own; read it next to
test_ordering.py, which is far more reliable.
"""

from __future__ import annotations

import pytest

from tests.eval.fixtures import cases as case_defs
from tests.eval.fixtures.cases import CASES, EvalCase
from tests.eval.harness import ScoreCache

pytestmark = pytest.mark.bands


@pytest.mark.parametrize("case", CASES, ids=lambda c: c.name)
def test_score_within_expected_band(case: EvalCase, scores: ScoreCache) -> None:
    outcome = scores.get(case)
    low, high = case.expected_band

    if case.expect_status != "scored":
        assert outcome.status == case.expect_status, (
            f"\ncase     : {case.name}"
            f"\nexpected : status={case.expect_status}, score=None"
            f"\nactual   : status={outcome.status}, score={outcome.final_score}"
            f"\nrationale: {case.rationale}"
        )
        assert outcome.final_score is None, (
            f"{case.name} must carry no score, got {outcome.final_score}"
        )
        return

    assert outcome.scored, (
        f"\ncase   : {case.name}"
        f"\nstatus : {outcome.status}"
        f"\nerror  : {outcome.error}"
        f"\nraw    : {(outcome.raw_response or '')[:300]!r}"
    )

    detail = (
        f"\ncase       : {case.name} ({case.category})"
        f"\nrationale  : {case.rationale}"
        f"\nexpected   : {low}-{high}"
        f"\nactual     : final={outcome.final_score:.1f} "
        f"llm={outcome.llm_score:.0f} semantic={outcome.semantic_score:.1f}"
        f"\nband miss  : {outcome.band_miss:+.1f}"
    )
    if case.known_defect:
        detail += f"\nknown defect: {case.known_defect}"
    if outcome.raw_response:
        detail += f"\nraw model output: {outcome.raw_response[:300]!r}"

    assert low <= outcome.final_score <= high, detail


@pytest.mark.parametrize("category", case_defs.ALL_CATEGORIES)
def test_category_has_several_cases(category: str) -> None:
    """The spec asks for several cases per category; guard against thinning them out."""
    found = case_defs.by_category(category)
    assert len(found) >= 2, f"{category} has only {len(found)} case(s)"


def test_llm_half_actually_contributes(scores: ScoreCache) -> None:
    """A non-zero LLM score should reach the hybrid on at least one real match.

    When langchain is missing or Gemini is unreachable, _run_llm_analysis swallows the
    error and returns score 0 for every input. final_score is then capped at 30
    (0.3 * semantic) and no band above 30 can ever pass. This test names that failure
    directly instead of letting it surface as 20-odd confusing band misses.
    """
    strong = [scores.get(c) for c in case_defs.by_category(case_defs.STRONG)]
    unavailable = [o for o in strong if o.status == "model_unavailable"]
    assert not unavailable, (
        "the scoring stack is unavailable, so no calibration measurement is valid: "
        f"{unavailable[0].error}"
    )
    assert any(o.llm_score for o in strong), (
        "llm_score was 0 for every strong match, so final_score is capped at 30."
    )


def test_empty_resume_is_input_invalid(scores: ScoreCache, case_by_name) -> None:
    """An empty resume must return an explicit error, not a score of any value."""
    outcome = scores.get(case_by_name("edge_empty_resume"))
    assert outcome.status == "input_invalid", f"got status={outcome.status}"
    assert outcome.final_score is None, (
        f"empty resume produced a score of {outcome.final_score}; it must be null"
    )


def test_missing_job_description_is_input_invalid(scores: ScoreCache, case_by_name) -> None:
    outcome = scores.get(case_by_name("edge_missing_job_description"))
    assert outcome.status == "input_invalid", f"got status={outcome.status}"
    assert outcome.final_score is None


def test_no_case_silently_scores_zero_from_failure(
    scores: ScoreCache, all_cases
) -> None:
    """The Step 1 guarantee, asserted across the whole fixture set.

    Any case that scored exactly 0 must have been scored by the model, not
    produced by a swallowed exception.
    """
    for case in all_cases:
        outcome = scores.get(case)
        if outcome.final_score == 0:
            assert outcome.status == "scored", (
                f"{case.name} scored 0 with status={outcome.status} - "
                "that is a failure masquerading as a verdict"
            )
