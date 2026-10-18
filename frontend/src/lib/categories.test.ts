import { describe, expect, it } from 'vitest'
import { categoriesByType, expenseCategories } from './categories'
import type { Category } from '../api/types'

const category = (id: string, type: Category['type']): Category => ({
  id,
  name: id,
  type,
  color: '#000000',
  isCustom: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const GASTO = category('g1', 'EXPENSE')
const INGRESO = category('i1', 'INCOME')

describe('categoriesByType', () => {
  const list = [GASTO, INGRESO]

  it('filtra las categorías por el tipo indicado', () => {
    expect(categoriesByType(list, 'EXPENSE')).toEqual([GASTO])
    expect(categoriesByType(list, 'INCOME')).toEqual([INGRESO])
  })

  it('no ofrece categorías para transferencias', () => {
    expect(categoriesByType(list, 'TRANSFER')).toEqual([])
  })
})

describe('expenseCategories', () => {
  it('devuelve solo las de gasto', () => {
    expect(expenseCategories([GASTO, INGRESO])).toEqual([GASTO])
  })
})
