import uuid

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
