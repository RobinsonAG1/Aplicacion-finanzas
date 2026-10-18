import { describe, expect, it } from 'vitest'
import { formatCOP, formatNumber, formatPercent, formatSignedCOP } from './formatCOP'

const normalize = (value: string): string => value.replace(/\u00a0/g, ' ')

describe('formatCOP', () => {
  it('formatea pesos colombianos sin decimales', () => {
    expect(normalize(formatCOP(1500000))).toContain('1.500.000')
  })

  it('acepta montos como string (Decimal de la API)', () => {
    expect(normalize(formatCOP('30000'))).toContain('30.000')
  })

  it('usa cero para valores inválidos', () => {
    expect(normalize(formatCOP('no-numero'))).toContain('0')
  })

  it('formatea números y porcentajes en es-CO', () => {
    expect(formatNumber(1234.5, 1)).toBe('1.234,5')
    expect(formatPercent(50)).toBe('50,0%')
  })

  it('antepone signo negativo en gastos y positivo en ingresos', () => {
    expect(formatSignedCOP('45000', true)).not.toContain('-')
    expect(normalize(formatSignedCOP('45000', false))).toContain('-')
    expect(normalize(formatSignedCOP('45000', false))).toContain('45.000')
  })
})
