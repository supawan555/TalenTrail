"""Notes API: CRUD-ish endpoints for candidate notes.
- GET /notes?candidate_id=... : list notes (optionally by candidate)
- GET /candidates/{candidate_id}/notes : list notes for a candidate
- POST /notes : create a note for a candidate

Notes document shape:
{
  _id: ObjectId,
  candidate_id: ObjectId,
  content: str,
  type: str,            # tag (e.g., Awaiting Feedback)
  author: str,          # from current user
  timestamp: datetime   # server-side
}
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

from app.db import candidate_notes_collection
from app.services.auth import get_current_user_from_cookie

router = APIRouter(prefix="/notes", tags=["notes"], dependencies=[Depends(get_current_user_from_cookie)])


def _to_out(doc: dict) -> dict:
    return {
        "id": str(doc.get("_id")),
        "candidate_id": str(doc.get("candidate_id")),
        "content": str(doc.get("content", "")),
        "type": str(doc.get("type", "")),
        "author": str(doc.get("author", "")),
        "timestamp": (doc.get("timestamp") or datetime.utcnow()).isoformat(),
    }


@router.get("")
async def list_notes(candidate_id: Optional[str] = None) -> List[dict]:
    query = {}
    if candidate_id:
        try:
            query["candidate_id"] = ObjectId(candidate_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid candidate_id")
    items = []
    for n in candidate_notes_collection.find(query).sort("timestamp", -1):
        items.append(_to_out(n))
    return items


@router.get("/candidate/{candidate_id}")
async def list_candidate_notes(candidate_id: str) -> List[dict]:
    try:
        oid = ObjectId(candidate_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid candidate id")
    items = []
    for n in candidate_notes_collection.find({"candidate_id": oid}).sort("timestamp", -1):
        items.append(_to_out(n))
    return items


@router.post("")
async def create_note(candidate_id: str, content: str, type: str, current_user: dict = Depends(get_current_user_from_cookie)) -> dict:
    # Basic validation
    if not content.strip():
        raise HTTPException(status_code=400, detail="content is required")
    if not type.strip():
        raise HTTPException(status_code=400, detail="type (tag) is required")
    try:
        oid = ObjectId(candidate_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid candidate_id")

    now = datetime.utcnow()
    doc = {
        "candidate_id": oid,
        "content": content.strip(),
        "type": type.strip(),
        "author": (current_user.get("email") or current_user.get("username") or "user"),
        "timestamp": now,
    }
    res = candidate_notes_collection.insert_one(doc)
    doc_out = {**doc, "_id": res.inserted_id}
    return _to_out(doc_out)
