import { z } from 'zod';

export const registerBody = z.object({
  name: z.string().trim().min(2, 'Minimo 2 caracteres').max(80),
  email: z.email('Email invalido').trim().toLowerCase(),
  password: z.string().min(8, 'Minimo 8 caracteres').max(128),
});

export const loginBody = z.object({
  email: z.email('Email invalido').trim().toLowerCase(),
  password: z.string().min(1, 'La contrasena es obligatoria'),
});

export const refreshBody = z.object({
  refreshToken: z.string().min(1, 'Refresh token obligatorio'),
});

export type RegisterInput = z.infer<typeof registerBody>;
export type LoginInput = z.infer<typeof loginBody>;
export type RefreshInput = z.infer<typeof refreshBody>;
