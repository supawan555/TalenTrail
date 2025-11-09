"""Job Descriptions routes."""
from fastapi import APIRouter, HTTPException
from typing import List
from bson import ObjectId
from datetime import datetime

from app.db import job_collection
from app.models.jobs import JobDescriptionIn, JobDescriptionOut

router = APIRouter(prefix="/jobs", tags=["jobs"])

# Backward compatibility router for legacy path /job-descriptions
legacy_router = APIRouter(prefix="/job-descriptions", tags=["jobs-legacy"])


@router.get("", response_model=List[JobDescriptionOut])
async def list_jobs():
    def to_out(j: dict) -> JobDescriptionOut:
        dept = j.get("department") or j.get("dept") or "General"
        role = j.get("role") or j.get("title") or j.get("position") or "Unknown"
        created = j.get("createdDate") or j.get("created_at") or j.get("date") or datetime.utcnow().isoformat()
        desc = j.get("description") or j.get("details") or j.get("text") or ""
        return JobDescriptionOut(
            id=str(j["_id"]),
            department=str(dept),
            role=str(role),
            description=str(desc),
            createdDate=str(created),
        )

    items = [to_out(j) for j in job_collection.find().sort("created_at", -1)]
    return items


@router.post("", response_model=JobDescriptionOut)
async def create_job(body: JobDescriptionIn):
    doc = body.model_dump()
    # Add createdDate if not provided by client
    doc.setdefault("createdDate", datetime.utcnow().isoformat())
    res = job_collection.insert_one(doc)
    return JobDescriptionOut(id=str(res.inserted_id), **doc)


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    try:
        oid = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job id")
    res = job_collection.delete_one({"_id": oid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"deleted": True}

# ===== Legacy endpoints replicating same behavior under /job-descriptions =====

@legacy_router.get("/", response_model=List[JobDescriptionOut])
async def legacy_list_job_descriptions():
    return await list_jobs()

@legacy_router.post("/", response_model=JobDescriptionOut)
async def legacy_create_job_description(body: JobDescriptionIn):
    return await create_job(body)

@legacy_router.delete("/{job_id}")
async def legacy_delete_job_description(job_id: str):
    return await delete_job(job_id)
