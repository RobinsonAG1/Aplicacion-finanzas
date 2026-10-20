from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cookies import (
    clear_refresh_cookie,
    get_refresh_cookie,
    set_refresh_cookie,
)
from app.core.errors import AppError
from app.core.rate_limit import limiter
from app.dependencies.auth import AuthUser, csrf_protection, get_current_user
from app.dependencies.db import get_db
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    LogoutResponse,
    MeResponse,
    RegisterRequest,
)
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _token_context(request: Request) -> auth_service.TokenContext:
    return auth_service.TokenContext(
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    )


def _auth_response(result: auth_service.AuthResult) -> AuthResponse:
    return AuthResponse(user=result.user, access_token=result.access_token)


@router.post("/register", response_model=AuthResponse, status_code=201)
@limiter.limit("20/15minutes")
async def register(
    request: Request,
    payload: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    result = await auth_service.register(db, payload, _token_context(request))
    set_refresh_cookie(response, result.refresh_token)
    return _auth_response(result)


@router.post("/login", response_model=AuthResponse)
@limiter.limit("10/15minutes")
async def login(
    request: Request,
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    result = await auth_service.login(db, payload, _token_context(request))
    set_refresh_cookie(response, result.refresh_token)
    return _auth_response(result)


@router.post(
    "/refresh",
    response_model=AuthResponse,
    dependencies=[Depends(csrf_protection)],
)
@limiter.limit("60/15minutes")
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    refresh_token = get_refresh_cookie(request)
    if not refresh_token:
        raise AppError("Refresh token no proporcionado", 401, code="INVALID_REFRESH_TOKEN")
    result = await auth_service.refresh(db, refresh_token, _token_context(request))
    set_refresh_cookie(response, result.refresh_token)
    return _auth_response(result)


@router.post(
    "/logout",
    response_model=LogoutResponse,
    dependencies=[Depends(csrf_protection)],
)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> LogoutResponse:
    refresh_token = get_refresh_cookie(request)
    if refresh_token:
        await auth_service.logout(db, refresh_token)
    clear_refresh_cookie(response)
    return LogoutResponse(success=True)


@router.get("/me", response_model=MeResponse)
async def me(
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MeResponse:
    return MeResponse(user=await auth_service.me(db, user.id))
