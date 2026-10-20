from decimal import Decimal

import httpx
import pytest
from app.utils.csv import escape_csv_field, parse_csv, to_csv

from tests.api_helpers import (
    auth_header,
    create_account,
    create_category,
    create_test_user,
    create_transaction,
    get_account_balance,
)

HEADER = "fecha,tipo,monto,cuenta,categoria,comercio,descripcion\r\n"


@pytest.mark.parametrize(
    "value",
    ["=SUM(1+1)", "+34 6000", "-cmd|/c calc", "@SUM(A1)"],
)
def test_escape_csv_field_neutralizes_formulas(value: str) -> None:
    assert escape_csv_field(value) == f"'{value}"


def test_escape_csv_field_keeps_real_negative_numbers() -> None:
    assert escape_csv_field(-500, numeric=True) == "-500"
    assert escape_csv_field(0, numeric=True) == "0"


def test_escape_csv_field_quotes_special_characters() -> None:
    assert escape_csv_field("a,b") == '"a,b"'
    assert escape_csv_field('dijo "hola"') == '"dijo ""hola"""'
    assert escape_csv_field("linea1\nlinea2") == '"linea1\nlinea2"'
    assert escape_csv_field(None) == ""


def test_to_csv_sanitizes_and_uses_crlf() -> None:
    assert to_csv(["comercio"], [["=1+1"]]) == "comercio\r\n'=1+1\r\n"


def test_parse_csv_handles_bom_quotes_and_newlines() -> None:
    parsed = parse_csv('\ufefffecha,monto\r\n2026-10-05,"Rappi, Colombia"\r\n')
    assert parsed == [["fecha", "monto"], ["2026-10-05", "Rappi, Colombia"]]


async def test_export_csv_respects_filters(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    account = await create_account(client, user, name="Ahorros")
    await create_transaction(
        client,
        user,
        account_id=account["id"],
        amount=30000,
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
        date="2026-10-06",
    )

    response = await client.get("/api/transactions/export.csv", headers=auth_header(user))
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "attachment" in response.headers["content-disposition"]
    assert "fecha,tipo,monto,cuenta,categoria,comercio,descripcion" in response.text
    assert "gasto" in response.text
    assert "ingreso" in response.text

    income_only = await client.get(
        "/api/transactions/export.csv?type=INCOME", headers=auth_header(user)
    )
    assert "ingreso" in income_only.text
    assert "gasto" not in income_only.text


async def test_import_csv_multipart_adjusts_balances(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    account = await create_account(client, user, name="Ahorros", balance=100000)
    await create_category(client, user, name="Transporte", category_type="EXPENSE")

    csv_text = (
        HEADER
        + "2026-10-05,gasto,30000,Ahorros,Transporte,Uber,Viaje\r\n"
        + '2026-10-06,ingreso,"4.000.000",Ahorros,,Empleador,Salario\r\n'
    )
    response = await client.post(
        "/api/transactions/import",
        headers=auth_header(user),
        files={"file": ("datos.csv", csv_text.encode(), "text/csv")},
    )

    assert response.status_code == 200
    assert response.json()["data"] == {
        "total": 2,
        "imported": 2,
        "skipped": 0,
        "errors": [],
    }
    assert await get_account_balance(client, user, account["id"]) == Decimal("4070000")

    listing = await client.get("/api/transactions", headers=auth_header(user))
    assert listing.json()["meta"]["total"] == 2
    transporte = next(
        transaction for transaction in listing.json()["data"] if transaction["merchant"] == "Uber"
    )
    assert transporte["category"]["name"] == "Transporte"


async def test_import_csv_accepts_plain_text(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    await create_account(client, user, name="Ahorros")
    csv_text = HEADER + '2026-10-05,gasto,15000,Ahorros,,"Rappi, Colombia",Domicilio\r\n'

    response = await client.post(
        "/api/transactions/import",
        headers={**auth_header(user), "Content-Type": "text/csv"},
        content=csv_text,
    )

    assert response.status_code == 200
    assert response.json()["data"]["imported"] == 1


async def test_import_csv_reports_invalid_rows(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    await create_account(client, user, name="Ahorros")
    csv_text = (
        HEADER
        + "no-es-fecha,gasto,10000,Ahorros,,,\r\n"
        + "2026-10-05,gasto,abc,Ahorros,,,\r\n"
        + "2026-10-06,gasto,20000,CuentaInexistente,,,\r\n"
        + "2026-10-07,gasto,25000,Ahorros,,,\r\n"
    )

    response = await client.post(
        "/api/transactions/import",
        headers={**auth_header(user), "Content-Type": "text/csv"},
        content=csv_text,
    )

    assert response.status_code == 200
    assert response.json()["data"]["imported"] == 1
    assert len(response.json()["data"]["errors"]) == 3


async def test_import_csv_skips_duplicates(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    await create_account(client, user, name="Ahorros")
    csv_text = HEADER + "2026-10-05,gasto,30000,Ahorros,Uber,,Viaje\r\n"
    headers = {**auth_header(user), "Content-Type": "text/csv"}

    await client.post("/api/transactions/import", headers=headers, content=csv_text)
    second = await client.post("/api/transactions/import", headers=headers, content=csv_text)

    assert second.json()["data"]["imported"] == 0
    assert second.json()["data"]["skipped"] == 1


async def test_import_csv_requires_content(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    response = await client.post(
        "/api/transactions/import",
        headers={**auth_header(user), "Content-Type": "text/csv"},
        content="",
    )
    assert response.status_code == 400


async def test_export_csv_neutralizes_formulas(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    account = await create_account(client, user, name="Ahorros")
    await create_transaction(
        client,
        user,
        account_id=account["id"],
        amount=1000,
        merchant="=SUM(1+1)",
        description="@peligro",
        date="2026-10-05",
    )

    response = await client.get("/api/transactions/export.csv", headers=auth_header(user))
    assert response.status_code == 200
    assert "'=SUM(1+1)" in response.text
    assert "'@peligro" in response.text


async def test_import_csv_rejects_long_fields(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    await create_account(client, user, name="Ahorros")
    long_field = "x" * 2001
    csv_text = HEADER + f"2026-10-05,gasto,10000,Ahorros,,,{long_field}\r\n"

    response = await client.post(
        "/api/transactions/import",
        headers={**auth_header(user), "Content-Type": "text/csv"},
        content=csv_text,
    )

    assert response.status_code == 200
    assert response.json()["data"]["imported"] == 0
    assert response.json()["data"]["errors"][0]["message"] == "campo demasiado largo"


async def test_import_csv_rejects_too_many_rows(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    await create_account(client, user, name="Ahorros")
    rows = "\r\n".join(["2026-10-05,gasto,1000,Ahorros,,,"] * 5001)
    csv_text = HEADER + rows + "\r\n"

    response = await client.post(
        "/api/transactions/import",
        headers={**auth_header(user), "Content-Type": "text/csv"},
        content=csv_text,
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "CSV_TOO_MANY_ROWS"


async def test_export_csv_does_not_leak_other_users(client: httpx.AsyncClient) -> None:
    user_a = await create_test_user(client)
    user_b = await create_test_user(client)
    account_a = await create_account(client, user_a, name="Ahorros")
    await create_transaction(
        client,
        user_a,
        account_id=account_a["id"],
        amount=5000,
        merchant="SecretoA",
        date="2026-10-05",
    )

    response = await client.get("/api/transactions/export.csv", headers=auth_header(user_b))
    assert response.status_code == 200
    assert "SecretoA" not in response.text


async def test_import_csv_cannot_use_other_users_account(
    client: httpx.AsyncClient,
) -> None:
    user_a = await create_test_user(client)
    user_b = await create_test_user(client)
    account_a = await create_account(client, user_a, name="Ahorros", balance=100000)
    csv_text = HEADER + "2026-10-05,gasto,30000,Ahorros,,,Viaje\r\n"

    response = await client.post(
        "/api/transactions/import",
        headers={**auth_header(user_b), "Content-Type": "text/csv"},
        content=csv_text,
    )

    assert response.status_code == 200
    assert response.json()["data"]["imported"] == 0
    assert len(response.json()["data"]["errors"]) == 1
    assert await get_account_balance(client, user_a, account_a["id"]) == Decimal("100000")
