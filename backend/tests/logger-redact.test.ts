import { describe, expect, it } from 'vitest';
import pino from 'pino';
import { redactOptions } from '../src/config/logger.js';

function captureLogger(lines: string[]): pino.Logger {
  const stream = { write: (line: string): void => void lines.push(line) };
  const testLogger = pino({ redact: redactOptions }, stream);
  testLogger.level = 'info';
  return testLogger;
}

describe('logger redact (punto 11)', () => {
  it('oculta cabeceras de autorizacion, cookies y campos sensibles', () => {
    const lines: string[] = [];
    const testLogger = captureLogger(lines);

    testLogger.info(
      {
        req: {
          headers: {
            authorization: 'Bearer super-secreto',
            cookie: 'refresh_token=abc123',
            'set-cookie': ['refresh_token=abc123; HttpOnly'],
          },
        },
        password: 'hunter2',
        passwordHash: '$argon2id$...',
        accessToken: 'eyJ.accesso',
        refreshToken: 'eyJ.refresh',
        token: 'eyJ.gen',
        tokenHash: 'deadbeef',
      },
      'peticion',
    );

    const output = lines.join('');
    for (const secret of [
      'super-secreto',
      'abc123',
      'hunter2',
      '$argon2id$...',
      'eyJ.accesso',
      'eyJ.refresh',
      'eyJ.gen',
      'deadbeef',
    ]) {
      expect(output).not.toContain(secret);
    }
    expect(output).toContain('[REDACTED]');
  });
});
