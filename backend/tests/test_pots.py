import httpx

from tests.api_helpers import auth_header, create_pot, create_test_user


async def test_create_pot_with_initial_progress(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)

    response = await client.post(
        "/api/pots",
        headers=auth_header(user),
        json={"name": "Vacaciones", "targetAmount": 1000000},
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["name"] == "Vacaciones"
    assert data["currentAmount"] == "0.00"
    assert data["targetAmount"] == "1000000.00"
    assert data["percentage"] == 0
    assert data["completed"] is False


async def test_reject_invalid_color(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)

    response = await client.post(
        "/api/pots",
        headers=auth_header(user),
        json={"name": "X", "targetAmount": 1000, "color": "verde"},
    )

    assert response.status_code == 422


async def test_deposit_reflects_progress(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    pot = await create_pot(client, user, target_amount=100000)

    response = await client.post(
        f"/api/pots/{pot['id']}/deposit",
        headers=auth_header(user),
        json={"amount": 30000, "note": "Primer ahorro"},
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["currentAmount"] == "30000.00"
    assert data["remaining"] == 70000
    assert data["percentage"] == 30
    assert data["completed"] is False


async def test_get_pot_includes_movement_history(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    pot = await create_pot(client, user)
    await client.post(
        f"/api/pots/{pot['id']}/deposit",
        headers=auth_header(user),
        json={"amount": 100000, "note": "Inicial"},
    )
    await client.post(
        f"/api/pots/{pot['id']}/withdraw",
        headers=auth_header(user),
        json={"amount": 40000},
    )

    response = await client.get(f"/api/pots/{pot['id']}", headers=auth_header(user))

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["currentAmount"] == "60000.00"
    assert len(data["transactions"]) == 2
    assert [item["type"] for item in data["transactions"]] == ["WITHDRAW", "DEPOSIT"]


async def test_cannot_withdraw_more_than_balance(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    pot = await create_pot(client, user)
    await client.post(
        f"/api/pots/{pot['id']}/deposit",
        headers=auth_header(user),
        json={"amount": 50000},
    )

    response = await client.post(
        f"/api/pots/{pot['id']}/withdraw",
        headers=auth_header(user),
        json={"amount": 80000},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "POT_INSUFFICIENT_FUNDS"


async def test_pot_is_completed_when_target_reached(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    pot = await create_pot(client, user, target_amount=50000)

    response = await client.post(
        f"/api/pots/{pot['id']}/deposit",
        headers=auth_header(user),
        json={"amount": 50000},
    )

    data = response.json()["data"]
    assert data["completed"] is True
    assert data["percentage"] == 100


async def test_update_and_delete_pot(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    pot = await create_pot(client, user)

    updated = await client.put(
        f"/api/pots/{pot['id']}",
        headers=auth_header(user),
        json={"name": "Moto", "targetAmount": 5000000},
    )
    assert updated.status_code == 200
    assert updated.json()["data"]["name"] == "Moto"

    deleted = await client.delete(f"/api/pots/{pot['id']}", headers=auth_header(user))
    assert deleted.status_code == 204

    gone = await client.get(f"/api/pots/{pot['id']}", headers=auth_header(user))
    assert gone.status_code == 404


async def test_pots_are_isolated_between_users(client: httpx.AsyncClient) -> None:
    user_a = await create_test_user(client)
    user_b = await create_test_user(client)
    pot = await create_pot(client, user_a)

    list_b = await client.get("/api/pots", headers=auth_header(user_b))
    assert list_b.json()["data"] == []

    deposit_b = await client.post(
        f"/api/pots/{pot['id']}/deposit",
        headers=auth_header(user_b),
        json={"amount": 1000},
    )
    assert deposit_b.status_code == 404
