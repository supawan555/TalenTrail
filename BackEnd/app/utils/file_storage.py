"""File storage utilities for uploads directory and saving uploaded files."""
from __future__ import annotations
import os
import shutil
import uuid
from fastapi import UploadFile

# Ensure uploads directory at BackEnd/uploads (one level above app/)
BACKEND_ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".."))
UPLOAD_DIR = os.path.join(BACKEND_ROOT, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def save_upload_file(upload_file: UploadFile, destination: str) -> str:
    """Save an UploadFile to destination path and return destination."""
    try:
        with open(destination, "wb") as buffer:
            shutil.copyfileobj(upload_file.file, buffer)
    finally:
        upload_file.file.close()
    return destination


def unique_name(prefix: str, original_filename: str, default_ext: str) -> str:
    ext = os.path.splitext(original_filename)[1] or default_ext
    return f"{prefix}_{uuid.uuid4().hex}{ext}"
