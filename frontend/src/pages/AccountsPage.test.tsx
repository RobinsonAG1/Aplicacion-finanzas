import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AccountsPage } from './AccountsPage'
import { stubFetchResponse } from '../test/helpers'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AccountsPage', () => {
  it('muestra las cuentas con su saldo formateado en COP', async () => {
    stubFetchResponse({
      status: 200,
      body: {
        data: [
          {
            id: '1',
            name: 'Nómina',
            type: 'SAVINGS',
            balance: '1500000',
            currency: 'COP',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    })

    render(<AccountsPage />)

    expect(await screen.findByRole('cell', { name: 'Nómina' })).toBeInTheDocument()
    expect(screen.getByText(/1\.500\.000/)).toBeInTheDocument()
  })

  it('muestra un mensaje cuando no hay cuentas', async () => {
    stubFetchResponse({ status: 200, body: { data: [] } })

    render(<AccountsPage />)

    expect(await screen.findByText(/Aún no tienes cuentas/)).toBeInTheDocument()
  })
})
