import httpx

from tests.api_helpers import auth_header, create_test_user


async def test_create_custom_category(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    response = await client.post(
        "/api/categories",
        headers=auth_header(user),
        json={"name": "Mascotas", "type": "EXPENSE", "color": "#ff8800"},
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["isCustom"] is True
    assert data["color"] == "#ff8800"


async def test_reject_invalid_color(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    response = await client.post(
        "/api/categories",
        headers=auth_header(user),
        json={"name": "Mascotas", "type": "EXPENSE", "color": "rojo"},
    )

    assert response.status_code == 422


async def test_reject_duplicate_name_and_type(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    payload = {"name": "Viajes", "type": "EXPENSE"}
    first = await client.post("/api/categories", headers=auth_header(user), json=payload)
    assert first.status_code == 201

    second = await client.post("/api/categories", headers=auth_header(user), json=payload)
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "CATEGORY_EXISTS"


async def test_same_name_with_different_type_is_allowed(
    client: httpx.AsyncClient,
) -> None:
    user = await create_test_user(client)
    expense = await client.post(
        "/api/categories",
        headers=auth_header(user),
        json={"name": "Ajuste", "type": "EXPENSE"},
    )
    income = await client.post(
        "/api/categories",
        headers=auth_header(user),
        json={"name": "Ajuste", "type": "INCOME"},
    )

    assert expense.status_code == 201
    assert income.status_code == 201


async def test_categories_are_isolated_between_users(
    client: httpx.AsyncClient,
) -> None:
    user_a = await create_test_user(client)
    user_b = await create_test_user(client)
    await client.post(
        "/api/categories",
        headers=auth_header(user_a),
        json={"name": "Solo A", "type": "EXPENSE"},
    )

    response = await client.get("/api/categories", headers=auth_header(user_b))

    assert response.status_code == 200
    assert response.json()["data"] == []


async def test_cannot_modify_or_delete_other_users_category(
    client: httpx.AsyncClient,
) -> None:
    user_a = await create_test_user(client)
    user_b = await create_test_user(client)
    created = await client.post(
        "/api/categories",
        headers=auth_header(user_a),
        json={"name": "Privada", "type": "EXPENSE"},
    )
    category_id = created.json()["data"]["id"]

    update = await client.put(
        f"/api/categories/{category_id}",
        headers=auth_header(user_b),
        json={"name": "Hackeada"},
    )
    assert update.status_code == 404

    delete = await client.delete(f"/api/categories/{category_id}", headers=auth_header(user_b))
    assert delete.status_code == 404


async def test_update_category_color(client: httpx.AsyncClient) -> None:
    user = await create_test_user(client)
    created = await client.post(
        "/api/categories",
        headers=auth_header(user),
        json={"name": "Mascotas", "type": "EXPENSE"},
    )
    category_id = created.json()["data"]["id"]

    response = await client.put(
        f"/api/categories/{category_id}",
        headers=auth_header(user),
        json={"color": "#00ccff"},
    )

    assert response.status_code == 200
    assert response.json()["data"]["color"] == "#00ccff"


async def test_update_requires_at_least_one_field(
    client: httpx.AsyncClient,
) -> None:
    user = await create_test_user(client)
    created = await client.post(
        "/api/categories",
        headers=auth_header(user),
        json={"name": "Mascotas", "type": "EXPENSE"},
    )
    category_id = created.json()["data"]["id"]

    response = await client.put(
        f"/api/categories/{category_id}", headers=auth_header(user), json={}
    )

    assert response.status_code == 422
