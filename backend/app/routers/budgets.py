from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.enums import BudgetPeriod
from app.dependencies.auth import AuthUser, get_current_user
from app.dependencies.db import get_db
from app.schemas.budget import (
    BudgetCreate,
    BudgetListResponse,
    BudgetOverviewResponse,
    BudgetResponse,
    BudgetUpdate,
)
from app.services import budget_service

router = APIRouter(prefix="/api/budgets", tags=["budgets"])


@router.get("", response_model=BudgetListResponse)
async def list_budgets(
    period: BudgetPeriod | None = None,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BudgetListResponse:
    budgets = await budget_service.list_budgets(db, user.id, period)
    return BudgetListResponse(data=budgets)


@router.get("/overview", response_model=BudgetOverviewResponse)
async def budget_overview(
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BudgetOverviewResponse:
    overview = await budget_service.overview(db, user.id, date_from, date_to)
    return BudgetOverviewResponse(data=overview)


@router.post("", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(
    payload: BudgetCreate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BudgetResponse:
    budget = await budget_service.create_budget(db, user.id, payload)
    return BudgetResponse(data=budget)


@router.get("/{budget_id}", response_model=BudgetResponse)
async def get_budget(
    budget_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BudgetResponse:
    budget = await budget_service.get_budget(db, user.id, budget_id)
    return BudgetResponse(data=budget)


@router.put("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: str,
    payload: BudgetUpdate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BudgetResponse:
    budget = await budget_service.update_budget(db, user.id, budget_id, payload)
    return BudgetResponse(data=budget)


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    budget_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await budget_service.delete_budget(db, user.id, budget_id)
