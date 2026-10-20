import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models import Category
from app.repositories import category_repository
from app.schemas.account import CategoryCreate, CategoryUpdate


def _not_found() -> AppError:
    return AppError("Categoria no encontrada", 404, code="CATEGORY_NOT_FOUND")


def _exists() -> AppError:
    return AppError(
        "Ya existe una categoria con ese nombre y tipo",
        409,
        code="CATEGORY_EXISTS",
    )


def parse_category_id(raw_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(raw_id)
    except ValueError as exc:
        raise _not_found() from exc


async def _commit_category(db: AsyncSession) -> None:
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        if getattr(exc.orig, "sqlstate", None) != "23505":
            raise
        raise _exists() from exc


async def list_categories(db: AsyncSession, user_id: uuid.UUID) -> list[Category]:
    return list(await category_repository.list_by_user(db, user_id))


async def create_category(
    db: AsyncSession, user_id: uuid.UUID, payload: CategoryCreate
) -> Category:
    existing = await category_repository.find_by_unique(db, user_id, payload.name, payload.type)
    if existing is not None:
        raise _exists()
    category = await category_repository.create(
        db,
        user_id=user_id,
        name=payload.name,
        category_type=payload.type,
        color=payload.color,
    )
    await _commit_category(db)
    return category


async def get_category(db: AsyncSession, user_id: uuid.UUID, raw_id: str) -> Category:
    category = await category_repository.find_owned(db, parse_category_id(raw_id), user_id)
    if category is None:
        raise _not_found()
    return category


async def update_category(
    db: AsyncSession, user_id: uuid.UUID, raw_id: str, payload: CategoryUpdate
) -> Category:
    category = await get_category(db, user_id, raw_id)
    data = payload.model_dump(exclude_unset=True)
    new_name = data.get("name")
    if new_name is not None and new_name != category.name:
        duplicate = await category_repository.find_by_unique(
            db, user_id, str(new_name), category.type
        )
        if duplicate is not None:
            raise _exists()
    await category_repository.update(db, category, data)
    await _commit_category(db)
    return category


async def delete_category(db: AsyncSession, user_id: uuid.UUID, raw_id: str) -> None:
    category = await get_category(db, user_id, raw_id)
    await category_repository.delete(db, category)
    await db.commit()
