from fastapi import APIRouter, Depends
from typing import List
from bson import ObjectId
from datetime import datetime

from app.db import job_collection
from typing import Annotated
from app.services.auth import get_current_user_from_cookie


router = APIRouter(prefix="/dashboard", tags=["dashboard"]) 


@router.get("/profile") 
async def get_dashboard_root(current_user: dict = Depends(get_current_user_from_cookie)):
    return current_user
