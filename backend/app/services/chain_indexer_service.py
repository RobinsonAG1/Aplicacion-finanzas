import asyncio
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession
from web3 import Web3
from web3.exceptions import TransactionNotFound

from app.core.chain import get_async_w3, load_payment_abi
from app.core.config import settings
from app.core.logging import get_logger
from app.db.models import ChainEvent, ChainSyncState, OnChainPayment
from app.db.models.enums import OnChainPaymentStatus
from app.db.session import SessionLocal
from app.repositories import onchain_repository, wallet_repository

logger = get_logger(__name__)

MAX_BLOCK_RANGE = 5_000


def utcnow() -> datetime:
    return datetime.now(UTC)


async def _get_or_init_sync_state(db: AsyncSession) -> ChainSyncState:
    result = await db.execute(
        select(ChainSyncState).where(ChainSyncState.chain_id == settings.chain_id)
    )
    state = result.scalar_one_or_none()
    if state is None:
        state = ChainSyncState(chain_id=settings.chain_id, last_synced_block=0)
        db.add(state)
        await db.flush()
    return state


async def resolve_submitted_payments(db: AsyncSession) -> list[OnChainPayment]:
    """Paso 6: consulta recibos de pagos difundidos y los confirma o falla."""
    payments = await onchain_repository.list_resolvable(db)
    if not payments:
        return []
    w3 = get_async_w3()
    resolved: list[OnChainPayment] = []
    for payment in payments:
        try:
            receipt = await w3.eth.get_transaction_receipt(payment.tx_hash)  # type: ignore[arg-type]
        except TransactionNotFound:
            continue
        confirmed = int(receipt["status"]) == 1
        await onchain_repository.apply_changes(
            db,
            payment,
            {
                "status": (
                    OnChainPaymentStatus.CONFIRMED if confirmed else OnChainPaymentStatus.FAILED
                ),
                "block_number": int(receipt["blockNumber"]),
                "gas_used": int(receipt["gasUsed"]),
                "confirmed_at": utcnow() if confirmed else None,
            },
        )
        resolved.append(payment)
        logger.info(
            "onchain_payment_resolved",
            payment_id=str(payment.id),
            confirmed=confirmed,
        )
    await db.commit()
    return resolved


async def _find_payment_by_reference(db: AsyncSession, reference: str) -> OnChainPayment | None:
    result = await db.execute(select(OnChainPayment).where(OnChainPayment.reference == reference))
    return result.scalar_one_or_none()


async def _attribute_user(
    db: AsyncSession, payment: OnChainPayment | None, payer: str
) -> uuid.UUID | None:
    if payment is not None:
        return payment.user_id
    wallet = await wallet_repository.find_by_address(db, Web3.to_checksum_address(payer))
    if wallet is not None:
        return wallet.user_id
    return None


async def _link_events_to_payment(db: AsyncSession, payment: OnChainPayment) -> None:
    await db.execute(
        sa_update(ChainEvent)
        .where(ChainEvent.reference == payment.reference, ChainEvent.payment_id.is_(None))
        .values(payment_id=payment.id)
    )


async def sync_events(db: AsyncSession) -> int:
    """Paso 7: lee eventos PaymentReceived desde el ultimo bloque sincronizado."""
    w3 = get_async_w3()
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(settings.payment_contract_address),
        abi=load_payment_abi(),
    )
    state = await _get_or_init_sync_state(db)
    latest = await w3.eth.block_number
    start = state.last_synced_block + 1
    if start > latest:
        await db.commit()
        return 0
    end = min(latest, start + MAX_BLOCK_RANGE - 1)
    logs = await contract.events.PaymentReceived.get_logs(from_block=start, to_block=end)

    indexed = 0
    for log in logs:
        ref_hex = "0x" + log["args"]["refId"].hex()
        payer = str(log["args"]["payer"])
        payment = await _find_payment_by_reference(db, ref_hex)
        user_id = await _attribute_user(db, payment, payer)
        if user_id is None:
            logger.warning("chain_event_unattributed", reference=ref_hex, payer=payer)
            continue
        inserted = await onchain_repository.upsert_event(
            db,
            user_id=user_id,
            payment_id=payment.id if payment else None,
            event_name="PaymentReceived",
            reference=ref_hex,
            payer=payer,
            amount_wei=int(log["args"]["amountWei"]),
            chain_id=settings.chain_id,
            block_number=int(log["blockNumber"]),
            tx_hash=log["transactionHash"].to_0x_hex(),
            log_index=int(log["logIndex"]),
        )
        if inserted is not None:
            indexed += 1

    state.last_synced_block = end
    await db.commit()
    return indexed


async def run_indexer_once(db: AsyncSession) -> dict[str, int]:
    resolved = await resolve_submitted_payments(db)
    indexed = await sync_events(db)
    for payment in resolved:
        if payment.status == OnChainPaymentStatus.CONFIRMED:
            await _link_events_to_payment(db, payment)
    if resolved:
        await db.commit()
    return {"resolved": len(resolved), "indexed": indexed}


_indexer_task: asyncio.Task[None] | None = None


async def indexer_loop() -> None:
    """Tarea de fondo: cada tick resuelve recibos y sincroniza eventos."""
    while True:
        try:
            async with SessionLocal() as db:
                stats = await run_indexer_once(db)
            if stats["resolved"] or stats["indexed"]:
                logger.info("chain_indexer_tick", **stats)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("chain_indexer_error")
        await asyncio.sleep(settings.indexer_interval)


def start_indexer() -> asyncio.Task[None] | None:
    """Arranca el indexador si blockchain esta configurado; idempotente."""
    global _indexer_task
    if not settings.blockchain_enabled:
        return None
    if _indexer_task is None or _indexer_task.done():
        _indexer_task = asyncio.create_task(indexer_loop())
        logger.info("chain_indexer_started", interval=settings.indexer_interval)
    return _indexer_task


async def stop_indexer() -> None:
    global _indexer_task
    if _indexer_task is not None:
        _indexer_task.cancel()
        try:
            await _indexer_task
        except asyncio.CancelledError:
            pass
        _indexer_task = None
        logger.info("chain_indexer_stopped")
