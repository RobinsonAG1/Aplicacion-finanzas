import uuid
from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import BillReminder, Category, RecurringBill, Transaction
from app.db.models.enums import ReminderChannel, ReminderStatus


async def list_by_user(
    db: AsyncSession, user_id: uuid.UUID, is_active: bool | None = None
) -> Sequence[tuple[RecurringBill, Category | None, Transaction | None]]:
    statement = (
        select(RecurringBill, Category, Transaction)
        .outerjoin(Category, RecurringBill.category_id == Category.id)
        .outerjoin(Transaction, RecurringBill.source_transaction_id == Transaction.id)
        .where(RecurringBill.user_id == user_id)
    )
    if is_active is not None:
        statement = statement.where(RecurringBill.is_active.is_(is_active))
    result = await db.execute(statement.order_by(RecurringBill.due_day.asc()))
    return [(row[0], row[1], row[2]) for row in result.all()]


async def find_owned(
    db: AsyncSession, bill_id: uuid.UUID, user_id: uuid.UUID
) -> tuple[RecurringBill, Category | None, Transaction | None] | None:
    result = await db.execute(
        select(RecurringBill, Category, Transaction)
        .outerjoin(Category, RecurringBill.category_id == Category.id)
        .outerjoin(Transaction, RecurringBill.source_transaction_id == Transaction.id)
        .where(RecurringBill.id == bill_id, RecurringBill.user_id == user_id)
    )
    row = result.first()
    if row is None:
        return None
    return row[0], row[1], row[2]


async def create(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    name: str,
    amount: Decimal,
    category_id: uuid.UUID | None,
    due_day: int,
    is_active: bool,
) -> RecurringBill:
    bill = RecurringBill(
        id=uuid.uuid4(),
        user_id=user_id,
        name=name,
        amount=amount,
        category_id=category_id,
        due_day=due_day,
        is_active=is_active,
    )
    db.add(bill)
    return bill


async def apply_changes(db: AsyncSession, bill: RecurringBill, data: dict[str, object]) -> None:
    for key, value in data.items():
        setattr(bill, key, value)


async def delete(db: AsyncSession, bill: RecurringBill) -> None:
    await db.delete(bill)


async def list_reminders(db: AsyncSession, bill_id: uuid.UUID) -> Sequence[BillReminder]:
    result = await db.execute(
        select(BillReminder)
        .where(BillReminder.bill_id == bill_id)
        .order_by(BillReminder.due_date.desc())
    )
    return result.scalars().all()


async def find_reminder(
    db: AsyncSession, bill_id: uuid.UUID, due_date: datetime
) -> BillReminder | None:
    result = await db.execute(
        select(BillReminder).where(
            BillReminder.bill_id == bill_id,
            BillReminder.due_date == due_date,
        )
    )
    return result.scalar_one_or_none()


async def create_reminder(
    db: AsyncSession,
    *,
    bill_id: uuid.UUID,
    due_date: datetime,
    channel: ReminderChannel,
    status: ReminderStatus,
    sent_at: datetime | None,
) -> BillReminder:
    reminder = BillReminder(
        id=uuid.uuid4(),
        bill_id=bill_id,
        due_date=due_date,
        channel=channel,
        status=status,
        sent_at=sent_at,
    )
    db.add(reminder)
    return reminder


async def set_source_transaction(
    db: AsyncSession, bill: RecurringBill, transaction_id: uuid.UUID
) -> None:
    bill.source_transaction_id = transaction_id
