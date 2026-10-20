import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, func, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import PotTransactionType


class Pot(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "pots"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    target_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)
    current_amount: Mapped[Decimal] = mapped_column(
        Numeric(16, 2), server_default=text("0"), nullable=False
    )
    color: Mapped[str] = mapped_column(String(7), server_default=text("'#22c55e'"), nullable=False)


class PotTransaction(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "pot_transactions"
    __table_args__ = (Index("ix_pot_transactions_pot_id_date", "pot_id", "date"),)

    pot_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pots.id", ondelete="CASCADE"),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)
    type: Mapped[PotTransactionType] = mapped_column(
        SAEnum(PotTransactionType, name="pot_transaction_type"),
        nullable=False,
    )
    date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
