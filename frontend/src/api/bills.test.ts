import { afterEach, describe, expect, it, vi } from 'vitest'
import { billsApi } from './bills'
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

describe('billsApi', () => {
  it('lista facturas sin y con filtro de estado', async () => {
    const fn = mockFetch({ status: 200, body: { data: [] } })

    await billsApi.list()
    await billsApi.list(true)

    expect(fn.mock.calls[0][0]).toBe('http://localhost:4000/api/bills')
    expect(fn.mock.calls[1][0]).toBe('http://localhost:4000/api/bills?isActive=true')
  })

  it('consulta próximos vencimientos', async () => {
    const fn = mockFetch({ status: 200, body: { data: { days: 30, upcoming: [] } } })

    const result = await billsApi.upcoming(30)

    expect(result.days).toBe(30)
    expect(fn.mock.calls[0][0]).toBe('http://localhost:4000/api/bills/upcoming?days=30')
  })

  it('crea una factura enviando el body', async () => {
    const fn = mockFetch({ status: 201, body: { data: { id: 'b1' } } })

    await billsApi.create({ name: 'Internet', amount: 120000, dueDay: 20, isActive: true })

    expect(fn.mock.calls[0][1].method).toBe('POST')
    expect(JSON.parse(fn.mock.calls[0][1].body as string)).toEqual({
      name: 'Internet',
      amount: 120000,
      dueDay: 20,
      isActive: true,
    })
  })

  it('paga una factura devolviendo factura y transacción', async () => {
    const fn = mockFetch({
      status: 201,
      body: { data: { bill: { id: 'b1' }, transaction: { id: 't1' } } },
    })

    const result = await billsApi.pay('b1', { accountId: 'a1', amount: 120000 })

    expect(result.transaction.id).toBe('t1')
    expect(fn.mock.calls[0][0]).toBe('http://localhost:4000/api/bills/b1/pay')
    expect(JSON.parse(fn.mock.calls[0][1].body as string)).toMatchObject({ accountId: 'a1' })
  })

  it('propaga el 409 al crear un recordatorio duplicado', async () => {
    mockFetch({
      status: 409,
      body: { error: { message: 'Ya existe un recordatorio para esa fecha', code: 'REMINDER_EXISTS' } },
    })

    await expect(billsApi.createReminder('b1')).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      code: 'REMINDER_EXISTS',
    })
    await expect(billsApi.createReminder('b1')).rejects.toBeInstanceOf(ApiError)
  })

  it('ejecuta los recordatorios y devuelve el resumen', async () => {
    const fn = mockFetch({ status: 200, body: { data: { created: 2, skipped: 1, reminders: [] } } })

    const result = await billsApi.runReminders({ days: 7, channel: 'LOG' })

    expect(result).toEqual({ created: 2, skipped: 1, reminders: [] })
    expect(fn.mock.calls[0][0]).toBe('http://localhost:4000/api/bills/reminders/run')
  })
})
