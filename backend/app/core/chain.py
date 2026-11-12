import json
from pathlib import Path
from typing import cast

from cryptography.fernet import Fernet
from web3 import AsyncWeb3
from web3.providers.rpc import AsyncHTTPProvider

from app.core.config import settings
from app.core.errors import AppError

_ARTIFACT_PATH = Path(__file__).resolve().parents[2] / "contracts" / "PaymentProcessor.json"


def load_payment_abi() -> list[dict[str, object]]:
    """ABI del contrato de pagos (se compila una vez y queda como artifact)."""
    artifact = json.loads(_ARTIFACT_PATH.read_text(encoding="utf-8"))
    return cast(list[dict[str, object]], artifact["abi"])


def get_async_w3() -> AsyncWeb3:
    return AsyncWeb3(AsyncHTTPProvider(settings.rpc_url))


def ensure_blockchain_enabled() -> None:
    if not settings.blockchain_enabled:
        raise AppError(
            "La seccion blockchain no esta configurada (falta RPC_URL, "
            "PAYMENT_CONTRACT_ADDRESS, TREASURY_ADDRESS o WALLET_ENCRYPTION_KEY)",
            503,
            code="BLOCKCHAIN_DISABLED",
        )


def load_fernet() -> Fernet:
    return Fernet(settings.wallet_encryption_key.encode())
