import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// Defensa CSRF para endpoints que se autentican por cookie (refresh/logout).
// El navegador siempre adjunta Origin en peticiones no simples y una web ajena
// no puede falsificarlo; si esta presente, debe coincidir con el origen permitido.
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (origin && origin !== env.CORS_ORIGIN) {
    throw new AppError('Origen no permitido', 403, { code: 'CSRF_ORIGIN_MISMATCH' });
  }
  next();
}
