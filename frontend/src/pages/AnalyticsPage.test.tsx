import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnalyticsPage } from './AnalyticsPage'

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
            from: '2026-05-01T00:00:00.000Z',
            to: '2026-10-17T00:00:00.000Z',
            totals: { income: 2000000, expense: 1500000, net: 500000, savingsRate: 25 },
            byCategory: [
              { id: 'c1', name: 'Transporte', color: '#f59e0b', total: 300000, percentage: 100, rank: 1 },
            ],
            byAccount: [],
          },
        })
      }
      if (url.includes('/analytics/monthly')) {
        return jsonResponse(200, {
          data: {
            from: 'a',
            to: 'b',
            months: [
              { month: '2026-10', income: 2000000, expense: 1500000, net: 500000, cumulativeNet: 500000 },
            ],
          },
        })
      }
      if (url.includes('/analytics/category-trends')) {
        return jsonResponse(200, {
          data: {
            from: 'a',
            to: 'b',
            trends: [
              {
                month: '2026-10',
                categoryId: 'c1',
                categoryName: 'Transporte',
                color: '#f59e0b',
                total: 300000,
                previous: 200000,
                changePct: 50,
              },
            ],
          },
        })
      }
      if (url.includes('/analytics/balance-timeline')) {
        return jsonResponse(200, {
          data: {
            from: 'a',
            to: 'b',
            timeline: [
              { date: '2026-10-05T00:00:00.000Z', delta: -50000, runningBalance: -50000 },
            ],
          },
        })
      }
      return jsonResponse(404, { error: { message: 'not found' } })
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AnalyticsPage', () => {
  it('muestra el resumen, las tendencias y la variación por categoría', async () => {
    mockApi()

    render(<AnalyticsPage />)

    expect(await screen.findByText('Tasa de ahorro')).toBeInTheDocument()
    expect(screen.getByText('25,0%')).toBeInTheDocument()
    expect(screen.getAllByText(/2\.000\.000/).length).toBeGreaterThan(0)
    expect(await screen.findByText('+50,0%')).toBeInTheDocument()
    expect(screen.getAllByText('Transporte').length).toBeGreaterThan(0)
    expect(screen.getByText('Variación por categoría (último mes)')).toBeInTheDocument()
  })
})
