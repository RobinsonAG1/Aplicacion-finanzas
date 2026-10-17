import request from 'supertest';
import type { Express } from 'express';
import { authHeader, type TestUser } from './auth.js';

export async function createAccount(
  app: Express,
  user: TestUser,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const res = await request(app)
    .post('/api/accounts')
    .set(...authHeader(user))
    .send({ name: 'Cuenta', type: 'SAVINGS', balance: 0, ...overrides });
  if (res.status !== 201) throw new Error(`createAccount fallo: ${res.status} ${res.text}`);
  return res.body.data as Record<string, unknown>;
}

export async function createCategory(
  app: Express,
  user: TestUser,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const res = await request(app)
    .post('/api/categories')
    .set(...authHeader(user))
    .send({ name: 'Categoria', type: 'EXPENSE', ...overrides });
  if (res.status !== 201) throw new Error(`createCategory fallo: ${res.status} ${res.text}`);
  return res.body.data as Record<string, unknown>;
}

export async function createTransaction(
  app: Express,
  user: TestUser,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await request(app).post('/api/transactions').set(...authHeader(user)).send(payload);
  if (res.status !== 201) throw new Error(`createTransaction fallo: ${res.status} ${res.text}`);
  return res.body.data as Record<string, unknown>;
}

export async function getAccountBalance(
  app: Express,
  user: TestUser,
  accountId: string,
): Promise<number> {
  const res = await request(app).get(`/api/accounts/${accountId}`).set(...authHeader(user));
  return Number(res.body.data.balance);
}
