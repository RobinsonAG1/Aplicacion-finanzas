import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env.js';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_PATH = '/api/auth';

const baseOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: env.isProduction,
  path: REFRESH_PATH,
};

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, { ...baseOptions, maxAge: env.JWT_REFRESH_TTL * 1000 });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, baseOptions);
}

export function getRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === REFRESH_COOKIE) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return undefined;
}
