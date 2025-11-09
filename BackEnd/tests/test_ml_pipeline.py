"""Basic ML pipeline test for resume/job matching.

Run with: pytest -q
Assumes a running Mongo connection same as app.db uses.
"""
from app.ml.resume_matcher import match_resume_to_job


def test_match_resume_to_job_variability():
    resume_a = "Experienced Python and React engineer with AWS and Docker skills."  # should score higher
    resume_b = "Experienced accounting professional with GAAP compliance background."  # unrelated
    job_desc = "We need a Software Engineer with strong Python, React, AWS, Docker experience."  # target

    score_a = match_resume_to_job(resume_a, job_desc)
    score_b = match_resume_to_job(resume_b, job_desc)

    assert 0 <= score_a <= 100
    assert 0 <= score_b <= 100
    # Expect resume_a to have a higher score than resume_b
    assert score_a > score_b, f"Expected resume_a score {score_a} > resume_b score {score_b}"
