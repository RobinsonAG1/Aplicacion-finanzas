import uuid
from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Pot, PotTransaction
from app.db.models.enums import PotTransactionType


async def list_by_user(db: AsyncSession, user_id: uuid.UUID) -> Sequence[Pot]:
    result = await db.execute(
        select(Pot).where(Pot.user_id == user_id).order_by(Pot.created_at.asc())
    )
    return result.scalars().all()


async def find_owned(db: AsyncSession, pot_id: uuid.UUID, user_id: uuid.UUID) -> Pot | None:
    result = await db.execute(select(Pot).where(Pot.id == pot_id, Pot.user_id == user_id))
    return result.scalar_one_or_none()


async def list_transactions(
    db: AsyncSession, pot_id: uuid.UUID, limit: int
) -> Sequence[PotTransaction]:
    result = await db.execute(
        select(PotTransaction)
        .where(PotTransaction.pot_id == pot_id)
        .order_by(PotTransaction.date.desc())
        .limit(limit)
    )
    return result.scalars().all()


async def create(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    name: str,
    target_amount: Decimal,
    color: str,
) -> Pot:
    pot = Pot(
        id=uuid.uuid4(),
        user_id=user_id,
        name=name,
        target_amount=target_amount,
        color=color,
    )
    db.add(pot)
    return pot


async def apply_changes(db: AsyncSession, pot: Pot, data: dict[str, object]) -> None:
    for key, value in data.items():
        setattr(pot, key, value)


async def delete(db: AsyncSession, pot: Pot) -> None:
    await db.delete(pot)


async def add_transaction(
    db: AsyncSession,
    *,
    pot_id: uuid.UUID,
    amount: Decimal,
    transaction_type: PotTransactionType,
    date: datetime,
    note: str | None,
) -> PotTransaction:
    transaction = PotTransaction(
        id=uuid.uuid4(),
        pot_id=pot_id,
        amount=amount,
        type=transaction_type,
        date=date,
        note=note,
    )
    db.add(transaction)
    return transaction


async def adjust_amount(db: AsyncSession, pot_id: uuid.UUID, delta: Decimal) -> None:
    await db.execute(
        sa_update(Pot).where(Pot.id == pot_id).values(current_amount=Pot.current_amount + delta)
    )
