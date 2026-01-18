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

# Database connection defaults (overridable via env/.env)
DEFAULT_MONGO_URI = "mongodb://localhost:27017/"


class Settings(BaseSettings):
    # Use env value if provided; otherwise generate a dev-safe secret.
    # This prevents startup crashes in development when .env is missing.
    SECRET_KEY_AUTHEN: str = Field(default_factory=lambda: token_urlsafe(32))
    MONGO_DB_URI: str = Field(
        default=DEFAULT_MONGO_URI,
        validation_alias=AliasChoices("MONGO_DB_URI", "MONGO_URL"),
    )
    PRIMARY_DB: str = Field(default="TalentTail")
    HR_DB: str = Field(default="hr_platform")

    # Pydantic Settings v2-style configuration
    model_config = SettingsConfigDict(
        env_file=(
            os.path.join(BACKEND_DIR, ".env"),    # prefer BackEnd/.env
            os.path.join(APP_DIR, ".env"),        # fallback app/.env
            os.path.join(PROJECT_ROOT, ".env"),   # project root/.env
            ".env",                                # or CWD/.env
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
]
CORS_ALLOW_REGEX: str = r"^http://(localhost|127\.0\.0\.1):\d+$"
