import pino from 'pino';
import { env } from './env.js';

// Cabeceras y campos sensibles que nunca deben aparecer en los logs (punto 11).
export const redactOptions = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["set-cookie"]',
    'res.headers["set-cookie"]',
    'req.body.password',
    'req.body.refreshToken',
    'password',
    'passwordHash',
    'refreshToken',
    'accessToken',
    'token',
    'tokenHash',
  ],
  censor: '[REDACTED]',
};

export const logger = pino({
  level: env.isTest ? 'silent' : env.LOG_LEVEL,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: redactOptions,
  transport: env.isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});
