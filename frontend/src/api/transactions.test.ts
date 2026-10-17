import { afterEach, describe, expect, it, vi } from 'vitest'
import { transactionsApi } from './transactions'
import { tokenStore } from '../lib/tokens'

interface MockPayload {
  status: number
  body?: unknown
  blobText?: string
  headers?: Record<string, string>
}

function mockFetch(payload: MockPayload): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    ok: payload.status >= 200 && payload.status < 300,
    status: payload.status,
    headers: { get: (name: string) => payload.headers?.[name.toLowerCase()] ?? null },
    json: async () => payload.body,
    blob: async () => new Blob([payload.blobText ?? '']),
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
  tokenStore.clear()
})

describe('transactionsApi', () => {
  it('lista con filtros y paginación en la query string', async () => {
    const fn = mockFetch({
      status: 200,
      body: { data: [], meta: { total: 0, page: 2, limit: 20, totalPages: 0 } },
    })

    await transactionsApi.list({ page: 2, limit: 20, search: 'uber', type: 'EXPENSE' })

    expect(fn.mock.calls[0][0]).toBe(
      'http://localhost:4000/api/transactions?page=2&limit=20&search=uber&type=EXPENSE',
    )
    expect(fn.mock.calls[0][1].method).toBe('GET')
  })

  it('crea una transacción y desenvuelve data', async () => {
    const fn = mockFetch({ status: 201, body: { data: { id: 't1', amount: '45000' } } })

    const created = await transactionsApi.create({
      accountId: 'a1',
      amount: 45000,
      type: 'EXPENSE',
      date: '2026-10-05',
    })

    expect(created.id).toBe('t1')
    expect(JSON.parse(fn.mock.calls[0][1].body as string)).toMatchObject({
      accountId: 'a1',
      amount: 45000,
      type: 'EXPENSE',
    })
  })

  it('cambia la categoría con PATCH', async () => {
    const fn = mockFetch({ status: 200, body: { data: { id: 't1' } } })

    await transactionsApi.setCategory('t1', null)

    expect(fn.mock.calls[0][0]).toBe('http://localhost:4000/api/transactions/t1/category')
    expect(fn.mock.calls[0][1].method).toBe('PATCH')
    expect(JSON.parse(fn.mock.calls[0][1].body as string)).toEqual({ categoryId: null })
  })

  it('obtiene sugerencias de categoría por comercio', async () => {
    const fn = mockFetch({
      status: 200,
      body: {
        suggestions: [
          {
            category: { id: 'c1', name: 'Transporte', color: '#f59e0b', type: 'EXPENSE' },
            count: 3,
            confidence: 0.9,
          },
        ],
      },
    })

    const suggestions = await transactionsApi.suggestions('Uber')

    expect(suggestions[0].category.name).toBe('Transporte')
    expect(fn.mock.calls[0][0]).toBe(
      'http://localhost:4000/api/transactions/suggestions?merchant=Uber',
    )
  })

  it('exporta el CSV como blob con el nombre del archivo', async () => {
    const fn = mockFetch({
      status: 200,
      blobText: 'fecha,comercio,monto',
      headers: { 'content-disposition': 'attachment; filename="transacciones.csv"' },
    })

    const { blob, filename } = await transactionsApi.exportCsv({ type: 'EXPENSE' })

    expect(filename).toBe('transacciones.csv')
    expect(await blob.text()).toBe('fecha,comercio,monto')
    expect(fn.mock.calls[0][0]).toBe(
      'http://localhost:4000/api/transactions/export.csv?type=EXPENSE',
    )
  })

  it('importa un CSV como multipart y devuelve el resumen', async () => {
    const fn = mockFetch({
      status: 200,
      body: { data: { total: 2, imported: 1, skipped: 1, errors: [] } },
    })

    const file = new File(['fecha,comercio'], 'movimientos.csv', { type: 'text/csv' })
    const summary = await transactionsApi.importCsv(file)

    expect(summary).toEqual({ total: 2, imported: 1, skipped: 1, errors: [] })
    const [, init] = fn.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('file')).toBe(file)
  })
})
