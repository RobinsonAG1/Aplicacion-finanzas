import { apiRequest } from './client'

export interface AnalyticsTotals {
  income: number
  expense: number
  net: number
  savingsRate: number
}

export interface CategorySpend {
  id: string
  name: string
  color: string
  total: number
  percentage: number
  rank: number
}

export interface AccountNet {
  id: string
  name: string
  type: string
  balance: number
  net: number
  transactions: number
}

export interface SummaryResult {
  from: string
  to: string
  totals: AnalyticsTotals
  byCategory: CategorySpend[]
  byAccount: AccountNet[]
}

export interface MonthlyPoint {
  month: string
  income: number
  expense: number
  net: number
  cumulativeNet: number
}

export interface MonthlyResult {
  from: string
  to: string
  months: MonthlyPoint[]
}

export interface TrendPoint {
  month: string
  categoryId: string
  categoryName: string
  color: string
  total: number
  previous: number | null
  changePct: number | null
}

export interface TrendsResult {
  from: string
  to: string
  trends: TrendPoint[]
}

export interface TimelinePoint {
  date: string
  delta: number
  runningBalance: number
}

export interface TimelineResult {
  from: string
  to: string
  timeline: TimelinePoint[]
}

function toQueryString(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const analyticsApi = {
  async summary(from?: string, to?: string): Promise<SummaryResult> {
    const result = await apiRequest<{ data: SummaryResult }>(
      `/analytics/summary${toQueryString({ from, to })}`,
    )
    return result.data
  },
  async monthly(months?: number): Promise<MonthlyResult> {
    const result = await apiRequest<{ data: MonthlyResult }>(
      `/analytics/monthly${toQueryString({ months })}`,
    )
    return result.data
  },
  async categoryTrends(months?: number): Promise<TrendsResult> {
    const result = await apiRequest<{ data: TrendsResult }>(
      `/analytics/category-trends${toQueryString({ months })}`,
    )
    return result.data
  },
  async balanceTimeline(from?: string, to?: string, limit?: number): Promise<TimelineResult> {
    const result = await apiRequest<{ data: TimelineResult }>(
      `/analytics/balance-timeline${toQueryString({ from, to, limit })}`,
    )
    return result.data
  },
}
