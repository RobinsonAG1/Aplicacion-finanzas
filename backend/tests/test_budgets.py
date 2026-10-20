from decimal import Decimal

import httpx

from tests.api_helpers import (
    auth_header,
    create_account,
    create_budget,
    create_category,
    create_test_user,
    create_transaction,
)


async def test_create_budget_for_expense_category(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    category = await create_category(client, user, name="Comida")

    budget = await create_budget(client, user, category_id=category["id"], limit_amount=500000)

    assert budget["category"]["name"] == "Comida"
    assert budget["period"] == "MONTHLY"
    assert Decimal(budget["limitAmount"]) == Decimal("500000")


async def test_reject_income_category(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    category = await create_category(client, user, name="Salario", category_type="INCOME")

    response = await client.post(
        "/api/budgets",
        headers=auth_header(user),
        json={"categoryId": category["id"], "limitAmount": 100000},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "BUDGET_INVALID_CATEGORY"


async def test_overview_sums_only_category_and_window(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    account = await create_account(client, user, balance=1000000)
    food = await create_category(client, user, name="Comida")
    transport = await create_category(client, user, name="Transporte")
    await create_budget(client, user, category_id=food["id"], limit_amount=100000)

    await create_transaction(
        client,
        user,
        account_id=account["id"],
        category_id=food["id"],
        amount=30000,
        date="2026-10-10",
    )
    await create_transaction(
        client,
        user,
        account_id=account["id"],
        category_id=food["id"],
        amount=20000,
        date="2026-10-12",
    )
    await create_transaction(
        client,
        user,
        account_id=account["id"],
        category_id=transport["id"],
        amount=99999,
        date="2026-10-11",
    )
    await create_transaction(
        client,
        user,
        account_id=account["id"],
        category_id=food["id"],
        amount=500000,
        transaction_type="INCOME",
        date="2026-10-13",
    )

    response = await client.get(
        "/api/budgets/overview?from=2026-10-01&to=2026-10-31",
        headers=auth_header(user),
    )

    assert response.status_code == 200, response.text
    summary = response.json()["data"]["budgets"][0]
    assert summary["spent"] == 50000
    assert summary["remaining"] == 50000
    assert summary["percentage"] == 50
    assert summary["exceeded"] is False
    assert set(summary["window"]) == {"from", "to"}


async def test_overview_marks_exceeded_and_totals(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    account = await create_account(client, user)
    food = await create_category(client, user, name="Comida")
    fun = await create_category(client, user, name="Ocio")
    await create_budget(client, user, category_id=food["id"], limit_amount=10000)
    await create_budget(client, user, category_id=fun["id"], limit_amount=200000)

    await create_transaction(
        client,
        user,
        account_id=account["id"],
        category_id=food["id"],
        amount=15000,
        date="2026-10-05",
    )
    await create_transaction(
        client,
        user,
        account_id=account["id"],
        category_id=fun["id"],
        amount=50000,
        date="2026-10-06",
    )

    response = await client.get(
        "/api/budgets/overview?from=2026-10-01&to=2026-10-31",
        headers=auth_header(user),
    )

    data = response.json()["data"]
    assert data["totals"] == {
        "limitAmount": 210000,
        "spent": 65000,
        "remaining": 145000,
    }
    summary = next(item for item in data["budgets"] if item["category"]["name"] == "Comida")
    assert summary["exceeded"] is True
    assert summary["remaining"] == -5000
    assert summary["percentage"] == 150


async def test_expenses_outside_budget_window_are_ignored(
    client: httpx.AsyncClient,
) -> None:
    user = await create_test_user(client)
    account = await create_account(client, user)
    food = await create_category(client, user, name="Comida")
    await create_budget(client, user, category_id=food["id"], start_date="2026-11-01")
    await create_transaction(
        client,
        user,
        account_id=account["id"],
        category_id=food["id"],
        amount=30000,
        date="2026-10-10",
    )

    response = await client.get(
        "/api/budgets/overview?from=2026-10-01&to=2026-10-31",
        headers=auth_header(user),
    )

    summary = response.json()["data"]["budgets"][0]
    assert summary["spent"] == 0
    assert summary["window"] is None


async def test_update_and_delete_budget(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    category = await create_category(client, user, name="Comida")
    budget = await create_budget(client, user, category_id=category["id"])

    updated = await client.put(
        f"/api/budgets/{budget['id']}",
        headers=auth_header(user),
        json={"limitAmount": 250000},
    )
    assert updated.status_code == 200
    assert Decimal(updated.json()["data"]["limitAmount"]) == Decimal("250000")

    invalid = await client.put(
        f"/api/budgets/{budget['id']}",
        headers=auth_header(user),
        json={"startDate": "2026-10-10", "endDate": "2026-10-01"},
    )
    assert invalid.status_code == 422

    deleted = await client.delete(f"/api/budgets/{budget['id']}", headers=auth_header(user))
    assert deleted.status_code == 204


async def test_budgets_are_isolated_between_users(client: httpx.AsyncClient) -> None:
    user_a = await create_test_user(client)
    user_b = await create_test_user(client)
    category = await create_category(client, user_a, name="Comida")
    budget = await create_budget(client, user_a, category_id=category["id"])

    list_b = await client.get("/api/budgets", headers=auth_header(user_b))
    assert list_b.json()["data"] == []

    get_b = await client.get(f"/api/budgets/{budget['id']}", headers=auth_header(user_b))
    assert get_b.status_code == 404
