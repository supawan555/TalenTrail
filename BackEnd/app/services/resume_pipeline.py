# app/services/resume_pipeline.py

from typing import Dict, Any, Optional
from datetime import datetime
import logging
import os

from app.ml.resume_extractor import extract_resume_text, extract_resume_data
from app.ml.resume_matcher import analyze_resume

try:
    from app.db import resume_analyses_collection
except Exception:
    resume_analyses_collection = None  # allow running without DB


logger = logging.getLogger("talenttrail.pipeline")


def analyze_resume_pipeline(
    file_path: str,
    job_description: Optional[str] = None,
    save: bool = False,
) -> Dict[str, Any]:
    """
    End-to-end resume processing pipeline

    Steps:
    1. Extract text from resume file
    2. Extract structured data (name, email, skills, etc.)
    3. Perform ML matching (optional)
    4. (Optional) Save result to database

    Args:
        file_path: path to resume file (PDF)
        job_description: optional job description text
        save: whether to persist result in DB

    Returns:
        dict: structured analysis result
    """

    # 0. Validate input
    if not os.path.exists(file_path):
        return {"error": "file_not_found"}

    # 1. Extract raw text
    resume_text = extract_resume_text(file_path)

    if not resume_text.strip():
        return {"error": "empty_resume_text"}

    # 2. Extract structured data
    extracted = extract_resume_data(resume_text)

    #3. Run matching (optional)
    match_result = None
    if job_description:
        try:
            match_result = analyze_resume(resume_text, job_description)
        except Exception as e:
            logger.warning("Matching failed: %s", e)
            match_result = {"error": "matching_failed"}

    # 4. Build final response
    result: Dict[str, Any] = {
        "candidate": {
            "name": extracted.get("name"),
            "email": extracted.get("email"),
            "phone": extracted.get("phone"),
        },
        "skills": extracted.get("skills", []),
        "experience": extracted.get("experience"),
        "match": match_result,
        "meta": {
            "file_path": file_path,
            "processed_at": datetime.utcnow().isoformat(),
        },
    }

    # 5. Optional: Save to DB
    if save and resume_analyses_collection is not None:
        try:
            insert_data = {
                **result,
                "raw_text": extracted.get("raw_text"),
            }
            inserted = resume_analyses_collection.insert_one(insert_data)
            result["id"] = str(inserted.inserted_id)
        except Exception as e:
            logger.error("DB insert failed: %s", e)

    return result


# Optional helper (cleaner usage in router)
def analyze_only(file_path: str) -> Dict[str, Any]:
    return analyze_resume_pipeline(file_path, job_description=None, save=False)


def analyze_with_job(file_path: str, job_description: str) -> Dict[str, Any]:
    return analyze_resume_pipeline(file_path, job_description=job_description, save=False)


def analyze_and_save(file_path: str, job_description: Optional[str] = None) -> Dict[str, Any]:
    return analyze_resume_pipeline(file_path, job_description=job_description, save=True)