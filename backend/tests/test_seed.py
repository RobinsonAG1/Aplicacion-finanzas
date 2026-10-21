import uuid

from app.db.models import Transaction, User
from app.db.session import SessionLocal
from scripts.seed import DEMO_EMAIL, seed
from sqlalchemy import func, select


async def test_seed_if_missing_preserves_existing_users_and_is_idempotent() -> None:
    async with SessionLocal() as db:
        db.add(
            User(
                id=uuid.uuid4(),
                email="existing@finanzas.test",
                name="Usuario Existente",
                password_hash="unused",
            )
        )
        await db.commit()

        await seed(db, clear_existing=False)
        first_transaction_count = await db.scalar(select(func.count()).select_from(Transaction))

        await seed(db, clear_existing=False)
        second_transaction_count = await db.scalar(select(func.count()).select_from(Transaction))
        users = set(await db.scalars(select(User.email)))

    assert first_transaction_count is not None and first_transaction_count > 0
    assert second_transaction_count == first_transaction_count
    assert users == {"existing@finanzas.test", DEMO_EMAIL}
