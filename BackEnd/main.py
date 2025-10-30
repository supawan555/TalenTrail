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

app = FastAPI()

# Allow front-end dev server to call the API
# Assumption: front-end runs on http://localhost:5173 (Vite default). Add more origins if needed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = MongoClient("mongodb://localhost:27017/")
db = client["TalentTail"]

# Collections
candidate_collection = db["candidates"]
job_collection = db["job_descriptions"]

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

    return {"url": url, "analysis": analysis}


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


@app.get("/")
async def root():
    return {"message": "Hello, World!"}


@app.post("/candidates/")
async def create_candidate(candidate: dict):
    """Create candidate. Accepts arbitrary JSON body (candidate object)."""
    data = dict(candidate)
    # remove id if provided so Mongo assigns ObjectId
    data.pop("id", None)
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