"""High-level resume-to-job matching API expected by the app.

Function:
- match_resume_to_job(resume_text: str, job_description_text: str) -> float

Bridges to existing services-based matcher for consistency.
"""
from __future__ import annotations
from typing import Any

from app.services.resume_matching import compute_match


def match_resume_to_job(resume_text: str, job_description_text: str) -> float:
    extracted = {
        'raw_text': resume_text or '',
        'skills': [],  # skills overlap is optional here; text similarity will still work
    }
    job_doc: dict[str, Any] = {'description': job_description_text or ''}
    result = compute_match(extracted, job_doc)
    # Return as float for rounding at the caller
    return float(result.get('score', 0))

__all__ = ['match_resume_to_job']
