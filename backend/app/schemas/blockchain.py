import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import Field

from app.db.models.enums import OnChainPaymentStatus
from app.schemas.common import CamelModel, CamelRequest


class ChainStatusPublic(CamelModel):
    enabled: bool
    chain_id: int
    contract_address: str | None
    treasury_address: str | None
    latest_block: int | None
    indexer_interval: int


class ChainStatusResponse(CamelModel):
    data: ChainStatusPublic


class WalletPublic(CamelModel):
    id: uuid.UUID
    address: str
    chain_id: int
    balance_eth: str
    created_at: datetime


class WalletResponse(CamelModel):
    data: WalletPublic


class PaymentPublic(CamelModel):
    id: uuid.UUID
    reference: str
    amount_eth: str
    amount_wei: str
    status: OnChainPaymentStatus
    transaction_id: uuid.UUID | None
    tx_hash: str | None
    block_number: int | None
    gas_used: int | None
    error_message: str | None
    confirmed_at: datetime | None
    created_at: datetime


class PaymentCreate(CamelRequest):
    amount: Decimal = Field(gt=0, le=Decimal("100"))
    transaction_id: uuid.UUID | None = None


class PaymentResponse(CamelModel):
    data: PaymentPublic


class PaymentListResponse(CamelModel):
    data: list[PaymentPublic]


class ChainEventPublic(CamelModel):
    id: uuid.UUID
    event_name: str
    reference: str
    payer: str
    amount_eth: str
    amount_wei: str
    block_number: int
    tx_hash: str
    log_index: int
    created_at: datetime


class ChainEventListResponse(CamelModel):
    data: list[ChainEventPublic]
