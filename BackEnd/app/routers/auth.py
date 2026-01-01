"""Auth routes: registration, login, OTP verification."""
from fastapi import APIRouter, HTTPException, Response, Depends
from datetime import datetime, timedelta
from ..services.auth import create_access_token, hash_password, verify_password, create_pending_session, verify_totp_code
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
async def auth_login(req: LoginRequest, response: Response):
    email = req.email.strip().lower()
    user = auth_users_collection.find_one({"email": email})
    if not user or not verify_password(req.password, user.get("password_hash")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    
    # Skip 2FA for ADMIN role: issue access token immediately and set cookie
    if str(user.get("role", "")).upper() == "ADMIN":
        access_token_expires = timedelta(minutes=1440)
        access_token = create_access_token(
            data={"sub": user["email"], "role": "ADMIN"},
            expires_delta=access_token_expires,
        )

        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            max_age=1440 * 60,
            samesite="lax",
            secure=False,
        )

        # No OTP required for admin; return placeholder pendingToken
        return LoginResponse(otp_required=False, pendingToken="")

    # Default: require OTP flow for non-admin users
    token = create_pending_session(user_id=user["_id"])
    return LoginResponse(otp_required=True, pendingToken=token)


@router.post("/verify-otp")
async def auth_verify_otp(req: VerifyOtpRequest, response: Response):
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
    
    access_token_expires = timedelta(minutes=1440)
    access_token = create_access_token(
        data={"sub": user["email"], "role": user.get("role", "user")}, 
        expires_delta=access_token_expires
    )

    # ฝัง HTTP-Only Cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=1440 * 60, # หน่วยวินาที
        samesite="lax",
        secure=False # แก้เป็น True ถ้าขึ้น Production
    )

    # อัปเดต Session ว่าใช้แล้ว
    auth_sessions_collection.update_one(
        {"_id": session["_id"]},
        {"$set": {"stage": "done", "used_at": datetime.utcnow()}}
    )
    # Return แค่ message (Token อยู่ใน Cookie แล้ว)
    return {"message": "Login successful", "role": user.get("role")}

    # เพิ่ม Logout ให้ด้วย
@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Logout successful"}
