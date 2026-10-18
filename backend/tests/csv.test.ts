import { describe, expect, it } from 'vitest';
import { escapeCsvField, toCsv } from '../src/utils/csv.js';

describe('escapeCsvField (punto 7)', () => {
  it('neutraliza formulas en celdas de texto', () => {
    expect(escapeCsvField('=SUM(1+1)')).toBe("'=SUM(1+1)");
    expect(escapeCsvField('+34 6000')).toBe("'+34 6000");
    expect(escapeCsvField('-cmd|/c calc')).toBe("'-cmd|/c calc");
    expect(escapeCsvField('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('no altera numeros negativos reales', () => {
    expect(escapeCsvField(-500)).toBe('-500');
    expect(escapeCsvField(0)).toBe('0');
  });

  it('entrecomilla comas, comillas y saltos de linea', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(escapeCsvField('linea1\nlinea2')).toBe('"linea1\nlinea2"');
  });

  it('trata null y undefined como cadena vacia', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('toCsv sanea cada celda y termina con CRLF', () => {
    const csv = toCsv(['comercio'], [['=1+1']]);
    expect(csv).toBe("comercio\r\n'=1+1\r\n");
  });
});
