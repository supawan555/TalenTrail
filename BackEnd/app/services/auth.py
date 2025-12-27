"""Authentication helpers: password hashing (PBKDF2) and TOTP utilities."""
from __future__ import annotations
from datetime import datetime, timedelta
from ..config import settings 
from ..db import auth_sessions_collection, auth_users_collection
from fastapi.security import OAuth2PasswordBearer
from typing import Annotated
from fastapi import Depends, HTTPException, status, Request
from ..models.token import TokenData
from ..models.auth import RegisterRequest
import base64
import hashlib
import hmac
import os
import uuid
import pyotp
from jose import jwt, JWTError

_PBKDF_ITER = 200_000
SECERT_KEY = settings.SECRET_KEY_AUTHEN

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def hash_password(pw: str) -> dict:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), salt, _PBKDF_ITER)
    return {
        "alg": "pbkdf2_sha256",
        "iter": _PBKDF_ITER,
        "salt": base64.b64encode(salt).decode("ascii"),
        "hash": base64.b64encode(dk).decode("ascii"),
    }

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECERT_KEY, algorithm="HS256")
    return encoded_jwt

async def Check_Token(token: Annotated[str, Depends(oauth2_scheme)]):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="token invalid",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECERT_KEY, algorithms=["HS256"])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except jwt.PyJWTError:
        raise credentials_exception
    

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


def verify_password(pw: str, stored: dict) -> bool:
    try:
        if not stored or stored.get("alg") != "pbkdf2_sha256":
            return False
        iter_ = int(stored.get("iter", _PBKDF_ITER))
        salt = base64.b64decode(stored.get("salt", ""))
        expected = base64.b64decode(stored.get("hash", ""))
        dk = hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), salt, iter_)
        return hmac.compare_digest(dk, expected)
    except Exception:
        return False


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
