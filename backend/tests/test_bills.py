from datetime import UTC, datetime
from decimal import Decimal

import httpx

from tests.api_helpers import (
    auth_header,
    create_account,
    create_bill,
    create_category,
    create_test_user,
    get_account_balance,
)

TODAY = datetime.now(UTC).day


async def test_create_recurring_bill(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)

    response = await client.post(
        "/api/bills",
        headers=auth_header(user),
        json={"name": "Internet", "amount": 120000, "dueDay": 15},
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["name"] == "Internet"
    assert data["amount"] == "120000.00"
    assert data["dueDay"] == 15


async def test_reject_income_category(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    category = await create_category(client, user, name="Salario", category_type="INCOME")

    response = await client.post(
        "/api/bills",
        headers=auth_header(user),
        json={
            "name": "X",
            "amount": 1000,
            "dueDay": 5,
            "categoryId": category["id"],
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "BILL_INVALID_CATEGORY"


async def test_filter_bills_by_active_state(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    await create_bill(client, user, name="Activa", due_day=10)
    await create_bill(client, user, name="Inactiva", due_day=11, is_active=False)

    response = await client.get("/api/bills?isActive=true", headers=auth_header(user))

    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data) == 1
    assert data[0]["name"] == "Activa"


async def test_upcoming_includes_due_today_and_overdue(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    await create_bill(client, user, name="Hoy", due_day=TODAY)
    if TODAY > 1:
        await create_bill(client, user, name="Vencida", due_day=TODAY - 1)

    response = await client.get("/api/bills/upcoming?days=30", headers=auth_header(user))

    assert response.status_code == 200
    upcoming = response.json()["data"]["upcoming"]
    today = next(item for item in upcoming if item["name"] == "Hoy")
    assert today["daysUntil"] == 0
    assert today["overdue"] is False

    if TODAY > 1:
        overdue = next(item for item in upcoming if item["name"] == "Vencida")
        assert overdue["overdue"] is True
        assert overdue["daysUntil"] < 0


async def test_create_reminder_and_reject_duplicate(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    bill = await create_bill(client, user, due_day=TODAY)

    response = await client.post(
        f"/api/bills/{bill['id']}/reminders",
        headers=auth_header(user),
        json={"send": True},
    )

    assert response.status_code == 201
    assert response.json()["data"]["status"] == "SENT"
    assert response.json()["data"]["sentAt"] is not None

    duplicate = await client.post(
        f"/api/bills/{bill['id']}/reminders",
        headers=auth_header(user),
        json={},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "REMINDER_EXISTS"


async def test_run_reminders_is_idempotent(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    await create_bill(client, user, due_day=TODAY)

    first = await client.post(
        "/api/bills/reminders/run",
        headers=auth_header(user),
        json={"days": 30},
    )
    assert first.status_code == 200
    assert first.json()["data"]["created"] == 1

    second = await client.post(
        "/api/bills/reminders/run",
        headers=auth_header(user),
        json={"days": 30},
    )
    assert second.json()["data"]["created"] == 0
    assert second.json()["data"]["skipped"] == 1


async def test_pay_bill_creates_transaction_and_links_it(
    client: httpx.AsyncClient,
) -> None:
    user = await create_test_user(client)
    account = await create_account(client, user, name="Ahorros", balance=500000)
    category = await create_category(client, user, name="Servicios")
    bill = await create_bill(
        client,
        user,
        amount=120000,
        due_day=TODAY,
        category_id=category["id"],
    )

    response = await client.post(
        f"/api/bills/{bill['id']}/pay",
        headers=auth_header(user),
        json={"accountId": account["id"]},
    )

    assert response.status_code == 201, response.text
    data = response.json()["data"]
    assert Decimal(data["transaction"]["amount"]) == Decimal("120000")
    assert data["bill"]["sourceTransaction"] is not None
    assert await get_account_balance(client, user, account["id"]) == Decimal("380000")

    detail = await client.get(f"/api/bills/{bill['id']}", headers=auth_header(user))
    assert detail.json()["data"]["sourceTransaction"]["id"] == data["transaction"]["id"]


async def test_update_clears_category_and_delete_bill(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    category = await create_category(client, user, name="Servicios")
    bill = await create_bill(client, user, category_id=category["id"], due_day=5)

    updated = await client.put(
        f"/api/bills/{bill['id']}",
        headers=auth_header(user),
        json={"name": "Internet hogar", "categoryId": None},
    )
    assert updated.status_code == 200
    assert updated.json()["data"]["name"] == "Internet hogar"
    assert updated.json()["data"]["category"] is None

    deleted = await client.delete(f"/api/bills/{bill['id']}", headers=auth_header(user))
    assert deleted.status_code == 204


async def test_bills_are_isolated_between_users(client: httpx.AsyncClient) -> None:
    user_a = await create_test_user(client)
    user_b = await create_test_user(client)
    bill = await create_bill(client, user_a)

    list_b = await client.get("/api/bills", headers=auth_header(user_b))
    assert list_b.json()["data"] == []

    get_b = await client.get(f"/api/bills/{bill['id']}", headers=auth_header(user_b))
    assert get_b.status_code == 404
