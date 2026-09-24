"""AES-256-GCM helpers for encrypting sensitive secrets at rest (e.g. TOTP secrets)."""
from __future__ import annotations

import base64
import hashlib
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from ..config import settings

# Derive a fixed 32-byte AES-256 key from the configured passphrase so any
# string length works as TOTP_ENCRYPTION_KEY in the environment.
_AES_KEY = hashlib.sha256(settings.TOTP_ENCRYPTION_KEY.encode("utf-8")).digest()
_NONCE_SIZE = 12


def encrypt_secret(plaintext: str) -> str:
    """Encrypt a value with AES-256-GCM. Returns base64(nonce || ciphertext)."""
    nonce = os.urandom(_NONCE_SIZE)
    ciphertext = AESGCM(_AES_KEY).encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ciphertext).decode("utf-8")


def decrypt_secret(token: str) -> str:
    """Decrypt a value produced by encrypt_secret."""
    raw = base64.b64decode(token)
    nonce, ciphertext = raw[:_NONCE_SIZE], raw[_NONCE_SIZE:]
    plaintext = AESGCM(_AES_KEY).decrypt(nonce, ciphertext, None)
    return plaintext.decode("utf-8")
