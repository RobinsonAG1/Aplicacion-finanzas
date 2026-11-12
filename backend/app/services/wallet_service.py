import uuid

from cryptography.fernet import Fernet
from eth_account import Account
from sqlalchemy.ext.asyncio import AsyncSession
from web3 import Web3

from app.core.chain import ensure_blockchain_enabled, get_async_w3, load_fernet
from app.core.config import settings
from app.core.errors import AppError
from app.db.models import Wallet
from app.repositories import wallet_repository
from app.schemas.blockchain import WalletPublic


def decrypt_private_key(wallet: Wallet) -> str:
    return load_fernet().decrypt(wallet.encrypted_private_key.encode()).decode()


def _public(wallet: Wallet, balance_eth: str) -> WalletPublic:
    return WalletPublic(
        id=wallet.id,
        address=wallet.address,
        chain_id=wallet.chain_id,
        balance_eth=balance_eth,
        created_at=wallet.created_at,
    )


async def get_wallet_or_404(db: AsyncSession, user_id: uuid.UUID) -> Wallet:
    wallet = await wallet_repository.find_by_user(db, user_id)
    if wallet is None:
        raise AppError("No tienes una billetera asociada", 404, code="WALLET_NOT_FOUND")
    return wallet


async def create_wallet(db: AsyncSession, user_id: uuid.UUID) -> WalletPublic:
    ensure_blockchain_enabled()
    existing = await wallet_repository.find_by_user(db, user_id)
    if existing is not None:
        raise AppError("Ya tienes una billetera asociada", 409, code="WALLET_ALREADY_EXISTS")
    account = Account.create()
    encrypted = (
        Fernet(settings.wallet_encryption_key.encode()).encrypt(account.key.hex().encode()).decode()
    )
    wallet = await wallet_repository.create(
        db,
        user_id=user_id,
        address=account.address,
        encrypted_private_key=encrypted,
        chain_id=settings.chain_id,
    )
    await db.commit()
    await db.refresh(wallet)
    w3 = get_async_w3()
    balance_wei = await w3.eth.get_balance(Web3.to_checksum_address(wallet.address))
    return _public(wallet, str(w3.from_wei(balance_wei, "ether")))


async def get_wallet(db: AsyncSession, user_id: uuid.UUID) -> WalletPublic:
    ensure_blockchain_enabled()
    wallet = await get_wallet_or_404(db, user_id)
    w3 = get_async_w3()
    balance_wei = await w3.eth.get_balance(Web3.to_checksum_address(wallet.address))
    return _public(wallet, str(w3.from_wei(balance_wei, "ether")))
