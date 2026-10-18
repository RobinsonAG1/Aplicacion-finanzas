import { Router } from 'express';
import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authController } from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { loginBody, refreshBody, registerBody } from '../schemas/auth.schema.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';

export const authRouter = Router();

const WINDOW_MS = 15 * 60 * 1000;

function authLimiter(limit: number, message: string): RequestHandler {
  if (env.isTest) {
    return (_req, _res, next) => next();
  }
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { message, code: 'RATE_LIMITED' } },
  });
}

const registerLimiter = authLimiter(20, 'Demasiados registros, intenta mas tarde');
const loginLimiter = authLimiter(10, 'Demasiados intentos de inicio de sesion, intenta mas tarde');
const refreshLimiter = authLimiter(60, 'Demasiadas renovaciones de sesion, intenta mas tarde');

authRouter.post(
  '/register',
  registerLimiter,
  validate({ body: registerBody }),
  asyncHandler(authController.register),
);
authRouter.post(
  '/login',
  loginLimiter,
  validate({ body: loginBody }),
  asyncHandler(authController.login),
);
authRouter.post(
  '/refresh',
  refreshLimiter,
  validate({ body: refreshBody }),
  asyncHandler(authController.refresh),
);
authRouter.post('/logout', validate({ body: refreshBody }), asyncHandler(authController.logout));
authRouter.get('/me', authenticate, asyncHandler(authController.me));
