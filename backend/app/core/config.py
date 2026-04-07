from __future__ import annotations

import json
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Postgres
    POSTGRES_USER: str = "locker_admin"
    POSTGRES_PASSWORD: str = "locker_secret_2026"
    POSTGRES_DB: str = "locker_db"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432

    DATABASE_URL: str = "postgresql+asyncpg://locker_admin:locker_secret_2026@db:5432/locker_db"
    DATABASE_URL_SYNC: str = "postgresql://locker_admin:locker_secret_2026@db:5432/locker_db"

    # JWT
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # CORS
    BACKEND_CORS_ORIGINS: str = '["http://localhost:3000","http://localhost:5173"]'

    # First admin
    FIRST_ADMIN_EMAIL: str = "admin@locker.com"
    FIRST_ADMIN_PASSWORD: str = "admin123"

    # SMTP (standard-library smtplib — no extra packages)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""        # e.g. yourapp@gmail.com
    SMTP_PASS: str = ""        # Gmail App Password (not your real password)
    SMTP_FROM: str = ""        # defaults to SMTP_USER if empty
    SMTP_USE_TLS: bool = True  # True = STARTTLS on port 587; False = plain

    @property
    def cors_origins(self) -> List[str]:
        try:
            return json.loads(self.BACKEND_CORS_ORIGINS)
        except (json.JSONDecodeError, TypeError):
            return [self.BACKEND_CORS_ORIGINS]


settings = Settings()
