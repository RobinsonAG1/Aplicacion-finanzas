import uuid
from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Account
from app.db.models.enums import AccountType


async def list_by_user(db: AsyncSession, user_id: uuid.UUID) -> Sequence[Account]:
    result = await db.execute(
        select(Account).where(Account.user_id == user_id).order_by(Account.created_at.asc())
    )
    return result.scalars().all()


async def find_owned(db: AsyncSession, account_id: uuid.UUID, user_id: uuid.UUID) -> Account | None:
    result = await db.execute(
        select(Account).where(
            Account.id == account_id,
            Account.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def create(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    name: str,
    account_type: AccountType,
    balance: Decimal,
    currency: str,
) -> Account:
    account = Account(
        id=uuid.uuid4(),
        user_id=user_id,
        name=name,
        type=account_type,
        balance=balance,
        currency=currency,
    )
    db.add(account)
    return account


async def update(db: AsyncSession, account: Account, data: dict[str, object]) -> Account:
    for key, value in data.items():
        setattr(account, key, value)
    return account


async def delete(db: AsyncSession, account: Account) -> None:
    await db.delete(account)
