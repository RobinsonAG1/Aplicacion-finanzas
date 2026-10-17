import { apiRequest } from './client'
import type { Category, CategoryType } from './types'

export interface CategoryInput {
  name: string
  type: CategoryType
  color?: string
}

export interface CategoryUpdateInput {
  name?: string
  color?: string
}

export const categoriesApi = {
  async list(): Promise<Category[]> {
    const result = await apiRequest<{ data: Category[] }>('/categories')
    return result.data
  },
  async create(input: CategoryInput): Promise<Category> {
    const result = await apiRequest<{ data: Category }>('/categories', {
      method: 'POST',
      body: input,
    })
    return result.data
  },
  async update(id: string, input: CategoryUpdateInput): Promise<Category> {
    const result = await apiRequest<{ data: Category }>(`/categories/${id}`, {
      method: 'PUT',
      body: input,
    })
    return result.data
  },
  async remove(id: string): Promise<void> {
    await apiRequest<void>(`/categories/${id}`, { method: 'DELETE' })
  },
}
