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
  others: string
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
}

export const CHART_PALETTES: Record<ResolvedTheme, ChartPalette> = {
  light: {
    axis: '#716879',
    grid: '#e5dfec',
    income: '#16803d',
    expense: '#c62828',
    line: '#820ad1',
    others: '#8f7fa1',
    tooltipBg: '#ffffff',
    tooltipBorder: '#e5dfec',
    tooltipText: '#241b2f',
  },
  dark: {
    axis: '#b4a8c2',
    grid: '#382a48',
    income: '#6bd79a',
    expense: '#ff9b93',
    line: '#c79bff',
    others: '#8d7fa3',
    tooltipBg: '#1d1428',
    tooltipBorder: '#382a48',
    tooltipText: '#f3eef8',
  },
}
