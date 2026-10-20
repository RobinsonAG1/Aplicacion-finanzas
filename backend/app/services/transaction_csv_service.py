import re
import unicodedata
import uuid
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models import Account, Category
from app.db.models.enums import TransactionType
from app.repositories import (
    account_repository,
    category_repository,
    transaction_repository,
)
from app.schemas.transaction import TransactionCreate
from app.schemas.transaction_csv import ImportRowError, ImportSummary
from app.services import transaction_service
from app.utils.csv import parse_csv, to_csv

CSV_HEADER = ["fecha", "tipo", "monto", "cuenta", "categoria", "comercio", "descripcion"]
MAX_IMPORT_ROWS = 5000
MAX_IMPORT_FIELD_LENGTH = 2000

COLUMN_ALIASES = {
    "fecha": "date",
    "date": "date",
    "monto": "amount",
    "valor": "amount",
    "amount": "amount",
    "tipo": "type",
    "type": "type",
    "cuenta": "account",
    "account": "account",
    "categoria": "category",
    "category": "category",
    "comercio": "merchant",
    "merchant": "merchant",
    "descripcion": "description",
    "detalle": "description",
    "description": "description",
}

TYPE_ALIASES = {
    "ingreso": TransactionType.INCOME,
    "ingresos": TransactionType.INCOME,
    "income": TransactionType.INCOME,
    "entrada": TransactionType.INCOME,
    "gasto": TransactionType.EXPENSE,
    "gastos": TransactionType.EXPENSE,
    "expense": TransactionType.EXPENSE,
    "egreso": TransactionType.EXPENSE,
    "salida": TransactionType.EXPENSE,
    "transferencia": TransactionType.TRANSFER,
    "transfer": TransactionType.TRANSFER,
}

TYPE_LABELS = {
    TransactionType.INCOME: "ingreso",
    TransactionType.EXPENSE: "gasto",
    TransactionType.TRANSFER: "transferencia",
}


def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value)
    return (
        "".join(character for character in decomposed if not unicodedata.combining(character))
        .strip()
        .lower()
    )


def parse_amount(raw: str) -> Decimal | None:
    text = re.sub(r"[^\d.,-]", "", raw)
    last_comma = text.rfind(",")
    last_dot = text.rfind(".")
    if last_comma > -1 and last_dot > -1:
        if last_comma > last_dot:
            text = text.replace(".", "").replace(",", ".", 1)
        else:
            text = text.replace(",", "")
    elif last_comma > -1:
        decimals = len(text) - last_comma - 1
        if decimals == 3 and re.fullmatch(r"-?\d{1,3}(,\d{3})+", text):
            text = text.replace(",", "")
        else:
            text = text.replace(",", ".", 1)
    elif last_dot > -1:
        decimals = len(text) - last_dot - 1
        if decimals == 3 and re.fullmatch(r"-?\d{1,3}(\.\d{3})+", text):
            text = text.replace(".", "")
    if not text:
        return Decimal(0)
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def parse_date(raw: str) -> datetime | None:
    text = raw.strip()
    match = re.fullmatch(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})", text)
    if match is not None:
        day, month, year = (int(part) for part in match.groups())
        try:
            return datetime(year, month, day, tzinfo=UTC)
        except ValueError:
            return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def resolve_type(raw: str, amount: Decimal) -> TransactionType:
    mapped = TYPE_ALIASES.get(normalize(raw))
    if mapped is not None:
        return mapped
    if normalize(raw) == "" and amount < 0:
        return TransactionType.EXPENSE
    return TransactionType.EXPENSE


def _dedup_key(
    account_id: uuid.UUID,
    date: datetime,
    amount: Decimal,
    transaction_type: TransactionType,
    merchant: str | None,
) -> str:
    day = date.astimezone(UTC).date().isoformat()
    amount_text = f"{amount.quantize(Decimal('0.01')):.2f}"
    return "|".join(
        [
            str(account_id),
            day,
            amount_text,
            transaction_type.value,
            (merchant or "").lower(),
        ]
    )


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _find_category(
    categories: list[Category],
    raw_name: str,
    transaction_type: TransactionType,
) -> Category | None:
    normalized = normalize(raw_name)
    if not normalized:
        return None

    def matches(category: Category, *, strict: bool) -> bool:
        if normalize(category.name) != normalized:
            return False
        return not strict or category.type.value == transaction_type.value

    for category in categories:
        if matches(category, strict=True):
            return category
    for category in categories:
        if matches(category, strict=False):
            return category
    return None


def _resolve_account(
    raw: str,
    by_name: dict[str, Account],
    by_id: dict[str, Account],
) -> Account | None:
    account = by_name.get(normalize(raw)) if raw else None
    return account if account is not None else by_id.get(raw)


def _cell(raw: list[str], index: dict[str, int], field: str) -> str:
    position = index.get(field)
    if position is None or position >= len(raw):
        return ""
    return raw[position].strip()


async def export_csv(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    search: str | None,
    category_id: str | None,
    account_id: str | None,
    transaction_type: TransactionType | None,
    date_from: datetime | None,
    date_to: datetime | None,
) -> str:
    filters = transaction_repository.TransactionFilters(
        search=search.strip() if search else None,
        category_id=category_id,
        account_id=account_id,
        transaction_type=transaction_type,
        date_from=_utc(date_from),
        date_to=_utc(date_to),
    )
    rows = await transaction_repository.find_for_export(db, user_id, filters)
    data = [
        [
            transaction.date.astimezone(UTC).date().isoformat(),
            TYPE_LABELS[transaction.type],
            f"{transaction.amount:.2f}",
            account.name,
            category.name if category is not None else "",
            transaction.merchant or "",
            transaction.description or "",
        ]
        for transaction, category, account in rows
    ]
    return "\ufeff" + to_csv(CSV_HEADER, data)


async def import_csv(db: AsyncSession, user_id: uuid.UUID, csv_text: str) -> ImportSummary:
    parsed = parse_csv(csv_text)
    if not parsed:
        raise AppError("El archivo CSV esta vacio", 400, code="CSV_EMPTY")

    index: dict[str, int] = {}
    for position, cell in enumerate(parsed[0]):
        field = COLUMN_ALIASES.get(normalize(cell))
        if field is not None and field not in index:
            index[field] = position
    if "date" not in index or "amount" not in index:
        raise AppError(
            'El CSV debe incluir las columnas "fecha" y "monto"',
            400,
            code="CSV_MISSING_COLUMNS",
        )
    if len(parsed) - 1 > MAX_IMPORT_ROWS:
        raise AppError(
            f"El CSV supera el maximo de {MAX_IMPORT_ROWS} filas",
            400,
            code="CSV_TOO_MANY_ROWS",
        )

    accounts = list(await account_repository.list_by_user(db, user_id))
    categories = list(await category_repository.list_by_user(db, user_id))
    account_by_name = {normalize(account.name): account for account in accounts}
    account_by_id = {str(account.id): account for account in accounts}

    existing = await transaction_repository.find_existing_keys(
        db, user_id, [account.id for account in accounts]
    )
    seen = {
        _dedup_key(account_id, date, amount, transaction_type, merchant)
        for account_id, date, amount, transaction_type, merchant in existing
    }

    summary = ImportSummary(total=0, imported=0, skipped=0, errors=[])
    for row_number, raw in enumerate(parsed[1:], start=2):
        if all(cell.strip() == "" for cell in raw):
            continue
        summary.total += 1

        if any(len(cell) > MAX_IMPORT_FIELD_LENGTH for cell in raw):
            summary.errors.append(ImportRowError(row=row_number, message="campo demasiado largo"))
            continue

        try:
            date = parse_date(_cell(raw, index, "date"))
            if date is None:
                raise ValueError("fecha invalida")

            parsed_amount = parse_amount(_cell(raw, index, "amount"))
            if parsed_amount is None or not parsed_amount.is_finite() or parsed_amount == 0:
                raise ValueError("monto invalido")
            transaction_type = resolve_type(_cell(raw, index, "type"), parsed_amount)
            amount = abs(parsed_amount)

            account_raw = _cell(raw, index, "account")
            account = _resolve_account(account_raw, account_by_name, account_by_id)
            if account is None:
                if account_raw:
                    raise ValueError(f'cuenta no encontrada: "{account_raw}"')
                raise ValueError("cuenta requerida")

            category = _find_category(categories, _cell(raw, index, "category"), transaction_type)
            merchant = _cell(raw, index, "merchant") or None
            description = _cell(raw, index, "description") or None

            key = _dedup_key(account.id, date, amount, transaction_type, merchant)
            if key in seen:
                summary.skipped += 1
                continue

            await transaction_service.create_transaction(
                db,
                user_id,
                TransactionCreate(
                    account_id=str(account.id),
                    category_id=str(category.id) if category is not None else None,
                    amount=amount,
                    type=transaction_type,
                    description=description,
                    merchant=merchant,
                    date=date,
                ),
            )
            seen.add(key)
            summary.imported += 1
        except Exception as exc:
            summary.errors.append(
                ImportRowError(
                    row=row_number,
                    message=str(exc) or "Error desconocido",
                )
            )

    return summary
