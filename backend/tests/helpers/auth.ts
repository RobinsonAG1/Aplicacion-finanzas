import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Express } from 'express';

export interface TestUser {
  id: string;
  email: string;
  accessToken: string;
  refreshToken: string;
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
    refreshToken: res.body.refreshToken as string,
  };
}

export function authHeader(user: TestUser): [string, string] {
  return ['Authorization', `Bearer ${user.accessToken}`];
}
