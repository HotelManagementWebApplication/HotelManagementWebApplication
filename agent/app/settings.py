from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[1] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls,
        init_settings,
        env_settings,
        dotenv_settings,
        file_secret_settings,
    ):
        return init_settings, dotenv_settings, env_settings, file_secret_settings

    backend_api_base_url: str = "http://localhost:8080"
    agent_port: int = 8090
    agent_cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    ai_provider: str = "gemini"
    gemini_api_key: SecretStr | None = None
    gemini_generation_model: str = "gemini-3.5-flash-lite"
    gemini_embedding_model: str = "gemini-embedding-2"
    gemini_embedding_dimensions: int = 768
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "customer_policy"
    qdrant_api_key: SecretStr | None = None

    @field_validator("agent_cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value):
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("agent_cors_origins")
    @classmethod
    def reject_wildcard(cls, value: list[str]) -> list[str]:
        if "*" in value:
            raise ValueError("AGENT_CORS_ORIGINS must list explicit origins")
        return value

    @field_validator("ai_provider")
    @classmethod
    def supported_provider(cls, value: str) -> str:
        provider = value.strip().casefold()
        if provider != "gemini":
            raise ValueError("AI_PROVIDER must be gemini")
        return provider

    @field_validator("gemini_generation_model", "gemini_embedding_model")
    @classmethod
    def safe_model_name(cls, value: str) -> str:
        if not value or any(character not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-" for character in value):
            raise ValueError("Gemini model names may contain only letters, numbers, dot, underscore and hyphen")
        return value

    @field_validator("gemini_embedding_dimensions")
    @classmethod
    def valid_embedding_dimensions(cls, value: int) -> int:
        if not 128 <= value <= 3072:
            raise ValueError("GEMINI_EMBEDDING_DIMENSIONS must be between 128 and 3072")
        return value

    @field_validator("qdrant_collection")
    @classmethod
    def valid_collection_name(cls, value: str) -> str:
        if not value or not all(character.isalnum() or character in "_-" for character in value):
            raise ValueError("QDRANT_COLLECTION contains invalid characters")
        return value

    @model_validator(mode="after")
    def require_provider_credentials(self) -> "Settings":
        if self.ai_provider == "gemini" and (
            self.gemini_api_key is None or not self.gemini_api_key.get_secret_value().strip()
        ):
            raise ValueError("GEMINI_API_KEY is required when AI_PROVIDER=gemini")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
