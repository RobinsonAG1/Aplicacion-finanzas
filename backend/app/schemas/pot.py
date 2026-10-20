import re
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Self

from pydantic import Field, field_validator, model_validator

from app.db.models.enums import PotTransactionType
from app.schemas.common import CamelModel, CamelRequest

COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{6}$")


class PotPublic(CamelModel):
    id: uuid.UUID
    name: str
    color: str
    target_amount: str
    current_amount: str
    remaining: float
    percentage: float
    completed: bool
    created_at: datetime
    updated_at: datetime


class PotTransactionPublic(CamelModel):
    id: uuid.UUID
    amount: str
    type: PotTransactionType
    date: datetime
    note: str | None


class PotDetail(PotPublic):
    transactions: list[PotTransactionPublic]


class PotListResponse(CamelModel):
    data: list[PotPublic]


class PotResponse(CamelModel):
    data: PotPublic


class PotDetailResponse(CamelModel):
    data: PotDetail


class PotCreate(CamelRequest):
    name: str
    target_amount: Decimal = Field(gt=0)
    color: str | None = None

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

    @field_validator("color")
    @classmethod
    def _validate_color(cls, value: str | None) -> str | None:
        if value is not None and not COLOR_PATTERN.match(value):
            raise ValueError("El color debe estar en formato hexadecimal (#RRGGBB)")
        return value


class PotUpdate(CamelRequest):
    name: str | None = None
    target_amount: Decimal | None = Field(default=None, gt=0)
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
        if len(value) > 80:
            raise ValueError("Maximo 80 caracteres")
        return value

    @field_validator("color")
    @classmethod
    def _validate_color(cls, value: str | None) -> str | None:
        if value is not None and not COLOR_PATTERN.match(value):
            raise ValueError("El color debe estar en formato hexadecimal (#RRGGBB)")
        return value

    @model_validator(mode="after")
    def _validate_payload(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Debe enviar al menos un campo para actualizar")
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError("Los campos enviados no pueden ser nulos")
        return self


class PotMovement(CamelRequest):
    amount: Decimal = Field(gt=0)
    note: str | None = None
    date: datetime | None = None

    @field_validator("note", mode="before")
    @classmethod
    def _strip_note(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("note")
    @classmethod
    def _validate_note(cls, value: str | None) -> str | None:
        if value is not None and len(value) > 140:
            raise ValueError("Maximo 140 caracteres")
        return value
