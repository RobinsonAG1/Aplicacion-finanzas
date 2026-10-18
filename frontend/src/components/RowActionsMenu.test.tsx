import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RowActionsMenu } from './RowActionsMenu'

describe('RowActionsMenu', () => {
  it('abre el menu al pulsar el disparador', () => {
    render(<RowActionsMenu actions={[{ label: 'Editar', onSelect: vi.fn() }]} />)

    const trigger = screen.getByRole('button', { name: 'Más acciones' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).toBeNull()

    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toBeInTheDocument()
  })

  it('ejecuta la accion y cierra el menu', () => {
    const onSelect = vi.fn()
    render(
      <RowActionsMenu
        actions={[
          { label: 'Editar', onSelect },
          { label: 'Eliminar', onSelect: vi.fn(), danger: true },
        ]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('cierra el menu con la tecla Escape', () => {
    render(<RowActionsMenu actions={[{ label: 'Editar', onSelect: vi.fn() }]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).toBeNull()
  })
})
