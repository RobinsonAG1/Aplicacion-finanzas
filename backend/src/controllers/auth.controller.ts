import type { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import type { AuthResult, TokenContext } from '../services/auth.service.js';
import type { LoginInput, RegisterInput } from '../schemas/auth.schema.js';
import { AppError } from '../utils/AppError.js';
import { clearRefreshCookie, getRefreshCookie, setRefreshCookie } from '../utils/cookies.js';

function tokenContext(req: Request): TokenContext {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

// El refresh token viaja en cookie HttpOnly; el access token se devuelve en el body
// (la SPA lo guarda solo en memoria).
function sendAuth(res: Response, status: number, result: AuthResult): void {
  const { refreshToken, ...body } = result;
  setRefreshCookie(res, refreshToken);
  res.status(status).json(body);
}

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    const result = await authService.register(req.body as RegisterInput, tokenContext(req));
    sendAuth(res, 201, result);
  },

  async login(req: Request, res: Response): Promise<void> {
    const result = await authService.login(req.body as LoginInput, tokenContext(req));
    sendAuth(res, 200, result);
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const refreshToken = getRefreshCookie(req);
    if (!refreshToken) {
      clearRefreshCookie(res);
      throw new AppError('Refresh token no proporcionado', 401, { code: 'INVALID_REFRESH_TOKEN' });
    }
    try {
      const result = await authService.refresh(refreshToken, tokenContext(req));
      sendAuth(res, 200, result);
    } catch (err) {
      clearRefreshCookie(res);
      throw err;
    }
  },

  async logout(req: Request, res: Response): Promise<void> {
    const refreshToken = getRefreshCookie(req);
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    clearRefreshCookie(res);
    res.status(200).json({ success: true });
  },

  async me(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new AppError('No autenticado', 401, { code: 'UNAUTHENTICATED' });
    }
    const user = await authService.me(req.user.id);
    res.status(200).json({ user });
  },
};
