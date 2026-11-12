from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import AuthUser, get_current_user
from app.dependencies.db import get_db
from app.schemas.blockchain import (
    ChainEventListResponse,
    ChainStatusResponse,
    PaymentCreate,
    PaymentListResponse,
    PaymentResponse,
    WalletResponse,
)
from app.services import onchain_payment_service, wallet_service

router = APIRouter(prefix="/api/blockchain", tags=["blockchain"])


@router.get("/status", response_model=ChainStatusResponse)
async def get_status(
    user: AuthUser = Depends(get_current_user),
) -> ChainStatusResponse:
    return ChainStatusResponse(data=await onchain_payment_service.get_chain_status())


@router.get("/wallet", response_model=WalletResponse)
async def get_wallet(
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WalletResponse:
    return WalletResponse(data=await wallet_service.get_wallet(db, user.id))


@router.post("/wallet", response_model=WalletResponse, status_code=status.HTTP_201_CREATED)
async def create_wallet(
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WalletResponse:
    return WalletResponse(data=await wallet_service.create_wallet(db, user.id))


@router.get("/payments", response_model=PaymentListResponse)
async def list_payments(
    limit: int = Query(50, ge=1, le=100),
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaymentListResponse:
    payments = await onchain_payment_service.list_payments(db, user.id, limit)
    return PaymentListResponse(data=payments)


@router.post("/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(
    payload: PaymentCreate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaymentResponse:
    payment = await onchain_payment_service.create_payment(db, user.id, payload)
    return PaymentResponse(data=payment)


@router.get("/events", response_model=ChainEventListResponse)
async def list_events(
    limit: int = Query(100, ge=1, le=200),
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChainEventListResponse:
    events = await onchain_payment_service.list_events(db, user.id, limit)
    return ChainEventListResponse(data=events)
