import { apiRequest } from './client'
import type { PotTransactionType } from './types'

export interface Pot {
  id: string
  name: string
  color: string
  targetAmount: string
  currentAmount: string
  remaining: number
  percentage: number
  completed: boolean
  createdAt: string
  updatedAt: string
}

export interface PotMovement {
  id: string
  amount: string
  type: PotTransactionType
  date: string
  note: string | null
}

export interface PotDetail extends Pot {
  transactions: PotMovement[]
}

export interface PotInput {
  name: string
  targetAmount: number
  color?: string
}

export interface PotMovementInput {
  amount: number
  note?: string
  date?: string
}

export const potsApi = {
  async list(): Promise<Pot[]> {
    const result = await apiRequest<{ data: Pot[] }>('/pots')
    return result.data
  },
  async get(id: string, limit?: number): Promise<PotDetail> {
    const query = limit ? `?limit=${limit}` : ''
    const result = await apiRequest<{ data: PotDetail }>(`/pots/${id}${query}`)
    return result.data
  },
  async create(input: PotInput): Promise<Pot> {
    const result = await apiRequest<{ data: Pot }>('/pots', { method: 'POST', body: input })
    return result.data
  },
  async update(id: string, input: Partial<PotInput>): Promise<Pot> {
    const result = await apiRequest<{ data: Pot }>(`/pots/${id}`, { method: 'PUT', body: input })
    return result.data
  },
  async remove(id: string): Promise<void> {
    await apiRequest<void>(`/pots/${id}`, { method: 'DELETE' })
  },
  async deposit(id: string, input: PotMovementInput): Promise<Pot> {
    const result = await apiRequest<{ data: Pot }>(`/pots/${id}/deposit`, {
      method: 'POST',
      body: input,
    })
    return result.data
  },
  async withdraw(id: string, input: PotMovementInput): Promise<Pot> {
    const result = await apiRequest<{ data: Pot }>(`/pots/${id}/withdraw`, {
      method: 'POST',
      body: input,
    })
    return result.data
  },
}
