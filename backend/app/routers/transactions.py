from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.datastructures import UploadFile

from app.core.errors import AppError
from app.db.models.enums import TransactionType
from app.dependencies.auth import AuthUser, get_current_user
from app.dependencies.db import get_db
from app.schemas.transaction import (
    SetCategoryRequest,
    SortField,
    SortOrder,
    SuggestionsResponse,
    TransactionCreate,
    TransactionListResponse,
    TransactionResponse,
    TransactionUpdate,
)
from app.schemas.transaction_csv import ImportResponse
from app.services import transaction_csv_service, transaction_service

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


async def _extract_csv_text(request: Request) -> str:
    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    text = ""

    if content_type == "multipart/form-data":
        form = await request.form()
        file = form.get("file")
        if isinstance(file, UploadFile):
            text = (await file.read()).decode("utf-8", errors="replace")
        elif isinstance(file, str):
            text = file
        if not text.strip():
            csv_value = form.get("csv")
            if isinstance(csv_value, str):
                text = csv_value
    elif content_type == "application/json":
        payload: Any = await request.json()
        if isinstance(payload, dict) and isinstance(payload.get("csv"), str):
            text = payload["csv"]
    else:
        text = (await request.body()).decode("utf-8", errors="replace")

    if not text.strip():
        raise AppError(
            'Debe adjuntar un archivo CSV en el campo "file" o enviar el contenido en "csv"',
            400,
            code="CSV_REQUIRED",
        )
    return text


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: str | None = Query(None, min_length=1, max_length=100),
    sort: SortField = "date",
    order: SortOrder = "desc",
    category_id: str | None = Query(None, alias="categoryId", min_length=1),
    account_id: str | None = Query(None, alias="accountId", min_length=1),
    type: TransactionType | None = None,
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionListResponse:
    return await transaction_service.list_transactions(
        db,
        user.id,
        page=page,
        limit=limit,
        search=search,
        sort=sort,
        order=order,
        category_id=category_id,
        account_id=account_id,
        transaction_type=type,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/suggestions", response_model=SuggestionsResponse)
async def suggestions(
    merchant: str = Query(..., min_length=1, max_length=120),
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuggestionsResponse:
    return await transaction_service.suggestions(db, user.id, merchant.strip())


@router.get("/export.csv")
async def export_transactions(
    search: str | None = Query(None, min_length=1, max_length=100),
    category_id: str | None = Query(None, alias="categoryId", min_length=1),
    account_id: str | None = Query(None, alias="accountId", min_length=1),
    type: TransactionType | None = None,
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    csv_text = await transaction_csv_service.export_csv(
        db,
        user.id,
        search=search,
        category_id=category_id,
        account_id=account_id,
        transaction_type=type,
        date_from=date_from,
        date_to=date_to,
    )
    return Response(
        content=csv_text.encode("utf-8"),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="transacciones.csv"'},
    )


@router.post("/import", response_model=ImportResponse)
async def import_transactions(
    request: Request,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ImportResponse:
    csv_text = await _extract_csv_text(request)
    summary = await transaction_csv_service.import_csv(db, user.id, csv_text)
    return ImportResponse(data=summary)


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    payload: TransactionCreate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    transaction = await transaction_service.create_transaction(db, user.id, payload)
    return TransactionResponse(data=transaction)


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    transaction = await transaction_service.get_transaction(db, user.id, transaction_id)
    return TransactionResponse(data=transaction)


@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: str,
    payload: TransactionUpdate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    transaction = await transaction_service.update_transaction(db, user.id, transaction_id, payload)
    return TransactionResponse(data=transaction)


@router.patch("/{transaction_id}/category", response_model=TransactionResponse)
async def set_category(
    transaction_id: str,
    payload: SetCategoryRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    transaction = await transaction_service.set_category(db, user.id, transaction_id, payload)
    return TransactionResponse(data=transaction)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await transaction_service.delete_transaction(db, user.id, transaction_id)
