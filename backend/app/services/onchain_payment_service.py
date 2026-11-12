import uuid
from datetime import UTC, datetime
from decimal import Decimal

from eth_account import Account as EthAccount
from hexbytes import HexBytes
from sqlalchemy.ext.asyncio import AsyncSession
from web3 import AsyncWeb3, Web3
from web3.types import TxParams

from app.core.chain import (
    ensure_blockchain_enabled,
    get_async_w3,
    load_payment_abi,
)
from app.core.config import settings
from app.core.errors import AppError
from app.core.logging import get_logger
from app.db.models import ChainEvent, OnChainPayment, Wallet
from app.db.models.enums import OnChainPaymentStatus
from app.repositories import onchain_repository, transaction_repository
from app.schemas.blockchain import (
    ChainEventPublic,
    ChainStatusPublic,
    PaymentCreate,
    PaymentPublic,
)
from app.services import wallet_service

logger = get_logger(__name__)

MAX_AMOUNT_ETH = Decimal("100")
PAY_GAS_LIMIT = 150_000


def _eth(wei: int) -> str:
    return str(Web3.from_wei(wei, "ether"))


def _public(payment: OnChainPayment) -> PaymentPublic:
    return PaymentPublic(
        id=payment.id,
        reference=payment.reference,
        amount_eth=_eth(int(payment.amount_wei)),
        amount_wei=str(payment.amount_wei),
        status=payment.status,
        transaction_id=payment.transaction_id,
        tx_hash=payment.tx_hash,
        block_number=payment.block_number,
        gas_used=payment.gas_used,
        error_message=payment.error_message,
        confirmed_at=payment.confirmed_at,
        created_at=payment.created_at,
    )


def _event_public(event: ChainEvent) -> ChainEventPublic:
    return ChainEventPublic(
        id=event.id,
        event_name=event.event_name,
        reference=event.reference,
        payer=event.payer,
        amount_eth=_eth(int(event.amount_wei)),
        amount_wei=str(event.amount_wei),
        block_number=event.block_number,
        tx_hash=event.tx_hash,
        log_index=event.log_index,
        created_at=event.created_at,
    )


async def get_chain_status() -> ChainStatusPublic:
    latest_block: int | None = None
    if settings.blockchain_enabled:
        try:
            w3 = get_async_w3()
            latest_block = await w3.eth.block_number
        except Exception as exc:  # nodo caido no debe tumbar el endpoint
            logger.warning("chain_status_rpc_error", error=str(exc))
    return ChainStatusPublic(
        enabled=settings.blockchain_enabled,
        chain_id=settings.chain_id,
        contract_address=settings.payment_contract_address or None,
        treasury_address=settings.treasury_address or None,
        latest_block=latest_block,
        indexer_interval=settings.indexer_interval,
    )


async def list_events(
    db: AsyncSession, user_id: uuid.UUID, limit: int = 100
) -> list[ChainEventPublic]:
    events = await onchain_repository.list_events_by_user(db, user_id, limit)
    return [_event_public(event) for event in events]


async def list_payments(
    db: AsyncSession, user_id: uuid.UUID, limit: int = 50
) -> list[PaymentPublic]:
    payments = await onchain_repository.list_by_user(db, user_id, limit)
    return [_public(payment) for payment in payments]


async def create_payment(
    db: AsyncSession, user_id: uuid.UUID, payload: PaymentCreate
) -> PaymentPublic:
    ensure_blockchain_enabled()
    if payload.amount > MAX_AMOUNT_ETH:
        raise AppError(
            f"El monto maximo por pago es {MAX_AMOUNT_ETH} ETH", 422, code="AMOUNT_TOO_HIGH"
        )
    wallet = await wallet_service.get_wallet_or_404(db, user_id)

    transaction_id: uuid.UUID | None = None
    if payload.transaction_id is not None:
        transaction = await transaction_repository.find_owned(db, payload.transaction_id, user_id)
        if transaction is None:
            raise AppError("Transaccion no encontrada", 404, code="TRANSACTION_NOT_FOUND")
        transaction_id = transaction.id

    amount_wei = Web3.to_wei(payload.amount, "ether")
    w3 = get_async_w3()
    balance = await w3.eth.get_balance(Web3.to_checksum_address(wallet.address))
    if balance < amount_wei:
        raise AppError(
            "Saldo insuficiente en la billetera para este pago",
            422,
            code="INSUFFICIENT_FUNDS",
        )

    # Paso 3 del flujo: la orden entra en la tabla como PENDING (mempool local).
    # La referencia es el bytes32 (64 chars hex) que viaja al contrato y con el
    # que el indexador emparejara los eventos PaymentReceived.
    payment = await onchain_repository.create(
        db,
        user_id=user_id,
        wallet_id=wallet.id,
        transaction_id=transaction_id,
        reference="0x" + uuid.uuid4().hex.rjust(64, "0"),
        amount_wei=amount_wei,
        status=OnChainPaymentStatus.PENDING,
        chain_id=settings.chain_id,
    )
    await db.commit()
    await db.refresh(payment)

    try:
        nonce, tx_hash = await _broadcast(w3, wallet, payment, amount_wei)
    except Exception as exc:
        message = str(exc)[:500]
        await onchain_repository.apply_changes(
            db, payment, {"status": OnChainPaymentStatus.FAILED, "error_message": message}
        )
        await db.commit()
        raise AppError(
            "No se pudo difundir el pago a la red", 502, code="CHAIN_ERROR", details=message
        ) from exc

    await onchain_repository.apply_changes(
        db,
        payment,
        {
            "status": OnChainPaymentStatus.SUBMITTED,
            "tx_hash": tx_hash.to_0x_hex(),
            "nonce": nonce,
        },
    )
    await db.commit()
    await db.refresh(payment)
    logger.info(
        "onchain_payment_submitted",
        payment_id=str(payment.id),
        tx_hash=payment.tx_hash,
    )
    return _public(payment)


async def _broadcast(
    w3: AsyncWeb3, wallet: Wallet, payment: OnChainPayment, amount_wei: int
) -> tuple[int, HexBytes]:
    """Pasos 1, 2 y 4: firma con la clave del wallet y difunde al nodo RPC."""
    private_key = wallet_service.decrypt_private_key(wallet)
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(settings.payment_contract_address),
        abi=load_payment_abi(),
    )
    ref_bytes32 = bytes.fromhex(payment.reference[2:])
    payer = Web3.to_checksum_address(wallet.address)
    # "pending" incluye transacciones aun no minadas para evitar colision de nonce.
    nonce = await w3.eth.get_transaction_count(payer, "pending")
    gas_price = await w3.eth.gas_price
    tx_params: TxParams = {
        "from": payer,
        "nonce": nonce,
        "value": Web3.to_wei(amount_wei, "wei"),
        "gas": PAY_GAS_LIMIT,
        "gasPrice": gas_price,
        "chainId": payment.chain_id,
    }
    tx = await contract.functions.pay(ref_bytes32).build_transaction(tx_params)
    signed = EthAccount.sign_transaction(tx, private_key)
    tx_hash = await w3.eth.send_raw_transaction(signed.raw_transaction)
    return nonce, tx_hash


def utc_now() -> datetime:
    return datetime.now(UTC)
