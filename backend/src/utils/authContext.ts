import type { Request } from 'express';
import { AppError } from './AppError.js';

export function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError('No autenticado', 401, { code: 'UNAUTHENTICATED' });
  }
  return req.user.id;
}
