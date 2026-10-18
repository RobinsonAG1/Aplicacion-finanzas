export function formatCOP(
  value: number | string,
  options: { decimals?: number; compact?: boolean } = {},
): string {
  const num = typeof value === 'string' ? Number(value) : value
  const safe = Number.isFinite(num) ? num : 0
  const decimals = options.decimals ?? 0

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    notation: options.compact ? 'compact' : 'standard',
  }).format(safe)
}

export function formatSignedCOP(amount: number | string, isIncome: boolean): string {
  const value = typeof amount === 'string' ? Number(amount) : amount
  return formatCOP(isIncome ? value : -value)
}

export function formatNumber(value: number | string, decimals = 0): string {
  const num = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(num) ? num : 0)
}

export function formatPercent(value: number, decimals = 1): string {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(value) ? value : 0)}%`
}
