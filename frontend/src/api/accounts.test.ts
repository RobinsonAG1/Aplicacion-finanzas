import { afterEach, describe, expect, it, vi } from 'vitest'
import { accountsApi } from './accounts'
import { categoriesApi } from './categories'
import { ApiError } from './client'
import { tokenStore } from '../lib/tokens'
import { stubFetchResponse } from '../test/helpers'

afterEach(() => {
  vi.unstubAllGlobals()
  tokenStore.clear()
})

describe('accountsApi', () => {
  it('lista cuentas y desenvuelve data', async () => {
    const fn = stubFetchResponse({
      status: 200,
      body: { data: [{ id: '1', name: 'Ahorros', type: 'SAVINGS', balance: '1500000' }] },
    })

    const accounts = await accountsApi.list()

    expect(accounts).toHaveLength(1)
    expect(accounts[0].name).toBe('Ahorros')
    expect(fn.mock.calls[0][0]).toBe('http://localhost:4000/api/accounts')
    expect(fn.mock.calls[0][1].method).toBe('GET')
  })

  it('crea una cuenta enviando body y token', async () => {
    tokenStore.setAccess('tok-123')
    const fn = stubFetchResponse({ status: 201, body: { data: { id: '2', name: 'Efectivo' } } })

    await accountsApi.create({ name: 'Efectivo', type: 'CASH', balance: 50000 })

    const [url, init] = fn.mock.calls[0]
    expect(url).toBe('http://localhost:4000/api/accounts')
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers as HeadersInit).get('Authorization')).toBe('Bearer tok-123')
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'Efectivo',
      type: 'CASH',
      balance: 50000,
    })
  })

  it('elimina una cuenta (204 sin cuerpo)', async () => {
    const fn = stubFetchResponse({ status: 204 })
    const result = await accountsApi.remove('9')
    expect(result).toBeUndefined()
    expect(fn.mock.calls[0][1].method).toBe('DELETE')
  })

  it('lanza ApiError con el mensaje del backend', async () => {
    stubFetchResponse({
      status: 409,
      body: { error: { message: 'La cuenta tiene transacciones', code: 'ACCOUNT_IN_USE' } },
    })

    await expect(accountsApi.remove('1')).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      code: 'ACCOUNT_IN_USE',
      message: 'La cuenta tiene transacciones',
    })
    await expect(accountsApi.remove('1')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('categoriesApi', () => {
  it('crea una categoría con color', async () => {
    const fn = stubFetchResponse({ status: 201, body: { data: { id: 'c1', name: 'Comida' } } })

    await categoriesApi.create({ name: 'Comida', type: 'EXPENSE', color: '#ef4444' })

    expect(JSON.parse(fn.mock.calls[0][1].body as string)).toEqual({
      name: 'Comida',
      type: 'EXPENSE',
      color: '#ef4444',
    })
  })
})
