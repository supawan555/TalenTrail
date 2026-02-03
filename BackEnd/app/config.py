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
    MONGO_DB_URI: str = Field(
        validation_alias=AliasChoices("MONGO_DB_URI", "MONGO_URL"),
    )
    PRIMARY_DB: str = Field(default="TalentTail")
    HR_DB: str = Field(default="hr_platform")

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
