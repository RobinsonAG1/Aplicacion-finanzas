import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authController } from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { loginBody, refreshBody, registerBody } from '../schemas/auth.schema.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';

export const authRouter = Router();

if (!env.isTest) {
  authRouter.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 50,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: {
        error: {
          message: 'Demasiados intentos de autenticacion, intenta mas tarde',
          code: 'RATE_LIMITED',
        },
      },
    }),
  );
}

authRouter.post('/register', validate({ body: registerBody }), asyncHandler(authController.register));
authRouter.post('/login', validate({ body: loginBody }), asyncHandler(authController.login));
authRouter.post('/refresh', validate({ body: refreshBody }), asyncHandler(authController.refresh));
authRouter.post('/logout', validate({ body: refreshBody }), asyncHandler(authController.logout));
authRouter.get('/me', authenticate, asyncHandler(authController.me));
