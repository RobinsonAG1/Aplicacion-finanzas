import type { Category, TransactionType } from '../api/types'

export function categoriesByType(categories: Category[], type: TransactionType): Category[] {
  if (type === 'TRANSFER') return []
  return categories.filter((category) => category.type === type)
}

export function expenseCategories(categories: Category[]): Category[] {
  return categoriesByType(categories, 'EXPENSE')
}
