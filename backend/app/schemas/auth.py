import re
import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator

from app.schemas.common import CamelModel

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_email(value: object) -> object:
    if not isinstance(value, str):
        return value
    normalized = value.strip().lower()
    if not EMAIL_PATTERN.match(normalized):
        raise ValueError("Email invalido")
    return normalized


class UserPublic(CamelModel):
    id: uuid.UUID
    email: str
    name: str
    created_at: datetime


class AuthResponse(CamelModel):
    user: UserPublic
    access_token: str


class MeResponse(CamelModel):
    user: UserPublic


class LogoutResponse(CamelModel):
    success: bool


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("email", mode="before")
    @classmethod
    def _validate_email(cls, value: object) -> object:
        return _normalize_email(value)

    @field_validator("name")
    @classmethod
    def _validate_name(cls, value: str) -> str:
        if len(value) < 2:
            raise ValueError("Minimo 2 caracteres")
        if len(value) > 80:
            raise ValueError("Maximo 80 caracteres")
        return value

    @field_validator("password")
    @classmethod
    def _validate_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Minimo 8 caracteres")
        if len(value) > 128:
            raise ValueError("Maximo 128 caracteres")
        return value


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email", mode="before")
    @classmethod
    def _validate_email(cls, value: object) -> object:
        return _normalize_email(value)

    @field_validator("password")
    @classmethod
    def _validate_password(cls, value: str) -> str:
        if not value:
            raise ValueError("La contrasena es obligatoria")
        return value
