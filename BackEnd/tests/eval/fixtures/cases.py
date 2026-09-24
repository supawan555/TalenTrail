"""Eval cases: resume + job-description pairs with an expected score BAND.

Bands are deliberately wide. Absolute LLM scores are subjective, so a band plus the
relative-ordering assertions in test_ordering.py is a far more honest signal than any
single expected number.

Bands apply to ``final_score`` from ``app.ml.resume_matcher.analyze_resume``, which is
``llm_score * 0.7 + semantic_score * 0.3``.

The ``mock_*`` fields describe how a *correctly behaving* model should score the case.
They drive the offline suite, which exercises the real prompt rendering, the real JSON
parser and the real combining maths, without touching Gemini.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from . import jobs, resumes

# Categories from the eval spec.
STRONG = "strong_match"
PARTIAL = "partial_match"
WRONG_DOMAIN = "wrong_domain"
OVERQUALIFIED = "overqualified"
UNDERQUALIFIED = "underqualified"
SWITCHER = "career_switcher"
STUFFED = "keyword_stuffing"
NOISY = "formatting_noise"
EDGE = "edge_case"
TIER = "tier_demo"

# QA objectivity suite (TC-01 .. TC-18).
MISSING_CORE = "missing_core_skill"
VAGUE = "vague"
CONSISTENCY = "consistency"


@dataclass(frozen=True)
class EvalCase:
    name: str
    category: str
    resume: str
    job_description: str
    expected_band: tuple[int, int]
    rationale: str
    # How a well-behaved model should score this case (drives offline mode).
    mock_llm_score: int
    mock_semantic: float
    # Raw string to return instead of well-formed JSON. Used by the parsing tests.
    mock_raw_override: Optional[str] = None
    # Set when the case is expected to fail today because of a known defect.
    known_defect: Optional[str] = None
    # Expected result status. Cases with invalid input must report an explicit
    # status rather than being scored at all, so they carry no meaningful band.
    expect_status: str = "scored"

    @property
    def low(self) -> int:
        return self.expected_band[0]

    @property
    def high(self) -> int:
        return self.expected_band[1]

    def in_band(self, score: float) -> bool:
        return self.low <= score <= self.high

    def band_miss(self, score: float) -> float:
        """Signed distance outside the band; 0.0 when inside."""
        if score < self.low:
            return score - self.low
        if score > self.high:
            return score - self.high
        return 0.0


CASES: list[EvalCase] = [
    # ---------------------------------------------------------------- strong
    EvalCase(
        name="strong_senior_frontend",
        category=STRONG,
        resume=resumes.STRONG_SENIOR_FRONTEND,
        job_description=jobs.SENIOR_FRONTEND,
        expected_band=(78, 100),
        rationale="Same title, 7y vs 5y required, every named skill present with evidence.",
        mock_llm_score=88,
        mock_semantic=85.0,
    ),
    EvalCase(
        name="strong_devops",
        category=STRONG,
        resume=resumes.STRONG_DEVOPS,
        job_description=jobs.MID_DEVOPS,
        expected_band=(78, 100),
        rationale="6y vs 4y required; AWS, K8s, Terraform, CI/CD and observability all evidenced.",
        mock_llm_score=87,
        mock_semantic=84.0,
    ),
    EvalCase(
        name="strong_ux_designer",
        category=STRONG,
        resume=resumes.STRONG_UX_DESIGNER,
        job_description=jobs.UX_DESIGNER,
        expected_band=(78, 100),
        rationale="5y vs 4y required; Figma, research, prototyping, WCAG all covered.",
        mock_llm_score=86,
        mock_semantic=83.0,
    ),
    # --------------------------------------------------------------- partial
    EvalCase(
        name="partial_frontend_missing_testing",
        category=PARTIAL,
        resume=resumes.PARTIAL_FRONTEND_NO_TESTING,
        job_description=jobs.SENIOR_FRONTEND,
        expected_band=(45, 74),
        rationale="Solid React/TS/Redux but explicitly no Next.js, Tailwind or testing.",
        mock_llm_score=58,
        mock_semantic=60.0,
    ),
    EvalCase(
        name="partial_fullstack_missing_cloud",
        category=PARTIAL,
        resume=resumes.PARTIAL_FULLSTACK_NO_CLOUD,
        job_description=jobs.FULL_STACK,
        expected_band=(45, 74),
        rationale="Node/React/Postgres/Mongo present; no Docker, GraphQL or cloud.",
        mock_llm_score=60,
        mock_semantic=62.0,
    ),
    EvalCase(
        name="partial_devops_missing_iac",
        category=PARTIAL,
        resume=resumes.PARTIAL_DEVOPS_NO_IAC,
        job_description=jobs.MID_DEVOPS,
        expected_band=(45, 74),
        rationale="AWS, Docker, Jenkins, scripting present; no Kubernetes, Terraform or IaC.",
        mock_llm_score=55,
        mock_semantic=58.0,
    ),
    # ---------------------------------------------------------- wrong domain
    EvalCase(
        name="wrong_domain_nurse_vs_frontend",
        category=WRONG_DOMAIN,
        resume=resumes.WRONG_DOMAIN_NURSE,
        job_description=jobs.SENIOR_FRONTEND,
        expected_band=(0, 20),
        rationale="ICU nursing shares no requirement with a frontend role.",
        mock_llm_score=5,
        mock_semantic=8.0,
    ),
    EvalCase(
        name="wrong_domain_chef_vs_devops",
        category=WRONG_DOMAIN,
        resume=resumes.WRONG_DOMAIN_CHEF,
        job_description=jobs.MID_DEVOPS,
        expected_band=(0, 20),
        rationale="Kitchen leadership is unrelated to cloud infrastructure.",
        mock_llm_score=4,
        mock_semantic=7.0,
    ),
    EvalCase(
        name="wrong_domain_accountant_vs_ux",
        category=WRONG_DOMAIN,
        resume=resumes.WRONG_DOMAIN_ACCOUNTANT,
        job_description=jobs.UX_DESIGNER,
        expected_band=(0, 20),
        rationale="Statutory accounting shares no UX competency; 'audit' is not 'research'.",
        mock_llm_score=6,
        mock_semantic=9.0,
    ),
    # -------------------------------------------------------- overqualified
    EvalCase(
        name="overqualified_principal_vs_junior_frontend",
        category=OVERQUALIFIED,
        resume=resumes.OVERQUALIFIED_PRINCIPAL_FRONTEND,
        job_description=jobs.JUNIOR_FRONTEND,
        expected_band=(55, 85),
        rationale="16y against a 0-2y role: every skill is met, so it should stay high, "
        "but seniority mismatch is a real hiring risk and should shade it below a peer fit.",
        mock_llm_score=72,
        mock_semantic=75.0,
    ),
    EvalCase(
        name="overqualified_director_vs_mid_devops",
        category=OVERQUALIFIED,
        resume=resumes.OVERQUALIFIED_DIRECTOR_DEVOPS,
        job_description=jobs.MID_DEVOPS,
        expected_band=(55, 85),
        rationale="17y director for a 4y IC role; capability is far beyond the bar.",
        mock_llm_score=70,
        mock_semantic=73.0,
    ),
    # ------------------------------------------------------- underqualified
    EvalCase(
        name="underqualified_intern_vs_senior_frontend",
        category=UNDERQUALIFIED,
        resume=resumes.UNDERQUALIFIED_INTERN_FRONTEND,
        job_description=jobs.SENIOR_FRONTEND,
        expected_band=(20, 50),
        rationale="6-month intern against 5+ years; right domain, nowhere near the bar.",
        mock_llm_score=32,
        mock_semantic=45.0,
    ),
    EvalCase(
        name="underqualified_junior_vs_lead_devops",
        category=UNDERQUALIFIED,
        resume=resumes.UNDERQUALIFIED_JUNIOR_DEVOPS,
        job_description=jobs.LEAD_DEVOPS,
        expected_band=(20, 50),
        rationale="1y sysadmin against 8y + team leadership; Docker exposure is tutorial-level.",
        mock_llm_score=28,
        mock_semantic=40.0,
    ),
    # ------------------------------------------------------- career switcher
    EvalCase(
        name="switcher_qa_to_frontend",
        category=SWITCHER,
        resume=resumes.SWITCHER_QA_TO_FRONTEND,
        job_description=jobs.SENIOR_FRONTEND,
        expected_band=(35, 68),
        rationale="No FE title, but 6y in the React codebase, TS, Jest/RTL and 37 merged PRs.",
        mock_llm_score=52,
        mock_semantic=55.0,
    ),
    EvalCase(
        name="switcher_analyst_to_pm",
        category=SWITCHER,
        resume=resumes.SWITCHER_ANALYST_TO_PM,
        job_description=jobs.PRODUCT_MANAGER,
        expected_band=(35, 68),
        rationale="No PM title, but roadmap, discovery interviews, A/B tests, SQL and B2B SaaS.",
        mock_llm_score=55,
        mock_semantic=52.0,
    ),
    # ------------------------------------------------------ keyword stuffing
    EvalCase(
        name="stuffed_frontend_keyword_list",
        category=STUFFED,
        resume=resumes.STUFFED_FRONTEND_KEYWORD_LIST,
        job_description=jobs.SENIOR_FRONTEND,
        expected_band=(0, 45),
        rationale="Adversarial: every JD keyword, zero employment history. Must not score high.",
        mock_llm_score=25,
        mock_semantic=72.0,
    ),
    EvalCase(
        name="stuffed_frontend_repetition",
        category=STUFFED,
        resume=resumes.STUFFED_FRONTEND_REPETITION,
        job_description=jobs.SENIOR_FRONTEND,
        expected_band=(0, 45),
        rationale="Adversarial: JD sentences pasted back verbatim; actual history is retail.",
        mock_llm_score=20,
        mock_semantic=78.0,
    ),
    EvalCase(
        name="stuffed_devops_skills_only",
        category=STUFFED,
        resume=resumes.STUFFED_DEVOPS_SKILLS_ONLY,
        job_description=jobs.MID_DEVOPS,
        expected_band=(0, 45),
        rationale="Adversarial: full DevOps tool list, but 'seeking my first role in technology'.",
        mock_llm_score=22,
        mock_semantic=74.0,
    ),
    # ------------------------------------------------------ formatting noise
    EvalCase(
        name="noisy_strong_frontend",
        category=NOISY,
        resume=resumes.NOISY_STRONG_FRONTEND,
        job_description=jobs.SENIOR_FRONTEND,
        expected_band=(70, 100),
        rationale="Byte-for-byte the strong_senior_frontend candidate through a bad PDF "
        "extract: BOM, form feed, letter-spacing, ASCII table, page furniture.",
        mock_llm_score=85,
        mock_semantic=80.0,
    ),
    EvalCase(
        name="noisy_strong_devops",
        category=NOISY,
        resume=resumes.NOISY_STRONG_DEVOPS,
        job_description=jobs.MID_DEVOPS,
        expected_band=(70, 100),
        rationale="Same candidate as strong_devops with box-drawing tables and non-ASCII dashes.",
        mock_llm_score=84,
        mock_semantic=79.0,
    ),
    # ------------------------------------------------------------- tier demo
    # One job description, three quality tiers, everything else held constant.
    EvalCase(
        name="tier_strong",
        category=TIER,
        resume=resumes.TIER_STRONG,
        job_description=jobs.SENIOR_FRONTEND,
        expected_band=(78, 100),
        rationale="7y senior, every required skill evidenced inside a work-history entry.",
        mock_llm_score=90,
        mock_semantic=86.0,
    ),
    EvalCase(
        name="tier_medium",
        category=TIER,
        resume=resumes.TIER_MEDIUM,
        job_description=jobs.SENIOR_FRONTEND,
        expected_band=(40, 65),
        rationale="3y vs 5y required; real React work but no TS at scale, Next.js, "
        "Tailwind, Redux or testing.",
        mock_llm_score=52,
        mock_semantic=58.0,
    ),
    EvalCase(
        name="tier_low",
        category=TIER,
        resume=resumes.TIER_LOW,
        job_description=jobs.SENIOR_FRONTEND,
        expected_band=(0, 30),
        rationale="IT support with 'basic HTML'; adjacent to tech, not to frontend "
        "engineering. No React, no JS framework, no product work.",
        mock_llm_score=12,
        mock_semantic=22.0,
    ),

    # ============================================================================
    # QA objectivity suite, Full Stack Developer baseline (TC-01 .. TC-18).
    # Bands: Low 0-40 | Medium 41-70 | High 71-100.
    # ============================================================================

    # -------------------------------------------- TC-01..04 keyword stuffing
    # All four score ~100 on SBERT (pure lexical overlap), so they also probe
    # whether the hybrid formula lets the semantic term lift a candidate the
    # LLM found no evidence for.
    EvalCase(
        name="stuffed_fs_skill_wall",
        category=STUFFED,
        resume=resumes.FS_STUFFED_SKILL_WALL,
        job_description=jobs.FULL_STACK_HARD_REQUIREMENTS,
        expected_band=(0, 40),
        rationale="TC-01: every must-have keyword present, but the entire history is "
        "'Freelance Developer - Various projects'. No employer, no outcome, no evidence.",
        mock_llm_score=2,
        mock_semantic=93.0,
    ),
    EvalCase(
        name="stuffed_fs_jd_echo",
        category=STUFFED,
        resume=resumes.FS_STUFFED_JD_ECHO,
        job_description=jobs.FULL_STACK_HARD_REQUIREMENTS,
        expected_band=(0, 40),
        rationale="TC-02: bullets are the JD's own requirements pasted back, including "
        "the 'Node.js, Python, or Go' disjunction nobody writes about their own past.",
        mock_llm_score=2,
        mock_semantic=96.0,
    ),
    EvalCase(
        name="stuffed_fs_footer_repeat",
        category=STUFFED,
        resume=resumes.FS_STUFFED_FOOTER_REPEAT,
        job_description=jobs.FULL_STACK_HARD_REQUIREMENTS,
        expected_band=(0, 40),
        rationale="TC-03: five years of real, verifiable, clerical work plus a repeated "
        "technology block. Repetition must not outweigh documented history.",
        mock_llm_score=3,
        mock_semantic=87.0,
    ),
    EvalCase(
        name="stuffed_fs_cert_farm",
        category=STUFFED,
        resume=resumes.FS_STUFFED_CERT_FARM,
        job_description=jobs.FULL_STACK_HARD_REQUIREMENTS,
        expected_band=(0, 40),
        rationale="TC-04: nine certificates covering every requirement, and an honest "
        "'no professional experience yet'. Distinguishes learned from did.",
        mock_llm_score=3,
        mock_semantic=92.0,
    ),

    # ------------------------------------------ TC-05..08 missing core skill
    EvalCase(
        name="missing_core_no_react",
        category=MISSING_CORE,
        resume=resumes.FS_MISSING_REACT,
        job_description=jobs.FULL_STACK_HARD_REQUIREMENTS,
        expected_band=(0, 40),
        rationale="TC-05: excellent 6y full stack engineer, every preferred item "
        "evidenced, but Angular not React and React is non-negotiable. Hard gate. "
        "The hardest case here: high SBERT overlap plus genuine seniority.",
        mock_llm_score=15,
        mock_semantic=85.0,
    ),
    EvalCase(
        name="missing_core_no_backend",
        category=MISSING_CORE,
        resume=resumes.FS_MISSING_BACKEND,
        job_description=jobs.FULL_STACK_HARD_REQUIREMENTS,
        expected_band=(0, 40),
        rationale="TC-06: outstanding React, exceeds the requirement, but consumes APIs "
        "rather than building them. No server language, no database. Half the role.",
        mock_llm_score=18,
        mock_semantic=80.0,
    ),
    EvalCase(
        name="missing_core_no_database",
        category=MISSING_CORE,
        resume=resumes.FS_MISSING_DATABASE,
        job_description=jobs.FULL_STACK_HARD_REQUIREMENTS,
        expected_band=(41, 70),
        rationale="TC-07: React and backend gates both cleared; relational DB missing. "
        "A closable gap for someone already writing services - penalise, don't gate.",
        mock_llm_score=55,
        mock_semantic=82.0,
    ),
    EvalCase(
        name="missing_core_no_cloud",
        category=MISSING_CORE,
        resume=resumes.FS_MISSING_CLOUD,
        job_description=jobs.FULL_STACK_HARD_REQUIREMENTS,
        expected_band=(41, 70),
        rationale="TC-08: all three must-haves evidenced. Cloud is PREFERRED, not "
        "required, and the gap has a stated regulatory cause. Upper Medium; must score "
        "above TC-07. Anti-harshness probe.",
        mock_llm_score=62,
        mock_semantic=80.0,
    ),

    # -------------------------------------------------------- TC-09..12 vague
    EvalCase(
        name="vague_no_stack_named",
        category=VAGUE,
        resume=resumes.FS_VAGUE_NO_STACK,
        job_description=jobs.FULL_STACK,
        expected_band=(0, 40),
        rationale="TC-09: four years of plausible engineering prose with not one "
        "technology named. No requirement is verifiable.",
        mock_llm_score=15,
        mock_semantic=45.0,
    ),
    EvalCase(
        name="vague_corporate_buzzwords",
        category=VAGUE,
        resume=resumes.FS_VAGUE_BUZZWORDS,
        job_description=jobs.FULL_STACK,
        expected_band=(0, 40),
        rationale="TC-10: pure corporate register, no engineering content; unclear this "
        "person writes code at all. Must land below TC-09.",
        mock_llm_score=8,
        mock_semantic=30.0,
    ),
    EvalCase(
        name="vague_stack_named_no_contribution",
        category=VAGUE,
        resume=resumes.FS_VAGUE_STACK_NO_CONTRIBUTION,
        job_description=jobs.FULL_STACK,
        expected_band=(30, 55),
        rationale="TC-11: right stack named, employment real, but every verb is passive "
        "and scopeless - 'worked on', 'involved in', 'part of a team'. The most "
        "calibration-sensitive case: too low punishes modest writing, too high means "
        "naming a technology earns full credit.",
        mock_llm_score=40,
        mock_semantic=70.0,
    ),
    EvalCase(
        name="vague_unanchored_metrics",
        category=VAGUE,
        resume=resumes.FS_VAGUE_UNANCHORED_METRICS,
        job_description=jobs.FULL_STACK,
        expected_band=(30, 55),
        rationale="TC-12: metrics everywhere, anchors nowhere. Performance of what, "
        "measured how, with which technology? Tests whether any digit reads as evidence.",
        mock_llm_score=35,
        mock_semantic=48.0,
    ),

    # ------------------------------------------------ TC-13..15 overqualified
    EvalCase(
        name="overqualified_cto_vs_junior",
        category=OVERQUALIFIED,
        resume=resumes.FS_OVERQUALIFIED_CTO,
        job_description=jobs.JUNIOR_FULL_STACK,
        expected_band=(41, 70),
        rationale="TC-13: every junior requirement met many times over, so not Low. But "
        "last hands-on delivery was 2013 and the role explicitly has no leadership scope. "
        "Qualified, poorly matched.",
        mock_llm_score=60,
        mock_semantic=72.0,
    ),
    EvalCase(
        name="overqualified_principal_hands_on",
        category=OVERQUALIFIED,
        resume=resumes.FS_PRINCIPAL_HANDS_ON,
        job_description=jobs.FULL_STACK,
        expected_band=(71, 100),
        rationale="TC-14: the control for TC-13 and TC-15. Senior title AND currently "
        "hands-on, every requirement evidenced in-role. If this ties TC-13, the model is "
        "reacting to the word 'Principal' rather than to what the person does.",
        mock_llm_score=92,
        mock_semantic=88.0,
    ),
    EvalCase(
        name="overqualified_em_stale_hands_on",
        category=OVERQUALIFIED,
        resume=resumes.FS_EM_STALE_HANDS_ON,
        job_description=jobs.FULL_STACK,
        expected_band=(30, 55),
        rationale="TC-15: senior title, 13 years, but the hands-on stack is AngularJS, "
        "Java, PHP, jQuery - none of the requirements - and last touched in 2019. Tests "
        "recency and relevance of skill against seniority of title.",
        mock_llm_score=38,
        mock_semantic=62.0,
    ),

    # -------------------------------------------------- TC-16..18 consistency
    EvalCase(
        name="consistency_baseline_high",
        category=CONSISTENCY,
        resume=resumes.FS_CONSISTENCY_HIGH,
        job_description=jobs.FULL_STACK,
        expected_band=(71, 100),
        rationale="TC-16: unambiguous strong fit, 7y, every requirement evidenced with "
        "employer, dates and outcomes. Variance here means the scale itself is unstable.",
        mock_llm_score=90,
        mock_semantic=87.0,
    ),
    EvalCase(
        name="consistency_baseline_borderline",
        category=CONSISTENCY,
        resume=resumes.FS_CONSISTENCY_BORDERLINE,
        job_description=jobs.FULL_STACK,
        expected_band=(41, 70),
        rationale="TC-17: deliberately near a band boundary - meets the minimum, misses "
        "every preferred item. Variance peaks where the model is closest to indifferent, "
        "so this is the most sensitive detector of an underspecified prompt.",
        mock_llm_score=55,
        mock_semantic=68.0,
    ),
    EvalCase(
        name="consistency_baseline_low",
        category=CONSISTENCY,
        resume=resumes.WRONG_DOMAIN_NURSE,
        job_description=jobs.FULL_STACK,
        expected_band=(0, 40),
        rationale="TC-18: unambiguously unrelated. Variance here would mean the model is "
        "not even stable on obvious rejections.",
        mock_llm_score=4,
        mock_semantic=8.0,
    ),

    # ------------------------------------------------------------ edge cases
    EvalCase(
        name="edge_empty_resume",
        category=EDGE,
        resume=resumes.EDGE_EMPTY,
        job_description=jobs.SENIOR_FRONTEND,
        expected_band=(0, 2),
        rationale="Nothing to score. Must report input_invalid, not any number.",
        mock_llm_score=0,
        mock_semantic=0.0,
        expect_status="input_invalid",
    ),
    EvalCase(
        name="edge_one_line_resume",
        category=EDGE,
        resume=resumes.EDGE_ONE_LINE,
        job_description=jobs.SENIOR_FRONTEND,
        expected_band=(0, 40),
        rationale="Claims the right title and years but offers no evidence; an unverified "
        "assertion should not score like a real resume.",
        mock_llm_score=18,
        mock_semantic=35.0,
    ),
    EvalCase(
        name="edge_long_resume_front_loaded",
        category=EDGE,
        resume=resumes.EDGE_LONG_FRONT_LOADED,
        job_description=jobs.SENIOR_FRONTEND,
        expected_band=(70, 100),
        rationale="~35k chars, 10x the 3000-char budget, but qualifications sit in the "
        "surviving prefix, so truncation is harmless here.",
        mock_llm_score=86,
        mock_semantic=82.0,
    ),
    EvalCase(
        name="edge_long_resume_back_loaded",
        category=EDGE,
        resume=resumes.EDGE_LONG_BACK_LOADED,
        job_description=jobs.SENIOR_FRONTEND,
        expected_band=(70, 100),
        rationale="Identical candidate to the front-loaded case. Band states the DESIRED "
        "outcome; resume_text[:3000] discards the qualifications, so a live failure here "
        "is direct evidence of input truncation, not prompt weakness.",
        mock_llm_score=86,
        mock_semantic=82.0,
        known_defect="resume_matcher.py:64 truncates resume_text to 3000 chars",
    ),
    EvalCase(
        name="edge_mixed_language_resume",
        category=EDGE,
        resume=resumes.EDGE_MIXED_LANGUAGE,
        job_description=jobs.SENIOR_FRONTEND,
        expected_band=(60, 95),
        rationale="Same strong candidate written in Thai with English skill names; "
        "language should not cost the candidate their qualifications.",
        mock_llm_score=78,
        mock_semantic=72.0,
    ),
    EvalCase(
        name="edge_missing_job_description",
        category=EDGE,
        resume=resumes.STRONG_SENIOR_FRONTEND,
        job_description="",
        expected_band=(0, 2),
        rationale="No JD means nothing to match against; must report input_invalid "
        "rather than scoring the resume in a vacuum.",
        mock_llm_score=0,
        mock_semantic=0.0,
        expect_status="input_invalid",
    ),
]

CASES_BY_NAME: dict[str, EvalCase] = {case.name: case for case in CASES}


def by_category(category: str) -> list[EvalCase]:
    return [case for case in CASES if case.category == category]


ALL_CATEGORIES: list[str] = [
    STRONG,
    PARTIAL,
    WRONG_DOMAIN,
    OVERQUALIFIED,
    UNDERQUALIFIED,
    SWITCHER,
    STUFFED,
    NOISY,
    EDGE,
    TIER,
    MISSING_CORE,
    VAGUE,
    CONSISTENCY,
]
