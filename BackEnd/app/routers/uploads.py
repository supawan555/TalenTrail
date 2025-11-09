"""Upload routes for generic file handling (if needed)."""
from fastapi import APIRouter, UploadFile, File
from app.utils.file_storage import save_upload_file, unique_name, UPLOAD_DIR
import os

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/resume")
async def upload_resume(file: UploadFile = File(...)):
    filename = unique_name("resume", file.filename or "resume.pdf", ".pdf")
    dest = os.path.join(UPLOAD_DIR, filename)
    save_upload_file(file, dest)
    return {"path": dest, "url": f"/uploads/{filename}"}
