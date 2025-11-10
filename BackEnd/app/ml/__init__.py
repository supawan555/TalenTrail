"""ML package exposing resume extraction and matching APIs.

Public API:
 - extract_resume_text(file_path: str) -> str
 - extract_resume_data(resume_text: str) -> dict
 - match_resume_to_job(resume_text: str, job_description_text: str) -> float
"""
