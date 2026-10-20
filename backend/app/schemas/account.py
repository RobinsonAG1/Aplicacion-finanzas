import re
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Self

from pydantic import BaseModel, field_validator, model_validator

from app.db.models.enums import AccountType, CategoryType
from app.schemas.common import CamelModel

COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{6}$")


class AccountPublic(CamelModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    type: AccountType
    balance: Decimal
    currency: str
    created_at: datetime
    updated_at: datetime


class AccountListResponse(CamelModel):
    data: list[AccountPublic]


class AccountResponse(CamelModel):
    data: AccountPublic


class AccountCreate(BaseModel):
    name: str
    type: AccountType
    balance: Decimal = Decimal("0")
    currency: str = "COP"

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

    @field_validator("currency", mode="before")
    @classmethod
    def _normalize_currency(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value

    @field_validator("currency")
    @classmethod
    def _validate_currency(cls, value: str) -> str:
        if len(value) != 3:
            raise ValueError("Moneda ISO de 3 letras")
        return value


class AccountUpdate(BaseModel):
    name: str | None = None
    type: AccountType | None = None
    balance: Decimal | None = None
    currency: str | None = None

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

    @field_validator("currency", mode="before")
    @classmethod
    def _normalize_currency(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value

    @field_validator("currency")
    @classmethod
    def _validate_currency(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if len(value) != 3:
            raise ValueError("Moneda ISO de 3 letras")
        return value

    @model_validator(mode="after")
    def _validate_payload(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Debe enviar al menos un campo para actualizar")
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError("Los campos enviados no pueden ser nulos")
        return self


class CategoryPublic(CamelModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    type: CategoryType
    color: str
    is_custom: bool
    created_at: datetime
    updated_at: datetime


class CategoryListResponse(CamelModel):
    data: list[CategoryPublic]


class CategoryResponse(CamelModel):
    data: CategoryPublic


class CategoryCreate(BaseModel):
    name: str
    type: CategoryType
    color: str = "#64748b"

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("name")
    @classmethod
    def _validate_name(cls, value: str) -> str:
        if not value:
            raise ValueError("Nombre obligatorio")
        if len(value) > 60:
            raise ValueError("Maximo 60 caracteres")
        return value

    @field_validator("color")
    @classmethod
    def _validate_color(cls, value: str) -> str:
        if not COLOR_PATTERN.match(value):
            raise ValueError("Color hex invalido (ej. #16a34a)")
        return value


class CategoryUpdate(BaseModel):
    name: str | None = None
    color: str | None = None

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
        if len(value) > 60:
            raise ValueError("Maximo 60 caracteres")
        return value

    @field_validator("color")
    @classmethod
    def _validate_color(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if not COLOR_PATTERN.match(value):
            raise ValueError("Color hex invalido (ej. #16a34a)")
        return value

    @model_validator(mode="after")
    def _validate_payload(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Debe enviar al menos un campo para actualizar")
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError("Los campos enviados no pueden ser nulos")
        return self
