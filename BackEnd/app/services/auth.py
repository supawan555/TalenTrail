"""Authentication helpers: password hashing (PBKDF2) and TOTP utilities."""
from __future__ import annotations
import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta
import uuid
import pyotp

from ..db import auth_sessions_collection

_PBKDF_ITER = 200_000


def hash_password(pw: str) -> dict:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), salt, _PBKDF_ITER)
    return {
        "alg": "pbkdf2_sha256",
        "iter": _PBKDF_ITER,
        "salt": base64.b64encode(salt).decode("ascii"),
        "hash": base64.b64encode(dk).decode("ascii"),
    }


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
