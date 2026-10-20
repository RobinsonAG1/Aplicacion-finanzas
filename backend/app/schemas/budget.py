import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Self

from pydantic import Field, field_validator, model_validator

from app.db.models.enums import BudgetPeriod
from app.schemas.common import CamelModel, CamelRequest, CategoryBrief


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


class BudgetWindow(CamelModel):
    from_date: datetime = Field(serialization_alias="from")
    to: datetime


class BudgetPublic(CamelModel):
    id: uuid.UUID
    user_id: uuid.UUID
    category_id: uuid.UUID
    category: CategoryBrief
    limit_amount: Decimal
    period: BudgetPeriod
    start_date: datetime
    end_date: datetime | None


class BudgetListResponse(CamelModel):
    data: list[BudgetPublic]


class BudgetResponse(CamelModel):
    data: BudgetPublic


class BudgetCreate(CamelRequest):
    category_id: str = Field(min_length=1)
    limit_amount: Decimal = Field(gt=0)
    period: BudgetPeriod = BudgetPeriod.MONTHLY
    start_date: datetime = Field(default_factory=lambda: datetime.now(UTC))
    end_date: datetime | None = None

    @field_validator("start_date", "end_date")
    @classmethod
    def _normalize_dates(cls, value: datetime | None) -> datetime | None:
        return _utc(value)

    @model_validator(mode="after")
    def _validate_range(self) -> Self:
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("endDate debe ser posterior o igual a startDate")
        return self


class BudgetUpdate(CamelRequest):
    category_id: str | None = Field(default=None, min_length=1)
    limit_amount: Decimal | None = Field(default=None, gt=0)
    period: BudgetPeriod | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None

    @field_validator("start_date", "end_date")
    @classmethod
    def _normalize_dates(cls, value: datetime | None) -> datetime | None:
        return _utc(value)

    @model_validator(mode="after")
    def _validate_payload(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Debe enviar al menos un campo para actualizar")
        for field in self.model_fields_set:
            if field == "end_date":
                continue
            if getattr(self, field) is None:
                raise ValueError("Los campos enviados no pueden ser nulos")
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("endDate debe ser posterior o igual a startDate")
        return self


class BudgetSummary(CamelModel):
    id: uuid.UUID
    category: CategoryBrief
    limit_amount: str
    period: BudgetPeriod
    start_date: datetime
    end_date: datetime | None
    spent: float
    remaining: float
    percentage: float
    exceeded: bool
    window: BudgetWindow | None


class BudgetTotals(CamelModel):
    limit_amount: float
    spent: float
    remaining: float


class BudgetOverview(CamelModel):
    from_date: datetime = Field(serialization_alias="from")
    to: datetime
    budgets: list[BudgetSummary]
    totals: BudgetTotals


class BudgetOverviewResponse(CamelModel):
    data: BudgetOverview
