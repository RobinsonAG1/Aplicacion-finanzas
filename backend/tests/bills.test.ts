import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closeDatabase, resetDatabase } from './helpers/db.js';
import { authHeader, createTestUser, type TestUser } from './helpers/auth.js';
import { createAccount, createCategory, getAccountBalance } from './helpers/fixtures.js';

const app = createApp();

const now = new Date();
const dom = now.getDate();

async function createBill(user: TestUser, payload: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/bills')
    .set(...authHeader(user))
    .send({ name: 'Internet', amount: 120000, dueDay: 15, ...payload });
  if (res.status !== 201) throw new Error(`createBill fallo: ${res.status} ${res.text}`);
  return res.body.data as Record<string, unknown>;
}

describe('Facturas recurrentes', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('crea una factura recurrente', async () => {
    const user = await createTestUser(app);
    const res = await request(app)
      .post('/api/bills')
      .set(...authHeader(user))
      .send({ name: 'Internet', amount: 120000, dueDay: 15 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Internet', amount: '120000.00', dueDay: 15 });
  });

  it('rechaza categoria de ingreso (422)', async () => {
    const user = await createTestUser(app);
    const income = await createCategory(app, user, { name: 'Salario', type: 'INCOME' });
    const res = await request(app)
      .post('/api/bills')
      .set(...authHeader(user))
      .send({ name: 'X', amount: 1000, dueDay: 5, categoryId: income.id });
    expect(res.status).toBe(422);
  });

  it('filtra por estado activo', async () => {
    const user = await createTestUser(app);
    await createBill(user, { name: 'Activa', dueDay: 10 });
    await createBill(user, { name: 'Inactiva', dueDay: 11, isActive: false });

    const active = await request(app).get('/api/bills?isActive=true').set(...authHeader(user));
    expect(active.body.data).toHaveLength(1);
    expect(active.body.data[0].name).toBe('Activa');
  });

  it('lista proximos vencimientos e identifica vencidas', async () => {
    const user = await createTestUser(app);
    await createBill(user, { name: 'Hoy', dueDay: dom });
    if (dom > 1) {
      await createBill(user, { name: 'Vencida', dueDay: dom - 1 });
    }

    const res = await request(app).get('/api/bills/upcoming?days=30').set(...authHeader(user));
    expect(res.status).toBe(200);
    const today = res.body.data.upcoming.find((b: { name: string }) => b.name === 'Hoy');
    expect(today.daysUntil).toBe(0);
    expect(today.overdue).toBe(false);

    if (dom > 1) {
      const overdue = res.body.data.upcoming.find((b: { name: string }) => b.name === 'Vencida');
      expect(overdue.overdue).toBe(true);
      expect(overdue.daysUntil).toBeLessThan(0);
    }
  });

  it('crea un recordatorio y evita duplicados', async () => {
    const user = await createTestUser(app);
    const bill = await createBill(user, { dueDay: dom });

    const res = await request(app)
      .post(`/api/bills/${bill.id as string}/reminders`)
      .set(...authHeader(user))
      .send({ send: true });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('SENT');
    expect(res.body.data.sentAt).not.toBeNull();

    const dup = await request(app)
      .post(`/api/bills/${bill.id as string}/reminders`)
      .set(...authHeader(user))
      .send({});
    expect(dup.status).toBe(409);
  });

  it('genera recordatorios de forma idempotente', async () => {
    const user = await createTestUser(app);
    await createBill(user, { dueDay: dom });

    const first = await request(app)
      .post('/api/bills/reminders/run')
      .set(...authHeader(user))
      .send({ days: 30 });
    expect(first.status).toBe(200);
    expect(first.body.data.created).toBe(1);

    const second = await request(app)
      .post('/api/bills/reminders/run')
      .set(...authHeader(user))
      .send({ days: 30 });
    expect(second.body.data.created).toBe(0);
    expect(second.body.data.skipped).toBe(1);
  });

  it('paga una factura creando la transaccion y enlazandola', async () => {
    const user = await createTestUser(app);
    const account = await createAccount(app, user, { name: 'Ahorros', balance: 500000 });
    const category = await createCategory(app, user, { name: 'Servicios', type: 'EXPENSE' });
    const bill = await createBill(user, { amount: 120000, dueDay: dom, categoryId: category.id });

    const res = await request(app)
      .post(`/api/bills/${bill.id as string}/pay`)
      .set(...authHeader(user))
      .send({ accountId: account.id });
    expect(res.status).toBe(201);
    expect(res.body.data.transaction.amount).toBe('120000');
    expect(res.body.data.bill.sourceTransaction).not.toBeNull();
    expect(await getAccountBalance(app, user, account.id as string)).toBe(380000);

    const detail = await request(app)
      .get(`/api/bills/${bill.id as string}`)
      .set(...authHeader(user));
    expect(detail.body.data.sourceTransaction.id).toBe(res.body.data.transaction.id);
  });

  it('aísla las facturas entre usuarios', async () => {
    const userA = await createTestUser(app);
    const userB = await createTestUser(app);
    const bill = await createBill(userA);

    const listB = await request(app).get('/api/bills').set(...authHeader(userB));
    expect(listB.body.data).toHaveLength(0);

    const getB = await request(app)
      .get(`/api/bills/${bill.id as string}`)
      .set(...authHeader(userB));
    expect(getB.status).toBe(404);
  });
});
