"""MongoDB client and collection access helpers."""
from pymongo import MongoClient
from . import config

_client = MongoClient(config.MONGO_URL)

primary_db = _client[config.PRIMARY_DB]
hr_db = _client[config.HR_DB]

# Primary DB collections
candidate_collection = primary_db["candidates"]
job_collection = primary_db["job_descriptions"]
resume_analyses_collection = primary_db["resume_analyses"]
auth_users_collection = primary_db["auth_users"]
auth_sessions_collection = primary_db["auth_sessions"]
candidate_notes_collection = primary_db["candidate_notes"]

# HR platform DB collections
jobs_collection = hr_db["jobs"]
users_collection = hr_db["users"]

__all__ = [
    "candidate_collection",
    "job_collection",
    "resume_analyses_collection",
    "auth_users_collection",
    "auth_sessions_collection",
    "candidate_notes_collection",
    "jobs_collection",
    "users_collection",
]
