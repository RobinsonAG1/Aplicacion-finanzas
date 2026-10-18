import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Express } from 'express';

export interface TestUser {
  id: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

// Extrae la cookie de refresh (formato "refresh_token=...; Path=...") de una respuesta.
export function extractRefreshCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? (raw as string[]) : raw ? [raw as string] : [];
  const found = cookies.find((cookie) => cookie.startsWith('refresh_token='));
  return found ? found.split(';')[0] : '';
}

export async function createTestUser(app: Express): Promise<TestUser> {
  const email = `user_${randomUUID()}@finanzas.test`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Usuario Test', email, password: 'Secreta123!' });

  if (res.status !== 201) {
    throw new Error(`No se pudo crear el usuario de prueba: ${res.status}`);
  }

  return {
    id: res.body.user.id as string,
    email,
    accessToken: res.body.accessToken as string,
    refreshToken: extractRefreshCookie(res),
  };
}

export function authHeader(user: TestUser): [string, string] {
  return ['Authorization', `Bearer ${user.accessToken}`];
}
