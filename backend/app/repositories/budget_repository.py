import uuid
from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Budget, Category, Transaction
from app.db.models.enums import BudgetPeriod, TransactionType


async def list_by_user(
    db: AsyncSession, user_id: uuid.UUID, period: BudgetPeriod | None = None
) -> Sequence[tuple[Budget, Category]]:
    statement = (
        select(Budget, Category)
        .join(Category, Budget.category_id == Category.id)
        .where(Budget.user_id == user_id)
    )
    if period is not None:
        statement = statement.where(Budget.period == period)
    result = await db.execute(statement.order_by(Budget.start_date.desc()))
    return [(row[0], row[1]) for row in result.all()]


async def find_owned(
    db: AsyncSession, budget_id: uuid.UUID, user_id: uuid.UUID
) -> tuple[Budget, Category] | None:
    result = await db.execute(
        select(Budget, Category)
        .join(Category, Budget.category_id == Category.id)
        .where(Budget.id == budget_id, Budget.user_id == user_id)
    )
    row = result.first()
    if row is None:
        return None
    return row[0], row[1]


async def create(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    category_id: uuid.UUID,
    limit_amount: Decimal,
    period: BudgetPeriod,
    start_date: datetime,
    end_date: datetime | None,
) -> Budget:
    budget = Budget(
        id=uuid.uuid4(),
        user_id=user_id,
        category_id=category_id,
        limit_amount=limit_amount,
        period=period,
        start_date=start_date,
        end_date=end_date,
    )
    db.add(budget)
    return budget


async def apply_changes(db: AsyncSession, budget: Budget, data: dict[str, object]) -> None:
    for key, value in data.items():
        setattr(budget, key, value)


async def delete(db: AsyncSession, budget: Budget) -> None:
    await db.delete(budget)


async def expenses_in_range(
    db: AsyncSession, user_id: uuid.UUID, date_from: datetime, date_to: datetime
) -> Sequence[tuple[uuid.UUID | None, Decimal, datetime]]:
    result = await db.execute(
        select(Transaction.category_id, Transaction.amount, Transaction.date).where(
            Transaction.user_id == user_id,
            Transaction.type == TransactionType.EXPENSE,
            Transaction.date >= date_from,
            Transaction.date <= date_to,
        )
    )
    return [(row[0], row[1], row[2]) for row in result.all()]
