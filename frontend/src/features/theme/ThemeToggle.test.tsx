import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeToggle } from './ThemeToggle'
import { ThemeContext } from './theme-context'
import type { ThemeContextValue } from './theme-context'

function renderWithTheme(overrides: Partial<ThemeContextValue> = {}) {
  const setPreference = vi.fn()
  const value: ThemeContextValue = {
    preference: 'system',
    resolvedTheme: 'light',
    setPreference,
    ...overrides,
  }
  render(
    <ThemeContext.Provider value={value}>
      <ThemeToggle />
    </ThemeContext.Provider>,
  )
  return { setPreference }
}

describe('ThemeToggle', () => {
  it('marca la opcion activa segun la preferencia', () => {
    renderWithTheme({ preference: 'dark' })

    expect(screen.getByRole('button', { name: 'Tema oscuro' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Tema claro' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('notifica el cambio de preferencia', () => {
    const { setPreference } = renderWithTheme()

    fireEvent.click(screen.getByRole('button', { name: 'Tema oscuro' }))

    expect(setPreference).toHaveBeenCalledWith('dark')
  })
})
