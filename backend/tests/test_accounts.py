from decimal import Decimal

import httpx

from tests.api_helpers import auth_header, create_test_user


async def test_accounts_require_authentication(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/accounts")

    assert response.status_code == 401


async def test_create_account_uses_default_currency(
    client: httpx.AsyncClient,
) -> None:
    user = await create_test_user(client)
    response = await client.post(
        "/api/accounts",
        headers=auth_header(user),
        json={"name": "Ahorros", "type": "SAVINGS", "balance": 500000},
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["currency"] == "COP"
    assert data["name"] == "Ahorros"
    assert isinstance(data["balance"], str)
    assert Decimal(data["balance"]) == Decimal("500000")


async def test_create_account_rejects_invalid_type(
    client: httpx.AsyncClient,
) -> None:
    user = await create_test_user(client)
    response = await client.post(
        "/api/accounts",
        headers=auth_header(user),
        json={"name": "X", "type": "NO_EXISTE"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_list_only_returns_own_accounts(client: httpx.AsyncClient) -> None:
    user_a = await create_test_user(client)
    user_b = await create_test_user(client)
    await client.post(
        "/api/accounts",
        headers=auth_header(user_a),
        json={"name": "A", "type": "CASH"},
    )
    await client.post(
        "/api/accounts",
        headers=auth_header(user_b),
        json={"name": "B", "type": "CASH"},
    )

    response = await client.get("/api/accounts", headers=auth_header(user_a))

    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data) == 1
    assert data[0]["name"] == "A"


async def test_cannot_read_other_users_account(client: httpx.AsyncClient) -> None:
    user_a = await create_test_user(client)
    user_b = await create_test_user(client)
    created = await client.post(
        "/api/accounts",
        headers=auth_header(user_a),
        json={"name": "Privada", "type": "SAVINGS"},
    )
    account_id = created.json()["data"]["id"]

    response = await client.get(f"/api/accounts/{account_id}", headers=auth_header(user_b))

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ACCOUNT_NOT_FOUND"


async def test_cannot_update_or_delete_other_users_account(
    client: httpx.AsyncClient,
) -> None:
    user_a = await create_test_user(client)
    user_b = await create_test_user(client)
    created = await client.post(
        "/api/accounts",
        headers=auth_header(user_a),
        json={"name": "Privada", "type": "SAVINGS"},
    )
    account_id = created.json()["data"]["id"]

    update = await client.put(
        f"/api/accounts/{account_id}",
        headers=auth_header(user_b),
        json={"name": "Hackeada"},
    )
    assert update.status_code == 404

    delete = await client.delete(f"/api/accounts/{account_id}", headers=auth_header(user_b))
    assert delete.status_code == 404


async def test_update_and_delete_own_account(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    created = await client.post(
        "/api/accounts",
        headers=auth_header(user),
        json={"name": "Vieja", "type": "SAVINGS"},
    )
    account_id = created.json()["data"]["id"]

    update = await client.put(
        f"/api/accounts/{account_id}",
        headers=auth_header(user),
        json={"name": "Nueva", "balance": 123400},
    )
    assert update.status_code == 200
    assert update.json()["data"]["name"] == "Nueva"

    delete = await client.delete(f"/api/accounts/{account_id}", headers=auth_header(user))
    assert delete.status_code == 204

    get = await client.get(f"/api/accounts/{account_id}", headers=auth_header(user))
    assert get.status_code == 404


async def test_invalid_account_id_is_not_found(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)

    response = await client.get("/api/accounts/no-es-uuid", headers=auth_header(user))

    assert response.status_code == 404
