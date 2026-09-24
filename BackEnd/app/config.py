"""Application configuration settings for TalentTrail."""
from typing import List
import os
from secrets import token_urlsafe
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


# Resolve project directories
APP_DIR = os.path.dirname(__file__)
BACKEND_DIR = os.path.dirname(APP_DIR)
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)


class Settings(BaseSettings):
    SECRET_KEY_AUTHEN: str = Field(default_factory=lambda: token_urlsafe(32))
    TOTP_ENCRYPTION_KEY: str = Field(default_factory=lambda: token_urlsafe(32))
    MONGO_DB_URI: str = Field(
        validation_alias=AliasChoices("MONGO_DB_URI", "MONGO_URL"),
    )
    PRIMARY_DB: str = Field(default="TalentTail")
    HR_DB: str = Field(default="hr_platform")

    SMTP_HOST: str = Field(default="")
    SMTP_PORT: int = Field(default=587)
    SMTP_USER: str = Field(default="")
    SMTP_PASSWORD: str = Field(default="")
    SMTP_FROM_EMAIL: str = Field(default="no-reply@talentrail.app")
    SMTP_FROM_NAME: str = Field(default="TalentTrail")
    SMTP_USE_TLS: bool = Field(default=True)

    GEMINI_API_KEY: str = Field(default="")
    GEMINI_MODEL: str = Field(default="gemini-3.6-flash")

    # Dev convenience: let ADMIN accounts log in without the TOTP step.
    # Off by default; set ALLOW_ADMIN_2FA_BYPASS=true only in a local .env.
    ALLOW_ADMIN_2FA_BYPASS: bool = Field(default=False)

    # Where uploaded resumes are stored: "local" (disk, for dev/Render) or
    # "vercel_blob" (private Vercel Blob store; required on Vercel, whose disk
    # is wiped between requests).
    FILE_STORAGE: str = Field(default="local")
    # Vercel rejects request bodies over 4.5 MB, so cap uploads below that.
    MAX_UPLOAD_MB: int = Field(default=4)

    # Vercel Cron calls /cron/* with "Authorization: Bearer <CRON_SECRET>".
    CRON_SECRET: str = Field(default="")
    # Run the 24h auto-archive loop inside the server process. Turn off on
    # Vercel (instances are short-lived) and let Vercel Cron call /cron instead.
    RUN_BACKGROUND_JOBS: bool = Field(default=True)

    model_config = SettingsConfigDict(
        env_file=(
            os.path.join(BACKEND_DIR, ".env"),    
            os.path.join(APP_DIR, ".env"),      
            os.path.join(PROJECT_ROOT, ".env"),   
            ".env",                            
        )
    )


settings = Settings()

MONGO_URL: str = settings.MONGO_DB_URI
PRIMARY_DB: str = settings.PRIMARY_DB
HR_DB: str = settings.HR_DB

CORS_ALLOW_ORIGINS: List[str] = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
    "https://talen-trail.vercel.app",
    "https://talen-trail-neff.vercel.app",
]
CORS_ALLOW_REGEX: str = r"^(https://.*\.vercel\.app|http://(localhost|127\.0\.0\.1):\d+)$"
