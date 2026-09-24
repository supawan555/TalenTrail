"""Unit tests for the pure helpers in ``app/services/auth.py``.

Covered here (no database needed):

    hash_password / verify_password  - bcrypt wrappers
    create_access_token              - builds a signed JWT with an expiry
    verify_totp_code                 - checks a 6-digit TOTP code
    generate_otp_code                - random 6-digit string
    require_role                     - dependency factory that guards a role

Testing strategy
----------------
bcrypt / pyotp / python-jose are fast enough to run for real, so we do. Only
``generate_otp_code`` is made deterministic (by patching ``auth.secrets``).
``require_role`` returns an ``async`` function; we call it and drive the
coroutine with ``asyncio.run`` instead of adding the pytest-asyncio plugin.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import pyotp
import pytest
from fastapi import HTTPException
from jose import JWTError, jwt

from app.services import auth

pytestmark = pytest.mark.unit


# ===========================================================================
# hash_password / verify_password
# ===========================================================================
def test_hash_password_returns_a_bcrypt_hash_not_the_plaintext() -> None:
    """
    Scenario: Hash a password.
    Expected: The output is a bcrypt hash string (starts with "$2b$") and is not
              the original password.

    Arrange: a plaintext password.
    Act:     hash it.
    Assert:  it differs from the input and has the bcrypt prefix.
    """
    hashed = auth.hash_password("s3cr3t-pw")
    assert hashed != "s3cr3t-pw"
    assert hashed.startswith("$2b$")


def test_verify_password_accepts_correct_and_rejects_wrong() -> None:
    """
    Scenario: Verify a password against its own hash, then against a bad guess.
    Expected: True for the right password, False for the wrong one.

    Arrange: hash "correct horse battery staple".
    Act:     verify with the right password and with a wrong one.
    Assert:  True then False.
    """
    # Arrange
    hashed = auth.hash_password("correct horse battery staple")

    # Act / Assert
    assert auth.verify_password("correct horse battery staple", hashed) is True
    assert auth.verify_password("Tr0ub4dor&3", hashed) is False


# ===========================================================================
# create_access_token
# ===========================================================================
def test_token_round_trips_its_payload() -> None:
    """
    Scenario: Create a token from a claims dict, then decode it.
    Expected: The custom claims ("sub", "role") survive the round trip.

    Arrange: claims dict.
    Act:     encode with create_access_token, decode with jose using auth.SECRET_KEY.
    Assert:  decoded["sub"] and decoded["role"] match what went in.
    """
    # Act
    token = auth.create_access_token({"sub": "jane@example.com", "role": "hr"})
    decoded = jwt.decode(token, auth.SECRET_KEY, algorithms=["HS256"])

    # Assert
    assert decoded["sub"] == "jane@example.com"
    assert decoded["role"] == "hr"


def test_default_expiry_is_about_15_minutes() -> None:
    """
    Scenario: Create a token without passing expires_delta.
    Expected: Its "exp" claim is ~15 minutes in the future (the documented
              default). We allow a 14-16 minute window for clock/exec slack.

    Arrange: record 'before' timestamp.
    Act:     create a token, decode it, read "exp".
    Assert:  14 min <= (exp - before) <= 16 min.
    """
    # Arrange
    before = datetime.now(timezone.utc)

    # Act
    token = auth.create_access_token({"sub": "x"})
    exp = datetime.fromtimestamp(
        jwt.decode(token, auth.SECRET_KEY, algorithms=["HS256"])["exp"], tz=timezone.utc
    )

    # Assert
    assert timedelta(minutes=14) <= (exp - before) <= timedelta(minutes=16)


def test_custom_expires_delta_is_respected() -> None:
    """
    Scenario: Create a token with expires_delta=2 hours.
    Expected: "exp" is ~2 hours out, not the 15-minute default.

    Arrange: -
    Act:     create the token with a 2-hour delta; decode "exp"; take 'now' after.
    Assert:  115 min <= (exp - now) <= 125 min.
    """
    # Act
    token = auth.create_access_token({"sub": "x"}, expires_delta=timedelta(hours=2))
    exp = datetime.fromtimestamp(
        jwt.decode(token, auth.SECRET_KEY, algorithms=["HS256"])["exp"], tz=timezone.utc
    )
    now = datetime.now(timezone.utc)

    # Assert
    assert timedelta(minutes=115) <= (exp - now) <= timedelta(minutes=125)


def test_token_is_signed_and_rejects_a_different_key() -> None:
    """
    Scenario: Decode a valid token using the wrong secret key.
    Expected: jose raises JWTError - the signature does not verify. This proves
              the token is actually signed, not just base64-encoded.

    Arrange: create a token with the real key.
    Act:     decode it with "not-the-real-key".
    Assert:  JWTError is raised.
    """
    token = auth.create_access_token({"sub": "x"})
    with pytest.raises(JWTError):
        jwt.decode(token, "not-the-real-key", algorithms=["HS256"])


# ===========================================================================
# verify_totp_code
# ===========================================================================
def test_verify_totp_accepts_the_current_code() -> None:
    """
    Scenario: Verify the code that an authenticator app would show right now.
    Expected: True.

    Arrange: random base32 secret; compute its current code with pyotp.
    Act:     verify_totp_code(secret, current_code).
    Assert:  True.
    """
    # Arrange
    secret = pyotp.random_base32()
    current_code = pyotp.TOTP(secret).now()

    # Act / Assert
    assert auth.verify_totp_code(secret, current_code) is True


def test_verify_totp_rejects_an_unrelated_code() -> None:
    """
    Scenario: Verify a code that is not the current one.
    Expected: False.

    Note: "000000" is only valid in the ~1-in-a-million case that it happens to
    be the live code, so we pick a fallback that is guaranteed different. This
    is also why the production call uses valid_window=1 - to tolerate the code
    rolling over during submission - but a clearly wrong code must still fail.

    Arrange: random secret; choose a code known to differ from now().
    Act:     verify_totp_code(secret, wrong_code).
    Assert:  False.
    """
    # Arrange
    secret = pyotp.random_base32()
    wrong_code = "000000" if pyotp.TOTP(secret).now() != "000000" else "111111"

    # Act / Assert
    assert auth.verify_totp_code(secret, wrong_code) is False


# ===========================================================================
# generate_otp_code
# ===========================================================================
def test_generate_otp_code_is_zero_padded_to_six_digits(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Scenario: The random draw returns a small number (5).
    Expected: The code is still 6 characters, left-padded with zeros: "000005".

    Arrange: monkeypatch auth.secrets.randbelow to always return 5.
    Act:     call generate_otp_code().
    Assert:  == "000005".
    """
    # Arrange
    monkeypatch.setattr(auth.secrets, "randbelow", lambda _n: 5)

    # Act / Assert
    assert auth.generate_otp_code() == "000005"


def test_generate_otp_code_shape_holds_over_many_real_calls() -> None:
    """
    Scenario: Draw many real OTP codes.
    Expected: Every one is exactly 6 ASCII digits.

    Arrange: -
    Act:     call generate_otp_code() 500 times.
    Assert:  each result has length 6 and .isdigit() is True.
    """
    for _ in range(500):
        code = auth.generate_otp_code()
        assert len(code) == 6 and code.isdigit()


# ===========================================================================
# require_role
# ===========================================================================
def test_require_role_allows_a_user_with_the_matching_role() -> None:
    """
    Scenario: A user whose role is "hr" hits an endpoint guarded by
              require_role("hr").
    Expected: The guard returns the user dict unchanged (request proceeds).

    Arrange: build the checker with require_role("hr"); a user dict with role "hr".
    Act:     await checker(current_user=user)  (driven via asyncio.run).
    Assert:  the returned value is the same user dict.
    """
    # Arrange
    checker = auth.require_role("hr")
    user = {"email": "jane@example.com", "role": "hr"}

    # Act
    result = asyncio.run(checker(current_user=user))

    # Assert
    assert result == user


def test_require_role_blocks_a_user_with_a_different_role() -> None:
    """
    Scenario: A user whose role is "hr" hits an endpoint guarded by
              require_role("admin").
    Expected: HTTPException(403) is raised.

    Arrange: build the checker with require_role("admin"); a non-admin user.
    Act:     await checker(current_user=user).
    Assert:  HTTPException is raised with status_code 403.
    """
    # Arrange
    checker = auth.require_role("admin")

    # Act / Assert
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(checker(current_user={"email": "jane@example.com", "role": "hr"}))
    assert exc_info.value.status_code == 403
