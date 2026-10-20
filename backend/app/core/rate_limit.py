from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

# Limite global: 300 peticiones / 15 minutos por IP (igual que Express).
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["300/15minutes"],
    headers_enabled=True,
    enabled=not settings.is_test,
)
