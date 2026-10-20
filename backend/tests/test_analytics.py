import calendar
from datetime import UTC, datetime

import httpx

from tests.api_helpers import (
    auth_header,
    create_account,
    create_category,
    create_test_user,
    create_transaction,
)

NOW = datetime.now(UTC)
YEAR = NOW.year
MONTH = NOW.month
LAST_DAY = calendar.monthrange(YEAR, MONTH)[1]
FROM = f"{YEAR}-{MONTH:02d}-01"
TO = f"{YEAR}-{MONTH:02d}-{LAST_DAY:02d}"
MONTH_KEY = f"{YEAR}-{MONTH:02d}"


async def _seed(client: httpx.AsyncClient, user: dict[str, str]) -> None:
    account = await create_account(client, user, balance=0)
    food = await create_category(client, user, name="Comida")
    transport = await create_category(client, user, name="Transporte")
    await create_transaction(
        client,
        user,
        account_id=account["id"],
        amount=1000000,
        transaction_type="INCOME",
        merchant="Empleador",
        date=f"{YEAR}-{MONTH:02d}-05",
    )
    await create_transaction(
        client,
        user,
        account_id=account["id"],
        category_id=food["id"],
        amount=300000,
        date=f"{YEAR}-{MONTH:02d}-10",
    )
    await create_transaction(
        client,
        user,
        account_id=account["id"],
        category_id=transport["id"],
        amount=200000,
        date=f"{YEAR}-{MONTH:02d}-12",
    )


async def test_summary_totals_savings_rate_and_categories(
    client: httpx.AsyncClient,
) -> None:
    user = await create_test_user(client)
    await _seed(client, user)

    response = await client.get(
        f"/api/analytics/summary?from={FROM}&to={TO}", headers=auth_header(user)
    )

    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["totals"] == {
        "income": 1000000,
        "expense": 500000,
        "net": 500000,
        "savingsRate": 50,
    }
    first, second = data["byCategory"]
    assert first == {
        "id": first["id"],
        "name": "Comida",
        "color": "#64748b",
        "total": 300000,
        "percentage": 60,
        "rank": 1,
    }
    assert second["name"] == "Transporte"
    assert second["percentage"] == 40
    assert second["rank"] == 2


async def test_summary_net_by_account(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    await _seed(client, user)

    response = await client.get(
        f"/api/analytics/summary?from={FROM}&to={TO}", headers=auth_header(user)
    )

    accounts = response.json()["data"]["byAccount"]
    assert len(accounts) == 1
    assert accounts[0]["net"] == 500000
    assert accounts[0]["transactions"] == 3
    assert accounts[0]["balance"] == 500000


async def test_monthly_series_has_cumulative_net(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    await _seed(client, user)

    response = await client.get("/api/analytics/monthly?months=3", headers=auth_header(user))

    assert response.status_code == 200, response.text
    months = response.json()["data"]["months"]
    assert len(months) == 3
    current = next(item for item in months if item["month"] == MONTH_KEY)
    assert current == {
        "month": MONTH_KEY,
        "income": 1000000,
        "expense": 500000,
        "net": 500000,
        "cumulativeNet": 500000,
    }


async def test_category_trends_uses_previous_month(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    await _seed(client, user)

    response = await client.get(
        "/api/analytics/category-trends?months=3", headers=auth_header(user)
    )

    assert response.status_code == 200, response.text
    trends = response.json()["data"]["trends"]
    food = next(item for item in trends if item["categoryName"] == "Comida")
    assert food["total"] == 300000
    assert food["previous"] is None
    assert food["changePct"] is None


async def test_balance_timeline_running_balance(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    await _seed(client, user)

    response = await client.get(
        f"/api/analytics/balance-timeline?from={FROM}&to={TO}",
        headers=auth_header(user),
    )

    assert response.status_code == 200, response.text
    timeline = response.json()["data"]["timeline"]
    assert len(timeline) == 3
    assert timeline[0]["delta"] == 1000000
    assert timeline[-1]["runningBalance"] == 500000


async def test_analytics_are_isolated_between_users(client: httpx.AsyncClient) -> None:
    user_a = await create_test_user(client)
    user_b = await create_test_user(client)
    await _seed(client, user_a)

    response = await client.get(
        f"/api/analytics/summary?from={FROM}&to={TO}", headers=auth_header(user_b)
    )

    data = response.json()["data"]
    assert data["totals"] == {
        "income": 0,
        "expense": 0,
        "net": 0,
        "savingsRate": 0,
    }
    assert data["byCategory"] == []
