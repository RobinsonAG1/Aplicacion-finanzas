import time

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

DEFAULT_MAX_BYTES = 1024 * 1024
IMPORT_MAX_BYTES = 5 * 1024 * 1024
IMPORT_PATH = "/api/transactions/import"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "no-referrer",
            "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
            "X-DNS-Prefetch-Control": "off",
        }
        if settings.is_production:
            headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        for name, value in headers.items():
            if name not in response.headers:
                response.headers[name] = value
        return response


class MaxBodySizeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        limit = IMPORT_MAX_BYTES if request.url.path == IMPORT_PATH else DEFAULT_MAX_BYTES
        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                declared = int(content_length)
            except ValueError:
                declared = limit + 1
            if declared > limit:
                return JSONResponse(
                    status_code=413,
                    content={
                        "error": {
                            "message": "El cuerpo de la solicitud es demasiado grande",
                            "code": "PAYLOAD_TOO_LARGE",
                        }
                    },
                )
        return await call_next(request)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if settings.is_test:
            return await call_next(request)

        started = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        logger.info(
            "request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=elapsed_ms,
        )
        return response
