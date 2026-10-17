import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closeDatabase, resetDatabase } from './helpers/db.js';
import { authHeader, createTestUser } from './helpers/auth.js';
import { createAccount, createCategory, createTransaction } from './helpers/fixtures.js';

const app = createApp();

async function createBudget(
  user: Awaited<ReturnType<typeof createTestUser>>,
  payload: Record<string, unknown>,
) {
  return request(app).post('/api/budgets').set(...authHeader(user)).send(payload);
}

describe('Presupuestos', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('crea un presupuesto para una categoria de gasto', async () => {
    const user = await createTestUser(app);
    const category = await createCategory(app, user, { name: 'Comida', type: 'EXPENSE' });

    const res = await createBudget(user, {
      categoryId: category.id,
      limitAmount: 500000,
      period: 'MONTHLY',
      startDate: '2026-10-01',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.category.name).toBe('Comida');
    expect(res.body.data.period).toBe('MONTHLY');
  });

  it('rechaza presupuestar una categoria de ingreso (422)', async () => {
    const user = await createTestUser(app);
    const category = await createCategory(app, user, { name: 'Salario', type: 'INCOME' });
    const res = await createBudget(user, { categoryId: category.id, limitAmount: 100000 });
    expect(res.status).toBe(422);
  });

  it('calcula el gasto real solo de la categoria y ventana del presupuesto', async () => {
    const user = await createTestUser(app);
    const account = await createAccount(app, user, { balance: 1000000 });
    const food = await createCategory(app, user, { name: 'Comida', type: 'EXPENSE' });
    const transport = await createCategory(app, user, { name: 'Transporte', type: 'EXPENSE' });
    await createBudget(user, {
      categoryId: food.id,
      limitAmount: 100000,
      startDate: '2026-10-01',
    });

    await createTransaction(app, user, {
      accountId: account.id,
      categoryId: food.id,
      amount: 30000,
      type: 'EXPENSE',
      date: '2026-10-10',
    });
    await createTransaction(app, user, {
      accountId: account.id,
      categoryId: food.id,
      amount: 20000,
      type: 'EXPENSE',
      date: '2026-10-12',
    });
    await createTransaction(app, user, {
      accountId: account.id,
      categoryId: transport.id,
      amount: 99999,
      type: 'EXPENSE',
      date: '2026-10-11',
    });
    await createTransaction(app, user, {
      accountId: account.id,
      categoryId: food.id,
      amount: 500000,
      type: 'INCOME',
      date: '2026-10-13',
    });

    const res = await request(app)
      .get('/api/budgets/overview?from=2026-10-01&to=2026-10-31')
      .set(...authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.data.budgets).toHaveLength(1);
    const summary = res.body.data.budgets[0];
    expect(summary.spent).toBe(50000);
    expect(summary.remaining).toBe(50000);
    expect(summary.percentage).toBe(50);
    expect(summary.exceeded).toBe(false);
  });

  it('marca excedido y calcula totales', async () => {
    const user = await createTestUser(app);
    const account = await createAccount(app, user);
    const food = await createCategory(app, user, { name: 'Comida', type: 'EXPENSE' });
    const fun = await createCategory(app, user, { name: 'Ocio', type: 'EXPENSE' });
    await createBudget(user, { categoryId: food.id, limitAmount: 10000, startDate: '2026-10-01' });
    await createBudget(user, { categoryId: fun.id, limitAmount: 200000, startDate: '2026-10-01' });

    await createTransaction(app, user, {
      accountId: account.id,
      categoryId: food.id,
      amount: 15000,
      type: 'EXPENSE',
      date: '2026-10-05',
    });
    await createTransaction(app, user, {
      accountId: account.id,
      categoryId: fun.id,
      amount: 50000,
      type: 'EXPENSE',
      date: '2026-10-06',
    });

    const res = await request(app)
      .get('/api/budgets/overview?from=2026-10-01&to=2026-10-31')
      .set(...authHeader(user));
    expect(res.body.data.totals).toMatchObject({
      limitAmount: 210000,
      spent: 65000,
      remaining: 145000,
    });
    const foodSummary = res.body.data.budgets.find(
      (b: { category: { name: string } }) => b.category.name === 'Comida',
    );
    expect(foodSummary.exceeded).toBe(true);
    expect(foodSummary.remaining).toBe(-5000);
    expect(foodSummary.percentage).toBe(150);
  });

  it('no cuenta gastos fuera de la ventana del presupuesto', async () => {
    const user = await createTestUser(app);
    const account = await createAccount(app, user);
    const food = await createCategory(app, user, { name: 'Comida', type: 'EXPENSE' });
    await createBudget(user, {
      categoryId: food.id,
      limitAmount: 100000,
      startDate: '2026-11-01',
    });
    await createTransaction(app, user, {
      accountId: account.id,
      categoryId: food.id,
      amount: 30000,
      type: 'EXPENSE',
      date: '2026-10-10',
    });

    const res = await request(app)
      .get('/api/budgets/overview?from=2026-10-01&to=2026-10-31')
      .set(...authHeader(user));
    expect(res.body.data.budgets[0].spent).toBe(0);
    expect(res.body.data.budgets[0].window).toBeNull();
  });

  it('actualiza y elimina un presupuesto', async () => {
    const user = await createTestUser(app);
    const category = await createCategory(app, user, { name: 'Comida' });
    const created = await createBudget(user, {
      categoryId: category.id,
      limitAmount: 100000,
      startDate: '2026-10-01',
    });
    const id = created.body.data.id as string;

    const updated = await request(app)
      .put(`/api/budgets/${id}`)
      .set(...authHeader(user))
      .send({ limitAmount: 250000 });
    expect(updated.status).toBe(200);
    expect(Number(updated.body.data.limitAmount)).toBe(250000);

    const invalid = await request(app)
      .put(`/api/budgets/${id}`)
      .set(...authHeader(user))
      .send({ startDate: '2026-10-10', endDate: '2026-10-01' });
    expect(invalid.status).toBe(422);

    const del = await request(app).delete(`/api/budgets/${id}`).set(...authHeader(user));
    expect(del.status).toBe(204);
  });

  it('aísla los presupuestos entre usuarios', async () => {
    const userA = await createTestUser(app);
    const userB = await createTestUser(app);
    const categoryA = await createCategory(app, userA, { name: 'Comida' });
    const created = await createBudget(userA, {
      categoryId: categoryA.id,
      limitAmount: 100000,
      startDate: '2026-10-01',
    });

    const listB = await request(app).get('/api/budgets').set(...authHeader(userB));
    expect(listB.body.data).toHaveLength(0);

    const getB = await request(app)
      .get(`/api/budgets/${created.body.data.id as string}`)
      .set(...authHeader(userB));
    expect(getB.status).toBe(404);
  });
});
