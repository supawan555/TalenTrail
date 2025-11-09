"""Startup service to preload job descriptions from mock JSON file if collection empty."""
import json
import os
from fastapi import FastAPI
from .. import db

# File resides under BackEnd/mock_job_descriptions.json (two levels up from services/)
MOCK_FILE = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "mock_job_descriptions.json"))


def register_startup(app: FastAPI) -> None:
    @app.on_event("startup")
    async def preload_job_descriptions():
        try:
            if db.job_collection.count_documents({}) > 0:
                return
            if not os.path.exists(MOCK_FILE):
                return
            with open(MOCK_FILE, "r", encoding="utf-8") as f:
                items = json.load(f)
            to_insert = []
            for it in items:
                doc = {k: v for k, v in it.items() if k != "id"}
                to_insert.append(doc)
            if to_insert:
                db.job_collection.insert_many(to_insert)
                print(f"Preloaded {len(to_insert)} job descriptions into MongoDB")
        except Exception as e:
            print("Failed to preload job descriptions:", e)
