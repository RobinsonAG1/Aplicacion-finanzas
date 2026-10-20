import uuid
from decimal import Decimal

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import AccountType


class Account(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "accounts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    type: Mapped[AccountType] = mapped_column(
        SAEnum(AccountType, name="account_type"),
        nullable=False,
    )
    balance: Mapped[Decimal] = mapped_column(
        Numeric(16, 2), server_default=text("0"), nullable=False
    )
    currency: Mapped[str] = mapped_column(String(3), server_default=text("'COP'"), nullable=False)
