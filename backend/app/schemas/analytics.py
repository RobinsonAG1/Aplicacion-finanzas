import uuid
from datetime import datetime

from pydantic import Field

from app.schemas.common import CamelModel


class AnalyticsTotals(CamelModel):
    income: float
    expense: float
    net: float
    savings_rate: float


class CategoryAnalytics(CamelModel):
    id: uuid.UUID
    name: str
    color: str
    total: float
    percentage: float
    rank: int


class AccountAnalytics(CamelModel):
    id: uuid.UUID
    name: str
    type: str
    balance: float
    net: float
    transactions: int


class SummaryData(CamelModel):
    from_date: datetime = Field(serialization_alias="from")
    to: datetime
    totals: AnalyticsTotals
    by_category: list[CategoryAnalytics]
    by_account: list[AccountAnalytics]


class SummaryResponse(CamelModel):
    data: SummaryData


class MonthlyPoint(CamelModel):
    month: str
    income: float
    expense: float
    net: float
    cumulative_net: float


class MonthlyData(CamelModel):
    from_date: datetime = Field(serialization_alias="from")
    to: datetime
    months: list[MonthlyPoint]


class MonthlyResponse(CamelModel):
    data: MonthlyData


class CategoryTrend(CamelModel):
    month: str
    category_id: uuid.UUID
    category_name: str
    color: str
    total: float
    previous: float | None
    change_pct: float | None


class TrendsData(CamelModel):
    from_date: datetime = Field(serialization_alias="from")
    to: datetime
    trends: list[CategoryTrend]


class TrendsResponse(CamelModel):
    data: TrendsData


class TimelinePoint(CamelModel):
    date: datetime
    delta: float
    running_balance: float


class TimelineData(CamelModel):
    from_date: datetime = Field(serialization_alias="from")
    to: datetime
    timeline: list[TimelinePoint]


class TimelineResponse(CamelModel):
    data: TimelineData
