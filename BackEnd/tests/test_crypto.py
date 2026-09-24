"""Unit tests for ``app/services/crypto.py`` (AES-256-GCM secret encryption).

This module encrypts sensitive strings (TOTP secrets) before they are written to
the database. Two functions do all the work:

    encrypt_secret(plaintext) -> "base64(nonce || ciphertext+tag)"
    decrypt_secret(token)     -> plaintext

Testing strategy
----------------
Crypto code is *deterministic given its inputs* except for the random 12-byte
nonce, so we run the real AES-GCM implementation (no mocking) and assert on
observable behaviour: round-trips succeed, output looks right, and any tampering
or wrong key is rejected loudly rather than silently returning garbage.

``_AES_KEY`` is derived once at import time from ``settings.TOTP_ENCRYPTION_KEY``.
For the "wrong key" test we patch that module-level constant directly.
"""

from __future__ import annotations

import base64

import pytest
from cryptography.exceptions import InvalidTag

from app.services import crypto
from app.services.crypto import decrypt_secret, encrypt_secret

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# Round-trip: encrypt then decrypt must give back exactly what we put in.
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "plaintext",
    [
        pytest.param("JBSWY3DPEHPK3PXP", id="typical-totp-secret"),
        pytest.param("", id="empty-string"),
        pytest.param("สวัสดีชาวโลก 🌏", id="unicode-thai-and-emoji"),
        pytest.param("x" * 5000, id="very-long-string"),
    ],
)
def test_round_trip_returns_original_value(plaintext: str) -> None:
    """
    Scenario: A value is encrypted and then decrypted with the same key.
    Expected: decrypt_secret(encrypt_secret(x)) == x, for ASCII, empty,
              multi-byte Unicode, and long inputs.

    Arrange: pick a plaintext (supplied by parametrize).
    Act:     token = encrypt_secret(plaintext); back = decrypt_secret(token).
    Assert:  the decrypted value is identical to the original.
    """
    # Arrange / Act
    token = encrypt_secret(plaintext)
    restored = decrypt_secret(token)

    # Assert
    assert restored == plaintext


def test_ciphertext_differs_each_call_for_same_plaintext() -> None:
    """
    Scenario: The same plaintext is encrypted twice.
    Expected: The two tokens are different, because a fresh random nonce is used
              every time. (Deterministic ciphertext would leak that two secrets
              are equal.)

    Arrange: one fixed plaintext.
    Act:     encrypt it twice.
    Assert:  the two tokens are not equal, yet both decrypt back to the plaintext.
    """
    # Arrange
    plaintext = "same-secret-both-times"

    # Act
    token_a = encrypt_secret(plaintext)
    token_b = encrypt_secret(plaintext)

    # Assert
    assert token_a != token_b
    assert decrypt_secret(token_a) == plaintext
    assert decrypt_secret(token_b) == plaintext


def test_token_is_base64_and_carries_nonce_plus_gcm_tag() -> None:
    """
    Scenario: Inspect the structure of a produced token.
    Expected: It is valid base64, and once decoded it is at least
              12 (nonce) + 16 (GCM authentication tag) bytes long.

    Arrange: encrypt a 1-character string.
    Act:     base64-decode the token.
    Assert:  decoding does not raise, and the raw length >= 28 bytes.
    """
    # Arrange
    token = encrypt_secret("x")

    # Act
    raw = base64.b64decode(token)  # raises if not valid base64

    # Assert
    assert len(raw) >= crypto._NONCE_SIZE + 16


# ---------------------------------------------------------------------------
# Failure modes: decryption must reject anything it cannot authenticate.
# ---------------------------------------------------------------------------
def test_tampered_ciphertext_raises_invalid_tag() -> None:
    """
    Scenario: An attacker flips one bit of a valid token before it is decrypted.
    Expected: AES-GCM authentication fails and InvalidTag is raised - the
              corrupted value is never returned as if it were real.

    Arrange: create a valid token, decode it, flip the last byte (part of the
             GCM tag), re-encode.
    Act:     decrypt the tampered token.
    Assert:  InvalidTag is raised.
    """
    # Arrange
    raw = bytearray(base64.b64decode(encrypt_secret("hunter2")))
    raw[-1] ^= 0x01  # flip one bit of the authentication tag
    tampered_token = base64.b64encode(bytes(raw)).decode("utf-8")

    # Act / Assert
    with pytest.raises(InvalidTag):
        decrypt_secret(tampered_token)


def test_truncated_token_with_no_ciphertext_raises_invalid_tag() -> None:
    """
    Scenario: A token that contains only a nonce and no ciphertext/tag.
    Expected: InvalidTag - there is nothing to authenticate.

    Arrange: base64-encode 12 zero bytes (a nonce-sized blob, nothing else).
    Act:     decrypt it.
    Assert:  InvalidTag is raised.
    """
    # Arrange
    nonce_only = base64.b64encode(b"\x00" * crypto._NONCE_SIZE).decode("utf-8")

    # Act / Assert
    with pytest.raises(InvalidTag):
        decrypt_secret(nonce_only)


def test_non_base64_input_raises_value_error() -> None:
    """
    Scenario: A caller passes a string that is not valid base64 at all.
    Expected: A ValueError is raised (binascii.Error, which decrypt_secret lets
              propagate from base64.b64decode, is a subclass of ValueError).

    Arrange: a string with bad padding / stray characters.
    Act:     decrypt it.
    Assert:  ValueError is raised.
    """
    # Act / Assert
    with pytest.raises(ValueError):
        decrypt_secret("this is not base64 %%%")


def test_wrong_key_cannot_decrypt(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Scenario: A token encrypted under key A is decrypted after the process key
              has been changed to key B (e.g. TOTP_ENCRYPTION_KEY was rotated
              without re-encrypting stored secrets).
    Expected: InvalidTag - GCM will not decrypt data it did not authenticate.

    Arrange: encrypt with the real key, then monkeypatch crypto._AES_KEY to a
             different 32-byte value.
    Act:     attempt to decrypt the original token under the new key.
    Assert:  InvalidTag is raised.
    """
    # Arrange
    token = encrypt_secret("hunter2")
    import hashlib

    monkeypatch.setattr(
        crypto, "_AES_KEY", hashlib.sha256(b"a completely different passphrase").digest()
    )

    # Act / Assert
    with pytest.raises(InvalidTag):
        decrypt_secret(token)
