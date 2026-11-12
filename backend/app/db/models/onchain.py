import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import OnChainPaymentStatus


class OnChainPayment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "onchain_payments"
    __table_args__ = (
        Index("ix_onchain_payments_user_id_created", "user_id", "created_at"),
        Index("ix_onchain_payments_status", "status"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    wallet_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("wallets.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Transaccion financiera asociada; se conserva aunque la borren (SET NULL).
    transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
    # refId enviado al contrato (bytes32); lo usa el indexador para emparejar eventos.
    reference: Mapped[str] = mapped_column(String(66), unique=True, nullable=False)
    # Monto en wei: hasta 78 digitos, sin decimales.
    amount_wei: Mapped[Decimal] = mapped_column(Numeric(78, 0), nullable=False)
    status: Mapped[OnChainPaymentStatus] = mapped_column(
        SAEnum(OnChainPaymentStatus, name="onchain_payment_status"),
        nullable=False,
    )
    chain_id: Mapped[int] = mapped_column(nullable=False)
    nonce: Mapped[int | None] = mapped_column(nullable=True)
    tx_hash: Mapped[str | None] = mapped_column(String(66), index=True, nullable=True)
    block_number: Mapped[int | None] = mapped_column(nullable=True)
    gas_used: Mapped[int | None] = mapped_column(nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ChainEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "chain_events"
    __table_args__ = (
        Index("ix_chain_events_user_id_block", "user_id", "block_number"),
        Index("ix_chain_events_reference", "reference"),
        UniqueConstraint("tx_hash", "log_index", name="uq_chain_events_tx_hash_log_index"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    payment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("onchain_payments.id", ondelete="SET NULL"),
        nullable=True,
    )
    event_name: Mapped[str] = mapped_column(String(80), nullable=False)
    reference: Mapped[str] = mapped_column(String(66), nullable=False)
    payer: Mapped[str] = mapped_column(String(42), nullable=False)
    amount_wei: Mapped[Decimal] = mapped_column(Numeric(78, 0), nullable=False)
    chain_id: Mapped[int] = mapped_column(nullable=False)
    block_number: Mapped[int] = mapped_column(nullable=False)
    tx_hash: Mapped[str] = mapped_column(String(66), nullable=False)
    log_index: Mapped[int] = mapped_column(nullable=False)


class ChainSyncState(TimestampMixin, Base):
    __tablename__ = "chain_sync_state"

    # Fila por cadena; el indexador retoma desde last_synced_block + 1.
    chain_id: Mapped[int] = mapped_column(primary_key=True)
    last_synced_block: Mapped[int] = mapped_column(nullable=False)
