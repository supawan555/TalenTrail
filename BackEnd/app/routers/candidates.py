"""Candidate-related routes."""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from typing import Optional
from datetime import datetime
from bson import ObjectId

from app.db import candidate_collection
from app.utils.file_storage import save_upload_file, unique_name, UPLOAD_DIR
import os

router = APIRouter(prefix="/candidates", tags=["candidates"])


@router.get("")
async def list_candidates():
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
    resume: Optional[UploadFile] = File(None),
):
    content_type = request.headers.get("content-type", "").lower()
    # JSON payload (from frontend add-candidate flow)
    if content_type.startswith("application/json"):
        payload = await request.json()
        if not isinstance(payload, dict):
            raise HTTPException(status_code=400, detail="Invalid JSON payload")
        payload.pop("id", None)  # let Mongo assign _id
        payload.setdefault("created_at", datetime.utcnow().isoformat())
        payload.setdefault("status", "active")
        res = candidate_collection.insert_one(payload)
        payload["id"] = str(res.inserted_id)
        return payload

    # Multipart form-data (optional file upload path)
    resume_path = None
    public_url = None
    if resume is not None:
        filename = unique_name("resume", resume.filename or "resume.pdf", ".pdf")
        dest = os.path.join(UPLOAD_DIR, filename)
        save_upload_file(resume, dest)
        resume_path = dest
        public_url = f"/uploads/{filename}"

    if not name or not email:
        raise HTTPException(status_code=400, detail="name and email are required")

    doc = {
        "name": name,
        "email": email,
        "phone": phone,
        "notes": notes,
        "resume_path": resume_path,
        "resume_url": public_url,
        "created_at": datetime.utcnow().isoformat(),
        "status": "active",
    }
    result = candidate_collection.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return doc


@router.post("/")
async def create_candidate_slash(
    request: Request,
    name: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    resume: Optional[UploadFile] = File(None),
):
    return await create_candidate(request=request, name=name, email=email, phone=phone, notes=notes, resume=resume)


@router.delete("/{candidate_id}")
async def delete_candidate(candidate_id: str):
    try:
        oid = ObjectId(candidate_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid candidate id")
    res = candidate_collection.delete_one({"_id": oid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return {"deleted": True}


@router.get("/{candidate_id}")
async def get_candidate(candidate_id: str):
    try:
        oid = ObjectId(candidate_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid candidate id")
    doc = candidate_collection.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Candidate not found")
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.put("/{candidate_id}")
async def update_candidate(candidate_id: str, request: Request):
    try:
        oid = ObjectId(candidate_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid candidate id")

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
    # Update timestamp
    payload["updated_at"] = datetime.utcnow().isoformat()

    res = candidate_collection.update_one({"_id": oid}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Candidate not found")

    doc = candidate_collection.find_one({"_id": oid})
    doc["id"] = str(doc.pop("_id"))
    return doc
