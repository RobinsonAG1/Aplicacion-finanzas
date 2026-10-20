from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import AuthUser, get_current_user
from app.dependencies.db import get_db
from app.schemas.account import (
    AccountCreate,
    AccountListResponse,
    AccountResponse,
    AccountUpdate,
)
from app.services import account_service

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("", response_model=AccountListResponse)
async def list_accounts(
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AccountListResponse:
    accounts = await account_service.list_accounts(db, user.id)
    return AccountListResponse(data=accounts)


@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    payload: AccountCreate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AccountResponse:
    account = await account_service.create_account(db, user.id, payload)
    return AccountResponse(data=account)


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AccountResponse:
    account = await account_service.get_account(db, user.id, account_id)
    return AccountResponse(data=account)


@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: str,
    payload: AccountUpdate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AccountResponse:
    account = await account_service.update_account(db, user.id, account_id, payload)
    return AccountResponse(data=account)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await account_service.delete_account(db, user.id, account_id)
