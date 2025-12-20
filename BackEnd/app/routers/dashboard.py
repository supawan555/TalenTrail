from fastapi import APIRouter, HTTPException, Depends
from typing import List
from bson import ObjectId
from datetime import datetime

from app.db import job_collection
from typing import Annotated
from app.services.auth import Check_Token


router = APIRouter(prefix="/dashboard", tags=["dashboard"]) 


@router.get("")
async def validate_token(_token: Annotated[str, Depends(Check_Token)]):
	"""Validate JWT using shared `Check_Token` dependency.

	If dependency passes, token is valid; otherwise it raises 401.
	"""
	print("TOKEN VALID")
	return {"message": "token valid"}
