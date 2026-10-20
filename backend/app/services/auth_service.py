import uuid
from dataclasses import dataclass

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.logging import get_logger
from app.core.security import (
    hash_password,
    hash_token,
    refresh_expiry,
    sign_access_token,
    sign_refresh_token,
    verify_password,
    verify_refresh_token,
)
from app.db.base import utcnow
from app.db.models import User
from app.repositories import auth_repository
from app.schemas.auth import LoginRequest, RegisterRequest, UserPublic

logger = get_logger(__name__)


@dataclass(frozen=True)
class TokenContext:
    user_agent: str | None = None
    ip: str | None = None


@dataclass
class AuthResult:
    user: UserPublic
    access_token: str
    refresh_token: str


def _public_user(user: User) -> UserPublic:
    return UserPublic.model_validate(user)


async def _issue_tokens(db: AsyncSession, user: User, ctx: TokenContext) -> tuple[str, str]:
    access_token = sign_access_token(str(user.id), user.email)
    refresh_token = sign_refresh_token(str(user.id), str(uuid.uuid4()))
    user_agent = ctx.user_agent[:500] if ctx.user_agent else None
    ip = ctx.ip[:45] if ctx.ip else None
    await auth_repository.create_refresh_token(
        db,
        user_id=user.id,
        token_hash=hash_token(refresh_token),
        expires_at=refresh_expiry(),
        user_agent=user_agent,
        ip=ip,
    )
    return access_token, refresh_token


async def register(db: AsyncSession, payload: RegisterRequest, ctx: TokenContext) -> AuthResult:
    existing = await auth_repository.get_user_by_email(db, payload.email)
    if existing is not None:
        raise AppError("El email ya esta registrado", 409, code="EMAIL_TAKEN")

    password_hash = await hash_password(payload.password)
    user = await auth_repository.create_user(
        db,
        email=payload.email,
        name=payload.name,
        password_hash=password_hash,
    )
    await db.flush()
    access_token, refresh_token = await _issue_tokens(db, user, ctx)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        if getattr(exc.orig, "sqlstate", None) != "23505":
            raise
        raise AppError("El email ya esta registrado", 409, code="EMAIL_TAKEN") from exc

    return AuthResult(_public_user(user), access_token, refresh_token)


async def login(db: AsyncSession, payload: LoginRequest, ctx: TokenContext) -> AuthResult:
    user = await auth_repository.get_user_by_email(db, payload.email)
    if user is None or not await verify_password(user.password_hash, payload.password):
        raise AppError("Credenciales invalidas", 401, code="INVALID_CREDENTIALS")

    access_token, refresh_token = await _issue_tokens(db, user, ctx)
    await db.commit()
    return AuthResult(_public_user(user), access_token, refresh_token)


async def refresh(db: AsyncSession, refresh_token: str, ctx: TokenContext) -> AuthResult:
    payload = verify_refresh_token(refresh_token)
    stored = await auth_repository.get_refresh_token_by_hash(db, hash_token(refresh_token))
    if stored is None:
        raise AppError("Refresh token invalido", 401, code="INVALID_REFRESH_TOKEN")

    if str(stored.user_id) != payload["sub"]:
        await auth_repository.revoke_all_for_user(db, stored.user_id)
        await db.commit()
        raise AppError("Refresh token invalido", 401, code="INVALID_REFRESH_TOKEN")

    if stored.revoked_at is not None or stored.expires_at < utcnow():
        logger.warning(
            "Reuso de refresh token detectado, revocando todas las sesiones del usuario",
            user_id=str(stored.user_id),
            token_id=str(stored.id),
        )
        await auth_repository.revoke_all_for_user(db, stored.user_id)
        await db.commit()
        raise AppError("Refresh token invalido", 401, code="INVALID_REFRESH_TOKEN")

    await auth_repository.revoke_refresh_token(db, stored)
    try:
        user_id = uuid.UUID(payload["sub"])
    except ValueError as exc:
        await db.commit()
        raise AppError("Refresh token invalido", 401, code="INVALID_REFRESH_TOKEN") from exc
    user = await auth_repository.get_user_by_id(db, user_id)
    if user is None:
        await db.commit()
        raise AppError("Refresh token invalido", 401, code="INVALID_REFRESH_TOKEN")

    access_token, new_refresh_token = await _issue_tokens(db, user, ctx)
    await db.commit()
    return AuthResult(_public_user(user), access_token, new_refresh_token)


async def logout(db: AsyncSession, refresh_token: str) -> None:
    stored = await auth_repository.get_refresh_token_by_hash(db, hash_token(refresh_token))
    if stored is not None and stored.revoked_at is None:
        await auth_repository.revoke_refresh_token(db, stored)
        await db.commit()


async def me(db: AsyncSession, user_id: uuid.UUID) -> UserPublic:
    user = await auth_repository.get_user_by_id(db, user_id)
    if user is None:
        raise AppError("Usuario no encontrado", 404, code="USER_NOT_FOUND")
    return _public_user(user)


__all__ = ["AuthResult", "TokenContext", "login", "logout", "me", "refresh", "register"]
