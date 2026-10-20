import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models import Pot
from app.db.models.enums import PotTransactionType
from app.repositories import pot_repository
from app.schemas.pot import (
    PotCreate,
    PotDetail,
    PotMovement,
    PotPublic,
    PotTransactionPublic,
    PotUpdate,
)


def _not_found() -> AppError:
    return AppError("Meta de ahorro no encontrada", 404, code="POT_NOT_FOUND")


def _parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise _not_found() from exc


def _utc(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(UTC)
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _public(pot: Pot) -> PotPublic:
    target = pot.target_amount
    current = pot.current_amount
    return PotPublic(
        id=pot.id,
        name=pot.name,
        color=pot.color,
        target_amount=f"{target:.2f}",
        current_amount=f"{current:.2f}",
        remaining=float(round(target - current, 2)),
        percentage=float(round(current / target * 100, 1)) if target > 0 else 0.0,
        completed=current >= target,
        created_at=pot.created_at,
        updated_at=pot.updated_at,
    )


async def _get_owned(db: AsyncSession, user_id: uuid.UUID, raw_id: str) -> Pot:
    pot_id = _parse_uuid(raw_id)
    pot = await pot_repository.find_owned(db, pot_id, user_id)
    if pot is None:
        raise _not_found()
    return pot


async def list_pots(db: AsyncSession, user_id: uuid.UUID) -> list[PotPublic]:
    pots = await pot_repository.list_by_user(db, user_id)
    return [_public(pot) for pot in pots]


async def get_pot(db: AsyncSession, user_id: uuid.UUID, raw_id: str, limit: int) -> PotDetail:
    pot = await _get_owned(db, user_id, raw_id)
    transactions = await pot_repository.list_transactions(db, pot.id, limit)
    summary = _public(pot)
    return PotDetail(
        **summary.model_dump(),
        transactions=[
            PotTransactionPublic(
                id=transaction.id,
                amount=f"{transaction.amount:.2f}",
                type=transaction.type,
                date=transaction.date,
                note=transaction.note,
            )
            for transaction in transactions
        ],
    )


async def create_pot(db: AsyncSession, user_id: uuid.UUID, payload: PotCreate) -> PotPublic:
    pot = await pot_repository.create(
        db,
        user_id=user_id,
        name=payload.name,
        target_amount=payload.target_amount,
        color=payload.color or "#22c55e",
    )
    await db.commit()
    await db.refresh(pot)
    return _public(pot)


async def update_pot(
    db: AsyncSession, user_id: uuid.UUID, raw_id: str, payload: PotUpdate
) -> PotPublic:
    pot = await _get_owned(db, user_id, raw_id)
    data = payload.model_dump(exclude_unset=True)
    await pot_repository.apply_changes(db, pot, data)
    await db.commit()
    await db.refresh(pot)
    return _public(pot)


async def delete_pot(db: AsyncSession, user_id: uuid.UUID, raw_id: str) -> None:
    pot = await _get_owned(db, user_id, raw_id)
    await pot_repository.delete(db, pot)
    await db.commit()


async def deposit(
    db: AsyncSession, user_id: uuid.UUID, raw_id: str, payload: PotMovement
) -> PotPublic:
    pot = await _get_owned(db, user_id, raw_id)
    amount: Decimal = payload.amount
    await pot_repository.add_transaction(
        db,
        pot_id=pot.id,
        amount=amount,
        transaction_type=PotTransactionType.DEPOSIT,
        date=_utc(payload.date),
        note=payload.note,
    )
    await pot_repository.adjust_amount(db, pot.id, amount)
    await db.commit()
    await db.refresh(pot)
    return _public(pot)


async def withdraw(
    db: AsyncSession, user_id: uuid.UUID, raw_id: str, payload: PotMovement
) -> PotPublic:
    pot = await _get_owned(db, user_id, raw_id)
    amount: Decimal = payload.amount
    if amount > pot.current_amount:
        raise AppError(
            "Saldo insuficiente en esta meta de ahorro",
            422,
            code="POT_INSUFFICIENT_FUNDS",
        )
    await pot_repository.add_transaction(
        db,
        pot_id=pot.id,
        amount=amount,
        transaction_type=PotTransactionType.WITHDRAW,
        date=_utc(payload.date),
        note=payload.note,
    )
    await pot_repository.adjust_amount(db, pot.id, -amount)
    await db.commit()
    await db.refresh(pot)
    return _public(pot)
