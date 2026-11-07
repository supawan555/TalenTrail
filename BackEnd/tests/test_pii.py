"""Unit tests for app/ml/pii.py and what the language model receives.

The Gemini unpaid tier must not receive personal information, so the resume is
redacted before the prompt is built. SBERT runs locally and still gets the
original text.
"""
from __future__ import annotations

import json

import pytest

from app.ml import resume_matcher
from app.ml.pii import redact_pii
from tests.eval.fixtures import resumes
from tests.eval.mocks import fixed_responder, install_fake_langchain

pytestmark = pytest.mark.unit

_OK = json.dumps({"score": 80, "strengths": [], "missing_skills": []})


def sent_resume(resume: str) -> str:
    with install_fake_langchain(fixed_responder(_OK)) as rec:
        resume_matcher._run_llm_analysis(resume, "Senior Frontend Developer")
    return rec.last.variables["resume_text"]


def test_name_email_and_location_line_from_a_fixture() -> None:
    """
    Scenario: A typical resume header "Name / Title | City | email".
    Expected: The name and the email are replaced; the title and city stay.
    """
    out = redact_pii(resumes.STRONG_SENIOR_FRONTEND)

    assert "Somchai Pattanakul" not in out
    assert "somchai.p@example.com" not in out
    assert out.startswith("[NAME]")
    assert "[EMAIL]" in out
    assert "Senior Frontend Developer" in out and "Bangkok" in out


@pytest.mark.parametrize(
    "phone",
    ["081-234-5678", "+66 81 234 5678", "(02) 123 4567", "0812345678", "+1 (415) 555-0132"],
)
def test_phone_numbers_are_replaced(phone: str) -> None:
    """
    Scenario: Phone numbers in Thai and international formats.
    Expected: Each becomes [PHONE].
    """
    assert redact_pii(f"Contact: {phone}\nSKILLS\nReact") == "Contact: [PHONE]\nSKILLS\nReact"


@pytest.mark.parametrize("text", ["2018-2021", "2019 - 2023", "Raised coverage from 31% to 84%", "Q3 2024", "1,500 users"])
def test_years_and_figures_are_kept(text: str) -> None:
    """
    Scenario: Dates and figures that only resemble phone numbers.
    Expected: Unchanged - they carry the evidence the model scores.
    """
    assert redact_pii(text) == text


def test_profile_links_are_replaced() -> None:
    """
    Scenario: GitHub, LinkedIn and portfolio links.
    Expected: Each becomes [LINK].
    """
    out = redact_pii("github.com/somchai | https://somchai.dev | www.linkedin.com/in/somchai")
    assert out == "[LINK] | [LINK] | [LINK]"


@pytest.mark.parametrize("first_line", ["Senior Frontend Developer", "RESUME", "Curriculum Vitae", "Profile Summary"])
def test_a_title_on_the_first_line_is_not_taken_for_a_name(first_line: str) -> None:
    """
    Scenario: The first line is a job title or heading, not a person.
    Expected: Nothing is replaced as [NAME].
    """
    text = f"{first_line}\nBuilt dashboards with React."
    assert "[NAME]" not in redact_pii(text)


def test_every_occurrence_of_the_name_is_replaced() -> None:
    """
    Scenario: The name appears again later, e.g. in a reference line.
    Expected: Both occurrences are replaced, case-insensitively.
    """
    out = redact_pii("Anan Wong\nDevOps Engineer\nReferences: ask ANAN WONG's manager")
    assert "anan" not in out.lower()
    assert out.count("[NAME]") == 2


def test_the_language_model_receives_the_redacted_resume() -> None:
    """
    Scenario: Run the real prompt path with a fake LangChain.
    Expected: The resume variable sent to the model has no name or email.
    """
    sent = sent_resume(resumes.STRONG_SENIOR_FRONTEND)

    assert "Somchai Pattanakul" not in sent
    assert "@example.com" not in sent
    assert "[NAME]" in sent and "React" in sent


def test_sbert_still_receives_the_original_resume(monkeypatch) -> None:
    """
    Scenario: The hybrid score is computed.
    Expected: The local semantic model gets the unredacted text; only the
              external call is redacted.
    """
    seen = {}

    def spy(resume_text, job_description):
        seen["resume"] = resume_text
        return 50.0

    monkeypatch.setattr(resume_matcher, "match_resume_to_job", spy)
    with install_fake_langchain(fixed_responder(_OK)):
        resume_matcher.analyze_resume(resumes.STRONG_SENIOR_FRONTEND, "Senior Frontend Developer")

    assert seen["resume"] == resumes.STRONG_SENIOR_FRONTEND
