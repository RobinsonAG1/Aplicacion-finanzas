import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Drawer } from './Drawer'

describe('Drawer', () => {
  it('no renderiza nada cuando esta cerrado', () => {
    render(
      <Drawer open={false} onClose={vi.fn()} label="Formulario">
        <p>contenido</p>
      </Drawer>,
    )

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('muestra el dialogo con su etiqueta y contenido', () => {
    render(
      <Drawer open onClose={vi.fn()} label="Nueva cuenta">
        <p>contenido</p>
      </Drawer>,
    )

    const dialog = screen.getByRole('dialog', { name: 'Nueva cuenta' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('contenido')).toBeInTheDocument()
  })

  it('cierra con la tecla Escape', () => {
    const onClose = vi.fn()
    render(
      <Drawer open onClose={onClose} label="Formulario">
        <p>contenido</p>
      </Drawer>,
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cierra al pulsar el fondo', () => {
    const onClose = vi.fn()
    render(
      <Drawer open onClose={onClose} label="Formulario">
        <p>contenido</p>
      </Drawer>,
    )

    fireEvent.click(screen.getByTestId('drawer-backdrop'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cierra con el boton de cerrar', () => {
    const onClose = vi.fn()
    render(
      <Drawer open onClose={onClose} label="Formulario">
        <p>contenido</p>
      </Drawer>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('enfoca el primer campo al abrir', () => {
    render(
      <Drawer open onClose={vi.fn()} label="Formulario">
        <input aria-label="Nombre" />
        <button type="button">Guardar</button>
      </Drawer>,
    )

    expect(screen.getByLabelText('Nombre')).toHaveFocus()
  })

  it('mantiene el foco dentro del panel al tabular', () => {
    render(
      <Drawer open onClose={vi.fn()} label="Formulario">
        <input aria-label="Nombre" />
      </Drawer>,
    )

    const input = screen.getByLabelText('Nombre')
    input.focus()
    fireEvent.keyDown(document, { key: 'Tab' })

    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus()
  })
})
