"""Upload routes for resume files with legacy compatibility.

Files are served at /uploads/<key> by the route below (not a static mount), so
the same URLs work whether storage is local disk or a private Vercel Blob store.
We provide the canonical endpoint under /uploads/* and a legacy endpoint under /upload/*.
"""
import os

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile

from app.services.auth import get_current_user_from_cookie
from app.utils import storage
from app.utils.file_storage import unique_name

# Canonical router (/uploads)
router = APIRouter(prefix="/uploads", tags=["uploads"])

# Legacy backward-compatible router (/upload)
legacy_router = APIRouter(prefix="/upload", tags=["uploads-legacy"])

# Content types we are willing to render inline. Anything else is sent as an
# attachment, so a browser never executes an uploaded .html/.svg/.js file.
_INLINE_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
}


def _store_file(prefix: str, file: UploadFile, default_ext: str, content_type: str) -> dict:
    """Internal helper to persist an UploadFile and return metadata dict."""
    key = unique_name(prefix, file.filename or f"{prefix}{default_ext}", default_ext)
    storage.save(key, storage.read_upload(file), content_type)
    return {"url": storage.url_for(key)}


# The stored extension decides how the file is served later, and the client's
# content_type header is attacker-controlled, so the extension is what we check.
@router.post("/resume")
async def upload_resume(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Resume must be a PDF file")
    return _store_file("resume", file, ".pdf", "application/pdf")


@router.get("/{key}")
async def get_uploaded_file(key: str, _user: dict = Depends(get_current_user_from_cookie)):
    """Serve a stored file to a logged-in user. Resumes contain personal data."""
    data = storage.read(key)
    if data is None:
        raise HTTPException(status_code=404, detail="File not found")
    ext = os.path.splitext(key)[1].lower()
    headers = {"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"}
    if ext not in _INLINE_TYPES:
        headers["Content-Disposition"] = f'attachment; filename="{key}"'
    return Response(
        content=data,
        media_type=_INLINE_TYPES.get(ext, "application/octet-stream"),
        headers=headers,
    )


# Legacy endpoint mapping (delegates to the canonical implementation)

@legacy_router.post("/resume")
async def legacy_upload_resume(file: UploadFile = File(...)):
    return await upload_resume(file)
