import uuid
from decimal import Decimal
from typing import Any

import httpx

DEFAULT_PASSWORD = "Secreta123!"


def extract_refresh_cookie(response: httpx.Response) -> str:
    for header in response.headers.get_list("set-cookie"):
        if header.startswith("refresh_token="):
            return header.split(";", 1)[0]
    return ""


async def create_test_user(
    client: httpx.AsyncClient,
    *,
    name: str = "Usuario Test",
    password: str = DEFAULT_PASSWORD,
) -> dict[str, str]:
    email = f"user_{uuid.uuid4().hex}@finanzas.test"
    response = await client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": password},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    return {
        "id": body["user"]["id"],
        "email": email,
        "access_token": body["accessToken"],
        "refresh_cookie": extract_refresh_cookie(response),
    }


def auth_header(user: dict[str, str]) -> dict[str, str]:
    return {"Authorization": f"Bearer {user['access_token']}"}


async def create_account(
    client: httpx.AsyncClient,
    user: dict[str, str],
    *,
    name: str = "Cuenta",
    account_type: str = "CASH",
    balance: float | int = 0,
) -> dict[str, Any]:
    response = await client.post(
        "/api/accounts",
        headers=auth_header(user),
        json={"name": name, "type": account_type, "balance": balance},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


async def create_category(
    client: httpx.AsyncClient,
    user: dict[str, str],
    *,
    name: str = "Categoria",
    category_type: str = "EXPENSE",
    color: str = "#64748b",
) -> dict[str, Any]:
    response = await client.post(
        "/api/categories",
        headers=auth_header(user),
        json={"name": name, "type": category_type, "color": color},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


async def create_transaction(
    client: httpx.AsyncClient,
    user: dict[str, str],
    *,
    account_id: str,
    category_id: str | None = None,
    amount: float | int = 1000,
    transaction_type: str = "EXPENSE",
    description: str | None = None,
    merchant: str | None = None,
    date: str = "2026-10-05",
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "accountId": account_id,
        "amount": amount,
        "type": transaction_type,
        "date": date,
    }
    if category_id is not None:
        payload["categoryId"] = category_id
    if description is not None:
        payload["description"] = description
    if merchant is not None:
        payload["merchant"] = merchant
    response = await client.post("/api/transactions", headers=auth_header(user), json=payload)
    assert response.status_code == 201, response.text
    return response.json()["data"]


async def get_account_balance(
    client: httpx.AsyncClient, user: dict[str, str], account_id: str
) -> Decimal:
    response = await client.get(f"/api/accounts/{account_id}", headers=auth_header(user))
    assert response.status_code == 200, response.text
    return Decimal(response.json()["data"]["balance"])


async def create_budget(
    client: httpx.AsyncClient,
    user: dict[str, str],
    *,
    category_id: str,
    limit_amount: float | int = 100000,
    period: str = "MONTHLY",
    start_date: str = "2026-10-01",
) -> dict[str, Any]:
    response = await client.post(
        "/api/budgets",
        headers=auth_header(user),
        json={
            "categoryId": category_id,
            "limitAmount": limit_amount,
            "period": period,
            "startDate": start_date,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


async def create_pot(
    client: httpx.AsyncClient,
    user: dict[str, str],
    *,
    name: str = "Vacaciones",
    target_amount: float | int = 1000000,
    color: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {"name": name, "targetAmount": target_amount}
    if color is not None:
        payload["color"] = color
    response = await client.post("/api/pots", headers=auth_header(user), json=payload)
    assert response.status_code == 201, response.text
    return response.json()["data"]


async def create_bill(
    client: httpx.AsyncClient,
    user: dict[str, str],
    *,
    name: str = "Internet",
    amount: float | int = 120000,
    due_day: int = 15,
    category_id: str | None = None,
    is_active: bool = True,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "name": name,
        "amount": amount,
        "dueDay": due_day,
        "isActive": is_active,
    }
    if category_id is not None:
        payload["categoryId"] = category_id
    response = await client.post("/api/bills", headers=auth_header(user), json=payload)
    assert response.status_code == 201, response.text
    return response.json()["data"]
