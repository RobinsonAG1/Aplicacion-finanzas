import uuid

import httpx
import pytest
from app.core.config import settings
from eth_account import Account as EthAccount
from web3 import Web3

from tests.api_helpers import auth_header, create_test_user

ANVIL_FUNDING_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"


def _node_available() -> bool:
    if not settings.blockchain_enabled:
        return False
    try:
        w3 = Web3(Web3.HTTPProvider(settings.rpc_url))
        return w3.is_connected()
    except Exception:
        return False


requires_node = pytest.mark.skipif(
    not _node_available(),
    reason="nodo RPC (Anvil) no disponible o blockchain desconfigurada",
)


async def _fund_wallet(address: str, amount_eth: float) -> None:
    w3 = Web3(Web3.HTTPProvider(settings.rpc_url))
    account = EthAccount.from_key(ANVIL_FUNDING_KEY)
    tx = {
        "to": Web3.to_checksum_address(address),
        "value": Web3.to_wei(amount_eth, "ether"),
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": 21_000,
        "gasPrice": w3.eth.gas_price,
        "chainId": w3.eth.chain_id,
    }
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)


@requires_node
async def test_create_and_get_wallet(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)

    response = await client.post("/api/blockchain/wallet", headers=auth_header(user))
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["address"].startswith("0x")
    assert len(data["address"]) == 42
    assert data["chainId"] == settings.chain_id
    assert data["balanceEth"] == "0"

    fetched = await client.get("/api/blockchain/wallet", headers=auth_header(user))
    assert fetched.status_code == 200
    assert fetched.json()["data"]["address"] == data["address"]

    duplicate = await client.post("/api/blockchain/wallet", headers=auth_header(user))
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "WALLET_ALREADY_EXISTS"


@requires_node
async def test_get_wallet_without_wallet_returns_404(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)

    response = await client.get("/api/blockchain/wallet", headers=auth_header(user))
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "WALLET_NOT_FOUND"


@requires_node
async def test_payment_flow_broadcasts_transaction(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    wallet = (await client.post("/api/blockchain/wallet", headers=auth_header(user))).json()["data"]
    await _fund_wallet(wallet["address"], 1)

    funded = await client.get("/api/blockchain/wallet", headers=auth_header(user))
    assert funded.json()["data"]["balanceEth"] == "1"

    response = await client.post(
        "/api/blockchain/payments",
        headers=auth_header(user),
        json={"amount": "0.01"},
    )
    assert response.status_code == 201, response.text
    payment = response.json()["data"]
    assert payment["status"] == "SUBMITTED"
    assert payment["txHash"] is not None and payment["txHash"].startswith("0x")
    assert payment["amountEth"] == "0.01"
    assert payment["reference"].startswith("0x")
    assert payment["confirmedAt"] is None

    listing = await client.get("/api/blockchain/payments", headers=auth_header(user))
    assert listing.status_code == 200
    assert len(listing.json()["data"]) == 1
    assert listing.json()["data"][0]["id"] == payment["id"]

    # El recibo queda minado en la cadena; el indexador (paso 7) lo confirma.
    w3 = Web3(Web3.HTTPProvider(settings.rpc_url))
    receipt = w3.eth.wait_for_transaction_receipt(payment["txHash"], timeout=60)
    assert receipt["status"] == 1


@requires_node
async def test_payment_requires_wallet(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)

    response = await client.post(
        "/api/blockchain/payments", headers=auth_header(user), json={"amount": "0.01"}
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "WALLET_NOT_FOUND"


@requires_node
async def test_payment_rejects_unknown_transaction(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    await client.post("/api/blockchain/wallet", headers=auth_header(user))

    response = await client.post(
        "/api/blockchain/payments",
        headers=auth_header(user),
        json={"amount": "0.01", "transactionId": str(uuid.uuid4())},
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "TRANSACTION_NOT_FOUND"


@requires_node
async def test_payment_rejects_amount_over_limit(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    await client.post("/api/blockchain/wallet", headers=auth_header(user))

    response = await client.post(
        "/api/blockchain/payments", headers=auth_header(user), json={"amount": "101"}
    )
    assert response.status_code == 422


@requires_node
async def test_events_start_empty(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)

    response = await client.get("/api/blockchain/events", headers=auth_header(user))
    assert response.status_code == 200
    assert response.json()["data"] == []


async def test_status_when_enabled(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)

    response = await client.get("/api/blockchain/status", headers=auth_header(user))
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["enabled"] == settings.blockchain_enabled
    assert data["chainId"] == settings.chain_id
