"""Candidate-related routes.

Implements candidate creation with ML pipeline:
 - extract resume text
 - extract structured data (name/email/skills/etc.)
 - match resume against job description to compute matchScore

Debug endpoint available at /candidates/debug/test-ml for manual score checks.
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request, Depends
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
import logging
import json
import re
from app.utils.file_handler import handle_candidate_uploads
from app.services.candidates import process_candidate_ml_pipeline, init_candidate_metadata
from ..services.auth import get_current_user_from_cookie, require_role
from app.db import candidate_collection
from app.db import job_collection
from app.db import candidate_notes_collection
from app.utils.file_storage import save_upload_file, unique_name, UPLOAD_DIR
from app.ml.resume_extractor import extract_resume_text, extract_resume_data as ml_extract_data
from app.ml.resume_matcher import analyze_resume
from app.services.resume_extraction import extract_resume_data as legacy_extract_from_path  # kept for fallback
import os

router = APIRouter(prefix="/candidates", tags=["candidates"], dependencies=[Depends(get_current_user_from_cookie)])
logger = logging.getLogger("talenttrail.ml")
if not logger.handlers:
    # Basic handler if not configured by app
    handler = logging.StreamHandler()
    formatter = logging.Formatter("[%(asctime)s] %(levelname)s %(name)s: %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Show List candidates
@router.get("")
async def list_candidates(
):
    items = []
    for c in candidate_collection.find().sort("created_at", -1):
        c["id"] = str(c.pop("_id"))
        items.append(c)
    # Frontend expects a raw array (not wrapped) based on candidates.tsx
    return items

# Backward-compatible trailing-slash routes to avoid 307 redirects
@router.get("/")
async def list_candidates_slash():
    return await list_candidates()


@router.post("")
async def create_candidate(
    request: Request,
    name: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    position: Optional[str] = Form(None),
    experience: Optional[str] = Form(None),
    avatar: Optional[UploadFile] = File(None),
    resume: Optional[UploadFile] = File(None),
):
    content_type = request.headers.get("content-type", "").lower()

    # 1. รวมข้อมูล (Normalizing Data)
    if "application/json" in content_type:
        payload = await request.json()
        resume_url = payload.get("resumeUrl")

        if resume_url:
            relative_path = resume_url.lstrip("/")
            full_path = os.path.abspath(relative_path)
            payload["resume_path"] = full_path
        print(f"Received JSON payload: {payload}")
    else:
        # ถ้ามาเป็น Form-data ก็จับยัดใส่ dict
        res_path, res_url, ava_url = handle_candidate_uploads(resume, avatar)
        payload = {
            "name": name, "email": email, "phone": phone, 
            "resume_path": res_path, "resume_url": res_url, "avatar": ava_url,
            "position": position, "experience": experience
        }
        

    # 2. จัดการ Metadata & Cleanup
    payload.pop("id", None)
    payload.pop("matchScore", None)
    payload = init_candidate_metadata(payload)

    # 3. รัน ML Pipeline 
    payload = await process_candidate_ml_pipeline(payload, payload.get("resume_path"))
    
    # 4. บันทึกลง DB
    result = candidate_collection.insert_one(payload)

    # ดึงค่า ID มาเก็บไว้เป็น String ก่อน
    new_id = str(result.inserted_id)
    if "_id" in payload:
        payload.pop("_id")
    payload["id"] = new_id
    return payload


@router.post("/")
async def create_candidate_slash(
    request: Request,
    name: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    position: Optional[str] = Form(None),
    experience: Optional[str] = Form(None),
    avatar: Optional[UploadFile] = File(None),
    resume: Optional[UploadFile] = File(None),
):
    # Delegate to main handler for logic consistency
    return await create_candidate(
        request=request,
        name=name,
        email=email,
        phone=phone,
        notes=notes,
        position=position,
        experience=experience,
        avatar=avatar,
        resume=resume,
    )


@router.delete("/{candidate_id}")
async def delete_candidate(candidate_id: str):
    try:
        oid = ObjectId(candidate_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid candidate id")
    # 1. ค้นหาข้อมูลก
    candidate = candidate_collection.find_one({"_id": oid})
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # 2. ลบไฟล์จริงในเครื่อง
    resume_path = candidate.get("resume_path")
    if resume_path and os.path.exists(resume_path):
        try:
            os.remove(resume_path)
            print(f"🗑️ Deleted file: {resume_path}")
        except Exception as e:
            print(f"Could not delete file: {e}")

    # 3. ลบข้อมูลใน MongoDB
    candidate_collection.delete_one({"_id": oid})

    return {"deleted": True, "message": "Candidate and associated files removed"}


@router.get("/{candidate_id}")
async def get_candidate(candidate_id: str):
    try:
        oid = ObjectId(candidate_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid candidate id")
    doc = candidate_collection.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Candidate not found")
    # เอา note มาด้วย
    notes = []
    for n in candidate_notes_collection.find({"candidate_id": oid}).sort("timestamp", -1):
        note = {
            "id": str(n.get("_id")),
            "author": str(n.get("author", "")),
            "content": str(n.get("content", "")),
            "timestamp": (n.get("timestamp") or datetime.now(timezone.utc)).isoformat(),
            "type": str(n.get("type", "")),
        }
        notes.append(note)
    doc["notes"] = notes
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.put("/{candidate_id}")
async def update_candidate(candidate_id: str, request: Request):
    try:
        oid = ObjectId(candidate_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid candidate id")

    existing = candidate_collection.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Candidate not found")

    try:
        payload = await request.json()
        if not isinstance(payload, dict):
            raise ValueError("payload must be object")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    payload.pop("id", None)
    # Normalize some field names from frontend
    if "resumeUrl" in payload and "resume_url" not in payload:
        payload["resume_url"] = payload.pop("resumeUrl")
    if "archivedDate" in payload and "archived_date" not in payload:
        payload["archived_date"] = payload.get("archivedDate")

    now_dt = datetime.utcnow()
    payload["updated_at"] = now_dt.isoformat()

    incoming_stage = payload.get("stage") or payload.get("current_state")
    normalized_stage = None
    if isinstance(incoming_stage, str):
        normalized_stage = incoming_stage.strip().lower()
        payload["stage"] = normalized_stage
    elif incoming_stage is not None:
        normalized_stage = incoming_stage

    previous_stage = existing.get("stage") or existing.get("current_state")
    prev_stage_norm = previous_stage.strip().lower() if isinstance(previous_stage, str) else previous_stage

    if normalized_stage:
        payload["current_state"] = normalized_stage

    if normalized_stage and normalized_stage != prev_stage_norm:
        history = existing.get("state_history") or []
        updated_history = []
        closed_prev = False
        for entry in history:
            entry_copy = dict(entry)
            entry_state = entry_copy.get("state")
            entry_state_norm = entry_state.strip().lower() if isinstance(entry_state, str) else entry_state
            exited_at = entry_copy.get("exited_at")
            is_open = exited_at is None or (isinstance(exited_at, str) and exited_at.strip().lower() in {"", "none"})
            if (not closed_prev) and entry_state_norm == prev_stage_norm and is_open:
                entry_copy["exited_at"] = now_dt
                closed_prev = True
            updated_history.append(entry_copy)
        updated_history.append({"state": normalized_stage, "entered_at": now_dt, "exited_at": None})
        payload["state_history"] = updated_history

        stage_timestamp_fields = {
            "screening": "screening_at",
            "interview": "interview_at",
            "final": "final_at",
        }
        ts_field = stage_timestamp_fields.get(normalized_stage)
        if ts_field and not existing.get(ts_field):
            payload[ts_field] = now_dt

        if normalized_stage == "hired":
            payload["hired_at"] = now_dt
            payload["rejected_at"] = None
            payload["dropped_at"] = None
            payload["status"] = "hired"
        elif normalized_stage == "archived":
            # For archived stage, preserve existing hired/rejected/dropped status
            # This allows auto-archived hired candidates to retain their hired status
            payload.setdefault("archived_date", now_dt)
            # Don't override status - keep existing (hired/inactive/active)
            payload.setdefault("status", existing.get("status", "active"))
        elif normalized_stage == "rejected":
            payload["rejected_at"] = now_dt
            payload["status"] = "inactive"
        elif normalized_stage in {"drop-off", "dropoff", "dropped"}:
            payload["dropped_at"] = now_dt
            payload["status"] = "inactive"
        else:
            payload.setdefault("status", existing.get("status", "active"))

    res = candidate_collection.update_one({"_id": oid}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Candidate not found")

    doc = candidate_collection.find_one({"_id": oid})
    doc["id"] = str(doc.pop("_id"))
    return doc

