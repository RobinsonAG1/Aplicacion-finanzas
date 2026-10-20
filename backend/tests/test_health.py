from httpx import AsyncClient


async def test_health_returns_service_metadata(client: AsyncClient) -> None:
    response = await client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "finanzas-backend"
    assert body["environment"] == "test"
    assert body["uptime"] >= 0
    assert body["timestamp"].endswith("Z")


async def test_unknown_route_uses_error_envelope(client: AsyncClient) -> None:
    response = await client.get("/api/no-existe")

    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "NOT_FOUND"
    assert body["error"]["message"] == "Ruta no encontrada: GET /api/no-existe"


async def test_security_headers_are_present(client: AsyncClient) -> None:
    response = await client.get("/api/health")

    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "no-referrer"
