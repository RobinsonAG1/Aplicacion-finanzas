import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models import Account
from app.repositories import account_repository
from app.schemas.account import AccountCreate, AccountUpdate


def _not_found() -> AppError:
    return AppError("Cuenta no encontrada", 404, code="ACCOUNT_NOT_FOUND")


def parse_account_id(raw_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(raw_id)
    except ValueError as exc:
        raise _not_found() from exc


async def list_accounts(db: AsyncSession, user_id: uuid.UUID) -> list[Account]:
    return list(await account_repository.list_by_user(db, user_id))


async def create_account(db: AsyncSession, user_id: uuid.UUID, payload: AccountCreate) -> Account:
    account = await account_repository.create(
        db,
        user_id=user_id,
        name=payload.name,
        account_type=payload.type,
        balance=payload.balance,
        currency=payload.currency,
    )
    await db.commit()
    return account


async def get_account(db: AsyncSession, user_id: uuid.UUID, raw_id: str) -> Account:
    account = await account_repository.find_owned(db, parse_account_id(raw_id), user_id)
    if account is None:
        raise _not_found()
    return account


async def update_account(
    db: AsyncSession, user_id: uuid.UUID, raw_id: str, payload: AccountUpdate
) -> Account:
    account = await get_account(db, user_id, raw_id)
    data = payload.model_dump(exclude_unset=True)
    await account_repository.update(db, account, data)
    await db.commit()
    return account


async def delete_account(db: AsyncSession, user_id: uuid.UUID, raw_id: str) -> None:
    account = await get_account(db, user_id, raw_id)
    await account_repository.delete(db, account)
    await db.commit()
