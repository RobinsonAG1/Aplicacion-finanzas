import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PotsPage } from './PotsPage'
import { jsonResponse } from '../test/helpers'

const POT = {
  id: 'p1',
  name: 'Vacaciones',
  color: '#22c55e',
  targetAmount: '1000000.00',
  currentAmount: '250000.00',
  remaining: 750000,
  percentage: 25,
  completed: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const DETAIL = {
  ...POT,
  transactions: [
    {
      id: 'm1',
      amount: '250000.00',
      type: 'DEPOSIT',
      date: '2026-10-05T00:00:00.000Z',
      note: 'Ahorro inicial',
    },
  ],
}

function mockApi(pots: unknown[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => {
      if (/\/pots\/[^/?]+/.test(url)) return jsonResponse(200, { data: DETAIL })
      if (url.includes('/pots')) return jsonResponse(200, { data: pots })
      return jsonResponse(404, { error: { message: 'not found' } })
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PotsPage', () => {
  it('muestra el progreso y lo que falta por ahorrar', async () => {
    mockApi([POT])

    render(<PotsPage />)

    expect(await screen.findByText('Vacaciones')).toBeInTheDocument()
    expect(screen.getByText('25.0%')).toBeInTheDocument()
    expect(screen.getByText(/Faltan/)).toBeInTheDocument()
  })

  it('marca las huchas completadas', async () => {
    mockApi([{ ...POT, currentAmount: '1000000.00', remaining: 0, percentage: 100, completed: true }])

    render(<PotsPage />)

    expect(await screen.findByText('Meta alcanzada')).toBeInTheDocument()
  })

  it('abre el panel de movimiento con el historial', async () => {
    mockApi([POT])

    render(<PotsPage />)
    await screen.findByText('Vacaciones')

    fireEvent.click(screen.getAllByRole('button', { name: 'Depositar' })[0])

    expect(await screen.findByText('Mover en Vacaciones')).toBeInTheDocument()
    expect(await screen.findByText('Ahorro inicial')).toBeInTheDocument()
  })

  it('muestra el estado vacío', async () => {
    mockApi([])

    render(<PotsPage />)

    expect(await screen.findByText('Aún no tienes huchas. Crea la primera.')).toBeInTheDocument()
  })
})
