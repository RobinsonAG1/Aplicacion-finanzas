import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Wallet


async def find_by_user(db: AsyncSession, user_id: uuid.UUID) -> Wallet | None:
    result = await db.execute(select(Wallet).where(Wallet.user_id == user_id))
    return result.scalar_one_or_none()


async def create(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    address: str,
    encrypted_private_key: str,
    chain_id: int,
) -> Wallet:
    wallet = Wallet(
        id=uuid.uuid4(),
        user_id=user_id,
        address=address,
        encrypted_private_key=encrypted_private_key,
        chain_id=chain_id,
    )
    db.add(wallet)
    return wallet
