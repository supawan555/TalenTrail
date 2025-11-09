"""Application configuration settings for TalentTrail."""
from typing import List
import os

MONGO_URL: str = os.getenv("MONGO_URL", "mongodb://localhost:27017/")
PRIMARY_DB: str = os.getenv("PRIMARY_DB", "TalentTail")
HR_DB: str = os.getenv("HR_DB", "hr_platform")

CORS_ALLOW_ORIGINS: List[str] = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
]
CORS_ALLOW_REGEX: str = r"^http://(localhost|127\.0\.0\.1):\d+$"
