"""
Create an initial ADMIN account for the FastAPI project.

This script is standalone (not an API endpoint) and uses the
existing MongoDB collections and password hashing utilities
from the application.

Usage:
    python scripts/create_admin.py
"""
from __future__ import annotations
import os
import sys
from datetime import datetime
from pathlib import Path

# Ensure the backend package path is available
ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "BackEnd"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db import auth_users_collection  # type: ignore
from app.services.auth import hash_password  # type: ignore

try:
    import pyotp
except ImportError:
    pyotp = None  # Optional 2FA support; will skip if unavailable


ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "Admin1234"
ADMIN_ROLE = "ADMIN"
ADMIN_NAME = "Administrator"
ADMIN_IS_ACTIVE = True


def create_admin() -> None:
    existing = auth_users_collection.find_one({"email": ADMIN_EMAIL})
    if existing:
        print(f"Admin already exists: {ADMIN_EMAIL}. No changes made.")
        # Close the Mongo client cleanly
        try:
            auth_users_collection.database.client.close()
        except Exception:
            pass
        return

    # Hash password using the project's helper (PBKDF2)
    pw_hash = hash_password(ADMIN_PASSWORD)

    # Optional TOTP/2FA secret to align with registration flow
    secret = None
    if pyotp:
        secret = os.getenv("TALENTTAIL_TOTP_STATIC_SECRET") or pyotp.random_base32()

    doc = {
        "name": ADMIN_NAME,
        "email": ADMIN_EMAIL,
        "password_hash": pw_hash,
        "role": ADMIN_ROLE,
        "is_active": ADMIN_IS_ACTIVE,
        # keep fields consistent with the existing auth flow
        "totp_secret": secret,
        "twofa_enabled": bool(secret),
        "created_at": datetime.utcnow().isoformat(),
    }

    result = auth_users_collection.insert_one(doc)
    print(f"Admin account created. User id: {result.inserted_id}")

    # Close the Mongo client cleanly
    try:
        auth_users_collection.database.client.close()
    except Exception:
        pass


if __name__ == "__main__":
    create_admin()
