import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models import Budget, Category
from app.db.models.enums import BudgetPeriod, CategoryType
from app.repositories import budget_repository, category_repository
from app.schemas.budget import (
    BudgetCreate,
    BudgetOverview,
    BudgetPublic,
    BudgetSummary,
    BudgetTotals,
    BudgetUpdate,
    BudgetWindow,
)
from app.schemas.common import CategoryBrief


def _not_found() -> AppError:
    return AppError("Presupuesto no encontrado", 404, code="BUDGET_NOT_FOUND")


def _invalid_range() -> AppError:
    return AppError(
        "endDate debe ser posterior o igual a startDate",
        422,
        code="BUDGET_INVALID_RANGE",
    )


def _parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise _not_found() from exc


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _start_of_month(now: datetime) -> datetime:
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _end_of_day(now: datetime) -> datetime:
    return now.replace(hour=23, minute=59, second=59, microsecond=999999)


def _public(budget: Budget, category: Category) -> BudgetPublic:
    return BudgetPublic(
        id=budget.id,
        user_id=budget.user_id,
        category_id=budget.category_id,
        category=CategoryBrief.model_validate(category),
        limit_amount=budget.limit_amount,
        period=budget.period,
        start_date=budget.start_date,
        end_date=budget.end_date,
    )


async def _ensure_expense_category(db: AsyncSession, user_id: uuid.UUID, raw_id: str) -> uuid.UUID:
    try:
        category_id = uuid.UUID(raw_id)
    except ValueError as exc:
        raise AppError("Categoria no encontrada", 404, code="CATEGORY_NOT_FOUND") from exc
    category = await category_repository.find_owned(db, category_id, user_id)
    if category is None:
        raise AppError("Categoria no encontrada", 404, code="CATEGORY_NOT_FOUND")
    if category.type != CategoryType.EXPENSE:
        raise AppError(
            "Solo se presupuestan categorias de gasto",
            422,
            code="BUDGET_INVALID_CATEGORY",
        )
    return category_id


def _intersect(budget: Budget, date_from: datetime, date_to: datetime) -> BudgetWindow | None:
    start = max(budget.start_date, date_from)
    end = min(budget.end_date, date_to) if budget.end_date is not None else date_to
    if end < start:
        return None
    return BudgetWindow(from_date=start, to=end)


async def list_budgets(
    db: AsyncSession, user_id: uuid.UUID, period: BudgetPeriod | None
) -> list[BudgetPublic]:
    rows = await budget_repository.list_by_user(db, user_id, period)
    return [_public(budget, category) for budget, category in rows]


async def get_budget(db: AsyncSession, user_id: uuid.UUID, raw_id: str) -> BudgetPublic:
    budget_id = _parse_uuid(raw_id)
    row = await budget_repository.find_owned(db, budget_id, user_id)
    if row is None:
        raise _not_found()
    return _public(*row)


async def create_budget(
    db: AsyncSession, user_id: uuid.UUID, payload: BudgetCreate
) -> BudgetPublic:
    category_id = await _ensure_expense_category(db, user_id, payload.category_id)
    budget = await budget_repository.create(
        db,
        user_id=user_id,
        category_id=category_id,
        limit_amount=payload.limit_amount,
        period=payload.period,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    await db.commit()
    row = await budget_repository.find_owned(db, budget.id, user_id)
    if row is None:
        raise _not_found()
    return _public(*row)


async def update_budget(
    db: AsyncSession, user_id: uuid.UUID, raw_id: str, payload: BudgetUpdate
) -> BudgetPublic:
    budget_id = _parse_uuid(raw_id)
    row = await budget_repository.find_owned(db, budget_id, user_id)
    if row is None:
        raise _not_found()
    budget, _ = row

    fields = payload.model_dump(exclude_unset=True)
    data: dict[str, object] = {}
    if "category_id" in fields:
        data["category_id"] = await _ensure_expense_category(
            db, user_id, str(fields["category_id"])
        )
    if "limit_amount" in fields:
        data["limit_amount"] = fields["limit_amount"]
    if "period" in fields:
        data["period"] = fields["period"]

    start_date = fields.get("start_date", budget.start_date)
    end_date = fields.get("end_date", budget.end_date)
    if end_date is not None and end_date < start_date:
        raise _invalid_range()
    data["start_date"] = start_date
    data["end_date"] = end_date

    await budget_repository.apply_changes(db, budget, data)
    await db.commit()
    updated = await budget_repository.find_owned(db, budget_id, user_id)
    if updated is None:
        raise _not_found()
    return _public(*updated)


async def delete_budget(db: AsyncSession, user_id: uuid.UUID, raw_id: str) -> None:
    budget_id = _parse_uuid(raw_id)
    row = await budget_repository.find_owned(db, budget_id, user_id)
    if row is None:
        raise _not_found()
    await budget_repository.delete(db, row[0])
    await db.commit()


async def overview(
    db: AsyncSession,
    user_id: uuid.UUID,
    date_from: datetime | None,
    date_to: datetime | None,
) -> BudgetOverview:
    now = datetime.now(UTC)
    from_ = _utc(date_from) if date_from is not None else _start_of_month(now)
    to = _utc(date_to) if date_to is not None else _end_of_day(now)

    budgets = await budget_repository.list_by_user(db, user_id)
    expenses = await budget_repository.expenses_in_range(db, user_id, from_, to)

    total_limit = Decimal("0")
    total_spent = Decimal("0")
    summaries: list[BudgetSummary] = []
    for budget, category in budgets:
        window = _intersect(budget, from_, to)
        spent = Decimal("0")
        if window is not None:
            for expense_category_id, amount, expense_date in expenses:
                if (
                    expense_category_id == budget.category_id
                    and expense_date >= window.from_date
                    and expense_date <= window.to
                ):
                    spent += amount

        limit = budget.limit_amount
        remaining = limit - spent
        percentage = float(round((spent / limit * 100), 1)) if limit > 0 else 0.0
        total_limit += limit
        total_spent += spent

        summaries.append(
            BudgetSummary(
                id=budget.id,
                category=CategoryBrief.model_validate(category),
                limit_amount=f"{limit:.2f}",
                period=budget.period,
                start_date=budget.start_date,
                end_date=budget.end_date,
                spent=float(round(spent, 2)),
                remaining=float(round(remaining, 2)),
                percentage=percentage,
                exceeded=spent > limit,
                window=window,
            )
        )

    return BudgetOverview(
        from_date=from_,
        to=to,
        budgets=summaries,
        totals=BudgetTotals(
            limit_amount=float(round(total_limit, 2)),
            spent=float(round(total_spent, 2)),
            remaining=float(round(total_limit - total_spent, 2)),
        ),
    )
