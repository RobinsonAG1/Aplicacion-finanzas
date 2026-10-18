export function progressFillClass(percentage: number, exceeded: boolean): string {
  if (exceeded) return 'progress-fill danger'
  if (percentage >= 80) return 'progress-fill warn'
  return 'progress-fill'
}
