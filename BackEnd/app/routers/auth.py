"""Auth routes: registration, login, OTP verification."""
from fastapi import APIRouter, HTTPException
from datetime import datetime
import os
import pyotp
import uuid

from app.models.auth import (
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    LoginResponse,
    VerifyOtpRequest,
    TokenResponse,
)
from app.db import auth_users_collection, auth_sessions_collection
from app.services.auth import hash_password, verify_password, create_pending_session, verify_totp_code

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=RegisterResponse)
async def auth_register(req: RegisterRequest):
    email = req.email.strip().lower()
    if not email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    if auth_users_collection.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email already registered")

    secret = os.getenv("TALENTTAIL_TOTP_STATIC_SECRET") or pyotp.random_base32()
    hashed = hash_password(req.password)
    doc = {
        "name": req.name,
        "email": email,
        "password_hash": hashed,
        "role": req.role,
        "totp_secret": secret,
        "twofa_enabled": True,
        "created_at": datetime.utcnow().isoformat(),
    }
    auth_users_collection.insert_one(doc)
    issuer = os.getenv("TALENTTAIL_TOTP_ISSUER", "TalentTail")
    otpauth_url = pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)
    return RegisterResponse(message="Registered successfully", otpauth_url=otpauth_url, secret=secret)


@router.post("/login", response_model=LoginResponse)
async def auth_login(req: LoginRequest):
    email = req.email.strip().lower()
    user = auth_users_collection.find_one({"email": email})
    if not user or not verify_password(req.password, user.get("password_hash")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_pending_session(user_id=user["_id"])
    return LoginResponse(otp_required=True, pendingToken=token)


@router.post("/verify-otp", response_model=TokenResponse)
async def auth_verify_otp(req: VerifyOtpRequest):
    session = auth_sessions_collection.find_one({"token": req.pendingToken, "stage": "pending"})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid pending token")
    try:
        if datetime.fromisoformat(session.get("expires_at")) < datetime.utcnow():
            raise HTTPException(status_code=401, detail="Pending token expired")
    except Exception:
        pass
    user = auth_users_collection.find_one({"_id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    secret = user.get("totp_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="TOTP not configured")
    if not verify_totp_code(secret, req.code):
        raise HTTPException(status_code=401, detail="Invalid OTP code")
    access = uuid.uuid4().hex
    auth_sessions_collection.update_one({"_id": session["_id"]}, {"$set": {"stage": "done", "access": access}})
    return TokenResponse(accessToken=access)
