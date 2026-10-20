from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.enums import TransactionType
from app.dependencies.auth import AuthUser, get_current_user
from app.dependencies.db import get_db
from app.schemas.transaction import (
    SetCategoryRequest,
    SortField,
    SortOrder,
    SuggestionsResponse,
    TransactionCreate,
    TransactionListResponse,
    TransactionResponse,
    TransactionUpdate,
)
from app.services import transaction_service

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: str | None = Query(None, min_length=1, max_length=100),
    sort: SortField = "date",
    order: SortOrder = "desc",
    category_id: str | None = Query(None, alias="categoryId", min_length=1),
    account_id: str | None = Query(None, alias="accountId", min_length=1),
    type: TransactionType | None = None,
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionListResponse:
    return await transaction_service.list_transactions(
        db,
        user.id,
        page=page,
        limit=limit,
        search=search,
        sort=sort,
        order=order,
        category_id=category_id,
        account_id=account_id,
        transaction_type=type,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/suggestions", response_model=SuggestionsResponse)
async def suggestions(
    merchant: str = Query(..., min_length=1, max_length=120),
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuggestionsResponse:
    return await transaction_service.suggestions(db, user.id, merchant.strip())


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    payload: TransactionCreate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    transaction = await transaction_service.create_transaction(db, user.id, payload)
    return TransactionResponse(data=transaction)


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    transaction = await transaction_service.get_transaction(db, user.id, transaction_id)
    return TransactionResponse(data=transaction)


@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: str,
    payload: TransactionUpdate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    transaction = await transaction_service.update_transaction(db, user.id, transaction_id, payload)
    return TransactionResponse(data=transaction)


@router.patch("/{transaction_id}/category", response_model=TransactionResponse)
async def set_category(
    transaction_id: str,
    payload: SetCategoryRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    transaction = await transaction_service.set_category(db, user.id, transaction_id, payload)
    return TransactionResponse(data=transaction)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await transaction_service.delete_transaction(db, user.id, transaction_id)
