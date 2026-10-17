import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BudgetsPage } from './BudgetsPage'

const CATEGORY = {
  id: 'c1',
  name: 'Transporte',
  type: 'EXPENSE',
  color: '#f59e0b',
  isCustom: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function summary(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    category: { id: 'c1', name: 'Transporte', color: '#f59e0b', type: 'EXPENSE' },
    limitAmount: '500000.00',
    period: 'MONTHLY',
    startDate: '2026-10-01T00:00:00.000Z',
    endDate: null,
    spent: 320000,
    remaining: 180000,
    percentage: 64,
    exceeded: false,
    window: { from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T23:59:59.999Z' },
    ...overrides,
  }
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  }
}

function mockApi(budgets: unknown[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/budgets/overview')) {
        return jsonResponse(200, {
          data: {
            from: '2026-10-01T00:00:00.000Z',
            to: '2026-10-31T23:59:59.999Z',
            budgets,
            totals: { limitAmount: 500000, spent: 320000, remaining: 180000 },
          },
        })
      }
      if (url.includes('/categories')) return jsonResponse(200, { data: [CATEGORY] })
      return jsonResponse(404, { error: { message: 'not found' } })
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BudgetsPage', () => {
  it('muestra tarjetas de progreso y totales', async () => {
    mockApi([summary()])

    render(<BudgetsPage />)

    expect(await screen.findByText('64.0%')).toBeInTheDocument()
    expect(screen.getByText('Límite total')).toBeInTheDocument()
    expect(screen.getByText('Disponible')).toBeInTheDocument()
    expect(screen.getAllByText(/500\.000/).length).toBeGreaterThan(0)
    expect(screen.getByText('64.0%').closest('.budget-card')?.textContent).toContain('Transporte')
  })

  it('marca los presupuestos excedidos', async () => {
    mockApi([summary({ percentage: 150, exceeded: true, spent: 750000, remaining: -250000 })])

    render(<BudgetsPage />)

    expect(await screen.findByText(/Excedido en/)).toBeInTheDocument()
    expect(screen.getByText('150.0%')).toBeInTheDocument()
    expect(screen.getByText(/Excedido en/).closest('.budget-card')?.textContent).toContain(
      'Transporte',
    )
  })

  it('muestra el estado vacío', async () => {
    mockApi([])

    render(<BudgetsPage />)

    expect(
      await screen.findByText('No hay presupuestos para el periodo seleccionado.'),
    ).toBeInTheDocument()
  })
})
