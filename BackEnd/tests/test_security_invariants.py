"""Security-invariant unit tests for the BackEnd, written with the
``security-audit`` skill in guidance mode.

How to read this file
---------------------
The skill asks, for every credential or trust decision: *who is the lower-trust
principal, what control is supposed to stop them, and what is the concrete
result if it fails?* Each test below pins one such control.

Tests marked "REGRESSION GUARD" cover a gap that was found and fixed; the
docstring records what the bug was so nobody reintroduces it.

Workflow for a NEW gap you find later
-------------------------------------
Write the test the way the code *should* behave and mark it::

    @pytest.mark.xfail(strict=True, raises=AssertionError, reason="SECURITY: ...")

* ``raises=AssertionError`` - only a failed assertion counts as the expected
  failure; an import error or typo still shows up as a real failure.
* ``strict=True`` - once the bug is fixed the test passes, pytest reports
  "XPASS(strict)" as a FAILURE, and that reminds you to delete the marker.

Everything is offline: Mongo collections are MagicMocks, file writes are
intercepted, and no HTTP server is started.
"""

from __future__ import annotations

import asyncio
import base64
import io
import json
import logging
import os
import random
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock

import pyotp
import pytest
from fastapi import HTTPException, Response

from app.models.auth import User
from app.routers import auth as auth_router
from app.routers import uploads as uploads_router
from app.services import auth
from app.services.crypto import encrypt_secret
from app.utils import file_handler, file_storage, storage

pytestmark = [pytest.mark.unit, pytest.mark.security]


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------
def _outcome(coro):
    """Run an async route/dependency and summarise how it ended.

    Returns ("ok", value) on success or ("http", status_code) when the code
    raised HTTPException. Comparing tuples keeps assertions readable.
    """
    try:
        return ("ok", asyncio.run(coro))
    except HTTPException as exc:
        return ("http", exc.status_code)


def _cookie_request(token: str | None) -> SimpleNamespace:
    """A stand-in for starlette.Request exposing only .cookies."""
    return SimpleNamespace(cookies={} if token is None else {"access_token": token})


def _route_request() -> SimpleNamespace:
    """A stand-in for starlette.Request with what _cookie_options() reads."""
    return SimpleNamespace(headers={}, url=SimpleNamespace(scheme="http", hostname="testserver"))


def _b64url_json(data: dict) -> str:
    raw = json.dumps(data, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


# ===========================================================================
# 1. Session cookie verification  (services/auth.get_current_user_from_cookie)
#    Principal: anyone who can send a Cookie header.
#    Control:   only tokens signed with SECRET_KEY, unexpired, with a subject.
# ===========================================================================
class TestCookieAuthentication:
    def test_valid_token_yields_its_subject_and_role(self) -> None:
        """
        Scenario: A correctly signed, unexpired cookie.
        Expected: The dependency returns the email and role from the token.

        Arrange: mint a token with create_access_token.
        Act:     run get_current_user_from_cookie on a request carrying it.
        Assert:  ("ok", {"email": ..., "role": ...}).
        """
        token = auth.create_access_token({"sub": "hr@example.com", "role": "hr"})
        assert _outcome(auth.get_current_user_from_cookie(_cookie_request(token))) == (
            "ok",
            {"email": "hr@example.com", "role": "hr"},
        )

    def test_missing_cookie_is_rejected(self) -> None:
        """
        Scenario: No access_token cookie at all.
        Expected: 401.
        """
        assert _outcome(auth.get_current_user_from_cookie(_cookie_request(None))) == ("http", 401)

    def test_token_signed_with_another_key_is_rejected(self) -> None:
        """
        Scenario: An attacker signs their own token with a key they chose.
        Expected: 401 - the signature does not verify against SECRET_KEY.

        Arrange: sign {"sub": victim, "role": "ADMIN"} with "attacker-key".
        Act:     run the dependency.
        Assert:  ("http", 401).
        """
        from jose import jwt

        forged = jwt.encode(
            {"sub": "victim@example.com", "role": "ADMIN"}, "attacker-key", algorithm="HS256"
        )
        assert _outcome(auth.get_current_user_from_cookie(_cookie_request(forged))) == ("http", 401)

    def test_unsigned_alg_none_token_is_rejected(self) -> None:
        """
        Scenario: The classic "alg: none" forgery - a token with no signature.
        Expected: 401, because decode pins algorithms=["HS256"].

        Arrange: hand-build header {"alg": "none"} + admin payload + empty signature.
        Act:     run the dependency.
        Assert:  ("http", 401).
        """
        forged = (
            f"{_b64url_json({'alg': 'none', 'typ': 'JWT'})}."
            f"{_b64url_json({'sub': 'victim@example.com', 'role': 'ADMIN'})}."
        )
        assert _outcome(auth.get_current_user_from_cookie(_cookie_request(forged))) == ("http", 401)

    def test_expired_token_is_rejected(self) -> None:
        """
        Scenario: A token whose exp is in the past (e.g. an old stolen cookie).
        Expected: 401.
        """
        stale = auth.create_access_token({"sub": "hr@example.com"}, expires_delta=timedelta(minutes=-5))
        assert _outcome(auth.get_current_user_from_cookie(_cookie_request(stale))) == ("http", 401)

    def test_token_without_subject_is_rejected(self) -> None:
        """
        Scenario: A validly signed token that names no user ("sub" missing).
        Expected: 401 - there is no principal to act as.
        """
        token = auth.create_access_token({"role": "hr"})
        assert _outcome(auth.get_current_user_from_cookie(_cookie_request(token))) == ("http", 401)

    def test_session_token_is_never_written_to_logs_or_stdout(self, caplog, capsys) -> None:
        """
        REGRESSION GUARD (fixed): get_current_user_from_cookie used to
        logger.warning() and print() the full JWT on every request, so anyone
        who could read the logs could replay it as that user.

        Scenario: A request authenticates with a valid cookie.
        Expected: The raw token string appears in neither log records nor stdout.

        Arrange: capture all log levels; mint a token.
        Act:     run the dependency.
        Assert:  token not in caplog.text and not in captured stdout.
        """
        caplog.set_level(logging.DEBUG)
        token = auth.create_access_token({"sub": "hr@example.com", "role": "hr"})

        asyncio.run(auth.get_current_user_from_cookie(_cookie_request(token)))

        assert token not in caplog.text
        assert token not in capsys.readouterr().out


# ===========================================================================
# 2. Registration  (routers/auth.auth_register)
#    Principal: an unauthenticated visitor.
#    Control:   only the three sign-up roles; ADMIN is granted in the DB only.
# ===========================================================================
class TestRegistration:
    @pytest.fixture()
    def users(self, monkeypatch: pytest.MonkeyPatch) -> MagicMock:
        """Fake users collection with no existing account."""
        collection = MagicMock()
        collection.find_one.return_value = None
        monkeypatch.setattr(auth_router, "auth_users_collection", collection)
        return collection

    @pytest.mark.parametrize("role", ["ADMIN", "admin", "Admin", "superuser", None])
    def test_privileged_or_unknown_role_is_refused(self, users: MagicMock, role) -> None:
        """
        REGRESSION GUARD (fixed): /auth/register used to store whatever role
        the visitor sent, so anyone could self-register as ADMIN (skipping 2FA
        and gaining delete rights over other users' notes).

        Scenario: A visitor registers with a role outside the sign-up list.
        Expected: 400, and nothing is written to the database.

        Arrange: fake users collection (parametrized role).
        Act:     await auth_register(User(..., role=role)).
        Assert:  ("http", 400) and insert_one was never called.
        """
        outcome = _outcome(
            auth_router.auth_register(
                User(name="Mallory", email="mallory@example.com", password="pw-123456", role=role)
            )
        )

        assert outcome == ("http", 400)
        users.insert_one.assert_not_called()

    def test_sign_up_role_is_stored(self, users: MagicMock) -> None:
        """
        Scenario: A visitor registers with a role the sign-up form offers.
        Expected: Registration succeeds and that role is stored.

        Arrange: fake users collection.
        Act:     await auth_register(User(..., role="hr-recruiter")).
        Assert:  success; the inserted document's role is "hr-recruiter".
        """
        kind, _ = _outcome(
            auth_router.auth_register(
                User(name="Jane", email="jane@example.com", password="pw-123456", role="hr-recruiter")
            )
        )

        assert kind == "ok"
        assert users.insert_one.call_args.args[0]["role"] == "hr-recruiter"


# ===========================================================================
# 3. ADMIN dev shortcut  (routers/auth.auth_login)
#    Control: ADMIN may skip TOTP only when ALLOW_ADMIN_2FA_BYPASS is enabled.
# ===========================================================================
_ADMIN_PASSWORD = "admin-pw-123"
_ADMIN_HASH = auth.hash_password(_ADMIN_PASSWORD)


class TestAdmin2FABypassFlag:
    @pytest.fixture()
    def login(self, monkeypatch: pytest.MonkeyPatch):
        """Wire fake collections and return a function that logs in as ADMIN."""
        users = MagicMock()
        users.find_one.return_value = {
            "_id": "admin-1",
            "email": "admin@example.com",
            "password_hash": _ADMIN_HASH,
            "role": "ADMIN",
        }
        monkeypatch.setattr(auth_router, "auth_users_collection", users)
        monkeypatch.setattr(auth_router, "create_pending_session", MagicMock(return_value="pending-xyz"))

        def _login(flag: bool) -> tuple:
            monkeypatch.setattr(auth_router.settings, "ALLOW_ADMIN_2FA_BYPASS", flag)
            response = Response()
            req = SimpleNamespace(email="admin@example.com", password=_ADMIN_PASSWORD)
            result = asyncio.run(auth_router.auth_login(req, response, _route_request()))
            return result, response

        return _login

    def test_admin_must_use_2fa_when_flag_is_off(self, login) -> None:
        """
        Scenario: The default (production) setting - flag off.
        Expected: ADMIN gets the normal OTP step and no session cookie yet.

        Arrange: flag = False.
        Act:     log in with the correct ADMIN password.
        Assert:  otp_required is True; pendingToken issued; no set-cookie header.
        """
        result, response = login(False)

        assert result.otp_required is True
        assert result.pendingToken == "pending-xyz"
        assert "set-cookie" not in response.headers

    def test_admin_skips_2fa_when_flag_is_on(self, login) -> None:
        """
        Scenario: A developer enabled ALLOW_ADMIN_2FA_BYPASS in their local .env.
        Expected: ADMIN is logged straight in (the dev convenience still works).

        Arrange: flag = True.
        Act:     log in with the correct ADMIN password.
        Assert:  otp_required is False and the access_token cookie is set.
        """
        result, response = login(True)

        assert result.otp_required is False
        assert "access_token=" in response.headers["set-cookie"]


# ===========================================================================
# 4. Second factor  (routers/auth.auth_verify_otp)
#    Principal: someone holding a pendingToken (issued after a correct password).
#    Control:   pendingToken is single-use and expires after 5 minutes; a valid
#               TOTP code is required.
# ===========================================================================
_TOTP_SECRET = pyotp.random_base32()


def _wire_otp_collections(monkeypatch: pytest.MonkeyPatch, *, expires_at) -> MagicMock:
    """Install fake sessions/users collections; return the sessions mock.

    expires_at may be a datetime or a raw value (to simulate a corrupt record).
    """
    sessions = MagicMock()
    sessions.find_one.return_value = {
        "_id": "sess-1",
        "token": "pending-abc",
        "stage": "pending",
        "user_id": "user-1",
        "expires_at": expires_at.isoformat() if isinstance(expires_at, datetime) else expires_at,
    }
    users = MagicMock()
    users.find_one.return_value = {
        "_id": "user-1",
        "email": "hr@example.com",
        "role": "hr",
        "totp_secret": encrypt_secret(_TOTP_SECRET),
    }
    monkeypatch.setattr(auth_router, "auth_sessions_collection", sessions)
    monkeypatch.setattr(auth_router, "auth_users_collection", users)
    return sessions


def _otp_request(code: str | None = None) -> SimpleNamespace:
    return SimpleNamespace(pendingToken="pending-abc", code=code or pyotp.TOTP(_TOTP_SECRET).now())


class TestSecondFactor:
    def test_valid_code_on_fresh_session_logs_in_and_consumes_the_session(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """
        Scenario: A fresh pending session and the current TOTP code.
        Expected: Login succeeds; the lookup required stage "pending"; the
                  session is then marked "done" (single use); the session
                  cookie is HttpOnly.
        """
        # Arrange
        sessions = _wire_otp_collections(
            monkeypatch, expires_at=datetime.utcnow() + timedelta(minutes=5)
        )
        response = Response()

        # Act
        kind, _ = _outcome(auth_router.auth_verify_otp(_otp_request(), response, _route_request()))

        # Assert
        assert kind == "ok"
        sessions.find_one.assert_called_once_with({"token": "pending-abc", "stage": "pending"})
        (_filter, update), _kw = sessions.update_one.call_args
        assert update["$set"]["stage"] == "done"
        assert "httponly" in response.headers["set-cookie"].lower()

    def test_wrong_code_is_rejected(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """
        Scenario: Password was right, but the TOTP code is wrong.
        Expected: 401 and the session is NOT consumed.
        """
        sessions = _wire_otp_collections(
            monkeypatch, expires_at=datetime.utcnow() + timedelta(minutes=5)
        )
        live = pyotp.TOTP(_TOTP_SECRET).now()
        wrong = "000000" if live != "000000" else "111111"

        outcome = _outcome(auth_router.auth_verify_otp(_otp_request(wrong), Response(), _route_request()))

        assert outcome == ("http", 401)
        sessions.update_one.assert_not_called()

    def test_expired_pending_session_is_rejected(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """
        REGRESSION GUARD (fixed): the "Pending token expired" HTTPException was
        raised inside `try: ... except Exception: pass`, which swallowed it, so
        an expired pendingToken still completed login.

        Scenario: The pending session expired a minute ago; the code is valid.
        Expected: 401.

        Arrange: fake collections with expires_at = now - 1 minute.
        Act:     await auth_verify_otp(...) with the live code.
        Assert:  ("http", 401).
        """
        _wire_otp_collections(monkeypatch, expires_at=datetime.utcnow() - timedelta(minutes=1))

        outcome = _outcome(auth_router.auth_verify_otp(_otp_request(), Response(), _route_request()))

        assert outcome == ("http", 401)

    @pytest.mark.parametrize("bad_value", [None, "not-a-date"])
    def test_session_with_unreadable_expiry_is_rejected(
        self, monkeypatch: pytest.MonkeyPatch, bad_value
    ) -> None:
        """
        Scenario: The session record's expires_at is missing or corrupt.
        Expected: 401 - an expiry we cannot read must fail closed, not open.

        Arrange: fake collections with expires_at = None / "not-a-date".
        Act:     await auth_verify_otp(...) with the live code.
        Assert:  ("http", 401).
        """
        _wire_otp_collections(monkeypatch, expires_at=bad_value)

        outcome = _outcome(auth_router.auth_verify_otp(_otp_request(), Response(), _route_request()))

        assert outcome == ("http", 401)


# ===========================================================================
# 5. Password recovery  (routers/auth + services/auth reset flow)
#    Principal: an unauthenticated visitor who knows (or guesses) an email.
#    Control:   the reset code/token is bound to one email, one stage, one use.
# ===========================================================================
class TestPasswordRecovery:
    def test_forgot_password_response_does_not_reveal_whether_account_exists(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """
        Scenario: Request a reset for a registered and an unregistered email.
        Expected: Both get the identical response; a code is only created and
                  emailed for the registered one.
        """
        # Arrange
        users = MagicMock()
        users.find_one.side_effect = lambda q: {"email": q["email"]} if q["email"] == "known@example.com" else None
        create_otp = MagicMock(return_value="123456")
        send_mail = MagicMock()
        monkeypatch.setattr(auth_router, "auth_users_collection", users)
        monkeypatch.setattr(auth_router, "create_password_reset_otp", create_otp)
        monkeypatch.setattr(auth_router, "send_password_reset_otp_email", send_mail)

        # Act
        known = asyncio.run(auth_router.auth_forgot_password(SimpleNamespace(email="known@example.com")))
        unknown = asyncio.run(auth_router.auth_forgot_password(SimpleNamespace(email="ghost@example.com")))

        # Assert
        assert known == unknown
        create_otp.assert_called_once_with("known@example.com")
        send_mail.assert_called_once()

    def test_reset_code_is_looked_up_by_email_and_pending_stage(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """
        Scenario: Verify a reset code.
        Expected: The lookup is bound to BOTH the email and stage "otp_pending",
                  so Bob's code can't unlock Alice's account and an already
                  verified record can't be verified again.
        """
        resets = MagicMock()
        resets.find_one.return_value = None
        monkeypatch.setattr(auth, "auth_password_resets_collection", resets)

        with pytest.raises(HTTPException):
            auth.verify_password_reset_otp("alice@example.com", "123456")

        resets.find_one.assert_called_once_with({"email": "alice@example.com", "stage": "otp_pending"})

    def test_successful_verification_burns_the_code(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """
        Scenario: The correct code is submitted.
        Expected: The stored otp_hash is $unset, so the same code can't be
                  replayed to mint a second reset token.
        """
        resets = MagicMock()
        resets.find_one.return_value = {
            "_id": "rec-1",
            "email": "alice@example.com",
            "stage": "otp_pending",
            "otp_hash": auth.hash_password("999888"),
            "attempts": 0,
            "expires_at": (datetime.utcnow() + timedelta(minutes=5)).isoformat(),
        }
        monkeypatch.setattr(auth, "auth_password_resets_collection", resets)

        auth.verify_password_reset_otp("alice@example.com", "999888")

        (_filter, update), _kw = resets.update_one.call_args
        assert "otp_hash" in update["$unset"]

    def test_reset_token_is_looked_up_only_in_verified_stage(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """
        Scenario: Redeem a reset token.
        Expected: The lookup requires stage "verified", so a token can only be
                  used after the emailed code was proven.
        """
        resets = MagicMock()
        resets.find_one.return_value = None
        monkeypatch.setattr(auth, "auth_password_resets_collection", resets)

        with pytest.raises(HTTPException):
            auth.consume_password_reset_token("tok")

        resets.find_one.assert_called_once_with({"reset_token": "tok", "stage": "verified"})

    def test_requesting_a_new_code_revokes_any_outstanding_reset_token(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """
        Scenario: A new reset code is requested while an old reset token exists.
        Expected: The upsert $unset-s reset_token, invalidating the old one.
        """
        resets = MagicMock()
        monkeypatch.setattr(auth, "auth_password_resets_collection", resets)

        auth.create_password_reset_otp("alice@example.com")

        (_filter, update), _kw = resets.update_one.call_args
        assert "reset_token" in update["$unset"]

    def test_reset_codes_do_not_come_from_the_seedable_global_prng(self) -> None:
        """
        REGRESSION GUARD (fixed): generate_otp_code() used random.randint
        (Mersenne Twister), whose output is reproducible from its seed. It now
        uses secrets.randbelow (the OS CSPRNG).

        Scenario: Seed the global PRNG identically twice and draw codes.
        Expected: The two batches are independent (they differ).

        Arrange: save PRNG state; seed 1234.
        Act:     draw 5 codes, reseed 1234, draw 5 more.
        Assert:  the batches differ. (PRNG state is restored afterwards.)
        """
        state = random.getstate()
        try:
            random.seed(1234)
            first = [auth.generate_otp_code() for _ in range(5)]
            random.seed(1234)
            second = [auth.generate_otp_code() for _ in range(5)]
        finally:
            random.setstate(state)

        assert first != second


# ===========================================================================
# 6. Uploads  (routers/uploads, utils/storage, utils/file_handler)
#    Control: every stored file is addressed by a bare storage key, so neither
#             an uploaded filename nor a client-supplied URL can reach files
#             outside the store, and resumes are always stored as .pdf.
# ===========================================================================
def _fake_upload(filename: str, content_type: str) -> SimpleNamespace:
    return SimpleNamespace(filename=filename, content_type=content_type, file=io.BytesIO(b"<x>"))


@pytest.fixture()
def saved(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    """Replace storage.save with a recorder so no test writes a real file."""
    recorder = MagicMock(side_effect=lambda key, data, content_type="application/pdf": key)
    monkeypatch.setattr(storage, "save", recorder)
    return recorder


class TestUploads:
    @pytest.mark.parametrize(
        "hostile_name",
        [
            "../../etc/passwd",
            "..\\..\\windows\\win.ini",
            "/absolute/path/cv.pdf",
            "C:\\temp\\cv.pdf",
            "cv.pdf/../../escape",
        ],
    )
    def test_unique_name_never_contains_a_directory_component(self, hostile_name: str) -> None:
        """
        Scenario: The client sends a filename full of traversal tricks.
        Expected: unique_name() returns a bare "resume_<hex><ext>", so it can
                  never name a file outside the store.
        """
        result = file_storage.unique_name("resume", hostile_name, ".pdf")
        assert os.path.basename(result) == result
        assert result.startswith("resume_")

    def test_resume_without_pdf_name_is_rejected(self, saved: MagicMock) -> None:
        """
        Scenario: Upload "notes.txt" as text/plain to /uploads/resume.
        Expected: 400, and nothing is stored.
        """
        assert _outcome(uploads_router.upload_resume(_fake_upload("notes.txt", "text/plain"))) == ("http", 400)
        saved.assert_not_called()

    def test_resume_with_html_name_is_rejected_even_if_declared_pdf(self, saved: MagicMock) -> None:
        """
        REGRESSION GUARD (fixed): the check was `name is .pdf OR type is pdf`,
        so "cv.html" with the (client-controlled) type application/pdf was
        accepted, stored as .html and served as a web page on the API origin.

        Scenario: Upload "cv.html" declared as application/pdf.
        Expected: 400 - the extension decides, not the client's header.
        """
        outcome = _outcome(uploads_router.upload_resume(_fake_upload("cv.html", "application/pdf")))
        assert outcome == ("http", 400)
        saved.assert_not_called()

    def test_pdf_resume_is_stored_as_pdf(self, saved: MagicMock) -> None:
        """
        Scenario: A normal resume "cv.pdf".
        Expected: Stored under a fresh .pdf key, and the returned URL is
                  "/uploads/<that key>" (no server file path is leaked).
        """
        result = asyncio.run(uploads_router.upload_resume(_fake_upload("cv.pdf", "application/pdf")))

        key = saved.call_args.args[0]
        assert key.lower().endswith(".pdf") and storage.is_valid_key(key)
        assert result == {"url": f"/uploads/{key}"}

    def test_removed_photo_routes_stay_removed(self) -> None:
        """
        REGRESSION GUARD: the candidate-photo feature was removed. Its routes
        (/uploads/profile-picture, /upload/profile-picture, /upload-file/...)
        were unused and one of them let visitors store .html files, so they
        must not come back by accident.

        Scenario: Collect every route path the app registers.
        Expected: None of them is a photo route.
        """
        from app import main

        paths = [getattr(route, "path", "") for route in main.app.routes]

        assert not [p for p in paths if "profile-picture" in p or "upload-file" in p]

    def test_candidate_resume_upload_ignores_the_client_filename(self, saved: MagicMock) -> None:
        """
        REGRESSION GUARD (fixed): handle_candidate_uploads used the raw client
        filename as a path, so "../../escaped.txt" escaped the upload folder.

        Scenario: A resume arrives named "../../escaped.txt".
        Expected: It is stored under a fresh "resume_<uuid>.pdf" key and the
                  URL points at that key - the client name is not used at all.
        """
        key, url = file_handler.handle_candidate_uploads(_fake_upload("../../escaped.txt", "application/pdf"))

        assert storage.is_valid_key(key)
        assert key.startswith("resume_") and key.endswith(".pdf")
        assert saved.call_args.args[0] == key
        assert url == f"/uploads/{key}"

    def test_handle_candidate_uploads_matches_how_its_caller_uses_it(self) -> None:
        """
        REGRESSION GUARD (correctness): routers/candidates.py once called this
        with 2 arguments while it took 1, so every multipart POST /candidates
        crashed with TypeError. The caller now does
            res_key, res_url = handle_candidate_uploads(resume)

        Scenario: No resume file was sent.
        Expected: It accepts one argument and returns exactly two values.
        """
        assert file_handler.handle_candidate_uploads(None) == (None, None)

    def test_resume_url_inside_uploads_maps_to_its_key(self) -> None:
        """
        Scenario: The frontend sends the URL it got back from /upload/resume.
        Expected: It maps to that storage key.
        """
        assert storage.key_from_url("/uploads/resume_abc.pdf") == "resume_abc.pdf"

    @pytest.mark.parametrize(
        "resume_url",
        [
            "/../../.env",
            "/uploads/../../.env",
            "/uploads/../app/config.py",
            "/uploads/resumes/x.pdf",
            "/uploads/.env",
            "/uploads/..",
            "C:/Windows/win.ini",
            "/etc/passwd",
            "",
            None,
            123,
        ],
    )
    def test_resume_url_outside_uploads_is_refused(self, resume_url) -> None:
        """
        REGRESSION GUARD (fixed): create_candidate turned the client's
        resumeUrl into os.path.abspath(url.lstrip("/")), so a logged-in user
        could point the resume parser at any file on the server.

        Scenario: A resumeUrl that escapes (or never was in) /uploads/, or
                  names something other than one plain file.
        Expected: None - no storage key, so no file is read or deleted.
        """
        assert storage.key_from_url(resume_url) is None
