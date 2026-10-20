import time
from datetime import UTC, datetime

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["health"])

_started_at = time.monotonic()


@router.get("/api/health")
async def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": "finanzas-backend",
        "uptime": round(time.monotonic() - _started_at, 3),
        "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "environment": settings.app_env,
    }
