import type { ResolvedTheme } from '../features/theme/theme-context'

// Recharts recibe colores como valores concretos (no puede consumir var() de
// forma fiable), por eso los gráficos eligen su paleta según el tema resuelto.
// Deben mantenerse alineados con los tokens de src/index.css.
export interface ChartPalette {
  axis: string
  grid: string
  income: string
  expense: string
  line: string
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
}

export const CHART_PALETTES: Record<ResolvedTheme, ChartPalette> = {
  light: {
    axis: '#6b6455',
    grid: '#ddd7ca',
    income: '#15683f',
    expense: '#a33a24',
    line: '#17614b',
    tooltipBg: '#fffefb',
    tooltipBorder: '#ddd7ca',
    tooltipText: '#1c1a15',
  },
  dark: {
    axis: '#a6a091',
    grid: '#3a382f',
    income: '#6ed095',
    expense: '#ee9a82',
    line: '#5fc79f',
    tooltipBg: '#201f1a',
    tooltipBorder: '#3a382f',
    tooltipText: '#ece8de',
  },
}
