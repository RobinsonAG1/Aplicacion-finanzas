from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import AuthUser, get_current_user
from app.dependencies.db import get_db
from app.schemas.analytics import (
    MonthlyResponse,
    SummaryResponse,
    TimelineResponse,
    TrendsResponse,
)
from app.services import analytics_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary", response_model=SummaryResponse)
async def summary(
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SummaryResponse:
    data = await analytics_service.summary(db, user.id, date_from, date_to)
    return SummaryResponse(data=data)


@router.get("/monthly", response_model=MonthlyResponse)
async def monthly(
    months: int = Query(6, ge=1, le=24),
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MonthlyResponse:
    data = await analytics_service.monthly(db, user.id, months)
    return MonthlyResponse(data=data)


@router.get("/category-trends", response_model=TrendsResponse)
async def category_trends(
    months: int = Query(6, ge=1, le=24),
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TrendsResponse:
    data = await analytics_service.category_trends(db, user.id, months)
    return TrendsResponse(data=data)


@router.get("/balance-timeline", response_model=TimelineResponse)
async def balance_timeline(
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    limit: int = Query(500, ge=1, le=2000),
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TimelineResponse:
    data = await analytics_service.balance_timeline(db, user.id, date_from, date_to, limit)
    return TimelineResponse(data=data)
