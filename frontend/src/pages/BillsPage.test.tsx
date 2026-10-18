import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BillsPage } from './BillsPage'

const CATEGORY = {
  id: 'c1',
  name: 'Servicios',
  type: 'EXPENSE',
  color: '#0ea5e9',
  isCustom: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const INTERNET = {
  id: 'b1',
  name: 'Internet',
  amount: '120000.00',
  dueDay: 20,
  isActive: true,
  category: { id: 'c1', name: 'Servicios', color: '#0ea5e9', type: 'EXPENSE' },
  sourceTransaction: null,
  nextDueDate: '2026-10-20T00:00:00.000Z',
  daysUntil: 3,
  overdue: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const LUZ = {
  ...INTERNET,
  id: 'b2',
  name: 'Luz',
  nextDueDate: '2026-10-10T00:00:00.000Z',
  daysUntil: -2,
  overdue: true,
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  }
}

function mockApi(bills: unknown[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/reminders')) {
        return jsonResponse(200, {
          data: [
            {
              id: 'r1',
              billId: 'b1',
              dueDate: '2026-10-20T00:00:00.000Z',
              channel: 'LOG',
              status: 'SENT',
              sentAt: '2026-10-17T00:00:00.000Z',
              createdAt: '2026-10-17T00:00:00.000Z',
            },
          ],
        })
      }
      if (url.includes('/accounts')) return jsonResponse(200, { data: [] })
      if (url.includes('/categories')) return jsonResponse(200, { data: [CATEGORY] })
      if (url.includes('/bills')) return jsonResponse(200, { data: bills })
      return jsonResponse(404, { error: { message: 'not found' } })
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BillsPage', () => {
  it('lista facturas con vencimiento y estado', async () => {
    mockApi([INTERNET, LUZ])

    render(<BillsPage />)

    expect(await screen.findByText('Internet')).toBeInTheDocument()
    expect(screen.getByText('en 3 d')).toBeInTheDocument()
    expect(screen.getByText('Luz')).toBeInTheDocument()
    expect(screen.getAllByText('Vencida').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/120\.000/).length).toBeGreaterThan(0)
  })

  it('muestra el estado vacío', async () => {
    mockApi([])

    render(<BillsPage />)

    expect(await screen.findByText('No hay facturas registradas.')).toBeInTheDocument()
  })

  it('abre el panel de recordatorios con su historial', async () => {
    mockApi([INTERNET])

    render(<BillsPage />)
    await screen.findByText('Internet')

    fireEvent.click(screen.getAllByRole('button', { name: 'Más acciones' })[0])
    fireEvent.click(screen.getByRole('menuitem', { name: 'Recordatorios' }))

    expect(await screen.findByText('Recordatorios · Internet')).toBeInTheDocument()
    expect(await screen.findByText('SENT')).toBeInTheDocument()
  })
})
