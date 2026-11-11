"""Application settings loaded from the environment / .env file."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "CareerIQ AI Service"
    version: str = "0.1.0"
    environment: str = Field(default="development")

    host: str = "127.0.0.1"
    port: int = 8000
    log_level: str = "info"

    # --- security -----------------------------------------------------------
    internal_api_key: str = ""
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    jwt_audience: str = "authenticated"

    # --- data plane ---------------------------------------------------------
    database_url: str = ""

    # --- AI (Gemini only — no OpenAI integration) ---------------------------
    llm_provider: str = "none"  # none | gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    gemini_fallback_model: str = ""
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dim: int = 384

    # --- processing limits ---------------------------------------------------
    max_pdf_bytes: int = 10 * 1024 * 1024  # 10 MB
    max_pdf_pages: int = 40
    request_timeout_seconds: int = 60

    # --- hardening (Phase 9) -------------------------------------------------
    # Requests per minute, per client-ip + path. 0 disables the limiter.
    rate_limit_per_minute: int = 120

    # --- CORS ---------------------------------------------------------------
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @field_validator("llm_provider", mode="before")
    @classmethod
    def _lower_provider(cls, v: object) -> object:
        return str(v).lower() if isinstance(v, str) else v

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_url.strip())

    @property
    def database_configured(self) -> bool:
        return bool(self.database_url and self.database_url.strip())

    @property
    def internal_key_configured(self) -> bool:
        return bool(self.internal_api_key and len(self.internal_api_key) >= 16)

    @property
    def llm_configured(self) -> bool:
        return self.llm_provider == "gemini" and bool(self.gemini_api_key)

    @property
    def llm_model_used(self) -> str | None:
        if not self.llm_configured:
            return None
        return self.gemini_model


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
