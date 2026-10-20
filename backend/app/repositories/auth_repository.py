import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import utcnow
from app.db.models import RefreshToken, User


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await db.get(User, user_id)


async def create_user(
    db: AsyncSession,
    *,
    email: str,
    name: str,
    password_hash: str,
) -> User:
    user = User(id=uuid.uuid4(), email=email, name=name, password_hash=password_hash)
    db.add(user)
    return user


async def create_refresh_token(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    token_hash: str,
    expires_at: datetime,
    user_agent: str | None,
    ip: str | None,
) -> RefreshToken:
    token = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
        user_agent=user_agent,
        ip=ip,
    )
    db.add(token)
    return token


async def get_refresh_token_by_hash(db: AsyncSession, token_hash: str) -> RefreshToken | None:
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    return result.scalar_one_or_none()


async def revoke_refresh_token(db: AsyncSession, token: RefreshToken) -> None:
    token.revoked_at = utcnow()


async def revoke_all_for_user(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=utcnow())
    )
