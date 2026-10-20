import calendar
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import analytics_repository
from app.schemas.analytics import (
    AccountAnalytics,
    AnalyticsTotals,
    CategoryAnalytics,
    CategoryTrend,
    MonthlyData,
    MonthlyPoint,
    SummaryData,
    TimelineData,
    TimelinePoint,
    TrendsData,
)


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _start_of_month(value: datetime) -> datetime:
    return value.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _end_of_month(value: datetime) -> datetime:
    last_day = calendar.monthrange(value.year, value.month)[1]
    return value.replace(day=last_day, hour=23, minute=59, second=59, microsecond=999999)


def _add_months(value: datetime, months: int) -> datetime:
    total = value.year * 12 + (value.month - 1) + months
    year, month_index = divmod(total, 12)
    return value.replace(
        year=year,
        month=month_index + 1,
        day=1,
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )


async def summary(
    db: AsyncSession,
    user_id: uuid.UUID,
    date_from: datetime | None,
    date_to: datetime | None,
) -> SummaryData:
    now = datetime.now(UTC)
    from_ = _utc(date_from) if date_from is not None else _start_of_month(now)
    to = _utc(date_to) if date_to is not None else now

    totals_row = await analytics_repository.totals(db, user_id, from_, to)
    categories = await analytics_repository.expense_by_category(db, user_id, from_, to)
    accounts = await analytics_repository.net_by_account(db, user_id, from_, to)

    income = float(totals_row["income"])
    expense = float(totals_row["expense"])
    net = float(totals_row["net"])
    return SummaryData(
        from_date=from_,
        to=to,
        totals=AnalyticsTotals(
            income=round(income, 2),
            expense=round(expense, 2),
            net=round(net, 2),
            savings_rate=round(net / income * 100, 1) if income > 0 else 0.0,
        ),
        by_category=[CategoryAnalytics.model_validate(dict(row)) for row in categories],
        by_account=[AccountAnalytics.model_validate(dict(row)) for row in accounts],
    )


async def monthly(db: AsyncSession, user_id: uuid.UUID, months: int) -> MonthlyData:
    now = datetime.now(UTC)
    from_ = _add_months(now, -(months - 1))
    to = _start_of_month(now)
    series = await analytics_repository.monthly_series(db, user_id, from_, to)
    return MonthlyData(
        from_date=from_,
        to=_end_of_month(now),
        months=[MonthlyPoint.model_validate(dict(row)) for row in series],
    )


async def category_trends(db: AsyncSession, user_id: uuid.UUID, months: int) -> TrendsData:
    now = datetime.now(UTC)
    from_ = _add_months(now, -(months - 1))
    to = _end_of_month(now)
    trends = await analytics_repository.category_trends(db, user_id, from_, to)
    return TrendsData(
        from_date=from_,
        to=to,
        trends=[CategoryTrend.model_validate(dict(row)) for row in trends],
    )


async def balance_timeline(
    db: AsyncSession,
    user_id: uuid.UUID,
    date_from: datetime | None,
    date_to: datetime | None,
    limit: int,
) -> TimelineData:
    now = datetime.now(UTC)
    from_ = _utc(date_from) if date_from is not None else now - timedelta(days=30)
    to = _utc(date_to) if date_to is not None else now
    timeline = await analytics_repository.balance_timeline(db, user_id, from_, to, limit)
    return TimelineData(
        from_date=from_,
        to=to,
        timeline=[TimelinePoint.model_validate(dict(row)) for row in timeline],
    )
