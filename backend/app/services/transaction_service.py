import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models import Account, Category, Transaction
from app.db.models.enums import TransactionType
from app.repositories import (
    account_repository,
    category_repository,
    transaction_repository,
)
from app.schemas.transaction import (
    AccountBrief,
    CategoryBrief,
    PaginationMeta,
    SetCategoryRequest,
    Suggestion,
    SuggestionCategory,
    SuggestionsResponse,
    TransactionCreate,
    TransactionListResponse,
    TransactionPublic,
    TransactionUpdate,
)


def _not_found() -> AppError:
    return AppError("Transaccion no encontrada", 404, code="TRANSACTION_NOT_FOUND")


def _account_not_found() -> AppError:
    return AppError("Cuenta no encontrada", 404, code="ACCOUNT_NOT_FOUND")


def _category_not_found() -> AppError:
    return AppError("Categoria no encontrada", 404, code="CATEGORY_NOT_FOUND")


def _parse_uuid(value: str | None) -> uuid.UUID | None:
    if value is None:
        return None
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


def _signed(transaction_type: TransactionType, amount: Decimal) -> Decimal:
    return amount if transaction_type == TransactionType.INCOME else -amount


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


async def _ensure_account(db: AsyncSession, user_id: uuid.UUID, raw_id: str) -> uuid.UUID:
    account_id = _parse_uuid(raw_id)
    if account_id is None:
        raise _account_not_found()
    account = await account_repository.find_owned(db, account_id, user_id)
    if account is None:
        raise _account_not_found()
    return account_id


async def _ensure_category(db: AsyncSession, user_id: uuid.UUID, raw_id: str) -> uuid.UUID:
    category_id = _parse_uuid(raw_id)
    if category_id is None:
        raise _category_not_found()
    category = await category_repository.find_owned(db, category_id, user_id)
    if category is None:
        raise _category_not_found()
    return category_id


def _public(
    transaction: Transaction, category: Category | None, account: Account
) -> TransactionPublic:
    return TransactionPublic(
        id=transaction.id,
        user_id=transaction.user_id,
        account_id=transaction.account_id,
        category_id=transaction.category_id,
        amount=transaction.amount,
        type=transaction.type,
        description=transaction.description,
        merchant=transaction.merchant,
        date=transaction.date,
        created_at=transaction.created_at,
        updated_at=transaction.updated_at,
        category=CategoryBrief.model_validate(category) if category else None,
        account=AccountBrief(
            id=account.id,
            name=account.name,
            type=account.type.value,
            currency=account.currency,
        ),
    )


async def _load(
    db: AsyncSession, transaction_id: uuid.UUID, user_id: uuid.UUID
) -> TransactionPublic:
    row = await transaction_repository.load_with_relations(db, transaction_id, user_id)
    if row is None:
        raise _not_found()
    return _public(*row)


async def list_transactions(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    page: int,
    limit: int,
    search: str | None,
    sort: str,
    order: str,
    category_id: str | None,
    account_id: str | None,
    transaction_type: TransactionType | None,
    date_from: datetime | None,
    date_to: datetime | None,
) -> TransactionListResponse:
    filters = transaction_repository.TransactionFilters(
        search=search.strip() if search else None,
        category_id=category_id,
        account_id=account_id,
        transaction_type=transaction_type,
        date_from=_utc(date_from),
        date_to=_utc(date_to),
    )
    rows, total = await transaction_repository.list_transactions(
        db,
        user_id,
        filters,
        sort=sort,  # type: ignore[arg-type]
        order=order,  # type: ignore[arg-type]
        page=page,
        limit=limit,
    )
    items = [_public(*row) for row in rows]
    return TransactionListResponse(
        data=items,
        meta=PaginationMeta(
            total=total,
            page=page,
            limit=limit,
            total_pages=-(-total // limit),
        ),
    )


async def get_transaction(db: AsyncSession, user_id: uuid.UUID, raw_id: str) -> TransactionPublic:
    transaction_id = _parse_uuid(raw_id)
    if transaction_id is None:
        raise _not_found()
    return await _load(db, transaction_id, user_id)


async def create_transaction(
    db: AsyncSession, user_id: uuid.UUID, payload: TransactionCreate
) -> TransactionPublic:
    account_id = await _ensure_account(db, user_id, payload.account_id)
    category_id: uuid.UUID | None = None
    if payload.category_id is not None:
        category_id = await _ensure_category(db, user_id, payload.category_id)

    transaction = await transaction_repository.create(
        db,
        user_id=user_id,
        account_id=account_id,
        category_id=category_id,
        amount=payload.amount,
        transaction_type=payload.type,
        description=payload.description,
        merchant=payload.merchant,
        date=payload.date,
    )
    await transaction_repository.adjust_balance(
        db, account_id, _signed(payload.type, payload.amount)
    )
    await db.commit()
    return await _load(db, transaction.id, user_id)


async def update_transaction(
    db: AsyncSession, user_id: uuid.UUID, raw_id: str, payload: TransactionUpdate
) -> TransactionPublic:
    transaction_id = _parse_uuid(raw_id)
    if transaction_id is None:
        raise _not_found()
    existing = await transaction_repository.find_owned(db, transaction_id, user_id)
    if existing is None:
        raise _not_found()

    fields = payload.model_dump(exclude_unset=True)
    target_account_id = existing.account_id
    if "account_id" in fields:
        target_account_id = await _ensure_account(db, user_id, str(fields["account_id"]))

    target_category_id = existing.category_id
    if "category_id" in fields:
        raw_category = fields["category_id"]
        target_category_id = (
            None if raw_category is None else await _ensure_category(db, user_id, str(raw_category))
        )
    elif existing.category_id is not None:
        target_category_id = existing.category_id

    new_amount: Decimal = fields.get("amount", existing.amount)
    new_type: TransactionType = fields.get("type", existing.type)

    await transaction_repository.adjust_balance(
        db, existing.account_id, -_signed(existing.type, existing.amount)
    )
    await transaction_repository.adjust_balance(
        db, target_account_id, _signed(new_type, new_amount)
    )

    data: dict[str, object] = {
        "account_id": target_account_id,
        "category_id": target_category_id,
        "amount": new_amount,
        "type": new_type,
    }
    if "description" in fields:
        data["description"] = fields["description"]
    if "merchant" in fields:
        data["merchant"] = fields["merchant"]
    if "date" in fields:
        data["date"] = fields["date"]
    await transaction_repository.apply_changes(db, existing, data)
    await db.commit()
    return await _load(db, transaction_id, user_id)


async def delete_transaction(db: AsyncSession, user_id: uuid.UUID, raw_id: str) -> None:
    transaction_id = _parse_uuid(raw_id)
    if transaction_id is None:
        raise _not_found()
    existing = await transaction_repository.find_owned(db, transaction_id, user_id)
    if existing is None:
        raise _not_found()
    await transaction_repository.adjust_balance(
        db, existing.account_id, -_signed(existing.type, existing.amount)
    )
    await transaction_repository.delete(db, existing)
    await db.commit()


async def set_category(
    db: AsyncSession,
    user_id: uuid.UUID,
    raw_id: str,
    payload: SetCategoryRequest,
) -> TransactionPublic:
    transaction_id = _parse_uuid(raw_id)
    if transaction_id is None:
        raise _not_found()
    existing = await transaction_repository.find_owned(db, transaction_id, user_id)
    if existing is None:
        raise _not_found()

    category_id: uuid.UUID | None = None
    if payload.category_id is not None:
        category_id = await _ensure_category(db, user_id, payload.category_id)

    await transaction_repository.apply_changes(db, existing, {"category_id": category_id})
    await db.commit()
    return await _load(db, transaction_id, user_id)


async def suggestions(db: AsyncSession, user_id: uuid.UUID, merchant: str) -> SuggestionsResponse:
    category_ids = await transaction_repository.recent_category_ids_by_merchant(
        db, user_id, merchant
    )
    total = len(category_ids)
    if total == 0:
        return SuggestionsResponse(suggestions=[])

    counts: dict[uuid.UUID, int] = {}
    for category_id in category_ids:
        counts[category_id] = counts.get(category_id, 0) + 1

    top = sorted(counts.items(), key=lambda item: item[1], reverse=True)[:3]
    categories = await transaction_repository.categories_by_ids(
        db, user_id, [category_id for category_id, _ in top]
    )
    by_id = {category.id: category for category in categories}

    suggestions: list[Suggestion] = []
    for category_id, count in top:
        category = by_id.get(category_id)
        if category is not None:
            suggestions.append(
                Suggestion(
                    category=SuggestionCategory.model_validate(category),
                    count=count,
                    confidence=round(count / total, 2),
                )
            )
    return SuggestionsResponse(suggestions=suggestions)
