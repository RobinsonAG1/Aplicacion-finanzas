import asyncio
import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher, Type
from argon2.exceptions import Argon2Error

from app.core.config import settings
from app.core.errors import AppError

ISSUER = "finanzas-backend"
AUDIENCE = "finanzas-app"
ALGORITHM = "HS256"

_hasher = PasswordHasher(
    time_cost=2,
    memory_cost=19456,
    parallelism=1,
    hash_len=32,
    type=Type.ID,
)


def _utcnow() -> datetime:
    return datetime.now(UTC)


async def hash_password(password: str) -> str:
    return await asyncio.to_thread(_hasher.hash, password)


async def verify_password(password_hash: str, password: str) -> bool:
    try:
        return await asyncio.to_thread(_hasher.verify, password_hash, password)
    except Argon2Error:
        return False


def _encode(payload: dict[str, Any], secret: str) -> str:
    now = _utcnow()
    return jwt.encode(
        {**payload, "iss": ISSUER, "aud": AUDIENCE, "iat": now},
        secret,
        algorithm=ALGORITHM,
    )


def sign_access_token(user_id: str, email: str) -> str:
    return _encode(
        {
            "sub": user_id,
            "email": email,
            "type": "access",
            "exp": _utcnow() + timedelta(seconds=settings.jwt_access_ttl),
        },
        settings.jwt_access_secret,
    )


def sign_refresh_token(user_id: str, token_id: str) -> str:
    return _encode(
        {
            "sub": user_id,
            "jti": token_id,
            "type": "refresh",
            "exp": _utcnow() + timedelta(seconds=settings.jwt_refresh_ttl),
        },
        settings.jwt_refresh_secret,
    )


def _decode(token: str, secret: str) -> dict[str, Any]:
    return jwt.decode(
        token,
        secret,
        algorithms=[ALGORITHM],
        audience=AUDIENCE,
        issuer=ISSUER,
        options={"require": ["exp", "iat", "sub"]},
    )


def verify_access_token(token: str) -> dict[str, Any]:
    try:
        payload = _decode(token, settings.jwt_access_secret)
    except jwt.InvalidTokenError as exc:
        raise AppError(
            "Token de acceso invalido o expirado",
            401,
            code="INVALID_TOKEN",
        ) from exc
    if (
        payload.get("type") != "access"
        or not isinstance(payload.get("sub"), str)
        or not isinstance(payload.get("email"), str)
    ):
        raise AppError("Token de acceso invalido o expirado", 401, code="INVALID_TOKEN")
    return payload


def verify_refresh_token(token: str) -> dict[str, Any]:
    try:
        payload = _decode(token, settings.jwt_refresh_secret)
    except jwt.InvalidTokenError as exc:
        raise AppError(
            "Refresh token invalido o expirado",
            401,
            code="INVALID_REFRESH_TOKEN",
        ) from exc
    if (
        payload.get("type") != "refresh"
        or not isinstance(payload.get("sub"), str)
        or not isinstance(payload.get("jti"), str)
    ):
        raise AppError("Refresh token invalido o expirado", 401, code="INVALID_REFRESH_TOKEN")
    return payload


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def refresh_expiry() -> datetime:
    return _utcnow() + timedelta(seconds=settings.jwt_refresh_ttl)
