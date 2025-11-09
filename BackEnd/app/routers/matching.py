"""Matching routes between candidate resumes and jobs."""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from bson import ObjectId
import os

from app.db import resume_analyses_collection, candidate_collection, job_collection
from app.utils.file_storage import unique_name, save_upload_file, UPLOAD_DIR
from app.services.resume_analysis import run_external_analyzer

router = APIRouter(prefix="/match", tags=["matching"])


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

    local_path = None
    if file is not None:
        filename = unique_name("analysis", file.filename or "resume.pdf", ".pdf")
        dest = os.path.join(UPLOAD_DIR, filename)
        save_upload_file(file, dest)
        local_path = dest
    elif candidate and candidate.get("resume_path"):
        local_path = candidate.get("resume_path")

    if not local_path:
        raise HTTPException(status_code=400, detail="No resume available for analysis")

    analysis = run_external_analyzer(local_path)
    doc = {
        "candidate_id": candidate.get("_id") if candidate else None,
        "job_id": job.get("_id") if job else None,
        "resume_path": local_path,
        "analysis": analysis,
    }
    ins = resume_analyses_collection.insert_one(doc)
    doc["id"] = str(ins.inserted_id)
    return doc
