"""STEP 4 - relative ordering assertions.

Absolute scores are subjective; rank order is not. If the model cannot put a strong
match above a wrong-domain match, no amount of band tuning will rescue it. These are
the assertions to trust when the two suites disagree.
"""

from __future__ import annotations

import pytest

from tests.eval.fixtures import cases as case_defs
from tests.eval.harness import ScoreCache

pytestmark = pytest.mark.ordering

# Minimum gap before a difference counts as a real ordering signal rather than noise.
MARGIN = 5.0


def _score(scores: ScoreCache, name: str) -> float:
    return scores.score(case_defs.CASES_BY_NAME[name])


def _assert_greater(scores: ScoreCache, higher: str, lower: str, margin: float = MARGIN) -> None:
    hi = _score(scores, higher)
    lo = _score(scores, lower)
    assert hi >= lo + margin, (
        f"\nexpected {higher} > {lower} by at least {margin}"
        f"\n  {higher:<45} = {hi:.1f}"
        f"\n  {lower:<45} = {lo:.1f}"
        f"\n  gap = {hi - lo:+.1f}"
    )


# --------------------------------------------------------------------------
# The core chain the spec calls out
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "strong,partial,wrong",
    [
        (
            "strong_senior_frontend",
            "partial_frontend_missing_testing",
            "wrong_domain_nurse_vs_frontend",
        ),
        (
            "strong_devops",
            "partial_devops_missing_iac",
            "wrong_domain_chef_vs_devops",
        ),
    ],
)
def test_strong_beats_partial_beats_wrong_domain(
    scores: ScoreCache, strong: str, partial: str, wrong: str
) -> None:
    _assert_greater(scores, strong, partial)
    _assert_greater(scores, partial, wrong)


# --------------------------------------------------------------------------
# Three-tier demo: one JD, three candidates, everything else held constant
# --------------------------------------------------------------------------


def test_tier_strong_beats_medium_beats_low(scores: ScoreCache) -> None:
    """The simplest question the scorer has to answer correctly.

    Same job, same resume format, same length. Only depth of experience varies.
    If this ordering does not hold, the score cannot rank candidates at all.
    """
    strong = _score(scores, "tier_strong")
    medium = _score(scores, "tier_medium")
    low = _score(scores, "tier_low")

    table = (
        f"\n  tier_strong = {strong:.1f}"
        f"\n  tier_medium = {medium:.1f}"
        f"\n  tier_low    = {low:.1f}"
    )
    assert strong > medium, "strong must outrank medium" + table
    assert medium > low, "medium must outrank low" + table


def test_tiers_are_meaningfully_separated(scores: ScoreCache) -> None:
    """Adjacent tiers must be further apart than the model's quantization step.

    A 3-point gap between a 7-year senior and a 3-year mid is not a usable
    signal even when the ordering is technically correct.
    """
    strong = _score(scores, "tier_strong")
    medium = _score(scores, "tier_medium")
    low = _score(scores, "tier_low")

    assert strong - medium >= 15, (
        f"strong({strong:.1f}) and medium({medium:.1f}) differ by only "
        f"{strong - medium:.1f} points"
    )
    assert medium - low >= 15, (
        f"medium({medium:.1f}) and low({low:.1f}) differ by only "
        f"{medium - low:.1f} points"
    )


# --------------------------------------------------------------------------
# QA objectivity suite (TC-01 .. TC-18), Full Stack Developer baseline
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "stuffed",
    ["stuffed_fs_skill_wall", "stuffed_fs_jd_echo", "stuffed_fs_cert_farm"],
)
def test_gated_candidate_still_beats_keyword_stuffing(
    scores: ScoreCache, stuffed: str
) -> None:
    """A real engineer who fails one gate must still outrank a resume with no history.

    missing_core_no_react is gated to Low, and so is every stuffing case - but for
    opposite reasons. He has six years of evidenced work and one wrong framework;
    they have keywords and nothing else. Collapsing both to the same number would
    mean the gate is doing all the work and evidence none.
    """
    _assert_greater(scores, "missing_core_no_react", stuffed)


def test_strong_candidate_dominates_the_certificate_farm(scores: ScoreCache) -> None:
    """The spec's 30-point separation requirement."""
    _assert_greater(
        scores, "consistency_baseline_high", "stuffed_fs_cert_farm", margin=30.0
    )


def test_missing_skill_is_graded_by_criticality(scores: ScoreCache) -> None:
    """A preferred-only gap must cost less than a must-have gap.

    A model that treats every absence identically cannot tell a closable gap from a
    disqualifying one, which is the whole point of a MUST HAVE section.
    """
    _assert_greater(scores, "missing_core_no_cloud", "missing_core_no_database", margin=0.0)
    _assert_greater(scores, "missing_core_no_database", "missing_core_no_react")
    _assert_greater(scores, "missing_core_no_database", "missing_core_no_backend")


def test_specificity_beats_fluency(scores: ScoreCache) -> None:
    """Named technologies must outrank confident corporate prose."""
    _assert_greater(scores, "vague_stack_named_no_contribution", "vague_corporate_buzzwords")
    _assert_greater(scores, "vague_no_stack_named", "vague_corporate_buzzwords", margin=0.0)


def test_concrete_evidence_beats_unanchored_metrics(scores: ScoreCache) -> None:
    _assert_greater(
        scores, "consistency_baseline_borderline", "vague_unanchored_metrics"
    )


def test_current_skill_beats_senior_title(scores: ScoreCache) -> None:
    """The TC-13/14/15 triangulation.

    All three carry senior titles. Only TC-14 is currently hands-on with the required
    stack. If the three score alike, the model is reading job titles, not experience.
    """
    _assert_greater(
        scores, "overqualified_principal_hands_on", "overqualified_em_stale_hands_on"
    )
    _assert_greater(
        scores, "overqualified_cto_vs_junior", "overqualified_em_stale_hands_on", margin=0.0
    )


def test_consistency_baselines_are_ordered(scores: ScoreCache) -> None:
    """The whole suite in one line."""
    _assert_greater(
        scores, "consistency_baseline_high", "consistency_baseline_borderline"
    )
    _assert_greater(
        scores, "consistency_baseline_borderline", "consistency_baseline_low"
    )


# --------------------------------------------------------------------------
# Adversarial: real experience must outrank keyword stuffing
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "real,stuffed",
    [
        ("strong_senior_frontend", "stuffed_frontend_keyword_list"),
        ("strong_senior_frontend", "stuffed_frontend_repetition"),
        ("strong_devops", "stuffed_devops_skills_only"),
    ],
)
def test_real_experience_beats_keyword_stuffing(
    scores: ScoreCache, real: str, stuffed: str
) -> None:
    """The single most important assertion in this suite.

    A stuffed resume has near-perfect lexical overlap with the JD, so the SBERT half
    actively rewards it. Only the LLM half can tell the difference.
    """
    _assert_greater(scores, real, stuffed)


def test_partial_match_beats_keyword_stuffing(scores: ScoreCache) -> None:
    """Even an imperfect real candidate should outrank a fabricated one."""
    _assert_greater(scores, "partial_frontend_missing_testing", "stuffed_frontend_keyword_list")


# --------------------------------------------------------------------------
# Seniority ordering
# --------------------------------------------------------------------------


def test_strong_beats_underqualified(scores: ScoreCache) -> None:
    _assert_greater(scores, "strong_senior_frontend", "underqualified_intern_vs_senior_frontend")


def test_overqualified_beats_underqualified(scores: ScoreCache) -> None:
    """Too much experience is a smaller problem than not enough."""
    _assert_greater(
        scores,
        "overqualified_principal_vs_junior_frontend",
        "underqualified_intern_vs_senior_frontend",
    )


def test_underqualified_beats_wrong_domain(scores: ScoreCache) -> None:
    """A junior in the right field still beats someone from another profession."""
    _assert_greater(
        scores, "underqualified_intern_vs_senior_frontend", "wrong_domain_nurse_vs_frontend"
    )


# --------------------------------------------------------------------------
# Career switchers sit between partial and underqualified
# --------------------------------------------------------------------------


def test_switcher_beats_wrong_domain(scores: ScoreCache) -> None:
    _assert_greater(scores, "switcher_qa_to_frontend", "wrong_domain_nurse_vs_frontend")


def test_switcher_beats_pure_underqualified(scores: ScoreCache) -> None:
    """6 years in the React codebase should outrank a 6-month internship."""
    _assert_greater(
        scores, "switcher_qa_to_frontend", "underqualified_intern_vs_senior_frontend"
    )


def test_strong_beats_switcher(scores: ScoreCache) -> None:
    _assert_greater(scores, "strong_senior_frontend", "switcher_qa_to_frontend")


# --------------------------------------------------------------------------
# Formatting must not move the score much
# --------------------------------------------------------------------------

FORMATTING_TOLERANCE = 12.0


@pytest.mark.parametrize(
    "clean,noisy",
    [
        ("strong_senior_frontend", "noisy_strong_frontend"),
        ("strong_devops", "noisy_strong_devops"),
    ],
)
def test_formatting_noise_is_near_neutral(scores: ScoreCache, clean: str, noisy: str) -> None:
    """Same candidate, same substance, different PDF extraction quality."""
    clean_score = _score(scores, clean)
    noisy_score = _score(scores, noisy)
    delta = abs(clean_score - noisy_score)
    assert delta <= FORMATTING_TOLERANCE, (
        f"\nformatting alone moved the score by {delta:.1f} (tolerance {FORMATTING_TOLERANCE})"
        f"\n  {clean:<30} = {clean_score:.1f}"
        f"\n  {noisy:<30} = {noisy_score:.1f}"
        "\nsame candidate, only the extraction quality differs."
    )


def test_noisy_strong_still_beats_partial(scores: ScoreCache) -> None:
    """Bad formatting must not drop a strong candidate below a weaker clean one."""
    _assert_greater(scores, "noisy_strong_frontend", "partial_frontend_missing_testing")


# --------------------------------------------------------------------------
# Edge-case ordering
# --------------------------------------------------------------------------


def test_real_resume_beats_one_liner(scores: ScoreCache) -> None:
    """An unevidenced one-line claim must not score like a documented history."""
    _assert_greater(scores, "strong_senior_frontend", "edge_one_line_resume")


def test_empty_resume_is_not_ranked_at_all(scores: ScoreCache) -> None:
    """An empty resume has no score, so it cannot sit anywhere in the ranking.

    Previously it scored 0 and ranked below everything, which read as a verdict.
    """
    outcome = scores.get(case_defs.CASES_BY_NAME["edge_empty_resume"])
    assert not outcome.scored
    assert outcome.status == "input_invalid"


def test_mixed_language_beats_wrong_domain(scores: ScoreCache) -> None:
    """Writing in Thai must not cost a qualified candidate their qualifications."""
    _assert_greater(scores, "edge_mixed_language_resume", "wrong_domain_nurse_vs_frontend")


def test_long_resume_position_should_not_matter(scores: ScoreCache) -> None:
    """Identical candidate, qualifications at the front vs at the back.

    A large gap here is proof of input truncation rather than of a scoring opinion.
    See test_truncation.py for the direct measurement.
    """
    front = _score(scores, "edge_long_resume_front_loaded")
    back = _score(scores, "edge_long_resume_back_loaded")
    assert abs(front - back) <= 15.0, (
        f"\nsame candidate scored differently based on content position:"
        f"\n  front-loaded = {front:.1f}"
        f"\n  back-loaded  = {back:.1f}"
        f"\n  gap = {front - back:+.1f}"
        "\nresume_matcher.py:64 keeps only resume_text[:3000]."
    )


# --------------------------------------------------------------------------
# Whole-ranking sanity
# --------------------------------------------------------------------------


def test_category_medians_are_ordered(scores: ScoreCache) -> None:
    """Category-level ordering, which averages out per-case noise."""
    import statistics

    def median_of(category: str) -> float:
        return statistics.median(
            [scores.score(c) for c in case_defs.by_category(category)]
        )

    strong = median_of(case_defs.STRONG)
    partial = median_of(case_defs.PARTIAL)
    stuffed = median_of(case_defs.STUFFED)
    wrong = median_of(case_defs.WRONG_DOMAIN)

    report = (
        f"\n  strong       = {strong:.1f}"
        f"\n  partial      = {partial:.1f}"
        f"\n  keyword-stuff= {stuffed:.1f}"
        f"\n  wrong domain = {wrong:.1f}"
    )
    assert strong > partial, "strong should outrank partial" + report
    assert partial > wrong, "partial should outrank wrong domain" + report
    assert strong > stuffed, "strong should outrank keyword stuffing" + report
