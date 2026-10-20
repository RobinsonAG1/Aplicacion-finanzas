from decimal import Decimal

import httpx

from tests.api_helpers import (
    auth_header,
    create_account,
    create_category,
    create_test_user,
    create_transaction,
    get_account_balance,
)


async def test_create_transaction_adjusts_account_balance(
    client: httpx.AsyncClient,
) -> None:
    user = await create_test_user(client)
    account = await create_account(client, user, balance=100000)

    await create_transaction(
        client,
        user,
        account_id=account["id"],
        amount=30000,
        merchant="Rappi",
    )

    assert await get_account_balance(client, user, account["id"]) == Decimal("70000")


async def test_reject_non_positive_amount(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    account = await create_account(client, user)

    response = await client.post(
        "/api/transactions",
        headers=auth_header(user),
        json={
            "accountId": account["id"],
            "amount": -5,
            "type": "EXPENSE",
            "date": "2026-10-05",
        },
    )

    assert response.status_code == 422


async def test_reject_unknown_account(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)

    response = await client.post(
        "/api/transactions",
        headers=auth_header(user),
        json={
            "accountId": "no-existe",
            "amount": 10,
            "type": "EXPENSE",
            "date": "2026-10-05",
        },
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ACCOUNT_NOT_FOUND"


async def test_pagination_returns_metadata(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    account = await create_account(client, user)
    for index in range(12):
        await create_transaction(
            client,
            user,
            account_id=account["id"],
            amount=1000 + index,
            merchant=f"Comercio {index}",
        )

    page1 = await client.get("/api/transactions?page=1&limit=10", headers=auth_header(user))
    assert page1.status_code == 200
    assert len(page1.json()["data"]) == 10
    assert page1.json()["meta"] == {
        "total": 12,
        "page": 1,
        "limit": 10,
        "totalPages": 2,
    }

    page2 = await client.get("/api/transactions?page=2&limit=10", headers=auth_header(user))
    assert len(page2.json()["data"]) == 2


async def test_search_matches_merchant_and_description(
    client: httpx.AsyncClient,
) -> None:
    user = await create_test_user(client)
    account = await create_account(client, user)
    await create_transaction(client, user, account_id=account["id"], amount=1000, merchant="Rappi")
    await create_transaction(client, user, account_id=account["id"], amount=2000, merchant="Uber")

    response = await client.get("/api/transactions?search=rapp", headers=auth_header(user))

    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data) == 1
    assert data[0]["merchant"] == "Rappi"


async def test_filters_by_category_type_and_date_range(
    client: httpx.AsyncClient,
) -> None:
    user = await create_test_user(client)
    account = await create_account(client, user)
    category = await create_category(client, user, name="Transporte")
    await create_transaction(
        client,
        user,
        account_id=account["id"],
        category_id=category["id"],
        amount=5000,
        merchant="Uber",
        date="2026-10-05",
    )
    await create_transaction(
        client,
        user,
        account_id=account["id"],
        amount=4000000,
        transaction_type="INCOME",
        merchant="Empleador",
        date="2026-09-15",
    )

    by_category = await client.get(
        f"/api/transactions?categoryId={category['id']}", headers=auth_header(user)
    )
    assert len(by_category.json()["data"]) == 1

    by_type = await client.get("/api/transactions?type=INCOME", headers=auth_header(user))
    assert len(by_type.json()["data"]) == 1

    by_range = await client.get(
        "/api/transactions?from=2026-10-01&to=2026-10-31",
        headers=auth_header(user),
    )
    assert len(by_range.json()["data"]) == 1


async def test_sort_by_amount(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    account = await create_account(client, user)
    for amount in (500, 3000, 100):
        await create_transaction(client, user, account_id=account["id"], amount=amount)

    response = await client.get(
        "/api/transactions?sort=amount&order=asc", headers=auth_header(user)
    )

    amounts = [Decimal(item["amount"]) for item in response.json()["data"]]
    assert amounts == [Decimal("100"), Decimal("500"), Decimal("3000")]


async def test_update_transaction_adjusts_balance(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    account = await create_account(client, user, balance=100000)
    transaction = await create_transaction(client, user, account_id=account["id"], amount=30000)

    response = await client.put(
        f"/api/transactions/{transaction['id']}",
        headers=auth_header(user),
        json={"amount": 50000},
    )

    assert response.status_code == 200
    assert await get_account_balance(client, user, account["id"]) == Decimal("50000")


async def test_delete_transaction_reverts_balance(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    account = await create_account(client, user, balance=100000)
    transaction = await create_transaction(client, user, account_id=account["id"], amount=30000)

    response = await client.delete(
        f"/api/transactions/{transaction['id']}", headers=auth_header(user)
    )

    assert response.status_code == 204
    assert await get_account_balance(client, user, account["id"]) == Decimal("100000")


async def test_set_and_clear_category(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    account = await create_account(client, user)
    category = await create_category(client, user, name="Comida")
    transaction = await create_transaction(client, user, account_id=account["id"], amount=1000)

    set_response = await client.patch(
        f"/api/transactions/{transaction['id']}/category",
        headers=auth_header(user),
        json={"categoryId": category["id"]},
    )
    assert set_response.status_code == 200
    assert set_response.json()["data"]["category"]["id"] == category["id"]

    clear_response = await client.patch(
        f"/api/transactions/{transaction['id']}/category",
        headers=auth_header(user),
        json={"categoryId": None},
    )
    assert clear_response.status_code == 200
    assert clear_response.json()["data"]["category"] is None


async def test_suggest_category_by_merchant(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    account = await create_account(client, user)
    category = await create_category(client, user, name="Transporte")
    await create_transaction(
        client,
        user,
        account_id=account["id"],
        category_id=category["id"],
        amount=5000,
        merchant="Uber",
        date="2026-10-01",
    )
    await create_transaction(
        client,
        user,
        account_id=account["id"],
        category_id=category["id"],
        amount=7000,
        merchant="Uber",
        date="2026-10-02",
    )

    response = await client.get(
        "/api/transactions/suggestions?merchant=Uber", headers=auth_header(user)
    )

    assert response.status_code == 200
    suggestions = response.json()["suggestions"]
    assert suggestions[0]["category"]["id"] == category["id"]
    assert suggestions[0]["count"] == 2
    assert suggestions[0]["confidence"] == 1.0


async def test_transactions_are_isolated_between_users(
    client: httpx.AsyncClient,
) -> None:
    user_a = await create_test_user(client)
    user_b = await create_test_user(client)
    account_a = await create_account(client, user_a)
    transaction = await create_transaction(client, user_a, account_id=account_a["id"], amount=1000)

    get_response = await client.get(
        f"/api/transactions/{transaction['id']}", headers=auth_header(user_b)
    )
    assert get_response.status_code == 404

    list_response = await client.get("/api/transactions", headers=auth_header(user_b))
    assert list_response.json()["data"] == []


async def test_reject_foreign_account_or_category_on_create(
    client: httpx.AsyncClient,
) -> None:
    user_a = await create_test_user(client)
    user_b = await create_test_user(client)
    account_a = await create_account(client, user_a)
    category_a = await create_category(client, user_a, name="Ajena")
    account_b = await create_account(client, user_b)

    foreign_account = await client.post(
        "/api/transactions",
        headers=auth_header(user_b),
        json={
            "accountId": account_a["id"],
            "amount": 10,
            "type": "EXPENSE",
            "date": "2026-10-05",
        },
    )
    assert foreign_account.status_code == 404

    foreign_category = await client.post(
        "/api/transactions",
        headers=auth_header(user_b),
        json={
            "accountId": account_b["id"],
            "categoryId": category_a["id"],
            "amount": 10,
            "type": "EXPENSE",
            "date": "2026-10-05",
        },
    )
    assert foreign_category.status_code == 404


async def test_reject_foreign_account_or_category_on_update(
    client: httpx.AsyncClient,
) -> None:
    user_a = await create_test_user(client)
    user_b = await create_test_user(client)
    account_a = await create_account(client, user_a)
    category_a = await create_category(client, user_a, name="Ajena")
    account_b = await create_account(client, user_b)
    transaction = await create_transaction(client, user_b, account_id=account_b["id"], amount=1000)

    to_foreign_account = await client.put(
        f"/api/transactions/{transaction['id']}",
        headers=auth_header(user_b),
        json={"accountId": account_a["id"]},
    )
    assert to_foreign_account.status_code == 404

    to_foreign_category = await client.patch(
        f"/api/transactions/{transaction['id']}/category",
        headers=auth_header(user_b),
        json={"categoryId": category_a["id"]},
    )
    assert to_foreign_category.status_code == 404


async def test_transaction_response_includes_relations(
    client: httpx.AsyncClient,
) -> None:
    user = await create_test_user(client)
    account = await create_account(client, user, name="Nequi")
    category = await create_category(client, user, name="Comida")
    transaction = await create_transaction(
        client,
        user,
        account_id=account["id"],
        category_id=category["id"],
        amount=2500,
        merchant="Rappi",
    )

    response = await client.get(f"/api/transactions/{transaction['id']}", headers=auth_header(user))

    assert response.status_code == 200
    data = response.json()["data"]
    assert isinstance(data["amount"], str)
    assert data["account"]["name"] == "Nequi"
    assert data["account"]["currency"] == "COP"
    assert data["category"]["name"] == "Comida"
