from fastapi import FastAPI
from pymongo import MongoClient
from pydantic import BaseModel
from bson.objectid import ObjectId

app = FastAPI()

client = MongoClient("mongodb://localhost:27017/")
db = client["Candidate"]
collection = db["Candidate"]

class Candidate(BaseModel):
    id: str = None
    name: str
    email: str


@app.get("/")
async def root():
    return {"message": "Hello, World!"}

#Test Create Candidate
@app.post("/candidates/")
async def create_candidate(candidate: Candidate):
    result = collection.insert_one(candidate.dict())
    return {
        "id": str(result.inserted_id),
        "name": candidate.name,
        "email": candidate.email
    }