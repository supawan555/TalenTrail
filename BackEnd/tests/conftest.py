"""Shared fixtures for the integration test suite.

These tests exercise real FastAPI routers + real service/auth logic together,
but swap MongoDB for an in-memory mongomock client so the suite is hermetic
(no live Mongo, SMTP, or Ollama/LLM instance required).
"""
from __future__ import annotations

import os
import sys

# --- Environment must be set BEFORE anything under `app` is imported -------
os.environ.setdefault("MONGO_DB_URI", "mongodb://localhost:27017/talenttrail_test")
os.environ.setdefault("SECRET_KEY_AUTHEN", "integration-test-secret-key")
# Skip the Ollama/sentence-transformers boot healthcheck; nothing in this
# suite exercises the LLM scoring pipeline.
os.environ.setdefault("TALENTRAIL_ALLOW_DEGRADED_LLM", "1")

import mongomock
import pymongo

# Patch pymongo's MongoClient with mongomock's in-memory equivalent before
# `app.db` (imported transitively by `app.main`) constructs its client.
pymongo.MongoClient = mongomock.MongoClient  # type: ignore[misc,assignment]

import pyotp
import pytest
from fastapi.testclient import TestClient

from app.db import (
    auth_password_resets_collection,
    auth_sessions_collection,
    auth_users_collection,
    candidate_collection,
    candidate_notes_collection,
    job_collection,
)
from app.main import app

ALL_COLLECTIONS = (
    auth_users_collection,
    auth_sessions_collection,
    auth_password_resets_collection,
    candidate_collection,
    candidate_notes_collection,
    job_collection,
)


@pytest.fixture(scope="session")
def _app_client():
    """One real startup/shutdown cycle (job preload, auto-archive, healthcheck) per run."""
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def _clean_db(_app_client):
    """Every test starts from an empty database and a logged-out client.

    `_app_client` is session-scoped (one real FastAPI startup per run), so
    without this its Mongo state and auth cookie jar would leak between tests.
    """
    for coll in ALL_COLLECTIONS:
        coll.delete_many({})
    _app_client.cookies.clear()
    yield
    for coll in ALL_COLLECTIONS:
        coll.delete_many({})
    _app_client.cookies.clear()


@pytest.fixture
def client(_app_client):
    return _app_client


def register_user(client: TestClient, *, name="Test User", email="user@example.com",
                   password="Password123!", role="RECRUITER") -> dict:
    """Register a user via the real endpoint and return the JSON response (includes TOTP secret)."""
    resp = client.post("/auth/register", json={
        "name": name, "email": email, "password": password, "role": role,
    })
    assert resp.status_code == 200, resp.text
    return resp.json()


def login_with_otp(client: TestClient, *, email: str, password: str, totp_secret: str) -> dict:
    """Run the full non-admin login flow (password -> pending token -> TOTP code) and return the JSON body.

    The `access_token` cookie is left set on `client` afterwards.
    """
    login_resp = client.post("/auth/login", json={"email": email, "password": password})
    assert login_resp.status_code == 200, login_resp.text
    pending_token = login_resp.json()["pendingToken"]

    code = pyotp.TOTP(totp_secret).now()
    verify_resp = client.post("/auth/verify-otp", json={"pendingToken": pending_token, "code": code})
    assert verify_resp.status_code == 200, verify_resp.text
    return verify_resp.json()


@pytest.fixture
def recruiter(client: TestClient) -> dict:
    """A registered + logged-in RECRUITER. Returns registration info; `client` carries the auth cookie."""
    info = register_user(client, email="recruiter@example.com", role="RECRUITER")
    login_with_otp(client, email="recruiter@example.com", password="Password123!", totp_secret=info["secret"])
    return info


@pytest.fixture
def second_recruiter(client: TestClient) -> dict:
    """A second, independent RECRUITER used for permission-boundary tests.

    Uses a throwaway client so it doesn't clobber the primary `client` fixture's cookie.
    """
    other = TestClient(app)
    info = register_user(other, email="other@example.com", role="RECRUITER")
    login_with_otp(other, email="other@example.com", password="Password123!", totp_secret=info["secret"])
    info["client"] = other
    return info


@pytest.fixture
def admin(client: TestClient) -> dict:
    """A registered + logged-in ADMIN (no OTP step). `client` carries the auth cookie."""
    info = register_user(client, email="admin@example.com", role="ADMIN")
    login_resp = client.post("/auth/login", json={"email": "admin@example.com", "password": "Password123!"})
    assert login_resp.status_code == 200, login_resp.text
    assert login_resp.json()["otp_required"] is False
    return info
