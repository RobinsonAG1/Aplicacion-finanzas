import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

interface ErrorResponseBody {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let statusCode = 500;
  let message = 'Error interno del servidor';
  let code: string | undefined;
  let details: unknown;

  if (err instanceof ZodError) {
    statusCode = 422;
    message = 'Datos de entrada invalidos';
    code = 'VALIDATION_ERROR';
    details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
    details = err.details;
  }

  if (statusCode >= 500) {
    logger.error({ err, path: req.originalUrl, method: req.method }, 'Error no controlado');
  } else {
    logger.warn({ path: req.originalUrl, method: req.method, code }, message);
  }

  const body: ErrorResponseBody = {
    error: {
      message,
      ...(code ? { code } : {}),
      ...(details !== undefined ? { details } : {}),
    },
  };

  if (!env.isProduction && statusCode >= 500 && err instanceof Error) {
    body.error.details = { stack: err.stack };
  }

  res.status(statusCode).json(body);
}
