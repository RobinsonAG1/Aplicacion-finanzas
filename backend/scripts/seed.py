import asyncio
import calendar
import os
import random
import uuid
from datetime import UTC, date, datetime, time
from decimal import Decimal

from app.core.config import settings
from app.core.security import hash_password
from app.db.models import (
    Account,
    BillReminder,
    Budget,
    Category,
    Pot,
    PotTransaction,
    RecurringBill,
    RefreshToken,
    Transaction,
    User,
)
from app.db.models.enums import (
    AccountType,
    BudgetPeriod,
    CategoryType,
    PotTransactionType,
    ReminderChannel,
    ReminderStatus,
    TransactionType,
)
from app.db.session import SessionLocal, dispose_engine
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

DEMO_EMAIL = "demo@finanzas.test"
DEMO_PASSWORD = "Demo1234!"

EXPENSE_CATEGORIES = [
    ("Alimentacion", "#16a34a"),
    ("Restaurantes", "#f97316"),
    ("Transporte", "#0ea5e9"),
    ("Vivienda", "#8b5cf6"),
    ("Servicios", "#eab308"),
    ("Entretenimiento", "#ec4899"),
    ("Salud", "#ef4444"),
    ("Educacion", "#6366f1"),
    ("Compras", "#14b8a6"),
    ("Suscripciones", "#a855f7"),
]

INCOME_CATEGORIES = [
    ("Salario", "#22c55e"),
    ("Freelance", "#10b981"),
    ("Intereses", "#84cc16"),
]

ACCOUNTS = [
    ("Bancolombia Ahorros", AccountType.SAVINGS, Decimal("3500000")),
    ("Nequi", AccountType.CASH, Decimal("4000000")),
    ("Davivienda Corriente", AccountType.CHECKING, Decimal("1500000")),
    ("Efectivo", AccountType.CASH, Decimal("3000000")),
    ("Nu Tarjeta de Credito", AccountType.CREDIT, Decimal("-1200000")),
    ("Inversion CDT", AccountType.INVESTMENT, Decimal("8000000")),
]

RECURRING = [
    ("Arriendo", 1400000, "Vivienda", 5, "Bancolombia Ahorros"),
    ("Claro Internet", 120000, "Servicios", 15, "Bancolombia Ahorros"),
    ("Enel (energia)", 180000, "Servicios", 18, "Bancolombia Ahorros"),
    ("EPM (agua)", 90000, "Servicios", 20, "Bancolombia Ahorros"),
    ("Vanti (gas)", 45000, "Servicios", 22, "Nequi"),
    ("Movistar Plan celular", 65000, "Servicios", 25, "Nequi"),
    ("Netflix", 44900, "Suscripciones", 10, "Nequi"),
    ("Spotify", 24900, "Suscripciones", 12, "Nequi"),
]

VARIABLE = [
    (
        "Alimentacion",
        ["Exito", "D1", "Ara", "Olimpica", "Carulla", "Jumbo"],
        40000,
        180000,
        4,
        7,
    ),
    (
        "Restaurantes",
        ["Rappi", "Domino's", "KFC", "Crepes & Waffles", "El Corral", "McDonald's"],
        25000,
        90000,
        3,
        6,
    ),
    (
        "Transporte",
        ["Uber", "DiDi", "TuLlave SITP", "Terpel", "Primax", "Cabify"],
        5000,
        60000,
        6,
        10,
    ),
    (
        "Entretenimiento",
        ["Cine Colombia", "Steam", "Panamericana", "Ticket Express"],
        20000,
        120000,
        1,
        3,
    ),
    (
        "Compras",
        ["Falabella", "MercadoLibre", "Alkosto", "Homecenter"],
        60000,
        350000,
        1,
        3,
    ),
    (
        "Salud",
        ["Cruz Verde", "Farmatodo", "Drogas La Rebaja", "EPS Sura"],
        20000,
        150000,
        0,
        2,
    ),
    (
        "Educacion",
        ["Platzi", "Udemy", "Coursera", "Sena"],
        50000,
        200000,
        0,
        1,
    ),
]

VARIABLE_ACCOUNTS = ["Nequi", "Davivienda Corriente", "Efectivo", "Bancolombia Ahorros"]
BUDGETS = [
    ("Alimentacion", Decimal("900000")),
    ("Restaurantes", Decimal("500000")),
    ("Transporte", Decimal("400000")),
    ("Entretenimiento", Decimal("300000")),
    ("Compras", Decimal("700000")),
    ("Servicios", Decimal("600000")),
]
POTS = [
    ("Viaje a San Andres", Decimal("2000000"), [300000, 250000, 200000]),
    ("Fondo de emergencia", Decimal("6000000"), [800000, 600000, 400000]),
    ("Computador nuevo", Decimal("4000000"), [500000, 300000, 100000]),
]

rng = random.Random(20261017)


def round_cop(value: int) -> Decimal:
    return Decimal(round(value / 100) * 100)


def random_int(minimum: int, maximum: int) -> int:
    return rng.randint(minimum, maximum)


def pick(values: list[str]) -> str:
    return rng.choice(values)


def day_in_month(year: int, month: int, day: int) -> datetime:
    last_day = calendar.monthrange(year, month)[1]
    return datetime(year, month, min(day, last_day), tzinfo=UTC)


def clamp_day(day: int, is_current: bool, today_day: int) -> int:
    return min(day, today_day) if is_current else day


async def clear_data(db: AsyncSession) -> None:
    for model in (
        BillReminder,
        RecurringBill,
        PotTransaction,
        Pot,
        Budget,
        Transaction,
        Category,
        Account,
        RefreshToken,
        User,
    ):
        await db.execute(delete(model))
    await db.commit()


async def seed(db: AsyncSession) -> dict[str, int]:
    if settings.is_production and os.environ.get("SEED_FORCE") != "true":
        raise RuntimeError(
            "El seed borra todos los datos y no puede ejecutarse en produccion. "
            "Define SEED_FORCE=true para forzarlo conscientemente."
        )

    print("Limpiando datos previos...")
    await clear_data(db)

    print("Creando usuario demo...")
    user = User(
        id=uuid.uuid4(),
        email=DEMO_EMAIL,
        name="Usuario Demo",
        password_hash=await hash_password(DEMO_PASSWORD),
    )
    db.add(user)
    await db.flush()

    print("Creando categorias...")
    category_by_name: dict[str, Category] = {}
    for name, color in EXPENSE_CATEGORIES:
        category = Category(
            id=uuid.uuid4(),
            user_id=user.id,
            name=name,
            type=CategoryType.EXPENSE,
            color=color,
        )
        db.add(category)
        category_by_name[name] = category
    for name, color in INCOME_CATEGORIES:
        category = Category(
            id=uuid.uuid4(),
            user_id=user.id,
            name=name,
            type=CategoryType.INCOME,
            color=color,
        )
        db.add(category)
        category_by_name[name] = category

    print("Creando cuentas...")
    account_by_name: dict[str, Account] = {}
    for name, account_type, base in ACCOUNTS:
        account = Account(
            id=uuid.uuid4(),
            user_id=user.id,
            name=name,
            type=account_type,
            balance=base,
            currency="COP",
        )
        db.add(account)
        account_by_name[name] = account
    await db.flush()

    today = datetime.now(UTC).date()
    transactions: list[Transaction] = []
    net_by_account: dict[str, Decimal] = {}

    for offset in range(5, -1, -1):
        total_months = today.year * 12 + (today.month - 1) - offset
        year, month_index = divmod(total_months, 12)
        month = month_index + 1
        last_day = calendar.monthrange(year, month)[1]
        is_current = offset == 0

        def add_transaction(
            account_name: str,
            category_name: str,
            amount: Decimal,
            transaction_type: TransactionType,
            description: str,
            merchant: str,
            transaction_date: date,
        ) -> None:
            account = account_by_name[account_name]
            category = category_by_name[category_name]
            transactions.append(
                Transaction(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    account_id=account.id,
                    category_id=category.id,
                    amount=amount,
                    type=transaction_type,
                    description=description,
                    merchant=merchant,
                    date=datetime.combine(transaction_date, time.min, tzinfo=UTC),
                )
            )
            signed = amount if transaction_type == TransactionType.INCOME else -amount
            net_by_account[account_name] = net_by_account.get(account_name, Decimal(0)) + signed

        salary_accounts = ["Bancolombia Ahorros", "Davivienda Corriente"]
        for index, day in enumerate([15, 30]):
            if day > last_day or (is_current and day > today.day):
                continue
            add_transaction(
                salary_accounts[index],
                "Salario",
                Decimal("2000000"),
                TransactionType.INCOME,
                "Pago de nomina",
                "Empleador S.A.S.",
                date(year, month, day),
            )

        interest = round_cop(random_int(25000, 60000))
        add_transaction(
            "Inversion CDT",
            "Intereses",
            interest,
            TransactionType.INCOME,
            "Rendimiento CDT",
            "Banco CDT",
            date(year, month, clamp_day(28, is_current, today.day)),
        )

        if rng.random() < 0.4:
            add_transaction(
                "Bancolombia Ahorros",
                "Freelance",
                round_cop(random_int(400000, 1500000)),
                TransactionType.INCOME,
                "Proyecto freelance",
                "Cliente Freelance",
                date(year, month, clamp_day(random_int(3, 26), is_current, today.day)),
            )

        for name, amount, category_name, due_day, account_name in RECURRING:
            if is_current and due_day > today.day:
                continue
            add_transaction(
                account_name,
                category_name,
                Decimal(amount),
                TransactionType.EXPENSE,
                f"Pago {name}",
                name.split(" ", 1)[0],
                date(year, month, due_day),
            )

        for category_name, merchants, minimum, maximum, min_count, max_count in VARIABLE:
            count = random_int(min_count, max_count)
            for _ in range(count):
                day = random_int(1, last_day)
                if is_current and day > today.day:
                    continue
                merchant = pick(merchants)
                add_transaction(
                    pick(VARIABLE_ACCOUNTS),
                    category_name,
                    round_cop(random_int(minimum, maximum)),
                    TransactionType.EXPENSE,
                    f"Compra en {merchant}",
                    merchant,
                    date(year, month, day),
                )

    print(f"Insertando {len(transactions)} transacciones...")
    db.add_all(transactions)
    for name, _, base in ACCOUNTS:
        account_by_name[name].balance = base + net_by_account.get(name, Decimal(0))

    month_start = datetime(today.year, today.month, 1, tzinfo=UTC)
    month_end = datetime(
        today.year,
        today.month,
        calendar.monthrange(today.year, today.month)[1],
        tzinfo=UTC,
    )
    print("Creando presupuestos...")
    for category_name, limit_amount in BUDGETS:
        db.add(
            Budget(
                id=uuid.uuid4(),
                user_id=user.id,
                category_id=category_by_name[category_name].id,
                limit_amount=limit_amount,
                period=BudgetPeriod.MONTHLY,
                start_date=month_start,
                end_date=month_end,
            )
        )

    print("Creando metas de ahorro (pots)...")
    saved_pots: list[tuple[Pot, list[int]]] = []
    for name, target, deposits in POTS:
        pot = Pot(
            id=uuid.uuid4(),
            user_id=user.id,
            name=name,
            target_amount=target,
            current_amount=Decimal(0),
        )
        db.add(pot)
        saved_pots.append((pot, deposits))
    await db.flush()

    for pot, deposits in saved_pots:
        current = Decimal(0)
        for amount in deposits:
            current += Decimal(amount)
            db.add(
                PotTransaction(
                    id=uuid.uuid4(),
                    pot_id=pot.id,
                    amount=Decimal(amount),
                    type=PotTransactionType.DEPOSIT,
                    note="Aporte",
                )
            )
        pot.current_amount = current

    print("Creando facturas recurrentes y recordatorios...")
    saved_bills: list[tuple[RecurringBill, int]] = []
    for name, amount, category_name, due_day, _ in RECURRING:
        bill = RecurringBill(
            id=uuid.uuid4(),
            user_id=user.id,
            name=name,
            amount=Decimal(amount),
            category_id=category_by_name[category_name].id,
            due_day=due_day,
            is_active=True,
        )
        db.add(bill)
        saved_bills.append((bill, due_day))
    await db.flush()

    for bill, due_day in saved_bills:
        db.add(
            BillReminder(
                id=uuid.uuid4(),
                bill_id=bill.id,
                due_date=day_in_month(today.year, today.month, due_day),
                channel=ReminderChannel.LOG,
                status=ReminderStatus.PENDING,
            )
        )

    await db.commit()
    return {
        "accounts": len(ACCOUNTS),
        "categories": len(EXPENSE_CATEGORIES) + len(INCOME_CATEGORIES),
        "transactions": len(transactions),
        "budgets": len(BUDGETS),
        "pots": len(POTS),
        "bills": len(RECURRING),
    }


async def main() -> None:
    async with SessionLocal() as db:
        summary = await seed(db)
    await dispose_engine()
    print("Seed completado:", {"user": DEMO_EMAIL, **summary})


if __name__ == "__main__":
    asyncio.run(main())
