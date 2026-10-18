import { createContext } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export interface ThemeContextValue {
  preference: ThemePreference
  resolvedTheme: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

// Debe coincidir con la clave que usa public/theme-init.js.
export const THEME_STORAGE_KEY = 'finanzas-theme'

export const ThemeContext = createContext<ThemeContextValue | null>(null)
