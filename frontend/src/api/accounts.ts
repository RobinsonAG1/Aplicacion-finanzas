import { apiRequest } from './client'
import type { Account, AccountType } from './types'

export interface AccountInput {
  name: string
  type: AccountType
  balance?: number
  currency?: string
}

export type AccountUpdateInput = Partial<AccountInput>

export const accountsApi = {
  async list(): Promise<Account[]> {
    const result = await apiRequest<{ data: Account[] }>('/accounts')
    return result.data
  },
  async create(input: AccountInput): Promise<Account> {
    const result = await apiRequest<{ data: Account }>('/accounts', { method: 'POST', body: input })
    return result.data
  },
  async update(id: string, input: AccountUpdateInput): Promise<Account> {
    const result = await apiRequest<{ data: Account }>(`/accounts/${id}`, {
      method: 'PUT',
      body: input,
    })
    return result.data
  },
  async remove(id: string): Promise<void> {
    await apiRequest<void>(`/accounts/${id}`, { method: 'DELETE' })
  },
}
