import type { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import type { TokenContext } from '../services/auth.service.js';
import type { LoginInput, RefreshInput, RegisterInput } from '../schemas/auth.schema.js';
import { AppError } from '../utils/AppError.js';

function tokenContext(req: Request): TokenContext {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    const result = await authService.register(req.body as RegisterInput, tokenContext(req));
    res.status(201).json(result);
  },

  async login(req: Request, res: Response): Promise<void> {
    const result = await authService.login(req.body as LoginInput, tokenContext(req));
    res.status(200).json(result);
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body as RefreshInput;
    const result = await authService.refresh(refreshToken, tokenContext(req));
    res.status(200).json(result);
  },

  async logout(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body as RefreshInput;
    const result = await authService.logout(refreshToken);
    res.status(200).json(result);
  },

  async me(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new AppError('No autenticado', 401, { code: 'UNAUTHENTICATED' });
    }
    const user = await authService.me(req.user.id);
    res.status(200).json({ user });
  },
};
