import { useContext } from 'react'
import { ThemeContext } from './theme-context'
import type { ThemeContextValue } from './theme-context'

// Valor de respaldo para poder usar el tema fuera del provider (pruebas o
// componentes aislados) sin lanzar. En la app siempre hay un ThemeProvider.
const FALLBACK: ThemeContextValue = {
  preference: 'system',
  resolvedTheme: 'light',
  setPreference: () => {},
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? FALLBACK
}
