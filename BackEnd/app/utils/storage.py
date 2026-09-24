"""Storage for uploaded resume files.

Two backends, picked by ``settings.FILE_STORAGE``:

* ``"local"``       - files live in ``UPLOAD_DIR`` on disk (local dev, Render).
* ``"vercel_blob"`` - files live in a *private* Vercel Blob store. Required on
  Vercel, whose disk is wiped between requests. The SDK authenticates with
  ``BLOB_READ_WRITE_TOKEN``, or automatically via OIDC when the store is
  connected to the Vercel project.

Every file is addressed by a bare *key* such as ``resume_<uuid>.pdf`` and is
exposed to the frontend as ``/uploads/<key>``. A key never contains a directory
part, so it cannot be used to reach files outside the store.
"""
from __future__ import annotations

import contextlib
import os
import re
import tempfile
from typing import Iterator, Optional

from fastapi import HTTPException, UploadFile

from app.config import settings
from app.utils.file_storage import UPLOAD_DIR

URL_PREFIX = "/uploads/"
# Blob pathnames are namespaced so the store can hold other things later.
BLOB_FOLDER = "uploads/"
_KEY_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$")


def is_valid_key(key) -> bool:
    """A key is a single safe filename: no slashes, no "..", no leading dot."""
    return isinstance(key, str) and bool(_KEY_RE.match(key)) and ".." not in key


def key_from_url(url) -> Optional[str]:
    """Map a client-supplied "/uploads/<key>" URL to a storage key, else None."""
    if not isinstance(url, str) or not url.startswith(URL_PREFIX):
        return None
    key = url[len(URL_PREFIX):]
    return key if is_valid_key(key) else None


def url_for(key: str) -> str:
    return f"{URL_PREFIX}{key}"


def _use_blob() -> bool:
    return settings.FILE_STORAGE.strip().lower() == "vercel_blob"


def _local_path(key: str) -> str:
    return os.path.join(UPLOAD_DIR, key)


def read_upload(upload: UploadFile) -> bytes:
    """Read an upload into memory, rejecting anything over MAX_UPLOAD_MB with 413."""
    limit = settings.MAX_UPLOAD_MB * 1024 * 1024
    try:
        data = upload.file.read(limit + 1)
    finally:
        upload.file.close()
    if len(data) > limit:
        raise HTTPException(
            status_code=413, detail=f"File is larger than {settings.MAX_UPLOAD_MB} MB"
        )
    return data


def save(key: str, data: bytes, content_type: str = "application/pdf") -> str:
    """Store ``data`` under ``key`` and return the key."""
    if not is_valid_key(key):
        raise ValueError(f"invalid storage key: {key!r}")
    if _use_blob():
        from vercel import blob

        blob.put(BLOB_FOLDER + key, data, access="private", content_type=content_type)
    else:
        with open(_local_path(key), "wb") as fh:
            fh.write(data)
    return key


def read(key: str) -> Optional[bytes]:
    """Return the file's bytes, or None if the key is invalid or missing."""
    if not is_valid_key(key):
        return None
    if _use_blob():
        from vercel import blob

        try:
            result = blob.get(BLOB_FOLDER + key, access="private")
        except blob.BlobNotFoundError:
            return None
        if result is None or getattr(result, "status_code", 200) != 200:
            return None
        return result.content
    path = _local_path(key)
    if not os.path.isfile(path):
        return None
    with open(path, "rb") as fh:
        return fh.read()


def delete(key: str) -> None:
    """Remove the file if it exists. Invalid or missing keys are ignored."""
    if not is_valid_key(key):
        return
    if _use_blob():
        from vercel import blob

        with contextlib.suppress(blob.BlobNotFoundError):
            blob.delete(BLOB_FOLDER + key)
        return
    with contextlib.suppress(FileNotFoundError):
        os.remove(_local_path(key))


@contextlib.contextmanager
def local_copy(key: str) -> Iterator[Optional[str]]:
    """Yield a filesystem path to the file, or None if it is missing.

    PyMuPDF needs a real path. Local files are used in place; blobs are
    downloaded to a temp file that is deleted afterwards.
    """
    if not is_valid_key(key):
        yield None
        return
    if not _use_blob():
        path = _local_path(key)
        yield path if os.path.isfile(path) else None
        return

    data = read(key)
    if data is None:
        yield None
        return
    fd, tmp_path = tempfile.mkstemp(suffix=os.path.splitext(key)[1])
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
        yield tmp_path
    finally:
        with contextlib.suppress(OSError):
            os.remove(tmp_path)
