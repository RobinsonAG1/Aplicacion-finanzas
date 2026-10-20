from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import AuthUser, get_current_user
from app.dependencies.db import get_db
from app.schemas.pot import (
    PotCreate,
    PotDetailResponse,
    PotListResponse,
    PotMovement,
    PotResponse,
    PotUpdate,
)
from app.services import pot_service

router = APIRouter(prefix="/api/pots", tags=["pots"])


@router.get("", response_model=PotListResponse)
async def list_pots(
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PotListResponse:
    pots = await pot_service.list_pots(db, user.id)
    return PotListResponse(data=pots)


@router.post("", response_model=PotResponse, status_code=status.HTTP_201_CREATED)
async def create_pot(
    payload: PotCreate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PotResponse:
    pot = await pot_service.create_pot(db, user.id, payload)
    return PotResponse(data=pot)


@router.get("/{pot_id}", response_model=PotDetailResponse)
async def get_pot(
    pot_id: str,
    limit: int = Query(20, ge=1, le=100),
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PotDetailResponse:
    pot = await pot_service.get_pot(db, user.id, pot_id, limit)
    return PotDetailResponse(data=pot)


@router.put("/{pot_id}", response_model=PotResponse)
async def update_pot(
    pot_id: str,
    payload: PotUpdate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PotResponse:
    pot = await pot_service.update_pot(db, user.id, pot_id, payload)
    return PotResponse(data=pot)


@router.delete("/{pot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pot(
    pot_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await pot_service.delete_pot(db, user.id, pot_id)


@router.post(
    "/{pot_id}/deposit",
    response_model=PotResponse,
    status_code=status.HTTP_201_CREATED,
)
async def deposit(
    pot_id: str,
    payload: PotMovement,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PotResponse:
    pot = await pot_service.deposit(db, user.id, pot_id, payload)
    return PotResponse(data=pot)


@router.post(
    "/{pot_id}/withdraw",
    response_model=PotResponse,
    status_code=status.HTTP_201_CREATED,
)
async def withdraw(
    pot_id: str,
    payload: PotMovement,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PotResponse:
    pot = await pot_service.withdraw(db, user.id, pot_id, payload)
    return PotResponse(data=pot)
