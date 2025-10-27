from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pydantic import BaseModel, Field
from bson.objectid import ObjectId
from typing import Optional, List
import json
import os

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
async def create_candidate(candidate: Candidate):
    data = candidate.dict()
    # remove id if None to let Mongo assign ObjectId
    data.pop("id", None)
    result = candidate_collection.insert_one(data)
    return {
        "id": str(result.inserted_id),
        "name": candidate.name,
        "email": candidate.email,
    }


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