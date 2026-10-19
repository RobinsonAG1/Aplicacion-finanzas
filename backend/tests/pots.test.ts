import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closeDatabase, resetDatabase } from './helpers/db.js';
import { authHeader, createTestUser, type TestUser } from './helpers/auth.js';

const app = createApp();

async function createPot(user: TestUser, payload: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/pots')
    .set(...authHeader(user))
    .send({ name: 'Vacaciones', targetAmount: 1000000, ...payload });
  if (res.status !== 201) throw new Error(`createPot fallo: ${res.status} ${res.text}`);
  return res.body.data as Record<string, unknown>;
}

describe('Metas de ahorro', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('crea una meta con progreso inicial', async () => {
    const user = await createTestUser(app);
    const res = await request(app)
      .post('/api/pots')
      .set(...authHeader(user))
      .send({ name: 'Vacaciones', targetAmount: 1000000 });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Vacaciones',
      currentAmount: '0.00',
      targetAmount: '1000000.00',
      percentage: 0,
      completed: false,
    });
  });

  it('valida el color en formato hexadecimal (422)', async () => {
    const user = await createTestUser(app);
    const res = await request(app)
      .post('/api/pots')
      .set(...authHeader(user))
      .send({ name: 'X', targetAmount: 1000, color: 'verde' });
    expect(res.status).toBe(422);
  });

  it('deposita y refleja el progreso', async () => {
    const user = await createTestUser(app);
    const pot = await createPot(user, { targetAmount: 100000 });

    const res = await request(app)
      .post(`/api/pots/${pot.id as string}/deposit`)
      .set(...authHeader(user))
      .send({ amount: 30000, note: 'Primer ahorro' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      currentAmount: '30000.00',
      remaining: 70000,
      percentage: 30,
      completed: false,
    });
  });

  it('registra el historial de movimientos', async () => {
    const user = await createTestUser(app);
    const pot = await createPot(user);
    await request(app)
      .post(`/api/pots/${pot.id as string}/deposit`)
      .set(...authHeader(user))
      .send({ amount: 100000, note: 'Inicial' });
    await request(app)
      .post(`/api/pots/${pot.id as string}/withdraw`)
      .set(...authHeader(user))
      .send({ amount: 40000 });

    const res = await request(app).get(`/api/pots/${pot.id as string}`).set(...authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.data.currentAmount).toBe('60000.00');
    expect(res.body.data.transactions).toHaveLength(2);
    expect(res.body.data.transactions.map((t: { type: string }) => t.type)).toEqual([
      'WITHDRAW',
      'DEPOSIT',
    ]);
  });

  it('impide retirar mas del saldo (422)', async () => {
    const user = await createTestUser(app);
    const pot = await createPot(user);
    await request(app)
      .post(`/api/pots/${pot.id as string}/deposit`)
      .set(...authHeader(user))
      .send({ amount: 50000 });

    const res = await request(app)
      .post(`/api/pots/${pot.id as string}/withdraw`)
      .set(...authHeader(user))
      .send({ amount: 80000 });
    expect(res.status).toBe(422);
  });

  it('marca la meta como completada al alcanzar el objetivo', async () => {
    const user = await createTestUser(app);
    const pot = await createPot(user, { targetAmount: 50000 });
    const res = await request(app)
      .post(`/api/pots/${pot.id as string}/deposit`)
      .set(...authHeader(user))
      .send({ amount: 50000 });
    expect(res.body.data.completed).toBe(true);
    expect(res.body.data.percentage).toBe(100);
  });

  it('actualiza y elimina una meta', async () => {
    const user = await createTestUser(app);
    const pot = await createPot(user);

    const updated = await request(app)
      .put(`/api/pots/${pot.id as string}`)
      .set(...authHeader(user))
      .send({ name: 'Moto', targetAmount: 5000000 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe('Moto');

    const del = await request(app).delete(`/api/pots/${pot.id as string}`).set(...authHeader(user));
    expect(del.status).toBe(204);
    const gone = await request(app).get(`/api/pots/${pot.id as string}`).set(...authHeader(user));
    expect(gone.status).toBe(404);
  });

  it('aísla las metas entre usuarios', async () => {
    const userA = await createTestUser(app);
    const userB = await createTestUser(app);
    const pot = await createPot(userA);

    const listB = await request(app).get('/api/pots').set(...authHeader(userB));
    expect(listB.body.data).toHaveLength(0);

    const depositB = await request(app)
      .post(`/api/pots/${pot.id as string}/deposit`)
      .set(...authHeader(userB))
      .send({ amount: 1000 });
    expect(depositB.status).toBe(404);
  });
});
