"""
Issue a new 2FA (TOTP) secret for one existing user. The user's role and
password are not touched.

Use it when a user's stored 2FA secret can no longer be decrypted (for example
it was encrypted before TOTP_ENCRYPTION_KEY was set), or when they lost their
authenticator app.

Writes to whatever database MONGO_DB_URI in your .env points at.

Usage (from the repo root):
    BackEnd\\.venv\\Scripts\\python scripts\\reset_2fa.py --email user@company.com

It prints an otpauth:// link once. Send it to the user privately (it is their
2FA secret) so they can add it to their authenticator app.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "BackEnd"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pyotp  # noqa: E402

from app.config import Settings, settings  # type: ignore  # noqa: E402
from app.db import auth_users_collection  # type: ignore  # noqa: E402
from app.services.crypto import decrypt_secret, encrypt_secret  # type: ignore  # noqa: E402


def require_stable_key() -> None:
    """Refuse to run if TOTP_ENCRYPTION_KEY is a random per-process default."""
    if Settings().TOTP_ENCRYPTION_KEY != settings.TOTP_ENCRYPTION_KEY:
        sys.exit("TOTP_ENCRYPTION_KEY is not set in .env - refusing to encrypt with a throwaway key.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Issue a new 2FA secret for one user.")
    parser.add_argument("--email", required=True, help="the user's email")
    args = parser.parse_args()
    email = args.email.strip().lower()

    require_stable_key()
    user = auth_users_collection.find_one({"email": email})
    if not user:
        sys.exit(f"No account for {email}.")

    print(f"Account: {email} (role: {user.get('role')})")
    if input("Issue a NEW 2FA secret? Their current authenticator entry will stop working. [y/N]: ").strip().lower() != "y":
        print("No changes made.")
        return

    secret = pyotp.random_base32()
    encrypted = encrypt_secret(secret)
    assert decrypt_secret(encrypted) == secret  # never store something we can't read back
    auth_users_collection.update_one(
        {"_id": user["_id"]}, {"$set": {"totp_secret": encrypted, "twofa_enabled": True}}
    )

    url = pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="TalentTail")
    print(f"\n2FA reset for {email}. Send this link to the user privately (shown only once):")
    print(f"  {url}\n")


if __name__ == "__main__":
    try:
        main()
    finally:
        try:
            auth_users_collection.database.client.close()
        except Exception:
            pass
