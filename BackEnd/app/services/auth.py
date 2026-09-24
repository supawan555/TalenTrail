"""Authentication helpers: password hashing (PBKDF2) and TOTP utilities."""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from ..config import settings 
from ..db import auth_sessions_collection, auth_users_collection, auth_password_resets_collection
from fastapi.security import OAuth2PasswordBearer
from typing import Annotated
from fastapi import Depends, HTTPException, status, Request
from ..models.token import TokenData
from ..models.auth import User
import base64
import hashlib
import hmac
import logging
import os
import secrets
import uuid
import pyotp
import bcrypt
from passlib.context import CryptContext
from jose import jwt, JWTError

SECRET_KEY = settings.SECRET_KEY_AUTHEN

#ทำหน้าที่หยิบ token จาก header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login") # บอกตัว Swagger ว่า endpoint ไหนสำหรับ test login
logger = logging.getLogger(__name__) 


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_byte = plain_password.encode('utf-8')
    hashed_byte = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_byte, hashed_byte)

# สร้าง JWT Access Token
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")
    return encoded_jwt

# ตรวจสอบ Token จาก Header เพื่อเอาข้อมูลผู้ใช้ (email, role)
async def check_token(token: Annotated[str, Depends(oauth2_scheme)]):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="token invalid",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    # token หมดอายุ
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="token expired")
    
    except jwt.PyJWTError:
        raise credentials_exception
    
# สร้าง Dependency ใหม่สำหรับอ่าน Cookie
async def get_current_user_from_cookie(request: Request):
    token = request.cookies.get("access_token")
    # Never log the token itself: anyone reading logs could replay it.

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    if not token:
        raise credentials_exception
    try:
        # แกะ Token
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        email: str = payload.get("sub")
        role: str = payload.get("role") # <--- ดึง Role ออกมาด้วย

        if email is None:
            raise credentials_exception
            
        # Return dict ง่ายๆ เพื่อเอาไปใช้ต่อ (Stateless)
        return {"email": email, "role": role}
        
    except JWTError: # ใช้ JWTError ของ python-jose
        raise credentials_exception
    
# ปรับ require_role ให้ใช้ dependency ตัวใหม่
def require_role(role: str):
    # เปลี่ยนมาใช้ get_current_user_from_cookie
    async def checker(current_user: dict = Depends(get_current_user_from_cookie)): 
        if current_user.get("role") != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Permission Denied"
            )
        return current_user
    return checker

async def get_current_active_user(current_user: User = Depends(check_token)):
    return current_user

def create_pending_session(user_id) -> str:

    """Create a short-lived pending OTP session and return the token."""
    token = uuid.uuid4().hex
    auth_sessions_collection.insert_one(
        {
            "token": token,
            "user_id": user_id,
            "stage": "pending",
            "expires_at": (datetime.utcnow() + timedelta(minutes=5)).isoformat(),
        }
    )
    return token

def verify_totp_code(secret: str, code: str) -> bool:
    return pyotp.TOTP(secret).verify(code, valid_window=1)


# ===== Forgot-password email-OTP flow =====
OTP_TTL_MINUTES = 10
RESET_TOKEN_TTL_MINUTES = 15
MAX_OTP_ATTEMPTS = 5


def generate_otp_code() -> str:
    # secrets = OS CSPRNG; `random` is predictable and unsuitable for codes
    return f"{secrets.randbelow(1_000_000):06d}"


def create_password_reset_otp(email: str) -> str:
    """Create (or replace) a pending password-reset OTP for the email and return the raw code."""
    code = generate_otp_code()
    auth_password_resets_collection.update_one(
        {"email": email},
        {
            "$set": {
                "email": email,
                "otp_hash": hash_password(code),
                "stage": "otp_pending",
                "attempts": 0,
                "expires_at": (datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES)).isoformat(),
            },
            "$unset": {"reset_token": "", "reset_token_expires_at": ""},
        },
        upsert=True,
    )
    return code


def verify_password_reset_otp(email: str, code: str) -> str:
    """Verify a previously-sent OTP and return a short-lived reset token on success."""
    record = auth_password_resets_collection.find_one({"email": email, "stage": "otp_pending"})
    if not record:
        raise HTTPException(status_code=400, detail="No verification code was requested for this email")
    if datetime.fromisoformat(record["expires_at"]) < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Verification code has expired")
    if record.get("attempts", 0) >= MAX_OTP_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many attempts, please request a new code")
    if not verify_password(code, record["otp_hash"]):
        auth_password_resets_collection.update_one({"_id": record["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=401, detail="Invalid verification code")

    reset_token = uuid.uuid4().hex
    auth_password_resets_collection.update_one(
        {"_id": record["_id"]},
        {
            "$set": {
                "stage": "verified",
                "reset_token": reset_token,
                "reset_token_expires_at": (datetime.utcnow() + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)).isoformat(),
            },
            "$unset": {"otp_hash": "", "attempts": ""},
        },
    )
    return reset_token


def consume_password_reset_token(reset_token: str) -> str:
    """Validate a reset token, consume it, and return the associated email."""
    record = auth_password_resets_collection.find_one({"reset_token": reset_token, "stage": "verified"})
    if not record:
        raise HTTPException(status_code=401, detail="Invalid or expired reset token")
    if datetime.fromisoformat(record["reset_token_expires_at"]) < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Reset token has expired")
    auth_password_resets_collection.delete_one({"_id": record["_id"]})
    return record["email"]