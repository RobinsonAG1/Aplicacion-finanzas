import { afterEach, describe, expect, it, vi } from 'vitest'
import { potsApi } from './pots'
import { ApiError } from './client'
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

describe('potsApi', () => {
  it('lista huchas y desenvuelve data', async () => {
    const fn = mockFetch({ status: 200, body: { data: [{ id: 'p1', name: 'Vacaciones' }] } })

    const pots = await potsApi.list()

    expect(pots[0].name).toBe('Vacaciones')
    expect(fn.mock.calls[0][0]).toBe('http://localhost:4000/api/pots')
  })

  it('obtiene el detalle con historial y límite', async () => {
    const fn = mockFetch({
      status: 200,
      body: { data: { id: 'p1', transactions: [{ id: 'm1', amount: '250000.00' }] } },
    })

    const detail = await potsApi.get('p1', 10)

    expect(detail.transactions).toHaveLength(1)
    expect(fn.mock.calls[0][0]).toBe('http://localhost:4000/api/pots/p1?limit=10')
  })

  it('deposita enviando monto y nota', async () => {
    const fn = mockFetch({ status: 201, body: { data: { id: 'p1', currentAmount: '300000.00' } } })

    await potsApi.deposit('p1', { amount: 50000, note: 'Ahorro' })

    expect(fn.mock.calls[0][0]).toBe('http://localhost:4000/api/pots/p1/deposit')
    expect(fn.mock.calls[0][1].method).toBe('POST')
    expect(JSON.parse(fn.mock.calls[0][1].body as string)).toEqual({ amount: 50000, note: 'Ahorro' })
  })

  it('propaga el error de fondos insuficientes al retirar', async () => {
    mockFetch({
      status: 422,
      body: { error: { message: 'Saldo insuficiente en la hucha', code: 'POT_INSUFFICIENT_FUNDS' } },
    })

    await expect(potsApi.withdraw('p1', { amount: 999999 })).rejects.toMatchObject({
      name: 'ApiError',
      status: 422,
      code: 'POT_INSUFFICIENT_FUNDS',
    })
    await expect(potsApi.withdraw('p1', { amount: 1 })).rejects.toBeInstanceOf(ApiError)
  })

  it('elimina una hucha (204)', async () => {
    const fn = mockFetch({ status: 204 })
    await expect(potsApi.remove('p1')).resolves.toBeUndefined()
    expect(fn.mock.calls[0][1].method).toBe('DELETE')
  })
})
