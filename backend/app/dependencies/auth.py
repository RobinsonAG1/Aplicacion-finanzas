import uuid
from dataclasses import dataclass

from fastapi import Request

from app.core.config import settings
from app.core.errors import AppError
from app.core.security import verify_access_token


@dataclass(frozen=True)
class AuthUser:
    id: uuid.UUID
    email: str


async def get_current_user(request: Request) -> AuthUser:
    header = request.headers.get("authorization")
    if not header or not header.startswith("Bearer "):
        raise AppError("Token de acceso no proporcionado", 401, code="UNAUTHENTICATED")
    token = header[len("Bearer ") :].strip()
    payload = verify_access_token(token)
    try:
        user_id = uuid.UUID(payload["sub"])
    except ValueError as exc:
        raise AppError("Token de acceso invalido o expirado", 401, code="INVALID_TOKEN") from exc
    return AuthUser(id=user_id, email=payload["email"])


async def csrf_protection(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin and origin != settings.cors_origin:
        raise AppError("Origen no permitido", 403, code="CSRF_ORIGIN_MISMATCH")
