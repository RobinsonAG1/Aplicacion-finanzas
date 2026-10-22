import pytest
from app.core.config import Settings, build_database_url, to_async_database_url
from pydantic import ValidationError


def test_build_database_url_encodes_special_characters() -> None:
    url = build_database_url(
        user="finanzas",
        password="p@ss:w/rd#2026",
        host="postgres",
        port=5432,
        name="finanzas",
    )

    assert url == "postgresql://finanzas:p%40ss%3Aw%2Frd%232026@postgres:5432/finanzas"


def test_settings_builds_database_url_from_parts_when_url_is_empty() -> None:
    settings = Settings(
        DATABASE_URL="",
        DB_HOST="postgres",
        DB_PORT="5432",
        DB_NAME="finanzas",
        DB_USER="finanzas",
        DB_PASSWORD="p@ss:w/rd#2026",
    )

    assert settings.database_url == (
        "postgresql://finanzas:p%40ss%3Aw%2Frd%232026@postgres:5432/finanzas"
    )


def test_settings_requires_database_url_or_parts() -> None:
    with pytest.raises(ValidationError):
        Settings(DATABASE_URL="", DB_USER="", DB_PASSWORD="")


def test_settings_does_not_expose_password_in_repr() -> None:
    settings = Settings(
        DATABASE_URL="",
        DB_HOST="postgres",
        DB_PORT="5432",
        DB_NAME="finanzas",
        DB_USER="finanzas",
        DB_PASSWORD="p@ss:w/rd#2026",
    )

    assert "p%40ss" not in repr(settings)
    assert "p%40ss" not in repr(settings.db_password)


def test_to_async_database_url_keeps_encoding_and_drops_schema() -> None:
    url = to_async_database_url(
        "postgresql://finanzas:p%40ss%3Aw%2Frd%232026@postgres:5432/finanzas?schema=public"
    )

    assert url == "postgresql+asyncpg://finanzas:p%40ss%3Aw%2Frd%232026@postgres:5432/finanzas"
