import { apiRequest } from './client'
import { buildQueryString } from './query'
import type { BudgetPeriod } from './types'

export interface BudgetCategory {
  id: string
  name: string
  color: string
  type: string
}

export interface Budget {
  id: string
  categoryId: string
  limitAmount: string
  period: BudgetPeriod
  startDate: string
  endDate: string | null
  category: BudgetCategory
  createdAt: string
  updatedAt: string
}

export interface BudgetSummary {
  id: string
  category: BudgetCategory
  limitAmount: string
  period: BudgetPeriod
  startDate: string
  endDate: string | null
  spent: number
  remaining: number
  percentage: number
  exceeded: boolean
  window: { from: string; to: string } | null
}

export interface BudgetOverview {
  from: string
  to: string
  budgets: BudgetSummary[]
  totals: {
    limitAmount: number
    spent: number
    remaining: number
  }
}

export interface BudgetInput {
  categoryId: string
  limitAmount: number
  period: BudgetPeriod
  startDate: string
  endDate?: string | null
}

export const budgetsApi = {
  async list(period?: BudgetPeriod): Promise<Budget[]> {
    const result = await apiRequest<{ data: Budget[] }>(`/budgets${buildQueryString({ period })}`)
    return result.data
  },
  async overview(from?: string, to?: string): Promise<BudgetOverview> {
    const result = await apiRequest<{ data: BudgetOverview }>(
      `/budgets/overview${buildQueryString({ from, to })}`,
    )
    return result.data
  },
  async create(input: BudgetInput): Promise<Budget> {
    const result = await apiRequest<{ data: Budget }>('/budgets', { method: 'POST', body: input })
    return result.data
  },
  async update(id: string, input: Partial<BudgetInput>): Promise<Budget> {
    const result = await apiRequest<{ data: Budget }>(`/budgets/${id}`, {
      method: 'PUT',
      body: input,
    })
    return result.data
  },
  async remove(id: string): Promise<void> {
    await apiRequest<void>(`/budgets/${id}`, { method: 'DELETE' })
  },
}
