import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ChainEvent, OnChainPayment
from app.db.models.enums import OnChainPaymentStatus


async def create(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    wallet_id: uuid.UUID,
    transaction_id: uuid.UUID | None,
    reference: str,
    amount_wei: int,
    status: OnChainPaymentStatus,
    chain_id: int,
) -> OnChainPayment:
    payment = OnChainPayment(
        id=uuid.uuid4(),
        user_id=user_id,
        wallet_id=wallet_id,
        transaction_id=transaction_id,
        reference=reference,
        amount_wei=amount_wei,
        status=status,
        chain_id=chain_id,
    )
    db.add(payment)
    return payment


async def find_owned(
    db: AsyncSession, payment_id: uuid.UUID, user_id: uuid.UUID
) -> OnChainPayment | None:
    result = await db.execute(
        select(OnChainPayment).where(
            OnChainPayment.id == payment_id, OnChainPayment.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def list_by_user(
    db: AsyncSession, user_id: uuid.UUID, limit: int = 50
) -> Sequence[OnChainPayment]:
    result = await db.execute(
        select(OnChainPayment)
        .where(OnChainPayment.user_id == user_id)
        .order_by(OnChainPayment.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


async def list_resolvable(db: AsyncSession, limit: int = 100) -> Sequence[OnChainPayment]:
    """Pagos difundidos esperando recibo (paso 4 -> 6 del flujo)."""
    result = await db.execute(
        select(OnChainPayment)
        .where(
            OnChainPayment.status == OnChainPaymentStatus.SUBMITTED,
            OnChainPayment.tx_hash.is_not(None),
        )
        .order_by(OnChainPayment.created_at.asc())
        .limit(limit)
    )
    return result.scalars().all()


async def find_by_reference(
    db: AsyncSession, reference: str, user_id: uuid.UUID
) -> OnChainPayment | None:
    result = await db.execute(
        select(OnChainPayment).where(
            OnChainPayment.reference == reference, OnChainPayment.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def apply_changes(db: AsyncSession, payment: OnChainPayment, data: dict[str, object]) -> None:
    for key, value in data.items():
        setattr(payment, key, value)


async def count_pending(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(OnChainPayment)
        .where(
            OnChainPayment.status.in_(
                [OnChainPaymentStatus.PENDING, OnChainPaymentStatus.SUBMITTED]
            )
        )
    )
    return int(result.scalar_one())


async def upsert_event(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    payment_id: uuid.UUID | None,
    event_name: str,
    reference: str,
    payer: str,
    amount_wei: int,
    chain_id: int,
    block_number: int,
    tx_hash: str,
    log_index: int,
) -> ChainEvent | None:
    """Inserta el evento solo si no existe (tx_hash + log_index es la clave natural)."""
    existing = await db.execute(
        select(ChainEvent.id).where(
            ChainEvent.tx_hash == tx_hash, ChainEvent.log_index == log_index
        )
    )
    if existing.scalar_one_or_none() is not None:
        return None
    event = ChainEvent(
        id=uuid.uuid4(),
        user_id=user_id,
        payment_id=payment_id,
        event_name=event_name,
        reference=reference,
        payer=payer,
        amount_wei=amount_wei,
        chain_id=chain_id,
        block_number=block_number,
        tx_hash=tx_hash,
        log_index=log_index,
    )
    db.add(event)
    return event


async def list_events_by_user(
    db: AsyncSession, user_id: uuid.UUID, limit: int = 100
) -> Sequence[ChainEvent]:
    result = await db.execute(
        select(ChainEvent)
        .where(ChainEvent.user_id == user_id)
        .order_by(ChainEvent.block_number.desc(), ChainEvent.log_index.desc())
        .limit(limit)
    )
    return result.scalars().all()
