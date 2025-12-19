"""Application configuration settings for TalentTrail."""
from typing import List
import os
from secrets import token_urlsafe
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


# Resolve project directories
APP_DIR = os.path.dirname(__file__)
BACKEND_DIR = os.path.dirname(APP_DIR)

# Database connection defaults (overridable via env/.env)
MONGO_URL: str = os.getenv("MONGO_URL", "mongodb://localhost:27017/")
PRIMARY_DB: str = os.getenv("PRIMARY_DB", "TalentTail")
HR_DB: str = os.getenv("HR_DB", "hr_platform")


class Settings(BaseSettings):
    # Use env value if provided; otherwise generate a dev-safe secret.
    # This prevents startup crashes in development when .env is missing.
    SECRET_KEY_AUTHEN: str = Field(default_factory=lambda: token_urlsafe(32))

    # Pydantic Settings v2-style configuration
    model_config = SettingsConfigDict(
        env_file=(
            os.path.join(BACKEND_DIR, ".env"),  # prefer BackEnd/.env
            os.path.join(APP_DIR, ".env"),      # fallback app/.env
            ".env",                              # or CWD/.env
        )
    )


settings = Settings()

CORS_ALLOW_ORIGINS: List[str] = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
]
CORS_ALLOW_REGEX: str = r"^http://(localhost|127\.0\.0\.1):\d+$"
