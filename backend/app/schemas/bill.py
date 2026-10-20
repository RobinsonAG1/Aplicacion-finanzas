import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Self

from pydantic import Field, field_validator, model_validator

from app.db.models.enums import ReminderChannel, ReminderStatus
from app.schemas.common import CamelModel, CamelRequest, CategoryBrief
from app.schemas.transaction import TransactionPublic


class SourceTransactionBrief(CamelModel):
    id: uuid.UUID
    date: datetime
    amount: str


class BillPublic(CamelModel):
    id: uuid.UUID
    name: str
    amount: str
    due_day: int
    is_active: bool
    category: CategoryBrief | None
    source_transaction: SourceTransactionBrief | None
    next_due_date: datetime
    days_until: int
    overdue: bool
    created_at: datetime
    updated_at: datetime


class BillListResponse(CamelModel):
    data: list[BillPublic]


class BillResponse(CamelModel):
    data: BillPublic


class UpcomingBill(CamelModel):
    id: uuid.UUID
    name: str
    amount: str
    category: CategoryBrief | None
    due_date: datetime
    days_until: int
    overdue: bool


class UpcomingResponse(CamelModel):
    days: int
    upcoming: list[UpcomingBill]


class UpcomingDataResponse(CamelModel):
    data: UpcomingResponse


class ReminderPublic(CamelModel):
    id: uuid.UUID
    bill_id: uuid.UUID
    due_date: datetime
    channel: ReminderChannel
    status: ReminderStatus
    sent_at: datetime | None
    created_at: datetime


class ReminderListResponse(CamelModel):
    data: list[ReminderPublic]


class ReminderResponse(CamelModel):
    data: ReminderPublic


class RunRemindersResult(CamelModel):
    created: int
    skipped: int
    reminders: list[ReminderPublic]


class RunRemindersResponse(CamelModel):
    data: RunRemindersResult


class PayBillResult(CamelModel):
    bill: BillPublic
    transaction: TransactionPublic


class PayBillResponse(CamelModel):
    data: PayBillResult


class BillCreate(CamelRequest):
    name: str
    amount: Decimal = Field(gt=0)
    category_id: str | None = Field(default=None, min_length=1)
    due_day: int = Field(ge=1, le=31)
    is_active: bool = True

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("name")
    @classmethod
    def _validate_name(cls, value: str) -> str:
        if not value:
            raise ValueError("Nombre obligatorio")
        if len(value) > 80:
            raise ValueError("Maximo 80 caracteres")
        return value


class BillUpdate(CamelRequest):
    name: str | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    category_id: str | None = Field(default=None, min_length=1)
    due_day: int | None = Field(default=None, ge=1, le=31)
    is_active: bool | None = None

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("name")
    @classmethod
    def _validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if not value:
            raise ValueError("Nombre obligatorio")
        if len(value) > 80:
            raise ValueError("Maximo 80 caracteres")
        return value

    @model_validator(mode="after")
    def _validate_payload(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Debe enviar al menos un campo para actualizar")
        for field in self.model_fields_set:
            if field == "category_id":
                continue
            if getattr(self, field) is None:
                raise ValueError("Los campos enviados no pueden ser nulos")
        return self


class ReminderCreate(CamelRequest):
    due_date: datetime | None = None
    channel: ReminderChannel = ReminderChannel.LOG
    send: bool = False

    @field_validator("due_date")
    @classmethod
    def _normalize_due_date(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


class RunReminders(CamelRequest):
    days: int = Field(default=7, ge=1, le=90)
    channel: ReminderChannel = ReminderChannel.LOG


class BillPay(CamelRequest):
    account_id: str = Field(min_length=1)
    amount: Decimal | None = Field(default=None, gt=0)
    date: datetime | None = None

    @field_validator("date")
    @classmethod
    def _normalize_date(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)
