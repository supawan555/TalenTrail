"""Matching routes between candidate resumes and jobs."""
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from typing import Optional
from bson import ObjectId

from app.db import resume_analyses_collection, candidate_collection, job_collection
from app.services.auth import get_current_user_from_cookie
from app.services.resume_pipeline import analyze_with_job
from app.utils import storage
from app.utils.file_storage import unique_name

# Requires login: this route stores files and spends Gemini quota.
router = APIRouter(prefix="/match", tags=["matching"], dependencies=[Depends(get_current_user_from_cookie)])


@router.post("/analyze")
async def analyze_resume(candidate_id: Optional[str] = Form(None), job_id: Optional[str] = Form(None), file: Optional[UploadFile] = File(None)):
    if not (candidate_id or file):
        raise HTTPException(status_code=400, detail="Provide either candidate_id or resume file")

    candidate = None
    if candidate_id:
        try:
            oid = ObjectId(candidate_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid candidate id")
        candidate = candidate_collection.find_one({"_id": oid})
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")

    job = None
    if job_id:
        try:
            jid = ObjectId(job_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid job id")
        job = job_collection.find_one({"_id": jid})

    resume_key = None
    if file is not None:
        resume_key = unique_name("analysis", "resume.pdf", ".pdf")
        storage.save(resume_key, storage.read_upload(file), "application/pdf")
    elif candidate:
        resume_key = candidate.get("resume_file") or storage.key_from_url(
            candidate.get("resume_url") or candidate.get("resumeUrl")
        )

    if not resume_key:
        raise HTTPException(status_code=400, detail="No resume available for analysis")

    with storage.local_copy(resume_key) as path:
        if not path:
            raise HTTPException(status_code=404, detail="Resume file not found")
        # analyze_with_job expects the description text, not the job document
        analysis = analyze_with_job(path, job.get("description") if job else None)

    doc = {
        "candidate_id": candidate.get("_id") if candidate else None,
        "job_id": job.get("_id") if job else None,
        "resume_file": resume_key,
        "analysis": analysis,
    }
    ins = resume_analyses_collection.insert_one(doc)
    doc["id"] = str(ins.inserted_id)
    return doc
