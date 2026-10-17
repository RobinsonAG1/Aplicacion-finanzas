export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(date)
}

export function toDateInputValue(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function startOfMonthInput(date = new Date()): string {
  return toDateInputValue(new Date(date.getFullYear(), date.getMonth(), 1))
}

export function endOfMonthInput(date = new Date()): string {
  return toDateInputValue(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

export function formatMonthLabel(value: string): string {
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) return value
  return new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  )
}
