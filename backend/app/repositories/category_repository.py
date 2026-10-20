import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Category
from app.db.models.enums import CategoryType


async def list_by_user(
    db: AsyncSession, user_id: uuid.UUID, category_type: CategoryType | None = None
) -> Sequence[Category]:
    statement = select(Category).where(Category.user_id == user_id)
    if category_type is not None:
        statement = statement.where(Category.type == category_type)
    result = await db.execute(statement.order_by(Category.type.asc(), Category.name.asc()))
    return result.scalars().all()


async def find_owned(
    db: AsyncSession, category_id: uuid.UUID, user_id: uuid.UUID
) -> Category | None:
    result = await db.execute(
        select(Category).where(
            Category.id == category_id,
            Category.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def find_by_unique(
    db: AsyncSession, user_id: uuid.UUID, name: str, category_type: CategoryType
) -> Category | None:
    result = await db.execute(
        select(Category).where(
            Category.user_id == user_id,
            Category.name == name,
            Category.type == category_type,
        )
    )
    return result.scalar_one_or_none()


async def create(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    name: str,
    category_type: CategoryType,
    color: str,
) -> Category:
    category = Category(
        id=uuid.uuid4(),
        user_id=user_id,
        name=name,
        type=category_type,
        color=color,
        is_custom=True,
    )
    db.add(category)
    return category


async def update(db: AsyncSession, category: Category, data: dict[str, object]) -> Category:
    for key, value in data.items():
        setattr(category, key, value)
    return category


async def delete(db: AsyncSession, category: Category) -> None:
    await db.delete(category)
