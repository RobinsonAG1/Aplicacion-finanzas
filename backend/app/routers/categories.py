from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import AuthUser, get_current_user
from app.dependencies.db import get_db
from app.schemas.account import (
    CategoryCreate,
    CategoryListResponse,
    CategoryResponse,
    CategoryUpdate,
)
from app.services import category_service

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=CategoryListResponse)
async def list_categories(
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CategoryListResponse:
    categories = await category_service.list_categories(db, user.id)
    return CategoryListResponse(data=categories)


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CategoryResponse:
    category = await category_service.create_category(db, user.id, payload)
    return CategoryResponse(data=category)


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CategoryResponse:
    category = await category_service.get_category(db, user.id, category_id)
    return CategoryResponse(data=category)


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: str,
    payload: CategoryUpdate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CategoryResponse:
    category = await category_service.update_category(db, user.id, category_id, payload)
    return CategoryResponse(data=category)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await category_service.delete_category(db, user.id, category_id)
