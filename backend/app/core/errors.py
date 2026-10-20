from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.cookies import clear_refresh_cookie
from app.core.logging import get_logger

logger = get_logger(__name__)


class AppError(Exception):
    def __init__(
        self,
        message: str,
        status_code: int = 500,
        *,
        code: str | None = None,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.details = details


def error_body(
    message: str,
    code: str | None = None,
    details: Any = None,
) -> dict[str, Any]:
    error: dict[str, Any] = {"message": message}
    if code is not None:
        error["code"] = code
    if details is not None:
        error["details"] = details
    return {"error": error}


def _path_and_method(request: Request) -> str:
    target = request.url.path
    if request.url.query:
        target = f"{target}?{request.url.query}"
    return f"{request.method} {target}"


async def app_error_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, AppError):
        return await unhandled_exception_handler(request, exc)
    response = JSONResponse(
        status_code=exc.status_code,
        content=error_body(exc.message, exc.code, exc.details),
    )
    if request.url.path == "/api/auth/refresh":
        clear_refresh_cookie(response)
    return response


async def validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    details: list[dict[str, str]] = []
    for error in exc.errors():
        location = [str(part) for part in error.get("loc", [])]
        if location and location[0] in {"body", "query", "path", "header", "cookie"}:
            location = location[1:]
        details.append(
            {
                "path": ".".join(location),
                "message": str(error.get("msg", "Dato invalido")),
            }
        )
    logger.warning("Datos de entrada invalidos", path=_path_and_method(request))
    return JSONResponse(
        status_code=422,
        content=error_body("Datos de entrada invalidos", "VALIDATION_ERROR", details),
    )


async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    if exc.status_code == 404:
        message = f"Ruta no encontrada: {_path_and_method(request)}"
        code = "NOT_FOUND"
    else:
        message = exc.detail if isinstance(exc.detail, str) else "Error en la solicitud"
        code = None
    return JSONResponse(status_code=exc.status_code, content=error_body(message, code))


async def rate_limit_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RateLimitExceeded)
    logger.warning("Limite de solicitudes excedido", path=_path_and_method(request))
    return JSONResponse(
        status_code=429,
        content=error_body(
            "Demasiadas solicitudes, intenta mas tarde",
            "RATE_LIMITED",
        ),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(
        "Error no controlado",
        path=_path_and_method(request),
        error_type=type(exc).__name__,
    )
    details: Any = None
    if not settings.is_production:
        details = {"stack": f"{type(exc).__name__}: {exc}"}
    return JSONResponse(
        status_code=500,
        content=error_body("Error interno del servidor", details=details),
    )
