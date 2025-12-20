"""FastAPI application entrypoint for modular TalentTail backend."""
import os
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Ensure the BackEnd directory (parent of this app/) is on sys.path so
# absolute imports like `from app.config import ...` work even if started inside app/.
APP_DIR = os.path.dirname(__file__)
BACKEND_DIR = os.path.dirname(APP_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Absolute imports (robust across working directories)
from app.config import CORS_ALLOW_ORIGINS, CORS_ALLOW_REGEX
from app.routers import auth as auth_router
from app.routers import candidates as candidates_router
from app.routers import job_descriptions as jobs_router
from app.routers import matching as matching_router
from app.routers import uploads as uploads_router
from app.routers import dashboard as dashboard_router
from app.services.job_preload import register_startup
from app.utils.file_storage import UPLOAD_DIR

app = FastAPI(title="TalentTail API", version="0.1.0")

# CORS settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_origin_regex=CORS_ALLOW_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static uploads directory (mounted at /uploads)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# New compatibility endpoint that won't be shadowed by the mount above
@app.get("/upload-file/{filename}")
async def get_upload_file(filename: str):
    """Serve files with legacy fallbacks and a default avatar.

    Resolution order:
    1. Exact filename in uploads
    2. If startswith profile_ -> try avatar_<rest>
    3. If startswith avatar_ -> try profile_<rest>
    4. default_avatar.svg
    """
    candidates = [filename]
    if filename.startswith("profile_"):
        candidates.append("avatar_" + filename[len("profile_"):])
    elif filename.startswith("avatar_"):
        candidates.append("profile_" + filename[len("avatar_"):])

    for cand in candidates:
        path = os.path.join(UPLOAD_DIR, cand)
        if os.path.isfile(path):
            return FileResponse(path)

    default_path = os.path.join(UPLOAD_DIR, "default_avatar.svg")
    if os.path.isfile(default_path):
        return FileResponse(default_path)
    raise HTTPException(status_code=404, detail="File not found")

# Register routers
app.include_router(auth_router.router)
app.include_router(candidates_router.router)
app.include_router(jobs_router.router)
app.include_router(jobs_router.legacy_router)
app.include_router(matching_router.router)
app.include_router(uploads_router.router)
app.include_router(uploads_router.legacy_router)
app.include_router(dashboard_router.router)

# Startup preload
register_startup(app)


@app.get("/")
async def root():
    return {"status": "ok", "message": "TalentTail backend running"}
