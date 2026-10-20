import uuid

from sqlalchemy import Boolean, ForeignKey, Index, String, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import CategoryType


class Category(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "categories"
    __table_args__ = (
        Index("ix_categories_user_id_name_type", "user_id", "name", "type", unique=True),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    type: Mapped[CategoryType] = mapped_column(
        SAEnum(CategoryType, name="category_type"),
        nullable=False,
    )
    color: Mapped[str] = mapped_column(String(7), server_default=text("'#64748b'"), nullable=False)
    is_custom: Mapped[bool] = mapped_column(Boolean, server_default=text("false"), nullable=False)
