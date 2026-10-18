import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyticsApi } from './analytics'
import { tokenStore } from '../lib/tokens'
import { stubFetchResponse } from '../test/helpers'

afterEach(() => {
  vi.unstubAllGlobals()
  tokenStore.clear()
})

describe('analyticsApi', () => {
  it('obtiene el resumen con rango', async () => {
    const fn = stubFetchResponse({
      status: 200,
      body: { data: { from: 'a', to: 'b', totals: { income: 1 }, byCategory: [], byAccount: [] } },
    })

    const summary = await analyticsApi.summary('2026-01-01T00:00:00.000Z', '2026-06-30T23:59:59.999Z')

    expect(summary.totals.income).toBe(1)
    expect(fn.mock.calls[0][0]).toBe(
      'http://localhost:4000/api/analytics/summary?from=2026-01-01T00%3A00%3A00.000Z&to=2026-06-30T23%3A59%3A59.999Z',
    )
  })

  it('pide la serie mensual con el número de meses', async () => {
    const fn = stubFetchResponse({ status: 200, body: { data: { months: [] } } })

    await analyticsApi.monthly(6)

    expect(fn.mock.calls[0][0]).toBe('http://localhost:4000/api/analytics/monthly?months=6')
  })

  it('pide las tendencias sin parámetros por defecto', async () => {
    const fn = stubFetchResponse({ status: 200, body: { data: { trends: [] } } })

    await analyticsApi.categoryTrends()

    expect(fn.mock.calls[0][0]).toBe('http://localhost:4000/api/analytics/category-trends')
  })

  it('pide la evolución de saldo con rango y límite', async () => {
    const fn = stubFetchResponse({ status: 200, body: { data: { timeline: [] } } })

    await analyticsApi.balanceTimeline('2026-01-01T00:00:00.000Z', '2026-06-30T23:59:59.999Z', 500)

    expect(fn.mock.calls[0][0]).toContain('/analytics/balance-timeline?')
    expect(fn.mock.calls[0][0]).toContain('limit=500')
  })
})
