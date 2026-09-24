"""
Encrypt 2FA (TOTP) secrets that are still stored in plaintext.

Accounts created before 2FA encryption was added keep their secret in the clear;
login still works (routers/auth.py falls back to plaintext), but anyone who reads
the database could generate every user's 2FA codes. This encrypts them with
TOTP_ENCRYPTION_KEY. Users do NOT need to rescan anything - the secret itself
is unchanged, only how it is stored.

IMPORTANT: after running with --apply, every environment that verifies 2FA
(local .env, Vercel) must use this same TOTP_ENCRYPTION_KEY, and it must never
change - otherwise these users can no longer log in.

Writes to whatever database MONGO_DB_URI in your .env points at.

Usage (from the repo root):
    BackEnd\\.venv\\Scripts\\python scripts\\encrypt_totp_secrets.py           # dry run
    BackEnd\\.venv\\Scripts\\python scripts\\encrypt_totp_secrets.py --apply   # write
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "BackEnd"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.config import Settings, settings  # type: ignore  # noqa: E402
from app.db import auth_users_collection  # type: ignore  # noqa: E402
from app.services.crypto import decrypt_secret, encrypt_secret  # type: ignore  # noqa: E402

# What pyotp.random_base32() produces; encrypted values are base64 and never match.
PLAINTEXT_SECRET = re.compile(r"^[A-Z2-7]{16,64}$")


def main() -> None:
    parser = argparse.ArgumentParser(description="Encrypt plaintext 2FA secrets.")
    parser.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    args = parser.parse_args()

    if Settings().TOTP_ENCRYPTION_KEY != settings.TOTP_ENCRYPTION_KEY:
        sys.exit("TOTP_ENCRYPTION_KEY is not set in .env - refusing to encrypt with a throwaway key.")

    todo = [
        u
        for u in auth_users_collection.find({}, {"email": 1, "totp_secret": 1})
        if PLAINTEXT_SECRET.match(u.get("totp_secret") or "")
    ]
    print(f"{len(todo)} account(s) with a plaintext 2FA secret.")

    done = 0
    for user in todo:
        plain = user["totp_secret"]
        encrypted = encrypt_secret(plain)
        if decrypt_secret(encrypted) != plain:  # never store something we can't read back
            sys.exit(f"Round-trip check failed for {user.get('email')} - stopping, nothing more written.")
        if not args.apply:
            print(f"  would encrypt: {user.get('email')}")
            continue
        # Only update if the secret hasn't changed since we read it.
        res = auth_users_collection.update_one(
            {"_id": user["_id"], "totp_secret": plain}, {"$set": {"totp_secret": encrypted}}
        )
        done += res.modified_count
        print(f"  encrypted: {user.get('email')}")

    if args.apply:
        print(f"Done: {done} account(s) encrypted.")
    else:
        print("Dry run only. Re-run with --apply to write.")


if __name__ == "__main__":
    try:
        main()
    finally:
        try:
            auth_users_collection.database.client.close()
        except Exception:
            pass
