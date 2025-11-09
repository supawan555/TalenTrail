from pydantic import BaseModel
from typing import Optional


class Candidate(BaseModel):
    id: Optional[str] = None
    name: str
    email: str
