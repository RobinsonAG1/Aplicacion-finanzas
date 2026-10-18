import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransactionsPage } from './TransactionsPage'
import { jsonResponse } from '../test/helpers'

const ACCOUNT = {
  id: 'a1',
  name: 'Nómina',
  type: 'SAVINGS',
  balance: '500000',
  currency: 'COP',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const CATEGORY = {
  id: 'c1',
  name: 'Transporte',
  type: 'EXPENSE',
  color: '#f59e0b',
  isCustom: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const TRANSACTION = {
  id: 't1',
  accountId: 'a1',
  categoryId: 'c1',
  amount: '45000',
  type: 'EXPENSE',
  description: 'Viaje al centro',
  merchant: 'Uber',
  date: '2026-10-05T00:00:00.000Z',
  category: CATEGORY,
  account: { id: 'a1', name: 'Nómina', type: 'SAVINGS', currency: 'COP' },
}

function mockApi(transactions: unknown[], meta: Record<string, number>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/accounts')) return jsonResponse(200, { data: [ACCOUNT] })
      if (url.includes('/categories')) return jsonResponse(200, { data: [CATEGORY] })
      if (url.includes('/transactions')) {
        return jsonResponse(200, { data: transactions, meta })
      }
      return jsonResponse(404, { error: { message: 'not found' } })
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TransactionsPage', () => {
  it('muestra la lista con monto firmado y categoría asignada', async () => {
    mockApi([TRANSACTION], { total: 1, page: 1, limit: 20, totalPages: 1 })

    render(<TransactionsPage />)

    expect(await screen.findByText('Uber')).toBeInTheDocument()
    expect(screen.getByText('Viaje al centro')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Nómina' })).toBeInTheDocument()
    expect(screen.getByText(/45\.000/)).toBeInTheDocument()
    expect((screen.getByLabelText('Categoría') as HTMLSelectElement).value).toBe('c1')
  })

  it('muestra el estado vacío y oculta la paginación de una sola página', async () => {
    mockApi([], { total: 0, page: 1, limit: 20, totalPages: 0 })

    render(<TransactionsPage />)

    expect(
      await screen.findByText('No hay transacciones para los filtros seleccionados.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument()
  })
})
