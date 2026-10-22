import os
from functools import lru_cache
from typing import Any, Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

LogLevel = Literal["fatal", "error", "warn", "info", "debug", "trace", "silent"]

# (variable en segundos, alias alternativo, factor de conversion a segundos)
_TTL_ALIASES = (
    ("JWT_ACCESS_TTL", "ACCESS_TOKEN_MINUTES", 60),
    ("JWT_REFRESH_TTL", "REFRESH_TOKEN_DAYS", 86400),
)


def to_async_database_url(url: str) -> str:
    """Convierte la URL de Prisma/psycopg en una URL asyncpg valida."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://") :]
    parts = urlsplit(url)
    # asyncpg no entiende el parametro "schema" que agrega Prisma.
    query = [(key, value) for key, value in parse_qsl(parts.query) if key != "schema"]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    app_env: Literal["development", "test", "production"] = Field(
        default="production",
        validation_alias=AliasChoices("APP_ENV", "NODE_ENV", "ENVIRONMENT"),
    )
    port: int = Field(default=8000, validation_alias=AliasChoices("PORT"))
    database_url: str = Field(validation_alias=AliasChoices("DATABASE_URL"))
    cors_origin: str = Field(
        default="*",
        validation_alias=AliasChoices("CORS_ORIGIN", "CORS_ORIGINS"),
    )
    log_level: LogLevel = Field(default="info", validation_alias=AliasChoices("LOG_LEVEL"))
    jwt_access_secret: str = Field(validation_alias=AliasChoices("JWT_ACCESS_SECRET", "SECRET_KEY"))
    jwt_refresh_secret: str = Field(
        validation_alias=AliasChoices("JWT_REFRESH_SECRET", "SECRET_KEY")
    )
    jwt_access_ttl: int = Field(
        default=900, validation_alias=AliasChoices("JWT_ACCESS_TTL", "ACCESS_TOKEN_MINUTES")
    )
    jwt_refresh_ttl: int = Field(
        default=604800, validation_alias=AliasChoices("JWT_REFRESH_TTL", "REFRESH_TOKEN_DAYS")
    )

    @field_validator("jwt_access_secret", "jwt_refresh_secret")
    @classmethod
    def _validate_secret_length(cls, value: str) -> str:
        if len(value) < 32:
            raise ValueError("debe tener al menos 32 caracteres")
        return value

    @model_validator(mode="before")
    @classmethod
    def _normalize_ttl_aliases(cls, data: Any) -> Any:
        """Los alias en minutos/dias se convierten a segundos; JWT_*_TTL ya viene en segundos."""
        if not isinstance(data, dict):
            return data
        for seconds_env, alias_env, factor in _TTL_ALIASES:
            if seconds_env in os.environ or alias_env not in os.environ:
                continue
            raw = os.environ.get(alias_env)
            if raw is None:
                continue
            try:
                data[seconds_env] = int(raw) * factor
            except ValueError:
                continue
        return data

    @field_validator("jwt_access_ttl", mode="before")
    @classmethod
    def _parse_access_ttl(cls, value: Any) -> int:
        if isinstance(value, int):
            return value
        try:
            return int(value)
        except (TypeError, ValueError):
            return 900

    @field_validator("jwt_refresh_ttl", mode="before")
    @classmethod
    def _parse_refresh_ttl(cls, value: Any) -> int:
        if isinstance(value, int):
            return value
        try:
            return int(value)
        except (TypeError, ValueError):
            return 604800

    @field_validator("cors_origin", mode="before")
    @classmethod
    def _parse_cors(cls, value: Any) -> str:
        if not value or value == "[]":
            return "*"
        if isinstance(value, list):
            return value[0] if value else "*"
        return str(value)

    @property
    def database_url_async(self) -> str:
        return to_async_database_url(self.database_url)

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    @property
    def is_test(self) -> bool:
        return self.app_env == "test"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
