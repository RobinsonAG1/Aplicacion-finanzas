import uuid
from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal, cast

from sqlalchemy import func, or_, select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.db.models import Account, Category, Transaction
from app.db.models.enums import TransactionType

SortField = Literal["date", "amount", "createdAt"]
SortOrder = Literal["asc", "desc"]


class TransactionFilters:
    def __init__(
        self,
        *,
        search: str | None = None,
        category_id: str | None = None,
        account_id: str | None = None,
        transaction_type: TransactionType | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> None:
        self.search = search
        self.category_id = category_id
        self.account_id = account_id
        self.transaction_type = transaction_type
        self.date_from = date_from
        self.date_to = date_to


def _parse_uuid(value: str | None) -> uuid.UUID | None:
    if value is None:
        return None
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


def _conditions(
    user_id: uuid.UUID, filters: TransactionFilters
) -> list[ColumnElement[bool]] | None:
    conditions: list[ColumnElement[bool]] = [Transaction.user_id == user_id]
    if filters.search:
        pattern = f"%{filters.search}%"
        conditions.append(
            or_(
                Transaction.description.ilike(pattern),
                Transaction.merchant.ilike(pattern),
            )
        )
    if filters.category_id is not None:
        category_id = _parse_uuid(filters.category_id)
        if category_id is None:
            return None
        conditions.append(Transaction.category_id == category_id)
    if filters.account_id is not None:
        account_id = _parse_uuid(filters.account_id)
        if account_id is None:
            return None
        conditions.append(Transaction.account_id == account_id)
    if filters.transaction_type is not None:
        conditions.append(Transaction.type == filters.transaction_type)
    if filters.date_from is not None:
        conditions.append(Transaction.date >= filters.date_from)
    if filters.date_to is not None:
        conditions.append(Transaction.date <= filters.date_to)
    return conditions


def _order_by(sort: SortField, order: SortOrder) -> list[ColumnElement[Any]]:
    column = {
        "date": Transaction.date,
        "amount": Transaction.amount,
        "createdAt": Transaction.created_at,
    }[sort]
    primary = column.asc() if order == "asc" else column.desc()
    return [primary, Transaction.id.desc()]


async def list_transactions(
    db: AsyncSession,
    user_id: uuid.UUID,
    filters: TransactionFilters,
    *,
    sort: SortField,
    order: SortOrder,
    page: int,
    limit: int,
) -> tuple[list[tuple[Transaction, Category | None, Account]], int]:
    conditions = _conditions(user_id, filters)
    if conditions is None:
        return [], 0

    total = (
        await db.execute(select(func.count()).select_from(Transaction).where(*conditions))
    ).scalar_one()

    result = await db.execute(
        select(Transaction, Category, Account)
        .outerjoin(Category, Transaction.category_id == Category.id)
        .join(Account, Transaction.account_id == Account.id)
        .where(*conditions)
        .order_by(*_order_by(sort, order))
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = [(row[0], cast(Category | None, row[1]), row[2]) for row in result.all()]
    return rows, int(total)


async def find_owned(
    db: AsyncSession, transaction_id: uuid.UUID, user_id: uuid.UUID
) -> Transaction | None:
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def load_with_relations(
    db: AsyncSession, transaction_id: uuid.UUID, user_id: uuid.UUID
) -> tuple[Transaction, Category | None, Account] | None:
    result = await db.execute(
        select(Transaction, Category, Account)
        .outerjoin(Category, Transaction.category_id == Category.id)
        .join(Account, Transaction.account_id == Account.id)
        .where(
            Transaction.id == transaction_id,
            Transaction.user_id == user_id,
        )
    )
    row = result.first()
    if row is None:
        return None
    return row[0], row[1], row[2]


async def create(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    category_id: uuid.UUID | None,
    amount: Decimal,
    transaction_type: TransactionType,
    description: str | None,
    merchant: str | None,
    date: datetime,
) -> Transaction:
    transaction = Transaction(
        id=uuid.uuid4(),
        user_id=user_id,
        account_id=account_id,
        category_id=category_id,
        amount=amount,
        type=transaction_type,
        description=description,
        merchant=merchant,
        date=date,
    )
    db.add(transaction)
    return transaction


async def apply_changes(
    db: AsyncSession, transaction: Transaction, data: dict[str, object]
) -> None:
    for key, value in data.items():
        setattr(transaction, key, value)


async def delete(db: AsyncSession, transaction: Transaction) -> None:
    await db.delete(transaction)


async def adjust_balance(db: AsyncSession, account_id: uuid.UUID, delta: Decimal) -> None:
    if delta == 0:
        return
    await db.execute(
        sa_update(Account).where(Account.id == account_id).values(balance=Account.balance + delta)
    )


async def recent_category_ids_by_merchant(
    db: AsyncSession, user_id: uuid.UUID, merchant: str, limit: int = 500
) -> Sequence[uuid.UUID]:
    result = await db.execute(
        select(Transaction.category_id)
        .where(
            Transaction.user_id == user_id,
            Transaction.category_id.is_not(None),
            Transaction.merchant.ilike(f"%{merchant}%"),
        )
        .limit(limit)
    )
    return [row[0] for row in result.all() if row[0] is not None]


async def categories_by_ids(
    db: AsyncSession, user_id: uuid.UUID, category_ids: list[uuid.UUID]
) -> Sequence[Category]:
    if not category_ids:
        return []
    result = await db.execute(
        select(Category).where(
            Category.user_id == user_id,
            Category.id.in_(category_ids),
        )
    )
    return result.scalars().all()
