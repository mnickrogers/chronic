from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl
from typing import List
import secrets


class Settings(BaseSettings):
    # Default to Postgres; override via DATABASE_URL
    # Example: postgresql+psycopg2://postgres:postgres@localhost:5432/chronic
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/chronic"
    jwt_secret: str = secrets.token_urlsafe(32)
    jwt_algorithm: str = "HS256"
    access_token_exp_minutes: int = 60 * 24  # 1 day for dev
    refresh_token_exp_days: int = 30
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
    ]


settings = Settings()
