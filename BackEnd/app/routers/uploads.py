"""Upload routes for file handling (resume, profile picture) with legacy compatibility.

Current public static URL base: /uploads/<filename>
Frontend (older code) still calls /upload/profile-picture and /upload/resume which returned 404.
We provide both new canonical endpoints under /uploads/* and legacy endpoints under /upload/*.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.utils.file_storage import save_upload_file, unique_name, UPLOAD_DIR
import os

# Canonical router (/uploads)
router = APIRouter(prefix="/uploads", tags=["uploads"])

# Legacy backward-compatible router (/upload)
legacy_router = APIRouter(prefix="/upload", tags=["uploads-legacy"])


def _store_file(prefix: str, file: UploadFile, default_ext: str) -> dict:
    """Internal helper to persist an UploadFile and return metadata dict."""
    filename = unique_name(prefix, file.filename or f"{prefix}{default_ext}", default_ext)
    dest = os.path.join(UPLOAD_DIR, filename)
    save_upload_file(file, dest)
    return {"path": dest, "url": f"/uploads/{filename}"}


@router.post("/resume")
async def upload_resume(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".pdf") and file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Resume must be a PDF file")
    return _store_file("resume", file, ".pdf")


@router.post("/profile-picture")
async def upload_profile_picture(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Profile picture must be an image file")
    # Preserve original extension if possible
    ext = os.path.splitext(file.filename or "avatar.png")[1] or ".png"
    data = _store_file("avatar", file, ext)
    return data


# Legacy endpoints mapping (delegate to canonical implementations)

@legacy_router.post("/resume")
async def legacy_upload_resume(file: UploadFile = File(...)):
    return await upload_resume(file)


@legacy_router.post("/profile-picture")
async def legacy_upload_profile_picture(file: UploadFile = File(...)):
    return await upload_profile_picture(file)
