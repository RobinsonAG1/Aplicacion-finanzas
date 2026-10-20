from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import AuthUser, get_current_user
from app.dependencies.db import get_db
from app.schemas.bill import (
    BillCreate,
    BillListResponse,
    BillPay,
    BillResponse,
    BillUpdate,
    PayBillResponse,
    ReminderCreate,
    ReminderListResponse,
    ReminderResponse,
    RunReminders,
    RunRemindersResponse,
    UpcomingDataResponse,
)
from app.services import bill_service

router = APIRouter(prefix="/api/bills", tags=["bills"])


@router.get("", response_model=BillListResponse)
async def list_bills(
    is_active: bool | None = Query(None, alias="isActive"),
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BillListResponse:
    bills = await bill_service.list_bills(db, user.id, is_active)
    return BillListResponse(data=bills)


@router.get("/upcoming", response_model=UpcomingDataResponse)
async def upcoming(
    days: int = Query(30, ge=1, le=365),
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UpcomingDataResponse:
    result = await bill_service.upcoming(db, user.id, days)
    return UpcomingDataResponse(data=result)


@router.post("/reminders/run", response_model=RunRemindersResponse)
async def run_reminders(
    payload: RunReminders,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RunRemindersResponse:
    result = await bill_service.run_reminders(db, user.id, payload)
    return RunRemindersResponse(data=result)


@router.post("", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
async def create_bill(
    payload: BillCreate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BillResponse:
    bill = await bill_service.create_bill(db, user.id, payload)
    return BillResponse(data=bill)


@router.get("/{bill_id}", response_model=BillResponse)
async def get_bill(
    bill_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BillResponse:
    bill = await bill_service.get_bill(db, user.id, bill_id)
    return BillResponse(data=bill)


@router.put("/{bill_id}", response_model=BillResponse)
async def update_bill(
    bill_id: str,
    payload: BillUpdate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BillResponse:
    bill = await bill_service.update_bill(db, user.id, bill_id, payload)
    return BillResponse(data=bill)


@router.delete("/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bill(
    bill_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await bill_service.delete_bill(db, user.id, bill_id)


@router.get("/{bill_id}/reminders", response_model=ReminderListResponse)
async def list_reminders(
    bill_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReminderListResponse:
    reminders = await bill_service.list_reminders(db, user.id, bill_id)
    return ReminderListResponse(data=reminders)


@router.post(
    "/{bill_id}/reminders",
    response_model=ReminderResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_reminder(
    bill_id: str,
    payload: ReminderCreate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReminderResponse:
    reminder = await bill_service.create_reminder(db, user.id, bill_id, payload)
    return ReminderResponse(data=reminder)


@router.post(
    "/{bill_id}/pay",
    response_model=PayBillResponse,
    status_code=status.HTTP_201_CREATED,
)
async def pay_bill(
    bill_id: str,
    payload: BillPay,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PayBillResponse:
    result = await bill_service.pay_bill(db, user.id, bill_id, payload)
    return PayBillResponse(data=result)
