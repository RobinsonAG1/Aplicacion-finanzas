import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Wallet(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "wallets"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    address: Mapped[str] = mapped_column(String(42), unique=True, nullable=False)
    # Clave privada cifrada con Fernet (WALLET_ENCRYPTION_KEY); nunca sale por API.
    encrypted_private_key: Mapped[str] = mapped_column(String(500), nullable=False)
    chain_id: Mapped[int] = mapped_column(nullable=False)
