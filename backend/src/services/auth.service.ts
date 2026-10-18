import { randomUUID } from 'node:crypto';
import { AppError } from '../utils/AppError.js';
import { logger } from '../config/logger.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  hashToken,
  refreshExpiryDate,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';
import { userRepository } from '../repositories/user.repository.js';
import { refreshTokenRepository } from '../repositories/refreshToken.repository.js';
import type { LoginInput, RegisterInput } from '../schemas/auth.schema.js';
import type { PublicUser } from '../types/auth.js';

export interface TokenContext {
  userAgent?: string;
  ip?: string;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

type UserRecord = {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
};

function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

async function issueTokens(user: UserRecord, ctx: TokenContext): Promise<Omit<AuthResult, 'user'>> {
  const accessToken = await signAccessToken({ sub: user.id, email: user.email });
  const refreshToken = await signRefreshToken({ sub: user.id, jti: randomUUID() });
  await refreshTokenRepository.create({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiryDate(),
    userAgent: ctx.userAgent,
    ip: ctx.ip,
  });
  return { accessToken, refreshToken };
}

export const authService = {
  async register(input: RegisterInput, ctx: TokenContext): Promise<AuthResult> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError('El email ya esta registrado', 409, { code: 'EMAIL_TAKEN' });
    }
    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.create({
      email: input.email,
      name: input.name,
      passwordHash,
    });
    const tokens = await issueTokens(user, ctx);
    return { user: toPublicUser(user), ...tokens };
  },

  async login(input: LoginInput, ctx: TokenContext): Promise<AuthResult> {
    const user = await userRepository.findByEmail(input.email);
    if (!user) {
      throw new AppError('Credenciales invalidas', 401, { code: 'INVALID_CREDENTIALS' });
    }
    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) {
      throw new AppError('Credenciales invalidas', 401, { code: 'INVALID_CREDENTIALS' });
    }
    const tokens = await issueTokens(user, ctx);
    return { user: toPublicUser(user), ...tokens };
  },

  async refresh(refreshToken: string, ctx: TokenContext): Promise<AuthResult> {
    const payload = await verifyRefreshToken(refreshToken);
    const stored = await refreshTokenRepository.findByHash(hashToken(refreshToken));
    if (!stored) {
      throw new AppError('Refresh token invalido', 401, { code: 'INVALID_REFRESH_TOKEN' });
    }

    // El token existe pero pertenece a otro usuario: firma manipulada o token filtrado.
    if (stored.userId !== payload.sub) {
      await refreshTokenRepository.revokeAllForUser(stored.userId);
      throw new AppError('Refresh token invalido', 401, { code: 'INVALID_REFRESH_TOKEN' });
    }

    // Ya rotado, revocado o expirado => reuso: se revoca toda la familia del usuario.
    if (stored.revokedAt || stored.expiresAt < new Date()) {
      logger.warn(
        { userId: stored.userId, tokenId: stored.id },
        'Reuso de refresh token detectado, revocando todas las sesiones del usuario',
      );
      await refreshTokenRepository.revokeAllForUser(stored.userId);
      throw new AppError('Refresh token invalido', 401, { code: 'INVALID_REFRESH_TOKEN' });
    }

    await refreshTokenRepository.revoke(stored.id);
    const user = await userRepository.findById(payload.sub);
    if (!user) {
      throw new AppError('Refresh token invalido', 401, { code: 'INVALID_REFRESH_TOKEN' });
    }
    const tokens = await issueTokens(user, ctx);
    return { user: toPublicUser(user), ...tokens };
  },

  async logout(refreshToken: string): Promise<{ success: true }> {
    const stored = await refreshTokenRepository.findByHash(hashToken(refreshToken));
    if (stored && !stored.revokedAt) {
      await refreshTokenRepository.revoke(stored.id);
    }
    return { success: true };
  },

  async me(userId: string): Promise<PublicUser> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('Usuario no encontrado', 404, { code: 'USER_NOT_FOUND' });
    }
    return toPublicUser(user);
  },
};
