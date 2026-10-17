import { afterEach, describe, expect, it, vi } from 'vitest'
import { budgetsApi } from './budgets'
import { tokenStore } from '../lib/tokens'

interface MockPayload {
  status: number
  body?: unknown
}

function mockFetch(payload: MockPayload): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    ok: payload.status >= 200 && payload.status < 300,
    status: payload.status,
    headers: { get: () => null },
    json: async () => payload.body,
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
  tokenStore.clear()
})

describe('budgetsApi', () => {
  it('lista presupuestos con filtro de periodo', async () => {
    const fn = mockFetch({ status: 200, body: { data: [{ id: 'b1', limitAmount: '500000.00' }] } })

    const budgets = await budgetsApi.list('MONTHLY')

    expect(budgets[0].id).toBe('b1')
    expect(fn.mock.calls[0][0]).toBe('http://localhost:4000/api/budgets?period=MONTHLY')
  })

  it('obtiene el overview con rango de fechas', async () => {
    const fn = mockFetch({
      status: 200,
      body: { data: { from: 'a', to: 'b', budgets: [], totals: { limitAmount: 0, spent: 0, remaining: 0 } } },
    })

    const overview = await budgetsApi.overview('2026-10-01T00:00:00.000', '2026-10-31T23:59:59.999')

    expect(overview.totals.limitAmount).toBe(0)
    expect(fn.mock.calls[0][0]).toBe(
      'http://localhost:4000/api/budgets/overview?from=2026-10-01T00%3A00%3A00.000&to=2026-10-31T23%3A59%3A59.999',
    )
  })

  it('crea un presupuesto enviando el body', async () => {
    const fn = mockFetch({ status: 201, body: { data: { id: 'b2' } } })

    await budgetsApi.create({
      categoryId: 'c1',
      limitAmount: 500000,
      period: 'MONTHLY',
      startDate: '2026-10-01',
      endDate: null,
    })

    expect(fn.mock.calls[0][1].method).toBe('POST')
    expect(JSON.parse(fn.mock.calls[0][1].body as string)).toEqual({
      categoryId: 'c1',
      limitAmount: 500000,
      period: 'MONTHLY',
      startDate: '2026-10-01',
      endDate: null,
    })
  })

  it('elimina un presupuesto (204)', async () => {
    const fn = mockFetch({ status: 204 })
    await expect(budgetsApi.remove('b1')).resolves.toBeUndefined()
    expect(fn.mock.calls[0][0]).toBe('http://localhost:4000/api/budgets/b1')
    expect(fn.mock.calls[0][1].method).toBe('DELETE')
  })
})
