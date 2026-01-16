"""Account settings endpoints."""
from fastapi import APIRouter, Depends, HTTPException

from app.db import auth_users_collection
from app.models.user import (
    PasswordChangeRequest,
    ProfileResponse,
    ProfileUpdateRequest,
)
from app.services.auth import (
    get_current_user_from_cookie,
    hash_password,
    verify_password,
)
from app.services.user import get_user_by_email_or_404, to_profile_payload

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(current_user: dict = Depends(get_current_user_from_cookie)):
    user_doc = get_user_by_email_or_404(current_user["email"])
    return to_profile_payload(user_doc)


@router.put("/profile", response_model=ProfileResponse)
async def update_profile(
    payload: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user_from_cookie),
):
    user_doc = get_user_by_email_or_404(current_user["email"])

    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name

    if payload.email and payload.email.lower() != user_doc.get("email", "").lower():
        raise HTTPException(
            status_code=400,
            detail="Email changes are not supported inside the application. Please contact an administrator.",
        )

    if not updates:
        raise HTTPException(status_code=400, detail="No changes detected")

    auth_users_collection.update_one({"_id": user_doc["_id"]}, {"$set": updates})
    user_doc.update(updates)
    return to_profile_payload(user_doc)


@router.put("/password")
async def change_password(
    payload: PasswordChangeRequest,
    current_user: dict = Depends(get_current_user_from_cookie),
):
    user_doc = get_user_by_email_or_404(current_user["email"])

    if not verify_password(payload.current_password, user_doc.get("password_hash")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=400,
            detail="New password must be different from the current password",
        )

    hashed_password = hash_password(payload.new_password)
    auth_users_collection.update_one(
        {"_id": user_doc["_id"]},
        {"$set": {"password_hash": hashed_password}},
    )

    return {"message": "Password updated successfully"}
