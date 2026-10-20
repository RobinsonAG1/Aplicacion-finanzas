from functools import lru_cache
from typing import Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

LogLevel = Literal["fatal", "error", "warn", "info", "debug", "trace", "silent"]


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
        default="development",
        validation_alias=AliasChoices("APP_ENV", "NODE_ENV"),
    )
    port: int = Field(default=4000, validation_alias=AliasChoices("PORT"))
    database_url: str = Field(validation_alias=AliasChoices("DATABASE_URL"))
    cors_origin: str = Field(
        default="http://localhost:5173",
        validation_alias=AliasChoices("CORS_ORIGIN"),
    )
    log_level: LogLevel = Field(default="info", validation_alias=AliasChoices("LOG_LEVEL"))
    jwt_access_secret: str = Field(validation_alias=AliasChoices("JWT_ACCESS_SECRET"))
    jwt_refresh_secret: str = Field(validation_alias=AliasChoices("JWT_REFRESH_SECRET"))
    jwt_access_ttl: int = Field(default=900, validation_alias=AliasChoices("JWT_ACCESS_TTL"))
    jwt_refresh_ttl: int = Field(default=604800, validation_alias=AliasChoices("JWT_REFRESH_TTL"))

    @field_validator("jwt_access_secret", "jwt_refresh_secret")
    @classmethod
    def _validate_secret_length(cls, value: str) -> str:
        if len(value) < 32:
            raise ValueError("debe tener al menos 32 caracteres")
        return value

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
