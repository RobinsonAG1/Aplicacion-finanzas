import { apiDownload, apiRequest, apiUpload } from './client'
import type { Paginated, Transaction, TransactionType } from './types'

export interface TransactionQuery {
  page?: number
  limit?: number
  search?: string
  sort?: 'date' | 'amount' | 'createdAt'
  order?: 'asc' | 'desc'
  categoryId?: string
  accountId?: string
  type?: TransactionType
  from?: string
  to?: string
}

export interface TransactionInput {
  accountId: string
  categoryId?: string | null
  amount: number
  type: TransactionType
  description?: string
  merchant?: string
  date: string
}

export type TransactionUpdateInput = Partial<TransactionInput>

export interface Suggestion {
  category: { id: string; name: string; color: string; type: string }
  count: number
  confidence: number
}

export interface ImportRowError {
  row: number
  message: string
}

export interface ImportSummary {
  total: number
  imported: number
  skipped: number
  errors: ImportRowError[]
}

function toQueryString(query: object): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const transactionsApi = {
  list(query: TransactionQuery) {
    return apiRequest<Paginated<Transaction>>(`/transactions${toQueryString(query)}`)
  },
  async create(input: TransactionInput): Promise<Transaction> {
    const result = await apiRequest<{ data: Transaction }>('/transactions', {
      method: 'POST',
      body: input,
    })
    return result.data
  },
  async update(id: string, input: TransactionUpdateInput): Promise<Transaction> {
    const result = await apiRequest<{ data: Transaction }>(`/transactions/${id}`, {
      method: 'PUT',
      body: input,
    })
    return result.data
  },
  async remove(id: string): Promise<void> {
    await apiRequest<void>(`/transactions/${id}`, { method: 'DELETE' })
  },
  async setCategory(id: string, categoryId: string | null): Promise<Transaction> {
    const result = await apiRequest<{ data: Transaction }>(`/transactions/${id}/category`, {
      method: 'PATCH',
      body: { categoryId },
    })
    return result.data
  },
  async suggestions(merchant: string): Promise<Suggestion[]> {
    const result = await apiRequest<{ suggestions: Suggestion[] }>(
      `/transactions/suggestions${toQueryString({ merchant })}`,
    )
    return result.suggestions
  },
  exportCsv(query: TransactionQuery) {
    return apiDownload(`/transactions/export.csv${toQueryString(query)}`)
  },
  async importCsv(file: File): Promise<ImportSummary> {
    const formData = new FormData()
    formData.append('file', file)
    const result = await apiUpload<{ data: ImportSummary }>('/transactions/import', formData)
    return result.data
  },
}
