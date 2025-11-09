from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class JobDescriptionIn(BaseModel):
    department: str
    role: str
    description: str


class JobDescriptionOut(JobDescriptionIn):
    id: str = Field(..., alias="id")
    createdDate: Optional[str] = None


class JobOut(BaseModel):
    id: str
    title: str


class MatchRequest(BaseModel):
    resume_text: str
    job_id: str


class MatchResponse(BaseModel):
    match_score: float
    profile: Dict[str, Any]
    job_title: str
