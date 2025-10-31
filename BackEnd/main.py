from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pydantic import BaseModel, Field
from bson.objectid import ObjectId
from typing import Optional, List
import json
import os
from fastapi import UploadFile, File, Request
from fastapi.staticfiles import StaticFiles
import shutil
import uuid
import sys
from datetime import datetime, timedelta
import pyotp
import hashlib
import hmac
import base64
import os as _os


app = FastAPI()

# Allow front-end dev server to call the API
# Broaden CORS to cover localhost and 127.0.0.1 dev servers on common ports
app.add_middleware(
    CORSMiddleware,
    # Keep a few common origins for clarity
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
    ],
    # And allow any localhost/127.0.0.1 with any port (e.g., 3001)
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = MongoClient("mongodb://localhost:27017/")
db = client["TalentTail"]

# Collections
candidate_collection = db["candidates"]
job_collection = db["job_descriptions"]
resume_analyses_collection = db["resume_analyses"]
auth_users_collection = db["auth_users"]
auth_sessions_collection = db["auth_sessions"]

# Additional DB for matching API
hr_db = client["hr_platform"]
jobs_collection = hr_db["jobs"]
users_collection = hr_db["users"]

# Import ML helpers (ensure project root on sys.path)
PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.append(PROJECT_ROOT)
try:
    from MachineLearning.ml_helpers import (
        preprocess_text,
        compute_match_score as ml_compute_match_score,
        extract_profile as ml_extract_profile,
    )
except Exception:
    # Fallback no-op functions if ML module not available
    def preprocess_text(x: str) -> str:
        return (x or "").lower()

    def ml_compute_match_score(a: str, b: str) -> float:
        return 0.0

    def ml_extract_profile(t: str):
        return {"email": None, "phone": None, "skills": []}

# Ensure uploads directory exists and mount it
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


def _save_upload_file(upload_file: UploadFile, destination: str):
    try:
        with open(destination, "wb") as buffer:
            shutil.copyfileobj(upload_file.file, buffer)
    finally:
        upload_file.file.close()


@app.post("/upload/profile-picture")
async def upload_profile_picture(request: Request, file: UploadFile = File(...)):
    """Accepts an image file and saves it under uploads/, returns public URL."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    fname = f"profile_{uuid.uuid4().hex}{ext}"
    dest = os.path.join(UPLOAD_DIR, fname)
    _save_upload_file(file, dest)
    base = str(request.base_url).rstrip("/")
    return {"url": f"{base}/uploads/{fname}"}


@app.post("/upload/resume")
async def upload_resume(request: Request, file: UploadFile = File(...)):
    """Accepts a PDF resume and saves it under uploads/, returns public URL."""
    if file.content_type != "application/pdf" and not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Resume must be a PDF file")
    ext = os.path.splitext(file.filename)[1] or ".pdf"
    fname = f"resume_{uuid.uuid4().hex}{ext}"
    dest = os.path.join(UPLOAD_DIR, fname)
    _save_upload_file(file, dest)
    base = str(request.base_url).rstrip("/")
    url = f"{base}/uploads/{fname}"

    # Attempt to run ML analyzer script located in MachineLearning/analyze_resume.py
    analysis = None
    try:
        analyze_script = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "MachineLearning", "analyze_resume.py"))
        if os.path.exists(analyze_script):
            import subprocess, sys
            # Use the same Python interpreter that's running this process
            proc = subprocess.run([sys.executable, analyze_script, dest], capture_output=True, text=True, timeout=30)
            if proc.returncode == 0 and proc.stdout:
                try:
                    analysis = json.loads(proc.stdout)
                except Exception:
                    analysis = {"error": "invalid_json_from_analyzer", "raw": proc.stdout}
            else:
                analysis = {"error": "analyzer_failed", "stderr": proc.stderr}
        else:
            analysis = {"error": "analyzer_not_found", "path": analyze_script}
    except Exception as e:
        analysis = {"error": "analyzer_exception", "detail": str(e)}

    # Persist analysis to DB for later association
    try:
        size_bytes = os.path.getsize(dest)
    except Exception:
        size_bytes = None

    try:
        record = {
            "file_name": file.filename,
            "server_path": dest,
            "public_url": url,
            "content_type": file.content_type,
            "size_bytes": size_bytes,
            "analysis": analysis,
            "uploaded_at": datetime.utcnow().isoformat(),
        }
        inserted = resume_analyses_collection.insert_one(record)
        analysis_id = str(inserted.inserted_id)
    except Exception as e:
        print("Failed to save resume analysis:", e)
        analysis_id = None

    return {"url": url, "analysis": analysis, "analysis_id": analysis_id}


@app.on_event("startup")
async def preload_job_descriptions():
    """If the job_descriptions collection is empty, preload entries from mock_job_descriptions.json."""
    try:
        exist_count = job_collection.count_documents({})
        if exist_count > 0:
            return
        path = os.path.join(os.path.dirname(__file__), "mock_job_descriptions.json")
        if not os.path.exists(path):
            return
        with open(path, "r", encoding="utf-8") as f:
            items = json.load(f)

        # Convert items for insertion: remove any `id` fields so Mongo assigns _id, but preserve createdDate
        to_insert = []
        for it in items:
            doc = {k: v for k, v in it.items() if k != "id"}
            to_insert.append(doc)

        if to_insert:
            job_collection.insert_many(to_insert)
            print(f"Preloaded {len(to_insert)} job descriptions into MongoDB")
    except Exception as e:
        print("Failed to preload job descriptions:", e)


class Candidate(BaseModel):
    id: Optional[str] = None
    name: str
    email: str


class JobDescriptionIn(BaseModel):
    department: str
    role: str
    description: str


class JobDescriptionOut(JobDescriptionIn):
    id: str = Field(..., alias="id")
    createdDate: Optional[str] = None


# ===== Matching API Schemas =====
class JobOut(BaseModel):
    id: str
    title: str


class MatchRequest(BaseModel):
    resume_text: str
    job_id: str


class MatchResponse(BaseModel):
    match_score: float
    profile: dict
    job_title: str


@app.get("/")
async def root():
    return {"message": "Hello, World!"}


# ================== Auth Models ==================
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: Optional[str] = None


class RegisterResponse(BaseModel):
    message: str
    otpauth_url: str
    secret: str


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    otp_required: bool = True
    pendingToken: str


class VerifyOtpRequest(BaseModel):
    pendingToken: str
    code: str


class TokenResponse(BaseModel):
    accessToken: str
    tokenType: str = "bearer"


_PBKDF_ITER = 200_000


def _hash_password(pw: str) -> dict:
    salt = _os.urandom(16)
    dk = hashlib.pbkdf2_hmac('sha256', pw.encode('utf-8'), salt, _PBKDF_ITER)
    return {
        "alg": "pbkdf2_sha256",
        "iter": _PBKDF_ITER,
        "salt": base64.b64encode(salt).decode('ascii'),
        "hash": base64.b64encode(dk).decode('ascii'),
    }


def _verify_password(pw: str, stored: dict) -> bool:
    try:
        if not stored or stored.get("alg") != "pbkdf2_sha256":
            return False
        iter_ = int(stored.get("iter", _PBKDF_ITER))
        salt = base64.b64decode(stored.get("salt", ""))
        expected = base64.b64decode(stored.get("hash", ""))
        dk = hashlib.pbkdf2_hmac('sha256', pw.encode('utf-8'), salt, iter_)
        # Use constant-time comparison to avoid timing attacks
        return hmac.compare_digest(dk, expected)
    except Exception:
        return False


@app.post("/auth/register", response_model=RegisterResponse)
async def auth_register(req: RegisterRequest):
    email = req.email.strip().lower()
    if not email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    if auth_users_collection.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email already registered")

    # Use static secret in dev if provided, else generate per-user
    secret = os.getenv("TALENTTAIL_TOTP_STATIC_SECRET") or pyotp.random_base32()
    hashed = _hash_password(req.password)
    doc = {
        "name": req.name,
        "email": email,
        "password_hash": hashed,
        "role": req.role,
        "totp_secret": secret,
        "twofa_enabled": True,
        "created_at": datetime.utcnow().isoformat(),
    }
    auth_users_collection.insert_one(doc)

    issuer = os.getenv("TALENTTAIL_TOTP_ISSUER", "TalentTail")
    otpauth_url = pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)
    return RegisterResponse(message="Registered successfully", otpauth_url=otpauth_url, secret=secret)


@app.post("/auth/login", response_model=LoginResponse)
async def auth_login(req: LoginRequest):
    email = req.email.strip().lower()
    user = auth_users_collection.find_one({"email": email})
    if not user or not _verify_password(req.password, user.get("password_hash")):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Create short-lived pending session for OTP verify
    token = uuid.uuid4().hex
    auth_sessions_collection.insert_one({
        "token": token,
        "user_id": user["_id"],
        "stage": "pending",
        "expires_at": (datetime.utcnow() + timedelta(minutes=5)).isoformat()
    })
    return LoginResponse(otp_required=True, pendingToken=token)


@app.post("/auth/verify-otp", response_model=TokenResponse)
async def auth_verify_otp(req: VerifyOtpRequest):
    session = auth_sessions_collection.find_one({"token": req.pendingToken, "stage": "pending"})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid pending token")

    # Check expiry
    try:
        if datetime.fromisoformat(session.get("expires_at")) < datetime.utcnow():
            raise HTTPException(status_code=401, detail="Pending token expired")
    except Exception:
        pass

    user = auth_users_collection.find_one({"_id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    secret = user.get("totp_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="TOTP not configured")

    if not pyotp.TOTP(secret).verify(req.code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid OTP code")

    # Mark session as authenticated and issue a simple access token
    access = uuid.uuid4().hex
    auth_sessions_collection.update_one({"_id": session["_id"]}, {"$set": {"stage": "done", "access": access}})
    return TokenResponse(accessToken=access)


@app.post("/candidates/")
async def create_candidate(candidate: dict):
    """Create candidate. Accepts arbitrary JSON body (candidate object)."""
    data = dict(candidate)
    # remove id if provided so Mongo assigns ObjectId
    data.pop("id", None)
    # If resumeAnalysis not provided but resumeUrl exists, try to attach the stored analysis
    if not data.get("resumeAnalysis") and data.get("resumeUrl"):
        try:
            rec = resume_analyses_collection.find_one({"public_url": data["resumeUrl"]})
            if rec and rec.get("analysis"):
                data["resumeAnalysis"] = rec["analysis"]
                # Optionally, if skills not provided, adopt from analysis
                if not data.get("skills") and isinstance(rec["analysis"], dict):
                    skills = rec["analysis"].get("skills")
                    if isinstance(skills, list):
                        data["skills"] = skills
        except Exception as e:
            print("Failed to attach resume analysis to candidate:", e)
    result = candidate_collection.insert_one(data)
    created = candidate_collection.find_one({"_id": result.inserted_id})
    if not created:
        raise HTTPException(status_code=500, detail="Failed to create candidate")
    # convert _id to id string
    created["id"] = str(created.pop("_id"))
    return created


@app.get("/candidates/")
async def list_candidates():
    docs = candidate_collection.find().sort([("_id", -1)])
    results = []
    for d in docs:
        doc = dict(d)
        doc["id"] = str(doc.pop("_id"))
        results.append(doc)
    return results


@app.get("/candidates/{candidate_id}")
async def get_candidate(candidate_id: str):
    try:
        oid = ObjectId(candidate_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid candidate id")

    doc = candidate_collection.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Candidate not found")
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc


@app.put("/candidates/{candidate_id}")
async def update_candidate(candidate_id: str, payload: dict):
    try:
        oid = ObjectId(candidate_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid candidate id")

    data = dict(payload or {})
    # Prevent overwriting the Mongo _id accidentally
    data.pop("_id", None)
    data.pop("id", None)

    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    res = candidate_collection.update_one({"_id": oid}, {"$set": data})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Candidate not found")

    updated = candidate_collection.find_one({"_id": oid})
    if not updated:
        raise HTTPException(status_code=404, detail="Candidate not found after update")
    updated = dict(updated)
    updated["id"] = str(updated.pop("_id"))
    return updated


@app.delete("/candidates/{candidate_id}")
async def delete_candidate(candidate_id: str):
    try:
        oid = ObjectId(candidate_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid candidate id")

    res = candidate_collection.delete_one({"_id": oid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return {"ok": True}


@app.post("/job-descriptions/", response_model=JobDescriptionOut)
async def create_job_description(job: JobDescriptionIn):
    data = job.dict()
    # add createdDate (ISO date)
    from datetime import datetime

    data["createdDate"] = datetime.utcnow().isoformat()
    result = job_collection.insert_one(data)
    created = job_collection.find_one({"_id": result.inserted_id})
    if not created:
        raise HTTPException(status_code=500, detail="Failed to create job description")
    return {
        "id": str(created["_id"]),
        "department": created.get("department"),
        "role": created.get("role"),
        "description": created.get("description"),
        "createdDate": created.get("createdDate"),
    }


@app.get("/job-descriptions/", response_model=List[JobDescriptionOut])
async def list_job_descriptions():
    docs = job_collection.find().sort([("_id", -1)])
    results = []
    for d in docs:
        results.append(
            {
                "id": str(d.get("_id")),
                "department": d.get("department"),
                "role": d.get("role"),
                "description": d.get("description"),
                "createdDate": d.get("createdDate"),
            }
        )
    return results


@app.put("/job-descriptions/{job_id}", response_model=JobDescriptionOut)
async def update_job_description(job_id: str, job: JobDescriptionIn):
    """Update an existing job description by id."""
    try:
        oid = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job id")

    data = job.dict()
    # Do not touch createdDate here; only update provided fields
    result = job_collection.update_one({"_id": oid}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Job description not found")

    updated = job_collection.find_one({"_id": oid})
    if not updated:
        raise HTTPException(status_code=404, detail="Job description not found after update")

    return {
        "id": str(updated["_id"]),
        "department": updated.get("department"),
        "role": updated.get("role"),
        "description": updated.get("description"),
        "createdDate": updated.get("createdDate"),
    }


@app.delete("/job-descriptions/{job_id}")
async def delete_job_description(job_id: str):
    """Delete a job description by id."""
    try:
        oid = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job id")

    result = job_collection.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job description not found")
    return {"ok": True}


@app.get("/internal/debug-job-preload")
async def debug_job_preload():
    """Debug endpoint: returns collection count and mock file status."""
    try:
        count = job_collection.count_documents({})
    except Exception as e:
        return {"ok": False, "error": f"DB error: {e}"}

    path = os.path.join(os.path.dirname(__file__), "mock_job_descriptions.json")
    file_exists = os.path.exists(path)
    sample = None
    try:
        sample_doc = job_collection.find_one()
        if sample_doc:
            # convert _id to str for JSON
            sample = {k: (str(v) if k == "_id" else v) for k, v in sample_doc.items()}
    except Exception:
        sample = None

    return {
        "ok": True,
        "count": count,
        "mock_file_path": path,
        "mock_file_exists": file_exists,
        "sample_doc": sample,
    }


# ================= Matching API =================
@app.get("/jobs", response_model=List[JobOut])
async def list_jobs():
    docs = jobs_collection.find()
    out: List[JobOut] = []
    for d in docs:
        # Expecting fields: _id, title
        title = d.get("title") or d.get("role") or d.get("name") or "Untitled"
        out.append(JobOut(id=str(d.get("_id")), title=title))
    return out


@app.post("/match", response_model=MatchResponse)
async def match_resume(req: MatchRequest):
    # Validate job id
    try:
        oid = ObjectId(req.job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job_id")

    job = jobs_collection.find_one({"_id": oid})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get job description from document (try common fields)
    job_desc = job.get("description") or job.get("job_description") or job.get("desc") or ""
    if not job_desc:
        raise HTTPException(status_code=422, detail="Job document missing description")

    # Preprocess texts
    resume_prep = preprocess_text(req.resume_text)
    job_prep = preprocess_text(job_desc)

    # Compute match score using TF-IDF + cosine similarity
    score = ml_compute_match_score(resume_prep, job_prep)

    # Extract profile info
    profile = ml_extract_profile(req.resume_text)

    # Persist in users collection
    user_doc = {
        "resume_text": req.resume_text,
        "email": profile.get("email"),
        "phone": profile.get("phone"),
        "skills": profile.get("skills", []),
        "matched_job_id": oid,
        "match_score": score,
    }
    try:
        users_collection.insert_one(user_doc)
    except Exception as e:
        # Log error but still return successful match; in production, consider failing the request
        print("Failed to save user match:", e)

    job_title = job.get("title") or job.get("role") or job.get("name") or "Untitled"
    return MatchResponse(match_score=score, profile=profile, job_title=job_title)