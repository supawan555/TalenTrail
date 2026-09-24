"""Endpoints called by Vercel Cron (schedules live in BackEnd/vercel.json).

Vercel sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set as a
project environment variable. Without a configured secret these routes refuse
every call, so nobody can trigger them from the internet.
"""
import hmac
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException

from app.config import settings
from app.services.auto_archive_hired import archive_hired_candidates

router = APIRouter(prefix="/cron", tags=["cron"])


def require_cron_secret(authorization: Optional[str] = Header(None)) -> None:
    secret = settings.CRON_SECRET
    if not secret:
        raise HTTPException(status_code=503, detail="CRON_SECRET is not configured")
    expected = f"Bearer {secret}".encode()
    if not hmac.compare_digest((authorization or "").encode(), expected):
        raise HTTPException(status_code=401, detail="Invalid cron secret")


@router.get("/auto-archive", dependencies=[Depends(require_cron_secret)])
def run_auto_archive() -> dict:
    """Archive candidates hired more than 7 days ago (daily via Vercel Cron)."""
    return {"archived": archive_hired_candidates()}
