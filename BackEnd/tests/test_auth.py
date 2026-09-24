"""Integration tests for the /auth router: registration, login, OTP, logout,
and the forgot-password OTP flow -- exercising the router, services.auth,
and the (mongomock) database together.
"""
import pyotp

from .conftest import login_with_otp, register_user


def test_register_returns_provisioning_uri_and_secret(client):
    body = register_user(client, email="alice@example.com")
    assert body["message"] == "Registered successfully"
    assert body["secret"]
    assert body["otpauth_url"].startswith("otpauth://totp/")


def test_register_duplicate_email_is_rejected(client):
    register_user(client, email="dupe@example.com")
    resp = client.post("/auth/register", json={
        "name": "Dupe Two", "email": "dupe@example.com", "password": "Password123!", "role": "RECRUITER",
    })
    assert resp.status_code == 409


def test_register_missing_password_is_rejected(client):
    resp = client.post("/auth/register", json={
        "name": "No Password", "email": "nopass@example.com", "password": "", "role": "RECRUITER",
    })
    assert resp.status_code == 400


def test_login_unknown_email_is_unauthorized(client):
    resp = client.post("/auth/login", json={"email": "ghost@example.com", "password": "whatever"})
    assert resp.status_code == 401


def test_login_wrong_password_is_unauthorized(client):
    register_user(client, email="bob@example.com")
    resp = client.post("/auth/login", json={"email": "bob@example.com", "password": "wrong-password"})
    assert resp.status_code == 401


def test_non_admin_login_requires_otp(client):
    register_user(client, email="carol@example.com")
    resp = client.post("/auth/login", json={"email": "carol@example.com", "password": "Password123!"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["otp_required"] is True
    assert body["pendingToken"]
    # No cookie until OTP is verified.
    assert "access_token" not in resp.cookies


def test_full_otp_login_sets_cookie_and_unlocks_protected_route(client):
    info = register_user(client, email="dave@example.com")
    result = login_with_otp(client, email="dave@example.com", password="Password123!", totp_secret=info["secret"])
    assert result["message"] == "Login successful"
    assert "access_token" in client.cookies

    profile = client.get("/dashboard/profile")
    assert profile.status_code == 200
    assert profile.json()["email"] == "dave@example.com"


def test_verify_otp_rejects_wrong_code(client):
    info = register_user(client, email="erin@example.com")
    login_resp = client.post("/auth/login", json={"email": "erin@example.com", "password": "Password123!"})
    pending_token = login_resp.json()["pendingToken"]

    resp = client.post("/auth/verify-otp", json={"pendingToken": pending_token, "code": "000000"})
    assert resp.status_code == 401


def test_verify_otp_rejects_unknown_pending_token(client):
    resp = client.post("/auth/verify-otp", json={"pendingToken": "not-a-real-token", "code": "123456"})
    assert resp.status_code == 401


def test_admin_login_skips_otp_and_sets_cookie_immediately(client, admin):
    assert "access_token" in client.cookies
    profile = client.get("/dashboard/profile")
    assert profile.status_code == 200
    assert profile.json()["role"] == "ADMIN"


def test_logout_clears_cookie_and_blocks_protected_route(client, recruiter):
    profile = client.get("/dashboard/profile")
    assert profile.status_code == 200

    resp = client.post("/auth/logout")
    assert resp.status_code == 200

    profile_after = client.get("/dashboard/profile")
    assert profile_after.status_code == 401


def test_protected_route_without_login_is_unauthorized(client):
    resp = client.get("/dashboard/profile")
    assert resp.status_code == 401


def test_forgot_password_unknown_email_returns_generic_message(client):
    resp = client.post("/auth/forgot-password", json={"email": "nobody@example.com"})
    assert resp.status_code == 200
    assert "verification code" in resp.json()["message"].lower()


def test_forgot_password_full_reset_flow(client, monkeypatch):
    register_user(client, email="finn@example.com", password="OldPassword1!")

    captured = {}

    def fake_send(to_email, code):
        captured["email"] = to_email
        captured["code"] = code

    monkeypatch.setattr("app.routers.auth.send_password_reset_otp_email", fake_send)

    resp = client.post("/auth/forgot-password", json={"email": "finn@example.com"})
    assert resp.status_code == 200
    assert captured["email"] == "finn@example.com"
    assert len(captured["code"]) == 6

    verify_resp = client.post("/auth/verify-reset-otp", json={"email": "finn@example.com", "code": captured["code"]})
    assert verify_resp.status_code == 200
    reset_token = verify_resp.json()["resetToken"]
    assert reset_token

    reset_resp = client.post("/auth/reset-password", json={"resetToken": reset_token, "new_password": "NewPassword1!"})
    assert reset_resp.status_code == 200

    # Old password no longer works; new one does.
    old_login = client.post("/auth/login", json={"email": "finn@example.com", "password": "OldPassword1!"})
    assert old_login.status_code == 401

    new_login = client.post("/auth/login", json={"email": "finn@example.com", "password": "NewPassword1!"})
    assert new_login.status_code == 200


def test_verify_reset_otp_rejects_wrong_code(client, monkeypatch):
    register_user(client, email="grace@example.com")
    monkeypatch.setattr("app.routers.auth.send_password_reset_otp_email", lambda to_email, code: None)
    client.post("/auth/forgot-password", json={"email": "grace@example.com"})

    resp = client.post("/auth/verify-reset-otp", json={"email": "grace@example.com", "code": "000000"})
    assert resp.status_code in (401, 400)


def test_reset_password_rejects_unknown_token(client):
    resp = client.post("/auth/reset-password", json={"resetToken": "bogus-token", "new_password": "SomethingLong1!"})
    assert resp.status_code == 401
