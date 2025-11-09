"""FastAPI application entrypoint for modular TalentTail backend."""
import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

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

# Register routers
app.include_router(auth_router.router)
app.include_router(candidates_router.router)
app.include_router(jobs_router.router)
app.include_router(jobs_router.legacy_router)
app.include_router(matching_router.router)
app.include_router(uploads_router.router)

# Startup preload
register_startup(app)


@app.get("/")
async def root():
    return {"status": "ok", "message": "TalentTail backend running"}
