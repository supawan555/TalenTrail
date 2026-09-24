"""Upload routes for resume files with legacy compatibility.

Current public static URL base: /uploads/<filename>
We provide the canonical endpoint under /uploads/* and a legacy endpoint under /upload/*.
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


# Files under /uploads are served by StaticFiles, which picks the Content-Type
# from the extension. The stored extension must therefore never be something a
# browser would execute (.html, .svg, ...). The client's content_type header is
# only a hint - it is attacker-controlled - so the extension is what matters.
@router.post("/resume")
async def upload_resume(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Resume must be a PDF file")
    return _store_file("resume", file, ".pdf")


# Legacy endpoint mapping (delegates to the canonical implementation)

@legacy_router.post("/resume")
async def legacy_upload_resume(file: UploadFile = File(...)):
    return await upload_resume(file)
