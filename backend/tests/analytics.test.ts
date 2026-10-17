import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closeDatabase, resetDatabase } from './helpers/db.js';
import { authHeader, createTestUser, type TestUser } from './helpers/auth.js';
import { createAccount, createCategory, createTransaction } from './helpers/fixtures.js';

const app = createApp();

const now = new Date();
const year = now.getFullYear();
const month = now.getMonth() + 1;
const pad = (n: number): string => String(n).padStart(2, '0');
const lastDay = new Date(year, month, 0).getDate();
const FROM = `${year}-${pad(month)}-01`;
const TO = `${year}-${pad(month)}-${pad(lastDay)}`;
const MONTH_KEY = `${year}-${pad(month)}`;

async function seed(user: TestUser) {
  const account = await createAccount(app, user, { balance: 0 });
  const food = await createCategory(app, user, { name: 'Comida', type: 'EXPENSE' });
  const transport = await createCategory(app, user, { name: 'Transporte', type: 'EXPENSE' });
  await createTransaction(app, user, {
    accountId: account.id,
    amount: 1000000,
    type: 'INCOME',
    merchant: 'Empleador',
    date: `${year}-${pad(month)}-05`,
  });
  await createTransaction(app, user, {
    accountId: account.id,
    categoryId: food.id,
    amount: 300000,
    type: 'EXPENSE',
    date: `${year}-${pad(month)}-10`,
  });
  await createTransaction(app, user, {
    accountId: account.id,
    categoryId: transport.id,
    amount: 200000,
    type: 'EXPENSE',
    date: `${year}-${pad(month)}-12`,
  });
}

describe('Analitica', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('resume ingresos, gastos, neto y tasa de ahorro', async () => {
    const user = await createTestUser(app);
    await seed(user);

    const res = await request(app)
      .get(`/api/analytics/summary?from=${FROM}&to=${TO}`)
      .set(...authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.data.totals).toMatchObject({
      income: 1000000,
      expense: 500000,
      net: 500000,
      savingsRate: 50,
    });
  });

  it('desglosa gastos por categoria con porcentaje y ranking (window functions)', async () => {
    const user = await createTestUser(app);
    await seed(user);

    const res = await request(app)
      .get(`/api/analytics/summary?from=${FROM}&to=${TO}`)
      .set(...authHeader(user));
    const [first, second] = res.body.data.byCategory;
    expect(first).toMatchObject({ name: 'Comida', total: 300000, percentage: 60, rank: 1 });
    expect(second).toMatchObject({ name: 'Transporte', total: 200000, percentage: 40, rank: 2 });
  });

  it('resume el neto por cuenta', async () => {
    const user = await createTestUser(app);
    await seed(user);

    const res = await request(app)
      .get(`/api/analytics/summary?from=${FROM}&to=${TO}`)
      .set(...authHeader(user));
    expect(res.body.data.byAccount).toHaveLength(1);
    expect(res.body.data.byAccount[0]).toMatchObject({ net: 500000, transactions: 3, balance: 500000 });
  });

  it('construye la serie mensual con neto acumulado (window function)', async () => {
    const user = await createTestUser(app);
    await seed(user);

    const res = await request(app).get('/api/analytics/monthly?months=3').set(...authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.data.months).toHaveLength(3);
    const current = res.body.data.months.find(
      (row: { month: string }) => row.month === MONTH_KEY,
    );
    expect(current).toMatchObject({ income: 1000000, expense: 500000, net: 500000, cumulativeNet: 500000 });
  });

  it('calcula la variacion mes a mes por categoria (LAG)', async () => {
    const user = await createTestUser(app);
    await seed(user);

    const res = await request(app)
      .get('/api/analytics/category-trends?months=3')
      .set(...authHeader(user));
    expect(res.status).toBe(200);
    const food = res.body.data.trends.find(
      (row: { categoryName: string }) => row.categoryName === 'Comida',
    );
    expect(food.total).toBe(300000);
    expect(food.previous).toBeNull();
    expect(food.changePct).toBeNull();
  });

  it('construye el saldo acumulado de la linea de tiempo (SUM OVER)', async () => {
    const user = await createTestUser(app);
    await seed(user);

    const res = await request(app)
      .get(`/api/analytics/balance-timeline?from=${FROM}&to=${TO}`)
      .set(...authHeader(user));
    expect(res.status).toBe(200);
    const timeline = res.body.data.timeline;
    expect(timeline).toHaveLength(3);
    expect(timeline[0].delta).toBe(1000000);
    expect(timeline[timeline.length - 1].runningBalance).toBe(500000);
  });

  it('aísla las metricas entre usuarios', async () => {
    const userA = await createTestUser(app);
    const userB = await createTestUser(app);
    await seed(userA);

    const res = await request(app)
      .get(`/api/analytics/summary?from=${FROM}&to=${TO}`)
      .set(...authHeader(userB));
    expect(res.body.data.totals).toMatchObject({ income: 0, expense: 0, net: 0 });
    expect(res.body.data.byCategory).toHaveLength(0);
  });
});
