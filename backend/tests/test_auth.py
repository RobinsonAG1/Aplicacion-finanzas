from typing import Any

import httpx

CREDENTIALS: dict[str, str] = {
    "name": "Usuario Prueba",
    "email": "auth@finanzas.test",
    "password": "Secreta123!",
}


def refresh_cookie(response: httpx.Response) -> str:
    for header in response.headers.get_list("set-cookie"):
        if header.startswith("refresh_token="):
            return header.split(";", 1)[0]
    return ""


async def register(
    client: httpx.AsyncClient, credentials: dict[str, str] | None = None
) -> httpx.Response:
    return await client.post("/api/auth/register", json=credentials or CREDENTIALS)


async def refresh_with_cookie(client: httpx.AsyncClient, cookie: str | None) -> httpx.Response:
    client.cookies.clear()
    headers: dict[str, str] = {}
    if cookie:
        headers["Cookie"] = cookie
    return await client.post("/api/auth/refresh", headers=headers)


async def test_register_returns_tokens_without_hash(client: httpx.AsyncClient) -> None:
    response = await register(client)

    assert response.status_code == 201
    body: dict[str, Any] = response.json()
    assert body["user"]["email"] == CREDENTIALS["email"]
    assert body["user"]["name"] == CREDENTIALS["name"]
    assert body["user"]["createdAt"].endswith("Z")
    assert isinstance(body["accessToken"], str)
    assert "passwordHash" not in body["user"]
    assert "refreshToken" not in body
    cookie = refresh_cookie(response)
    assert cookie.startswith("refresh_token=")
    raw_cookie = response.headers.get("set-cookie", "").lower()
    assert "httponly" in raw_cookie
    assert "samesite=strict" in raw_cookie


async def test_register_rejects_duplicate_email(client: httpx.AsyncClient) -> None:
    await register(client)
    response = await register(client)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "EMAIL_TAKEN"


async def test_register_rejects_invalid_payload(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/api/auth/register",
        json={"name": "X", "email": "no-es-email", "password": "123"},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    paths = {item["path"] for item in body["error"]["details"]}
    assert paths == {"name", "email", "password"}


async def test_login_with_valid_credentials(client: httpx.AsyncClient) -> None:
    await register(client)
    response = await client.post(
        "/api/auth/login",
        json={"email": CREDENTIALS["email"], "password": CREDENTIALS["password"]},
    )

    assert response.status_code == 200
    assert isinstance(response.json()["accessToken"], str)
    assert "refreshToken" not in response.json()
    assert refresh_cookie(response).startswith("refresh_token=")


async def test_login_rejects_wrong_password(client: httpx.AsyncClient) -> None:
    await register(client)
    response = await client.post(
        "/api/auth/login",
        json={"email": CREDENTIALS["email"], "password": "incorrecta"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


async def test_me_requires_valid_access_token(client: httpx.AsyncClient) -> None:
    registration = await register(client)
    access_token = registration.json()["accessToken"]

    unauthorized = await client.get("/api/auth/me")
    assert unauthorized.status_code == 401

    authorized = await client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {access_token}"}
    )
    assert authorized.status_code == 200
    assert authorized.json()["user"]["email"] == CREDENTIALS["email"]


async def test_refresh_rotates_token_and_rejects_reuse(
    client: httpx.AsyncClient,
) -> None:
    registration = await register(client)
    first_cookie = refresh_cookie(registration)
    assert first_cookie.startswith("refresh_token=")

    refreshed = await refresh_with_cookie(client, first_cookie)
    assert refreshed.status_code == 200
    assert isinstance(refreshed.json()["accessToken"], str)
    second_cookie = refresh_cookie(refreshed)
    assert second_cookie and second_cookie != first_cookie

    reuse = await refresh_with_cookie(client, first_cookie)
    assert reuse.status_code == 401


async def test_reuse_revokes_entire_family(client: httpx.AsyncClient) -> None:
    registration = await register(client)
    first_cookie = refresh_cookie(registration)

    rotated = await refresh_with_cookie(client, first_cookie)
    assert rotated.status_code == 200
    second_cookie = refresh_cookie(rotated)
    assert second_cookie != first_cookie

    reuse = await refresh_with_cookie(client, first_cookie)
    assert reuse.status_code == 401

    after_reuse = await refresh_with_cookie(client, second_cookie)
    assert after_reuse.status_code == 401


async def test_logout_revokes_refresh_token(client: httpx.AsyncClient) -> None:
    registration = await register(client)
    cookie = refresh_cookie(registration)

    client.cookies.clear()
    logout = await client.post("/api/auth/logout", headers={"Cookie": cookie})
    assert logout.status_code == 200
    assert logout.json() == {"success": True}

    after_logout = await refresh_with_cookie(client, cookie)
    assert after_logout.status_code == 401


async def test_refresh_without_cookie_is_rejected(client: httpx.AsyncClient) -> None:
    response = await refresh_with_cookie(client, None)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_REFRESH_TOKEN"


async def test_refresh_rejects_foreign_origin(client: httpx.AsyncClient) -> None:
    registration = await register(client)
    cookie = refresh_cookie(registration)

    client.cookies.clear()
    response = await client.post(
        "/api/auth/refresh",
        headers={"Cookie": cookie, "Origin": "https://sitio-malicioso.example"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "CSRF_ORIGIN_MISMATCH"


async def test_me_rejects_invalid_access_token(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/auth/me", headers={"Authorization": "Bearer token.falso.xxx"})

    assert response.status_code == 401
