"""Unit tests for the Vercel-readiness changes:

    app/utils/storage.py          - local disk / private Vercel Blob file storage
    app/routers/uploads.py        - GET /uploads/{key} serves files to logged-in users
    app/routers/cron.py           - GET /cron/auto-archive, protected by CRON_SECRET
    app/services/auto_archive_hired.py - archive logic + RUN_BACKGROUND_JOBS switch
    app/routers/candidates.py     - clients can no longer set resume_path/resume_file

Testing strategy
----------------
* Local storage runs for real against pytest's ``tmp_path``.
* Blob storage never touches the network: the SDK functions ``put``/``get``/
  ``delete`` are replaced with an in-memory fake.
* Routes are exercised with FastAPI's ``TestClient`` on a small app that only
  includes the router under test, so no startup hooks or MongoDB are involved.
"""
from __future__ import annotations

import asyncio
import io
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from bson import ObjectId
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from vercel import blob as vercel_blob

from app.config import settings
from app.routers import candidates as candidates_router
from app.routers import cron as cron_router
from app.routers import uploads as uploads_router
from app.services import auth
from app.services import auto_archive_hired
from app.services.auth import get_current_user_from_cookie
from app.utils import storage

pytestmark = pytest.mark.unit


@pytest.fixture()
def local_store(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    """Point local storage at an empty temp folder."""
    monkeypatch.setattr(settings, "FILE_STORAGE", "local")
    monkeypatch.setattr(storage, "UPLOAD_DIR", str(tmp_path))
    return tmp_path


@pytest.fixture()
def blob_store(monkeypatch: pytest.MonkeyPatch) -> dict:
    """Switch to Blob storage backed by an in-memory dict instead of Vercel."""
    files: dict = {}
    calls: list = []

    def fake_put(path, body, *, access="public", content_type=None, **_):
        calls.append(("put", path, access))
        files[path] = body

    def fake_get(path, *, access="public", **_):
        calls.append(("get", path, access))
        if path not in files:
            raise vercel_blob.BlobNotFoundError()
        return SimpleNamespace(content=files[path], status_code=200)

    def fake_delete(path, **_):
        calls.append(("delete", path, None))
        files.pop(path, None)

    monkeypatch.setattr(settings, "FILE_STORAGE", "vercel_blob")
    monkeypatch.setattr(vercel_blob, "put", fake_put)
    monkeypatch.setattr(vercel_blob, "get", fake_get)
    monkeypatch.setattr(vercel_blob, "delete", fake_delete)
    return {"files": files, "calls": calls}


def _upload(data: bytes) -> SimpleNamespace:
    return SimpleNamespace(filename="cv.pdf", content_type="application/pdf", file=io.BytesIO(data))


# ===========================================================================
# Storage keys
# ===========================================================================
@pytest.mark.parametrize(
    "key, valid",
    [
        ("resume_abc123.pdf", True),
        ("resume_ABC-1.PDF", True),
        ("../secret.pdf", False),
        ("sub/dir.pdf", False),
        ("sub\\dir.pdf", False),
        (".env", False),
        ("..", False),
        ("a..b.pdf", False),
        ("", False),
        (None, False),
        ("x" * 300, False),
    ],
)
def test_is_valid_key(key, valid: bool) -> None:
    """
    Scenario: Keys a caller (or attacker) might hand to storage.
    Expected: Only a single plain filename is accepted: no slashes of either
              kind, no "..", no leading dot, and not absurdly long.
    """
    assert storage.is_valid_key(key) is valid


# ===========================================================================
# Local backend
# ===========================================================================
class TestLocalStorage:
    def test_save_read_delete_round_trip(self, local_store: Path) -> None:
        """
        Scenario: Save a file, read it back, delete it.
        Expected: The bytes survive the round trip, the file lives inside the
                  upload folder, and delete removes it.
        """
        storage.save("resume_a.pdf", b"%PDF-1.4 hello")

        assert (local_store / "resume_a.pdf").read_bytes() == b"%PDF-1.4 hello"
        assert storage.read("resume_a.pdf") == b"%PDF-1.4 hello"

        storage.delete("resume_a.pdf")
        assert storage.read("resume_a.pdf") is None

    def test_invalid_key_is_refused_on_save_and_ignored_elsewhere(self, local_store: Path) -> None:
        """
        Scenario: A traversal key reaches storage.
        Expected: save() raises; read()/delete() do nothing and touch no file.
        """
        with pytest.raises(ValueError):
            storage.save("../evil.pdf", b"x")
        assert storage.read("../evil.pdf") is None
        storage.delete("../evil.pdf")  # must not raise or delete anything

    def test_local_copy_uses_the_file_in_place(self, local_store: Path) -> None:
        """
        Scenario: The ML pipeline asks for a path to parse.
        Expected: With local storage, it gets the real file path; a missing
                  key yields None.
        """
        storage.save("resume_b.pdf", b"data")
        with storage.local_copy("resume_b.pdf") as path:
            assert Path(path) == local_store / "resume_b.pdf"
        with storage.local_copy("resume_missing.pdf") as path:
            assert path is None


# ===========================================================================
# Vercel Blob backend (SDK faked)
# ===========================================================================
class TestBlobStorage:
    def test_save_uses_a_private_blob_under_the_uploads_folder(self, blob_store: dict) -> None:
        """
        Scenario: Save with FILE_STORAGE=vercel_blob.
        Expected: put() is called with pathname "uploads/<key>" and
                  access="private" - resumes must never be public blobs.
        """
        storage.save("resume_c.pdf", b"data")

        assert blob_store["calls"][0] == ("put", "uploads/resume_c.pdf", "private")

    def test_read_returns_content_and_none_when_missing(self, blob_store: dict) -> None:
        """
        Scenario: Read an existing blob, then a missing one.
        Expected: The bytes, then None (BlobNotFoundError is swallowed).
        """
        storage.save("resume_d.pdf", b"hello")

        assert storage.read("resume_d.pdf") == b"hello"
        assert storage.read("resume_nope.pdf") is None

    def test_local_copy_downloads_to_a_temp_file_and_cleans_up(self, blob_store: dict) -> None:
        """
        Scenario: The ML pipeline needs a real path but the file is a blob.
        Expected: A temp file with the blob's bytes exists inside the block
                  and is deleted afterwards.
        """
        storage.save("resume_e.pdf", b"%PDF temp")

        with storage.local_copy("resume_e.pdf") as path:
            assert Path(path).read_bytes() == b"%PDF temp"
            kept = path
        assert not os.path.exists(kept)

    def test_delete_removes_the_blob(self, blob_store: dict) -> None:
        """
        Scenario: Delete a stored blob, then delete it again.
        Expected: It is gone; deleting a missing blob does not raise.
        """
        storage.save("resume_f.pdf", b"x")
        storage.delete("resume_f.pdf")
        storage.delete("resume_f.pdf")

        assert "uploads/resume_f.pdf" not in blob_store["files"]


# ===========================================================================
# Upload size limit
# ===========================================================================
class TestUploadSizeLimit:
    def test_upload_at_the_limit_is_accepted(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """
        Scenario: A file exactly MAX_UPLOAD_MB in size.
        Expected: Read in full.
        """
        monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 1)
        data = b"x" * (1024 * 1024)
        assert storage.read_upload(_upload(data)) == data

    def test_upload_over_the_limit_is_rejected_with_413(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """
        Scenario: A file one byte over MAX_UPLOAD_MB.
        Expected: HTTP 413, since Vercel rejects bodies over 4.5 MB anyway and
                  a clear error beats a mysterious failure.
        """
        monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 1)
        with pytest.raises(HTTPException) as exc_info:
            storage.read_upload(_upload(b"x" * (1024 * 1024 + 1)))
        assert exc_info.value.status_code == 413


# ===========================================================================
# GET /uploads/{key}
# ===========================================================================
@pytest.fixture()
def files_client(local_store: Path) -> TestClient:
    app = FastAPI()
    app.include_router(uploads_router.router)
    return TestClient(app)


def _login_cookie() -> dict:
    return {"access_token": auth.create_access_token({"sub": "hr@example.com", "role": "hr-recruiter"})}


class TestServeUploadedFiles:
    def test_anonymous_request_is_rejected(self, files_client: TestClient) -> None:
        """
        Scenario: Fetch a resume without logging in.
        Expected: 401. Resumes hold personal data; the old static /uploads
                  mount served them to anyone with the link.
        """
        storage.save("resume_g.pdf", b"%PDF")
        assert files_client.get("/uploads/resume_g.pdf").status_code == 401

    def test_logged_in_user_gets_the_pdf_inline(self, files_client: TestClient) -> None:
        """
        Scenario: A logged-in user opens a resume (the frontend's iframe).
        Expected: 200 with the bytes, served as application/pdf, not cached,
                  and with nosniff so the browser trusts the declared type.
        """
        storage.save("resume_h.pdf", b"%PDF-1.4")
        res = files_client.get("/uploads/resume_h.pdf", cookies=_login_cookie())

        assert res.status_code == 200
        assert res.content == b"%PDF-1.4"
        assert res.headers["content-type"] == "application/pdf"
        assert res.headers["x-content-type-options"] == "nosniff"
        assert "no-store" in res.headers["cache-control"]

    def test_unknown_types_are_downloaded_never_rendered(self, files_client: TestClient) -> None:
        """
        Scenario: An old file with an .html extension is requested.
        Expected: Served as an octet-stream attachment, so the browser saves it
                  instead of running it as a page on the API's origin.
        """
        storage.save("legacy_x.html", b"<script>alert(1)</script>")
        res = files_client.get("/uploads/legacy_x.html", cookies=_login_cookie())

        assert res.headers["content-type"] == "application/octet-stream"
        assert res.headers["content-disposition"].startswith("attachment")

    def test_missing_file_is_404(self, files_client: TestClient) -> None:
        """
        Scenario: Ask for a key that was never stored.
        Expected: 404.
        """
        assert files_client.get("/uploads/resume_none.pdf", cookies=_login_cookie()).status_code == 404


# ===========================================================================
# Vercel Cron: GET /cron/auto-archive
# ===========================================================================
@pytest.fixture()
def cron_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr(cron_router, "archive_hired_candidates", lambda: 3)
    app = FastAPI()
    app.include_router(cron_router.router)
    return TestClient(app)


class TestCronEndpoint:
    def test_refuses_everything_when_no_secret_is_configured(
        self, cron_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """
        Scenario: CRON_SECRET is not set.
        Expected: 503 for every caller - fail closed, never open.
        """
        monkeypatch.setattr(settings, "CRON_SECRET", "")
        res = cron_client.get("/cron/auto-archive", headers={"Authorization": "Bearer "})
        assert res.status_code == 503

    @pytest.mark.parametrize("header", [None, "Bearer wrong", "not-bearer s3cret", "s3cret"])
    def test_rejects_missing_or_wrong_secret(
        self, cron_client: TestClient, monkeypatch: pytest.MonkeyPatch, header
    ) -> None:
        """
        Scenario: Someone on the internet calls the cron URL.
        Expected: 401 unless the exact "Bearer <CRON_SECRET>" is sent.
        """
        monkeypatch.setattr(settings, "CRON_SECRET", "s3cret")
        headers = {} if header is None else {"Authorization": header}
        assert cron_client.get("/cron/auto-archive", headers=headers).status_code == 401

    def test_runs_the_archive_with_the_right_secret(
        self, cron_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """
        Scenario: Vercel Cron calls with the configured secret.
        Expected: 200 and the number of archived candidates.
        """
        monkeypatch.setattr(settings, "CRON_SECRET", "s3cret")
        res = cron_client.get("/cron/auto-archive", headers={"Authorization": "Bearer s3cret"})
        assert res.status_code == 200
        assert res.json() == {"archived": 3}


def test_vercel_json_schedules_the_cron_route_once_a_day() -> None:
    """
    Scenario: Read BackEnd/vercel.json.
    Expected: It calls /cron/auto-archive, and the schedule is daily (fixed
              minute and hour). Hobby plans reject anything more frequent,
              which would fail the whole deployment.
    """
    config = json.loads((Path(__file__).resolve().parents[1] / "vercel.json").read_text())
    (job,) = config["crons"]
    minute, hour, *_ = job["schedule"].split()

    assert job["path"] == "/cron/auto-archive"
    assert minute.isdigit() and hour.isdigit()


# ===========================================================================
# Archive logic + background-job switch
# ===========================================================================
class TestAutoArchive:
    def test_archives_old_hires_and_returns_the_count(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """
        Scenario: One candidate was hired long ago.
        Expected: It is set to archived with an open "archived" history entry,
                  its hired entry is closed, and the function returns 1.
        """
        hired = {
            "_id": "c1",
            "stage": "hired",
            "hired_at": datetime.utcnow() - timedelta(days=30),
            "state_history": [{"state": "hired", "entered_at": datetime.utcnow(), "exited_at": None}],
        }
        collection = MagicMock()
        collection.find.return_value = [hired]
        monkeypatch.setattr(auto_archive_hired.db, "candidate_collection", collection)

        assert auto_archive_hired.archive_hired_candidates() == 1

        (_filter, update), _kw = collection.update_one.call_args
        fields = update["$set"]
        assert fields["stage"] == "archived" and fields["status"] == "hired"
        assert fields["state_history"][0]["exited_at"] is not None
        assert fields["state_history"][-1]["state"] == "archived"

    def test_startup_loop_is_skipped_when_background_jobs_are_off(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """
        Scenario: RUN_BACKGROUND_JOBS=false (the Vercel setting).
        Expected: Startup neither archives nor starts the 24h loop, so cold
                  starts stay fast; Vercel Cron does the work instead.
        """
        monkeypatch.setattr(settings, "RUN_BACKGROUND_JOBS", False)
        archive = MagicMock()
        monkeypatch.setattr(auto_archive_hired, "archive_hired_candidates", archive)
        app = FastAPI()
        auto_archive_hired.register_auto_archive(app)

        for handler in app.router.on_startup:
            asyncio.run(handler())

        archive.assert_not_called()


# ===========================================================================
# Candidates: resume_path / resume_file are server-owned
# ===========================================================================
@pytest.fixture()
def candidates_client(monkeypatch: pytest.MonkeyPatch):
    """Candidates router with auth bypassed and a fake Mongo collection."""
    oid = ObjectId()
    collection = MagicMock()
    collection.find_one.side_effect = lambda *a, **k: {"_id": oid, "stage": "applied"}
    collection.update_one.return_value = SimpleNamespace(matched_count=1)
    collection.insert_one.return_value = SimpleNamespace(inserted_id=ObjectId())
    monkeypatch.setattr(candidates_router, "candidate_collection", collection)

    pipeline_keys: list = []

    async def fake_pipeline(data, resume_key=None):
        pipeline_keys.append(resume_key)
        return data

    monkeypatch.setattr(candidates_router, "process_candidate_ml_pipeline", fake_pipeline)

    app = FastAPI()
    app.include_router(candidates_router.router)
    app.dependency_overrides[get_current_user_from_cookie] = lambda: {"email": "hr@x.com", "role": "hr-recruiter"}
    return SimpleNamespace(client=TestClient(app), collection=collection, oid=oid, pipeline_keys=pipeline_keys)


class TestServerManagedResumeFields:
    def test_update_cannot_set_resume_path(self, candidates_client) -> None:
        """
        REGRESSION GUARD (fixed): PUT /candidates/{id} stored any resume_path the
        client sent, and delete_candidate later did os.remove(resume_path) - so
        any logged-in user could delete arbitrary files on the server.

        Scenario: PUT with resume_path, resume_file and a normal field.
        Expected: The normal field is saved; both resume fields are dropped.
        """
        c = candidates_client
        c.client.put(
            f"/candidates/{c.oid}",
            json={"name": "Bob", "resume_path": "/etc/passwd", "resume_file": "../x.pdf"},
        )

        (_filter, update), _kw = c.collection.update_one.call_args
        fields = update["$set"]
        assert fields["name"] == "Bob"
        assert "resume_path" not in fields and "resume_file" not in fields

    def test_create_ignores_client_resume_path_and_uses_resume_url(self, candidates_client) -> None:
        """
        REGRESSION GUARD (fixed): POST /candidates (JSON) passed a client-sent
        resume_path straight to the resume parser when resumeUrl was absent.

        Scenario: Create with a hostile resume_path plus a real resumeUrl.
        Expected: The pipeline gets the key from resumeUrl, and the stored
                  document has no resume_path.
        """
        c = candidates_client
        c.client.post(
            "/candidates",
            json={"name": "Ann", "resume_path": "/etc/passwd", "resumeUrl": "/uploads/resume_ab.pdf"},
        )

        assert c.pipeline_keys == ["resume_ab.pdf"]
        stored = c.collection.insert_one.call_args.args[0]
        assert "resume_path" not in stored
        assert stored["resume_file"] == "resume_ab.pdf"

    def test_create_without_resume_url_parses_nothing(self, candidates_client) -> None:
        """
        Scenario: Create with only a hostile resume_path.
        Expected: No key reaches the pipeline, so no file is read.
        """
        c = candidates_client
        c.client.post("/candidates", json={"name": "Eve", "resume_path": "/etc/passwd"})

        assert c.pipeline_keys == [None]

    def test_delete_removes_the_file_by_key_only(
        self, candidates_client, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """
        Scenario: Delete a candidate whose record holds a (legacy, hostile)
                  resume_path and a real resume_file.
        Expected: storage.delete is called with the key; the raw path is never
                  touched.
        """
        c = candidates_client
        c.collection.find_one.side_effect = lambda *a, **k: {
            "_id": c.oid,
            "resume_path": "/etc/passwd",
            "resume_file": "resume_zz.pdf",
        }
        deleted = MagicMock()
        monkeypatch.setattr(candidates_router.storage, "delete", deleted)

        c.client.delete(f"/candidates/{c.oid}")

        deleted.assert_called_once_with("resume_zz.pdf")
