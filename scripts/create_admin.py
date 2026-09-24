"""
Create an ADMIN account, or reset an existing ADMIN's password.

This script is standalone (not an API endpoint) and uses the existing MongoDB
collections and helpers from the application, so it writes to whatever
database MONGO_DB_URI in your .env points at.

The password is typed at a hidden prompt - it is never stored in this file,
in shell history, or printed.

Usage (from the repo root):
    BackEnd\\.venv\\Scripts\\python scripts\\create_admin.py
    BackEnd\\.venv\\Scripts\\python scripts\\create_admin.py --email you@company.com
    BackEnd\\.venv\\Scripts\\python scripts\\create_admin.py --reset-2fa
"""
from __future__ import annotations

import argparse
import getpass
import sys
from datetime import datetime
from pathlib import Path

# Ensure the backend package path is available
ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "BackEnd"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pyotp  # noqa: E402

from app.db import auth_users_collection  # type: ignore  # noqa: E402
from app.services.auth import hash_password  # type: ignore  # noqa: E402
from app.services.crypto import encrypt_secret  # type: ignore  # noqa: E402

DEFAULT_EMAIL = "admin@test.com"
ADMIN_ROLE = "ADMIN"
ADMIN_NAME = "Administrator"
MIN_PASSWORD_LENGTH = 12


def prompt_password() -> str:
    """Ask for the new password twice at a hidden prompt."""
    while True:
        first = getpass.getpass(f"New admin password (min {MIN_PASSWORD_LENGTH} chars): ")
        if len(first) < MIN_PASSWORD_LENGTH:
            print(f"Too short - use at least {MIN_PASSWORD_LENGTH} characters.")
            continue
        if getpass.getpass("Repeat password: ") != first:
            print("Passwords do not match, try again.")
            continue
        return first


def new_totp_secret(email: str) -> tuple[str, str]:
    """Return (encrypted secret for the DB, otpauth URL to show once)."""
    secret = pyotp.random_base32()
    url = pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="TalentTail")
    return encrypt_secret(secret), url


def show_2fa_setup(url: str) -> None:
    print("\nScan this in your authenticator app (shown only once):")
    print(f"  {url}")
    print("Or paste the value after 'secret=' into the app manually.\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or reset an ADMIN account.")
    parser.add_argument("--email", default=DEFAULT_EMAIL, help=f"admin email (default {DEFAULT_EMAIL})")
    parser.add_argument("--reset-2fa", action="store_true", help="also issue a new 2FA secret")
    args = parser.parse_args()
    email = args.email.strip().lower()

    existing = auth_users_collection.find_one({"email": email})

    if existing:
        print(f"Account found: {email} (role: {existing.get('role')})")
        if input("Reset its password? [y/N]: ").strip().lower() != "y":
            print("No changes made.")
            return
        update = {"password_hash": hash_password(prompt_password()), "role": ADMIN_ROLE}
        url = None
        if args.reset_2fa or not existing.get("totp_secret"):
            update["totp_secret"], url = new_totp_secret(email)
            update["twofa_enabled"] = True
        auth_users_collection.update_one({"_id": existing["_id"]}, {"$set": update})
        print(f"Password updated for {email}.")
        if url:
            show_2fa_setup(url)
        return

    print(f"No account for {email} - creating a new ADMIN.")
    encrypted_secret, url = new_totp_secret(email)
    auth_users_collection.insert_one(
        {
            "name": ADMIN_NAME,
            "email": email,
            "password_hash": hash_password(prompt_password()),
            "role": ADMIN_ROLE,
            "is_active": True,
            "totp_secret": encrypted_secret,
            "twofa_enabled": True,
            "created_at": datetime.utcnow().isoformat(),
        }
    )
    print(f"Admin account created: {email}")
    show_2fa_setup(url)


if __name__ == "__main__":
    try:
        main()
    finally:
        # Close the Mongo client cleanly
        try:
            auth_users_collection.database.client.close()
        except Exception:
            pass
