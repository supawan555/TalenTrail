"""Unit tests for the forgot-password OTP flow in ``app/services/auth.py``.

Three functions form the flow:

    create_password_reset_otp(email)          -> raw 6-digit code (also emailed)
    verify_password_reset_otp(email, code)    -> short-lived reset token
    consume_password_reset_token(reset_token) -> email  (token is deleted)

Testing strategy
----------------
These functions talk to the Mongo collection ``auth_password_resets_collection``.
We replace that module-level handle with a ``unittest.mock.MagicMock`` per test
and:
  * feed ``find_one`` a hand-built record dict, and
  * assert on the *shape* of the ``update_one`` / ``delete_one`` calls the code
    makes (filter, ``$set`` / ``$inc`` payload, ``upsert=True``).
Timestamps are stored by the code as ISO strings via ``datetime.utcnow()``, so
the fake records use the same format.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.services import auth

pytestmark = pytest.mark.unit

# Hashing with bcrypt is deliberately slow; do it once and reuse.
_KNOWN_CODE = "999888"
_KNOWN_CODE_HASH = auth.hash_password(_KNOWN_CODE)


@pytest.fixture()
def fake_resets(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    """Swap the Mongo collection handle for a MagicMock for the duration of a test."""
    collection = MagicMock()
    monkeypatch.setattr(auth, "auth_password_resets_collection", collection)
    return collection


def _pending_record(**overrides) -> dict:
    """A record in the 'otp_pending' stage; override fields per test."""
    record = {
        "_id": "rec-1",
        "email": "jane@example.com",
        "stage": "otp_pending",
        "otp_hash": _KNOWN_CODE_HASH,
        "attempts": 0,
        "expires_at": (datetime.utcnow() + timedelta(minutes=5)).isoformat(),
    }
    record.update(overrides)
    return record


def _verified_record(**overrides) -> dict:
    """A record in the 'verified' stage holding a reset token."""
    record = {
        "_id": "rec-1",
        "email": "jane@example.com",
        "stage": "verified",
        "reset_token": "tok-abc",
        "reset_token_expires_at": (datetime.utcnow() + timedelta(minutes=5)).isoformat(),
    }
    record.update(overrides)
    return record


# ===========================================================================
# create_password_reset_otp
# ===========================================================================
def test_create_returns_a_six_digit_code(fake_resets: MagicMock) -> None:
    """
    Scenario: Request a password-reset OTP for an email.
    Expected: The returned raw code is 6 digits (this is what gets emailed).

    Arrange: fake collection (no return value needed for update_one).
    Act:     call create_password_reset_otp(email).
    Assert:  the code is 6 characters and all digits.
    """
    code = auth.create_password_reset_otp("jane@example.com")
    assert len(code) == 6 and code.isdigit()


def test_create_upserts_a_pending_record_with_the_hashed_code(
    fake_resets: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    """
    Scenario: Request a reset OTP; inspect what gets written to Mongo.
    Expected: exactly one update_one({"email": ...}, {"$set": {...}}, upsert=True)
              where $set has stage="otp_pending", attempts=0, an otp_hash that
              is NOT the raw code but DOES verify against it, and an expiry
              ~10 minutes out.

    Arrange: make the random draw deterministic so the code is "123456".
    Act:     call create_password_reset_otp(email).
    Assert:  the update_one call args match the expected shape.
    """
    # Arrange
    monkeypatch.setattr(auth.secrets, "randbelow", lambda _n: 123456)

    # Act
    code = auth.create_password_reset_otp("jane@example.com")

    # Assert
    assert code == "123456"
    fake_resets.update_one.assert_called_once()
    (filt, update), kwargs = fake_resets.update_one.call_args
    assert filt == {"email": "jane@example.com"}
    assert kwargs.get("upsert") is True

    set_block = update["$set"]
    assert set_block["stage"] == "otp_pending"
    assert set_block["attempts"] == 0
    assert set_block["otp_hash"] != code  # stored hashed, never in the clear
    assert auth.verify_password(code, set_block["otp_hash"]) is True

    expires_at = datetime.fromisoformat(set_block["expires_at"])
    assert timedelta(minutes=9) <= (expires_at - datetime.utcnow()) <= timedelta(minutes=11)


# ===========================================================================
# verify_password_reset_otp
# ===========================================================================
def test_verify_with_no_pending_record_raises_400(fake_resets: MagicMock) -> None:
    """
    Scenario: Verify an OTP when none was ever requested for this email.
    Expected: HTTPException(400).

    Arrange: find_one -> None.
    Act:     verify_password_reset_otp(email, code).
    Assert:  HTTPException with status_code 400.
    """
    fake_resets.find_one.return_value = None
    with pytest.raises(HTTPException) as exc_info:
        auth.verify_password_reset_otp("jane@example.com", "123456")
    assert exc_info.value.status_code == 400


def test_verify_with_expired_code_raises_400(fake_resets: MagicMock) -> None:
    """
    Scenario: The pending OTP's expires_at is in the past.
    Expected: HTTPException(400) ("code has expired").

    Arrange: find_one -> a pending record with expires_at 1 minute ago.
    Act:     verify with the otherwise-correct code.
    Assert:  HTTPException 400.
    """
    fake_resets.find_one.return_value = _pending_record(
        expires_at=(datetime.utcnow() - timedelta(minutes=1)).isoformat()
    )
    with pytest.raises(HTTPException) as exc_info:
        auth.verify_password_reset_otp("jane@example.com", _KNOWN_CODE)
    assert exc_info.value.status_code == 400


def test_verify_after_too_many_attempts_raises_429(fake_resets: MagicMock) -> None:
    """
    Scenario: The record already has attempts == MAX_OTP_ATTEMPTS (5).
    Expected: HTTPException(429) ("too many attempts") - checked before the code
              is even compared, so brute force is capped.

    Arrange: find_one -> pending record with attempts=5.
    Act:     verify with the correct code.
    Assert:  HTTPException 429.
    """
    fake_resets.find_one.return_value = _pending_record(attempts=5)
    with pytest.raises(HTTPException) as exc_info:
        auth.verify_password_reset_otp("jane@example.com", _KNOWN_CODE)
    assert exc_info.value.status_code == 429


def test_verify_with_wrong_code_increments_attempts_and_raises_401(
    fake_resets: MagicMock,
) -> None:
    """
    Scenario: A valid, non-expired record exists but the submitted code is wrong.
    Expected: The attempt counter is bumped via
              update_one({"_id": ...}, {"$inc": {"attempts": 1}}) and
              HTTPException(401) is raised.

    Arrange: find_one -> fresh pending record (correct code is _KNOWN_CODE).
    Act:     verify with "000000".
    Assert:  HTTPException 401, and update_one was called with the $inc payload.
    """
    # Arrange
    fake_resets.find_one.return_value = _pending_record()

    # Act / Assert
    with pytest.raises(HTTPException) as exc_info:
        auth.verify_password_reset_otp("jane@example.com", "000000")
    assert exc_info.value.status_code == 401

    (filt, update), _kwargs = fake_resets.update_one.call_args
    assert filt == {"_id": "rec-1"}
    assert update == {"$inc": {"attempts": 1}}


def test_verify_with_correct_code_returns_token_and_marks_verified(
    fake_resets: MagicMock,
) -> None:
    """
    Scenario: A valid, non-expired record and the correct code.
    Expected: Returns a 32-char hex reset token, and writes stage="verified"
              plus that same token into the record.

    Arrange: find_one -> fresh pending record.
    Act:     verify with the correct code (_KNOWN_CODE).
    Assert:  token is 32 hex chars; the update_one $set carries
             stage="verified" and reset_token == the returned token.
    """
    # Arrange
    fake_resets.find_one.return_value = _pending_record()

    # Act
    token = auth.verify_password_reset_otp("jane@example.com", _KNOWN_CODE)

    # Assert
    assert len(token) == 32 and all(c in "0123456789abcdef" for c in token)
    (_filt, update), _kwargs = fake_resets.update_one.call_args
    set_block = update["$set"]
    assert set_block["stage"] == "verified"
    assert set_block["reset_token"] == token


# ===========================================================================
# consume_password_reset_token
# ===========================================================================
def test_consume_unknown_token_raises_401(fake_resets: MagicMock) -> None:
    """
    Scenario: Redeem a reset token that does not match any verified record.
    Expected: HTTPException(401).

    Arrange: find_one -> None.
    Act:     consume_password_reset_token("nope").
    Assert:  HTTPException 401.
    """
    fake_resets.find_one.return_value = None
    with pytest.raises(HTTPException) as exc_info:
        auth.consume_password_reset_token("nope")
    assert exc_info.value.status_code == 401


def test_consume_expired_token_raises_401(fake_resets: MagicMock) -> None:
    """
    Scenario: The verified record exists but its reset_token_expires_at is past.
    Expected: HTTPException(401).

    Arrange: find_one -> verified record with expiry 1 minute ago.
    Act:     consume_password_reset_token(token).
    Assert:  HTTPException 401.
    """
    fake_resets.find_one.return_value = _verified_record(
        reset_token_expires_at=(datetime.utcnow() - timedelta(minutes=1)).isoformat()
    )
    with pytest.raises(HTTPException) as exc_info:
        auth.consume_password_reset_token("tok-abc")
    assert exc_info.value.status_code == 401


def test_consume_valid_token_deletes_record_and_returns_email(fake_resets: MagicMock) -> None:
    """
    Scenario: Redeem a valid, non-expired reset token.
    Expected: The record is deleted (single-use) and the associated email is
              returned so the caller can set the new password.

    Arrange: find_one -> fresh verified record.
    Act:     consume_password_reset_token("tok-abc").
    Assert:  returns "jane@example.com"; delete_one called once with {"_id": "rec-1"}.
    """
    # Arrange
    fake_resets.find_one.return_value = _verified_record()

    # Act
    email = auth.consume_password_reset_token("tok-abc")

    # Assert
    assert email == "jane@example.com"
    fake_resets.delete_one.assert_called_once_with({"_id": "rec-1"})
