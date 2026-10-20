import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Literal, Self

from pydantic import Field, field_validator, model_validator

from app.db.models.enums import CategoryType, TransactionType
from app.schemas.common import CamelModel, CamelRequest, CategoryBrief


def _normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _strip_optional(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


def _validate_optional_text(value: str | None, *, maximum: int) -> str | None:
    if value is None:
        return value
    if len(value) > maximum:
        raise ValueError(f"Maximo {maximum} caracteres")
    return value


class AccountBrief(CamelModel):
    id: uuid.UUID
    name: str
    type: str
    currency: str


class TransactionPublic(CamelModel):
    id: uuid.UUID
    user_id: uuid.UUID
    account_id: uuid.UUID
    category_id: uuid.UUID | None
    amount: Decimal
    type: TransactionType
    description: str | None
    merchant: str | None
    date: datetime
    created_at: datetime
    updated_at: datetime
    category: CategoryBrief | None
    account: AccountBrief


class PaginationMeta(CamelModel):
    total: int
    page: int
    limit: int
    total_pages: int


class TransactionListResponse(CamelModel):
    data: list[TransactionPublic]
    meta: PaginationMeta


class TransactionResponse(CamelModel):
    data: TransactionPublic


class TransactionCreate(CamelRequest):
    account_id: str = Field(min_length=1)
    category_id: str | None = Field(default=None, min_length=1)
    amount: Decimal = Field(gt=0)
    type: TransactionType
    description: str | None = None
    merchant: str | None = None
    date: datetime

    @field_validator("description", "merchant", mode="before")
    @classmethod
    def _strip_text(cls, value: object) -> object:
        return _strip_optional(value)

    @field_validator("description")
    @classmethod
    def _validate_description(cls, value: str | None) -> str | None:
        return _validate_optional_text(value, maximum=200)

    @field_validator("merchant")
    @classmethod
    def _validate_merchant(cls, value: str | None) -> str | None:
        return _validate_optional_text(value, maximum=120)

    @field_validator("date")
    @classmethod
    def _normalize_date(cls, value: datetime) -> datetime:
        return _normalize_datetime(value)


class TransactionUpdate(CamelRequest):
    account_id: str | None = Field(default=None, min_length=1)
    category_id: str | None = Field(default=None, min_length=1)
    amount: Decimal | None = Field(default=None, gt=0)
    type: TransactionType | None = None
    description: str | None = None
    merchant: str | None = None
    date: datetime | None = None

    @field_validator("description", "merchant", mode="before")
    @classmethod
    def _strip_text(cls, value: object) -> object:
        return _strip_optional(value)

    @field_validator("description")
    @classmethod
    def _validate_description(cls, value: str | None) -> str | None:
        return _validate_optional_text(value, maximum=200)

    @field_validator("merchant")
    @classmethod
    def _validate_merchant(cls, value: str | None) -> str | None:
        return _validate_optional_text(value, maximum=120)

    @field_validator("date")
    @classmethod
    def _normalize_date(cls, value: datetime | None) -> datetime | None:
        return _normalize_datetime(value) if value is not None else None

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


class SetCategoryRequest(CamelRequest):
    category_id: str | None = Field(min_length=1)


class SuggestionCategory(CamelModel):
    id: uuid.UUID
    name: str
    color: str
    type: CategoryType


class Suggestion(CamelModel):
    category: SuggestionCategory
    count: int
    confidence: float


class SuggestionsResponse(CamelModel):
    suggestions: list[Suggestion]


SortField = Literal["date", "amount", "createdAt"]
SortOrder = Literal["asc", "desc"]
