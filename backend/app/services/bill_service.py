import calendar
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, time

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.logging import get_logger
from app.db.models import BillReminder, Category, RecurringBill, Transaction
from app.db.models.enums import (
    CategoryType,
    ReminderStatus,
    TransactionType,
)
from app.repositories import bill_repository, category_repository
from app.schemas.bill import (
    BillCreate,
    BillPay,
    BillPublic,
    BillUpdate,
    PayBillResult,
    ReminderCreate,
    ReminderPublic,
    RunReminders,
    RunRemindersResult,
    SourceTransactionBrief,
    UpcomingBill,
    UpcomingResponse,
)
from app.schemas.common import CategoryBrief
from app.schemas.transaction import TransactionCreate
from app.services import transaction_service

logger = get_logger(__name__)


@dataclass(frozen=True)
class BillTiming:
    due_date: date
    next_due_date: date
    days_until: int
    overdue: bool


def _not_found() -> AppError:
    return AppError("Factura no encontrada", 404, code="BILL_NOT_FOUND")


def _parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise _not_found() from exc


def _today() -> date:
    return datetime.now(UTC).date()


def _to_datetime(value: date) -> datetime:
    return datetime.combine(value, time.min, tzinfo=UTC)


def _start_of_day(value: datetime) -> datetime:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    else:
        value = value.astimezone(UTC)
    return datetime.combine(value.date(), time.min, tzinfo=UTC)


def _clamp_due_date(year: int, month: int, due_day: int) -> date:
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(due_day, last_day))


def _next_month(year: int, month: int) -> tuple[int, int]:
    return (year + 1, 1) if month == 12 else (year, month + 1)


def _timing(bill: RecurringBill, source: Transaction | None, today: date) -> BillTiming:
    this_month_due = _clamp_due_date(today.year, today.month, bill.due_day)
    passed_this_month = today > this_month_due
    next_year, next_month = _next_month(today.year, today.month)
    next_due_date = (
        _clamp_due_date(next_year, next_month, bill.due_day)
        if passed_this_month
        else this_month_due
    )
    paid_this_month = bool(source is not None and source.date.date() >= this_month_due)
    overdue = bill.is_active and passed_this_month and not paid_this_month
    due_date = this_month_due if overdue else next_due_date
    return BillTiming(
        due_date=due_date,
        next_due_date=next_due_date,
        days_until=(due_date - today).days,
        overdue=overdue,
    )


def _source_brief(source: Transaction | None) -> SourceTransactionBrief | None:
    if source is None:
        return None
    return SourceTransactionBrief(
        id=source.id,
        date=source.date,
        amount=f"{source.amount:.2f}",
    )


def _public(
    bill: RecurringBill,
    category: Category | None,
    source: Transaction | None,
    today: date,
) -> BillPublic:
    timing = _timing(bill, source, today)
    return BillPublic(
        id=bill.id,
        name=bill.name,
        amount=f"{bill.amount:.2f}",
        due_day=bill.due_day,
        is_active=bill.is_active,
        category=CategoryBrief.model_validate(category) if category else None,
        source_transaction=_source_brief(source),
        next_due_date=_to_datetime(timing.next_due_date),
        days_until=timing.days_until,
        overdue=timing.overdue,
        created_at=bill.created_at,
        updated_at=bill.updated_at,
    )


async def _ensure_expense_category(db: AsyncSession, user_id: uuid.UUID, raw_id: str) -> uuid.UUID:
    try:
        category_id = uuid.UUID(raw_id)
    except ValueError as exc:
        raise AppError("Categoria no encontrada", 404, code="CATEGORY_NOT_FOUND") from exc
    category = await category_repository.find_owned(db, category_id, user_id)
    if category is None:
        raise AppError("Categoria no encontrada", 404, code="CATEGORY_NOT_FOUND")
    if category.type != CategoryType.EXPENSE:
        raise AppError(
            "Solo se asignan categorias de gasto a las facturas",
            422,
            code="BILL_INVALID_CATEGORY",
        )
    return category_id


async def _load(
    db: AsyncSession, bill_id: uuid.UUID, user_id: uuid.UUID
) -> tuple[RecurringBill, Category | None, Transaction | None]:
    row = await bill_repository.find_owned(db, bill_id, user_id)
    if row is None:
        raise _not_found()
    return row


async def list_bills(
    db: AsyncSession, user_id: uuid.UUID, is_active: bool | None
) -> list[BillPublic]:
    today = _today()
    rows = await bill_repository.list_by_user(db, user_id, is_active)
    return [_public(bill, category, source, today) for bill, category, source in rows]


async def get_bill(db: AsyncSession, user_id: uuid.UUID, raw_id: str) -> BillPublic:
    bill_id = _parse_uuid(raw_id)
    row = await _load(db, bill_id, user_id)
    return _public(*row, _today())


async def create_bill(db: AsyncSession, user_id: uuid.UUID, payload: BillCreate) -> BillPublic:
    category_id: uuid.UUID | None = None
    if payload.category_id is not None:
        category_id = await _ensure_expense_category(db, user_id, payload.category_id)
    bill = await bill_repository.create(
        db,
        user_id=user_id,
        name=payload.name,
        amount=payload.amount,
        category_id=category_id,
        due_day=payload.due_day,
        is_active=payload.is_active,
    )
    await db.commit()
    row = await _load(db, bill.id, user_id)
    return _public(*row, _today())


async def update_bill(
    db: AsyncSession, user_id: uuid.UUID, raw_id: str, payload: BillUpdate
) -> BillPublic:
    bill_id = _parse_uuid(raw_id)
    bill, _, _ = await _load(db, bill_id, user_id)
    fields = payload.model_dump(exclude_unset=True)

    data: dict[str, object] = {}
    for key in ("name", "amount", "due_day", "is_active"):
        if key in fields:
            data[key] = fields[key]
    if "category_id" in fields:
        raw_category = fields["category_id"]
        data["category_id"] = (
            None
            if raw_category is None
            else await _ensure_expense_category(db, user_id, str(raw_category))
        )

    await bill_repository.apply_changes(db, bill, data)
    await db.commit()
    row = await _load(db, bill_id, user_id)
    return _public(*row, _today())


async def delete_bill(db: AsyncSession, user_id: uuid.UUID, raw_id: str) -> None:
    bill_id = _parse_uuid(raw_id)
    bill, _, _ = await _load(db, bill_id, user_id)
    await bill_repository.delete(db, bill)
    await db.commit()


async def upcoming(db: AsyncSession, user_id: uuid.UUID, days: int) -> UpcomingResponse:
    today = _today()
    rows = await bill_repository.list_by_user(db, user_id, True)
    items: list[UpcomingBill] = []
    for bill, category, source in rows:
        timing = _timing(bill, source, today)
        if not timing.overdue and timing.days_until > days:
            continue
        items.append(
            UpcomingBill(
                id=bill.id,
                name=bill.name,
                amount=f"{bill.amount:.2f}",
                category=CategoryBrief.model_validate(category) if category else None,
                due_date=_to_datetime(timing.due_date),
                days_until=timing.days_until,
                overdue=timing.overdue,
            )
        )
    items.sort(key=lambda item: item.due_date)
    return UpcomingResponse(days=days, upcoming=items)


async def list_reminders(db: AsyncSession, user_id: uuid.UUID, raw_id: str) -> list[ReminderPublic]:
    bill_id = _parse_uuid(raw_id)
    await _load(db, bill_id, user_id)
    reminders = await bill_repository.list_reminders(db, bill_id)
    return [ReminderPublic.model_validate(reminder) for reminder in reminders]


async def create_reminder(
    db: AsyncSession, user_id: uuid.UUID, raw_id: str, payload: ReminderCreate
) -> ReminderPublic:
    bill_id = _parse_uuid(raw_id)
    bill, _, source = await _load(db, bill_id, user_id)
    today = _today()
    due_date = (
        _start_of_day(payload.due_date)
        if payload.due_date is not None
        else _to_datetime(_timing(bill, source, today).due_date)
    )

    existing = await bill_repository.find_reminder(db, bill_id, due_date)
    if existing is not None:
        raise AppError(
            "Ya existe un recordatorio para esa fecha",
            409,
            code="REMINDER_EXISTS",
        )

    sent_at = datetime.now(UTC) if payload.send else None
    reminder = await bill_repository.create_reminder(
        db,
        bill_id=bill_id,
        due_date=due_date,
        channel=payload.channel,
        status=ReminderStatus.SENT if payload.send else ReminderStatus.PENDING,
        sent_at=sent_at,
    )
    await db.commit()
    await db.refresh(reminder)
    if payload.send:
        logger.info(
            "Recordatorio de factura enviado (stub)",
            bill_id=str(bill_id),
            due_date=due_date.isoformat(),
            channel=payload.channel.value,
        )
    return ReminderPublic.model_validate(reminder)


async def run_reminders(
    db: AsyncSession, user_id: uuid.UUID, payload: RunReminders
) -> RunRemindersResult:
    today = _today()
    rows = await bill_repository.list_by_user(db, user_id, True)
    created: list[BillReminder] = []
    skipped = 0

    for bill, _, source in rows:
        timing = _timing(bill, source, today)
        if not timing.overdue and timing.days_until > payload.days:
            continue
        due_date = _to_datetime(timing.due_date)
        if await bill_repository.find_reminder(db, bill.id, due_date) is not None:
            skipped += 1
            continue
        reminder = await bill_repository.create_reminder(
            db,
            bill_id=bill.id,
            due_date=due_date,
            channel=payload.channel,
            status=ReminderStatus.SENT,
            sent_at=datetime.now(UTC),
        )
        created.append(reminder)
        logger.info(
            "Recordatorio de factura generado y enviado (stub)",
            bill_id=str(bill.id),
            due_date=due_date.isoformat(),
            channel=payload.channel.value,
        )

    await db.commit()
    for reminder in created:
        await db.refresh(reminder)
    return RunRemindersResult(
        created=len(created),
        skipped=skipped,
        reminders=[ReminderPublic.model_validate(reminder) for reminder in created],
    )


async def pay_bill(
    db: AsyncSession, user_id: uuid.UUID, raw_id: str, payload: BillPay
) -> PayBillResult:
    bill_id = _parse_uuid(raw_id)
    bill, _, _ = await _load(db, bill_id, user_id)
    transaction_payload = TransactionCreate(
        account_id=payload.account_id,
        category_id=str(bill.category_id) if bill.category_id is not None else None,
        amount=payload.amount if payload.amount is not None else bill.amount,
        type=TransactionType.EXPENSE,
        description=f"Pago {bill.name}",
        merchant=bill.name,
        date=payload.date if payload.date is not None else datetime.now(UTC),
    )
    transaction = await transaction_service.create_transaction(
        db, user_id, transaction_payload, commit=False
    )
    await bill_repository.set_source_transaction(db, bill, transaction.id)
    await db.commit()
    row = await _load(db, bill_id, user_id)
    return PayBillResult(
        bill=_public(*row, _today()),
        transaction=transaction,
    )
