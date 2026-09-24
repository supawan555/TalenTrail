"""What actually reaches the model, measured on the rendered prompt.

Score bands cannot distinguish "the model judged this harshly" from "the model never
saw the qualifications". These tests read the prompt directly, so the answer is exact
rather than inferred, and they are fully deterministic offline.

Limits under test (app/ml/resume_matcher.py:64-65):
    resume_text[:3000]
    job_description[:1500]
"""

from __future__ import annotations

import json

import pytest

from app.ml import resume_matcher
from tests.eval.fixtures import resumes
from tests.eval.fixtures.cases import CASES_BY_NAME
from tests.eval.mocks import fixed_responder, install_fake_langchain

pytestmark = pytest.mark.parsing

RESUME_LIMIT = 3000
JOB_LIMIT = 1500

_OK = json.dumps({"score": 80, "strengths": [], "missing_skills": []})


def rendered_prompt(resume: str, job: str) -> str:
    with install_fake_langchain(fixed_responder(_OK)) as rec:
        resume_matcher._run_llm_analysis(resume, job)
    return rec.last.rendered_prompt


def sent_resume(resume: str, job: str) -> str:
    with install_fake_langchain(fixed_responder(_OK)) as rec:
        resume_matcher._run_llm_analysis(resume, job)
    return rec.last.variables["resume_text"]


def sent_job(resume: str, job: str) -> str:
    with install_fake_langchain(fixed_responder(_OK)) as rec:
        resume_matcher._run_llm_analysis(resume, job)
    return rec.last.variables["job_description"]


class TestLimits:
    def test_resume_is_cut_at_3000_chars(self) -> None:
        long_resume = "A" * 10_000
        assert len(sent_resume(long_resume, "Frontend role")) == RESUME_LIMIT

    def test_job_description_is_cut_at_1500_chars(self) -> None:
        long_job = "B" * 10_000
        assert len(sent_job("Some resume text", long_job)) == JOB_LIMIT

    def test_short_inputs_pass_through_whole(self) -> None:
        resume = resumes.STRONG_SENIOR_FRONTEND
        assert len(resume) < RESUME_LIMIT
        assert sent_resume(resume, "Frontend role") == resume

    def test_truncation_is_silent(self) -> None:
        """No marker is added, so the model cannot tell it received a fragment."""
        sent = sent_resume("A" * 10_000, "Frontend role")
        assert sent == "A" * RESUME_LIMIT
        assert "..." not in sent
        assert "truncat" not in sent.lower()


class TestBackLoadedContentIsLost:
    """The direct measurement behind the edge_long_resume_* cases."""

    def test_front_loaded_qualifications_reach_the_model(self) -> None:
        case = CASES_BY_NAME["edge_long_resume_front_loaded"]
        sent = sent_resume(case.resume, case.job_description)
        assert resumes.TRUNCATION_SENTINEL in sent, (
            "front-loaded qualifications should survive the 3000-char cut"
        )

    def test_back_loaded_qualifications_never_reach_the_model(self) -> None:
        """Same candidate, only reordered. The evidence is discarded before inference.

        Any low score on edge_long_resume_back_loaded is an input-truncation problem,
        not a prompt problem.
        """
        case = CASES_BY_NAME["edge_long_resume_back_loaded"]
        assert resumes.TRUNCATION_SENTINEL in case.resume, "fixture no longer has the sentinel"
        sent = sent_resume(case.resume, case.job_description)
        assert resumes.TRUNCATION_SENTINEL not in sent, (
            "the 3000-char cut no longer discards the tail - if the limit was raised, "
            "update RESUME_LIMIT and the edge_long_resume_back_loaded rationale"
        )

    def test_the_two_long_cases_are_the_same_candidate(self) -> None:
        """Guards the comparison itself: only ordering may differ."""
        front = CASES_BY_NAME["edge_long_resume_front_loaded"].resume
        back = CASES_BY_NAME["edge_long_resume_back_loaded"].resume
        assert len(front) == len(back)
        assert sorted(front.split()) == sorted(back.split())

    def test_back_loaded_prompt_is_mostly_filler(self) -> None:
        case = CASES_BY_NAME["edge_long_resume_back_loaded"]
        sent = sent_resume(case.resume, case.job_description)
        assert "NOTES SECTION" in sent
        assert "React" not in sent, (
            "no qualifying signal should survive in the back-loaded case"
        )


class TestRealisticSizes:
    """How close production input sits to the limit."""

    def test_typical_fixture_resumes_fit(self) -> None:
        oversized = {
            name: len(case.resume)
            for name, case in CASES_BY_NAME.items()
            if len(case.resume) > RESUME_LIMIT
        }
        assert set(oversized) <= {
            "edge_long_resume_front_loaded",
            "edge_long_resume_back_loaded",
        }, f"unexpected fixtures exceed the resume budget: {oversized}"

    def test_formatting_noise_consumes_budget(self) -> None:
        """Whitespace and table furniture eat the same 3000 chars as content."""
        clean = CASES_BY_NAME["strong_senior_frontend"].resume
        noisy = CASES_BY_NAME["noisy_strong_frontend"].resume
        assert len(noisy) > len(clean), (
            "the noisy fixture should be larger than its clean twin"
        )

    def test_multi_role_resume_loses_its_tail(self) -> None:
        """Four fixture resumes concatenated (~3.3k chars) already exceed the budget.

        The fixtures here are deliberately terse - a single page each. A real senior CV
        with four roles, a publications list and a skills matrix extracts to well past
        3000 chars, so the final role is routinely dropped before inference.
        """
        multi_role = (
            resumes.STRONG_SENIOR_FRONTEND
            + resumes.STRONG_DEVOPS
            + resumes.STRONG_UX_DESIGNER
            + resumes.SWITCHER_QA_TO_FRONTEND
        )
        assert len(multi_role) > RESUME_LIMIT, (
            f"fixture text shrank to {len(multi_role)} chars; this test needs to exceed "
            f"the {RESUME_LIMIT}-char budget to be meaningful"
        )
        sent = sent_resume(multi_role, "Frontend role")
        assert len(sent) == RESUME_LIMIT
        assert len(sent) < len(multi_role)
        # The tail - the last role listed - is what gets discarded.
        assert "Built a React + TypeScript dashboard" not in sent


class TestSemanticHalfSeesEverything:
    """The two halves of the hybrid score disagree about what the input even is."""

    def test_sbert_receives_the_untruncated_resume(self, monkeypatch) -> None:
        """combine_scores passes the full text to SBERT, unlike the LLM half.

        So llm_score judges the first 3000 chars while semantic_score judges the whole
        document. On any long resume the two halves are scoring different inputs.
        """
        seen: dict[str, str] = {}

        def spy(resume_text: str, job_description: str) -> float:
            seen["resume"] = resume_text
            return 50.0

        monkeypatch.setattr(resume_matcher, "match_resume_to_job", spy)

        long_resume = CASES_BY_NAME["edge_long_resume_back_loaded"].resume
        resume_matcher.combine_scores(
            {"score": 10, "strengths": [], "missing_skills": []},
            long_resume,
            "Frontend role",
        )
        assert len(seen["resume"]) == len(long_resume), (
            "SBERT should have received the full text"
        )
        assert len(seen["resume"]) > RESUME_LIMIT
