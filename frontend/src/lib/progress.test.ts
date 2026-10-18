import { describe, expect, it } from 'vitest'
import { progressFillClass } from './progress'

describe('progressFillClass', () => {
  it('usa danger cuando el presupuesto se excede', () => {
    expect(progressFillClass(150, true)).toBe('progress-fill danger')
  })

  it('usa warn al llegar al 80%', () => {
    expect(progressFillClass(80, false)).toBe('progress-fill warn')
    expect(progressFillClass(95, false)).toBe('progress-fill warn')
  })

  it('usa el estilo base por debajo del 80%', () => {
    expect(progressFillClass(64, false)).toBe('progress-fill')
  })
})
