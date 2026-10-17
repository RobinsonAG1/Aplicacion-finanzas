import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DashboardPage } from './DashboardPage'
import { AuthContext } from '../features/auth/auth-context'

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  }
}

function mockApi(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/analytics/summary')) {
        return jsonResponse(200, {
          data: {
            from: 'a',
            to: 'b',
            totals: { income: 2000000, expense: 1500000, net: 500000, savingsRate: 25 },
            byCategory: [],
            byAccount: [],
          },
        })
      }
      if (url.includes('/bills/upcoming')) {
        return jsonResponse(200, {
          data: {
            days: 30,
            upcoming: [
              {
                id: 'b1',
                name: 'Internet',
                amount: '120000.00',
                category: null,
                dueDate: '2026-10-20T00:00:00.000Z',
                daysUntil: 3,
                overdue: false,
              },
              {
                id: 'b2',
                name: 'Luz',
                amount: '80000.00',
                category: null,
                dueDate: '2026-10-10T00:00:00.000Z',
                daysUntil: -2,
                overdue: true,
              },
            ],
          },
        })
      }
      if (url.includes('/budgets/overview')) {
        return jsonResponse(200, {
          data: {
            from: 'a',
            to: 'b',
            budgets: [
              {
                id: 'bu1',
                category: { id: 'c1', name: 'Transporte', color: '#f59e0b', type: 'EXPENSE' },
                limitAmount: '500000.00',
                period: 'MONTHLY',
                startDate: '2026-10-01T00:00:00.000Z',
                endDate: null,
                spent: 320000,
                remaining: 180000,
                percentage: 64,
                exceeded: false,
                window: { from: 'a', to: 'b' },
              },
            ],
            totals: { limitAmount: 500000, spent: 320000, remaining: 180000 },
          },
        })
      }
      if (url.includes('/pots')) {
        return jsonResponse(200, {
          data: [
            {
              id: 'p1',
              name: 'Vacaciones',
              color: '#22c55e',
              targetAmount: '1000000.00',
              currentAmount: '250000.00',
              remaining: 750000,
              percentage: 25,
              completed: false,
              createdAt: 'a',
              updatedAt: 'b',
            },
          ],
        })
      }
      if (url.includes('/transactions')) {
        return jsonResponse(200, {
          data: [
            {
              id: 't1',
              accountId: 'a1',
              categoryId: null,
              amount: '45000',
              type: 'EXPENSE',
              description: null,
              merchant: 'Uber',
              date: '2026-10-05T00:00:00.000Z',
              category: null,
              account: null,
            },
          ],
          meta: { total: 1, page: 1, limit: 5, totalPages: 1 },
        })
      }
      return jsonResponse(404, { error: { message: 'not found' } })
    }),
  )
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          user: { id: 'u1', email: 'demo@finanzas.test', name: 'Demo', createdAt: 'a' },
          loading: false,
          login: async () => {},
          register: async () => {},
          logout: async () => {},
        }}
      >
        <DashboardPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DashboardPage', () => {
  it('muestra el resumen del mes y los paneles agregados', async () => {
    mockApi()

    renderDashboard()

    expect(await screen.findByText('Hola, Demo')).toBeInTheDocument()
    expect(screen.getByText('Tasa de ahorro')).toBeInTheDocument()
    expect(screen.getByText('25,0%')).toBeInTheDocument()

    expect(await screen.findByText('Internet')).toBeInTheDocument()
    expect(screen.getByText('Luz')).toBeInTheDocument()
    expect(screen.getByText('Vencida')).toBeInTheDocument()

    expect(screen.getByText('Transporte')).toBeInTheDocument()
    expect(await screen.findByText('Vacaciones')).toBeInTheDocument()
    expect(await screen.findByText('Uber')).toBeInTheDocument()
  })
})
