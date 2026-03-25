"""Resume-to-job matching adapter for the improved ML analyzer.

The legacy service API accepted ``compute_match(extracted, job)``. This module
now routes that contract through ``app.ml.resume_matcher.analyze_resume`` and
keeps a compatibility wrapper so existing imports keep working.
"""
from __future__ import annotations
import logging
from typing import Dict, Any
from app.ml.resume_matcher import analyze_resume as _analyze_resume


logger = logging.getLogger("talenttrail.ml")


def _extract_text_payload(extracted: Dict[str, Any] | None, job: Dict[str, Any] | str | None) -> tuple[str, str]:
    """Normalize service inputs into raw resume and job text."""
    extracted = extracted or {}
    resume_text = str(
        extracted.get("raw_text")
        or extracted.get("text_snippet")
        or extracted.get("text")
        or ""
    )
    if isinstance(job, str):
        job_text = job
    else:
        job = job or {}
        job_text = str(job.get("description") or job.get("job_description") or "")
    return resume_text, job_text


def _coerce_service_result(ml_result: Dict[str, Any]) -> Dict[str, Any]:
    """Map the improved ML payload to the legacy service response shape."""
    final_score = int(ml_result.get("final_score") or 0)
    semantic_score = float(ml_result.get("semantic_score") or 0.0)
    llm_score = int(ml_result.get("llm_score") or 0)
    strengths = list(ml_result.get("strengths") or [])
    missing_skills = list(ml_result.get("missing_skills") or [])

    return {
        "score": max(0, min(100, final_score)),
        "details": {
            "jd_match_pct": round(semantic_score, 2),
            "skill_overlap_pct": 0.0,
            "text_similarity": round(semantic_score / 100.0, 4),
            "jd_skills": strengths,
            "cv_skills": missing_skills,
            "reason": "ok",
            "explanation": (
                "Hybrid score from app.ml.resume_matcher.analyze_resume "
                f"(llm_score={llm_score}, semantic_score={semantic_score:.2f})."
            ),
        },
    }


def analyze_resume(extracted: Dict[str, Any], job: Dict[str, Any] | str) -> Dict[str, Any]:
    """Run the improved resume analyzer and keep the old service response shape."""
    resume_text, job_text = _extract_text_payload(extracted, job)
    ml_result = _analyze_resume(resume_text, job_text)
    service_result = _coerce_service_result(ml_result)
    logger.info(
        "[ML] resume_matching.analyze_resume produced result: score=%s final_score=%s",
        service_result.get("score"),
        service_result.get("score"),
    )
    return service_result


def compute_match(extracted: Dict[str, Any], job: Dict[str, Any] | str) -> Dict[str, Any]:
    """Backward-compatible alias for the legacy service contract."""
    service_result = analyze_resume(extracted, job)
    logger.info(
        "[ML] resume_matching.compute_match produced result via analyze_resume: score=%s",
        service_result.get("score"),
    )
    return service_result


__all__ = ["analyze_resume", "compute_match"]
