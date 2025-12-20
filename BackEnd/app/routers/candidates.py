"""Candidate-related routes.

Implements candidate creation with ML pipeline:
 - extract resume text
 - extract structured data (name/email/skills/etc.)
 - match resume against job description to compute matchScore

Debug endpoint available at /candidates/debug/test-ml for manual score checks.
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request, Depends
from typing import Optional
from datetime import datetime
from bson import ObjectId
import logging
import json
import re
from ..services.auth import Check_Token, require_role
from app.db import candidate_collection
from app.db import job_collection
from app.utils.file_storage import save_upload_file, unique_name, UPLOAD_DIR
from app.ml.resume_extractor import extract_resume_text, extract_resume_data as ml_extract_data
from app.ml.resume_matcher import match_resume_to_job
from app.services.resume_extraction import extract_resume_data as legacy_extract_from_path  # kept for fallback
from app.services.resume_matching import compute_match as legacy_compute_match  # fallback if needed
import os

router = APIRouter(prefix="/candidates", tags=["candidates"], dependencies=[Depends(Check_Token)])
logger = logging.getLogger("talenttrail.ml")
if not logger.handlers:
    # Basic handler if not configured by app
    handler = logging.StreamHandler()
    formatter = logging.Formatter("[%(asctime)s] %(levelname)s %(name)s: %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
logger.setLevel(logging.INFO)


def _is_placeholder_phone(value: Optional[str]) -> bool:
    """Heuristic check to decide if a phone looks like a placeholder.

    Rules:
    - empty or None
    - common mock strings like 'N/A', 'none'
    - specific samples: '+1 234 567 890', '+1 234 567 8900'
    - after stripping non-digits, length < 9 or obvious sequences like 1234567890/0123456789
    """
    if not value:
        return True
    s = value.strip().lower()
    if s in {"n/a", "na", "none", "unknown"}:
        return True
    if s in {"+1 234 567 890", "+1 234 567 8900"}:
        return True
    digits = re.sub(r"\D", "", s)
    if digits in {"", "1234567890", "0123456789"}:
        return True
    return len(digits) < 9

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

# Show on Terminal for Checking Log
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

    # JSON payload (from frontend add-candidate flow)
    if content_type.startswith("application/json"):
        payload = await request.json()
        if not isinstance(payload, dict):
            raise HTTPException(status_code=400, detail="Invalid JSON payload")
        payload.pop("id", None)  # let Mongo assign _id
        # Never trust client-sent matchScore; always recompute server-side
        if "matchScore" in payload:
            payload.pop("matchScore", None)
        payload.setdefault("created_at", datetime.utcnow().isoformat())
        payload.setdefault("status", "active")
        # Normalize resume url field name for consistency
        if "resumeUrl" in payload and "resume_url" not in payload:
            payload["resume_url"] = payload.get("resumeUrl")
        # Attempt ML pipeline even for JSON-only submissions (using resume_url if provided)
        try:
            position_role = payload.get("position") or payload.get("role")
            resume_url = payload.get("resume_url") or payload.get("resumeUrl")
            incoming_analysis = payload.get("resumeAnalysis") or {}
            resume_text = incoming_analysis.get("raw_text") or incoming_analysis.get("text_snippet") or ""

            resume_fs_path = None
            if resume_url and isinstance(resume_url, str) and resume_url.startswith("/uploads/"):
                filename = resume_url.split("/uploads/")[-1].strip()
                tentative_path = os.path.join(UPLOAD_DIR, filename)
                if os.path.exists(tentative_path):
                    resume_fs_path = tentative_path
                    print("📄 [ML] Extracting resume text from (JSON path):", resume_fs_path)
                    # Only extract if we don't already have raw_text
                    if not resume_text:
                        resume_text = extract_resume_text(resume_fs_path)
                        print("📄 [ML] Resume text length (JSON path):", len(resume_text))
                else:
                    print("⚠️ [ML] Resume file not found for", tentative_path)
            else:
                if resume_url:
                    print("⚠️ [ML] Unsupported resume_url format (JSON path):", resume_url)

            extracted_struct = {}
            if resume_text:
                extracted_struct = ml_extract_data(resume_text)
                print("🧠 [ML] Extracted fields (JSON path):", json.dumps(extracted_struct, indent=2, ensure_ascii=False))
                # Enrich top-level fields even if job match fails
                if (not payload.get("email") or payload.get("email") == "candidate@example.com") and extracted_struct.get("email"):
                    payload["email"] = extracted_struct.get("email")
                # Replace phone if it's missing or a known placeholder
                if _is_placeholder_phone(payload.get("phone")) and extracted_struct.get("phone"):
                    payload["phone"] = extracted_struct.get("phone")
                if not payload.get("name") and extracted_struct.get("name"):
                    payload["name"] = extracted_struct.get("name")
                if (not isinstance(payload.get("skills"), list)) or (isinstance(payload.get("skills"), list) and len(payload.get("skills")) == 0):
                    if extracted_struct.get("skills"):
                        payload["skills"] = extracted_struct.get("skills")

            # Prepare analysis block regardless of matching outcome
            analysis_block = payload.get("resumeAnalysis") or {}
            if extracted_struct:
                # Only set raw fields if not already present to avoid clobbering client-provided analysis
                for k, v in extracted_struct.items():
                    if k not in analysis_block or analysis_block.get(k) in (None, ""):
                        analysis_block[k] = v

            if position_role and resume_text:
                job_doc = job_collection.find_one({"role": position_role})
                if not job_doc:
                    # Case-insensitive exact match fallback
                    job_doc = job_collection.find_one({"role": {"$regex": f"^{re.escape(position_role)}$", "$options": "i"}})
                if job_doc:
                    print("📊 [ML] Matching with Job Description (JSON path):", job_doc.get("role"), "id=", job_doc.get("_id"))
                    score = match_resume_to_job(resume_text, job_doc.get("description") or "")
                    match_score = round(float(score), 2)
                    payload["matchScore"] = match_score
                    print("⭐ [ML] Computed match score (JSON path):", match_score)
                    analysis_block.setdefault("match", {"score": match_score})
                else:
                    print("⚠️ [ML] No job description found for role (JSON path):", position_role)
            else:
                print("⚠️ [ML] Insufficient data to compute matchScore (JSON path): position or resume_text missing")

            # Persist analysis block if we have extracted content or match score
            if analysis_block:
                payload["resumeAnalysis"] = analysis_block
        except Exception as e:
            print("❌ [ML] Exception in JSON pipeline:", e)
            logger.warning(f"Failed to compute matchScore (JSON path): {e}")

        res = candidate_collection.insert_one(payload)
        # PyMongo may mutate the original dict and add _id; remove it for JSON response
        if "_id" in payload:
            payload.pop("_id", None)
        payload["id"] = str(res.inserted_id)
        return payload

    # Multipart form-data (optional file upload path)
    resume_path = None
    public_url = None
    avatar_url = None
    if resume is not None:
        filename = unique_name("resume", resume.filename or "resume.pdf", ".pdf")
        dest = os.path.join(UPLOAD_DIR, filename)
        save_upload_file(resume, dest)
        resume_path = dest
        public_url = f"/uploads/{filename}"
    if avatar is not None:
        afn = unique_name("avatar", avatar.filename or "avatar.png", os.path.splitext(avatar.filename or "avatar.png")[1])
        adest = os.path.join(UPLOAD_DIR, afn)
        save_upload_file(avatar, adest)
        avatar_url = f"/uploads/{afn}"

    if not name or not email:
        raise HTTPException(status_code=400, detail="name and email are required")

    doc = {
        "name": name,
        "email": email,
        # Apply placeholder detection before persisting phone (will be enriched later if resume provided)
        "phone": None if _is_placeholder_phone(phone) else phone,
        "notes": notes,
        "position": position,
        "experience": experience,
        "avatar": avatar_url,
        "resume_path": resume_path,
        "resume_url": public_url,
        "created_at": datetime.utcnow().isoformat(),
        "status": "active",
    }

    # Run ML extraction & matching if we have a resume and position (multipart form path)
    try:
        if resume_path and position:
            print("📄 [ML] Extracting resume text from (multipart path):", resume_path)
            resume_text = extract_resume_text(resume_path)
            print("📄 [ML] Resume text length (multipart path):", len(resume_text))
            extracted = ml_extract_data(resume_text) if resume_text else {}
            print("🧠 [ML] Extracted fields (multipart path):", json.dumps(extracted, indent=2, ensure_ascii=False))

            # Enrich candidate fields if missing (do not override provided ones)
            # Enrich name/email if missing. For phone, also replace placeholders.
            if not doc.get("name") and extracted.get("name"):
                doc["name"] = extracted.get("name")
            if not doc.get("email") and extracted.get("email"):
                doc["email"] = extracted.get("email")
            if _is_placeholder_phone(doc.get("phone")) and extracted.get("phone"):
                doc["phone"] = extracted.get("phone")

            job_doc = job_collection.find_one({"role": position})
            if not job_doc:
                job_doc = job_collection.find_one({"role": {"$regex": f"^{re.escape(position)}$", "$options": "i"}})
            match_score = None
            if job_doc:
                print("📊 [ML] Matching with Job Description (multipart path):", job_doc.get("role"), "id=", job_doc.get("_id"))
                job_desc_text = job_doc.get("description") or ""
                match_score = match_resume_to_job(resume_text, job_desc_text)
                match_score = round(float(match_score), 2)
                print("⭐ [ML] Computed match score (multipart path):", match_score)
            else:
                print("⚠️ [ML] No job description found for role (multipart path):", position)

            if match_score is not None:
                doc["matchScore"] = match_score

            analysis_block = {**extracted}
            if match_score is not None:
                analysis_block["match"] = {"score": match_score}
            doc["resumeAnalysis"] = analysis_block
            # Also update top-level skills if not provided
            if (not isinstance(doc.get("skills"), list)) or (isinstance(doc.get("skills"), list) and len(doc.get("skills")) == 0):
                if extracted.get("skills"):
                    doc["skills"] = extracted.get("skills")
        else:
            print("⚠️ [ML] Skipping ML pipeline (multipart path) resume_path or position missing")
    except Exception as e:
        print("❌ [ML] Exception in multipart pipeline:", e)
        logger.warning(f"ML pipeline failed (multipart path): {e}")

    result = candidate_collection.insert_one(doc)
    # Remove Mongo's _id added by PyMongo to avoid JSON serialization issues
    if "_id" in doc:
        doc.pop("_id", None)
    doc["id"] = str(result.inserted_id)
    return doc


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


@router.post("/debug/test-ml")
async def debug_test_ml(resume_text: str = Form(...), job_role: str = Form(...)):
    """Debug endpoint: supply raw resume_text and a job role to compute match score."""
    job_doc = job_collection.find_one({"role": job_role})
    if not job_doc:
        raise HTTPException(status_code=404, detail="Job role not found")
    job_desc_text = job_doc.get("description") or ""
    score = match_resume_to_job(resume_text, job_desc_text)
    score = round(float(score), 2)
    logger.info(f"[debug_test_ml] score={score} role={job_role} text_len={len(resume_text)}")
    return {"matchScore": score, "jobRole": job_role, "resumeLength": len(resume_text)}
