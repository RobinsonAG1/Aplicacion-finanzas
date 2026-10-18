import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closeDatabase, resetDatabase } from './helpers/db.js';
import { authHeader, createTestUser } from './helpers/auth.js';
import {
  createAccount,
  createCategory,
  createTransaction,
  getAccountBalance,
} from './helpers/fixtures.js';

const app = createApp();

describe('Transacciones', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('crea una transaccion y ajusta el saldo de la cuenta', async () => {
    const user = await createTestUser(app);
    const account = await createAccount(app, user, { balance: 100000 });

    await createTransaction(app, user, {
      accountId: account.id,
      amount: 30000,
      type: 'EXPENSE',
      merchant: 'Rappi',
      date: '2026-10-05',
    });

    expect(await getAccountBalance(app, user, account.id as string)).toBe(70000);
  });

  it('rechaza monto no positivo (422)', async () => {
    const user = await createTestUser(app);
    const account = await createAccount(app, user);
    const res = await request(app)
      .post('/api/transactions')
      .set(...authHeader(user))
      .send({ accountId: account.id, amount: -5, type: 'EXPENSE', date: '2026-10-05' });
    expect(res.status).toBe(422);
  });

  it('rechaza una cuenta inexistente o ajena (404)', async () => {
    const user = await createTestUser(app);
    const res = await request(app)
      .post('/api/transactions')
      .set(...authHeader(user))
      .send({ accountId: 'no-existe', amount: 10, type: 'EXPENSE', date: '2026-10-05' });
    expect(res.status).toBe(404);
  });

  it('pagina 10 por pagina con metadatos', async () => {
    const user = await createTestUser(app);
    const account = await createAccount(app, user);
    for (let i = 0; i < 12; i += 1) {
      await createTransaction(app, user, {
        accountId: account.id,
        amount: 1000 + i,
        type: 'EXPENSE',
        merchant: `Comercio ${i}`,
        date: '2026-10-05',
      });
    }

    const page1 = await request(app).get('/api/transactions?page=1&limit=10').set(...authHeader(user));
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(10);
    expect(page1.body.meta).toMatchObject({ total: 12, page: 1, limit: 10, totalPages: 2 });

    const page2 = await request(app).get('/api/transactions?page=2&limit=10').set(...authHeader(user));
    expect(page2.body.data).toHaveLength(2);
  });

  it('busca por comercio y descripcion', async () => {
    const user = await createTestUser(app);
    const account = await createAccount(app, user);
    await createTransaction(app, user, {
      accountId: account.id,
      amount: 1000,
      type: 'EXPENSE',
      merchant: 'Rappi',
      date: '2026-10-05',
    });
    await createTransaction(app, user, {
      accountId: account.id,
      amount: 2000,
      type: 'EXPENSE',
      merchant: 'Uber',
      date: '2026-10-05',
    });

    const res = await request(app).get('/api/transactions?search=rapp').set(...authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].merchant).toBe('Rappi');
  });

  it('filtra por categoria, tipo y rango de fechas', async () => {
    const user = await createTestUser(app);
    const account = await createAccount(app, user);
    const category = await createCategory(app, user, { name: 'Transporte' });
    await createTransaction(app, user, {
      accountId: account.id,
      categoryId: category.id,
      amount: 5000,
      type: 'EXPENSE',
      merchant: 'Uber',
      date: '2026-10-05',
    });
    await createTransaction(app, user, {
      accountId: account.id,
      amount: 4000000,
      type: 'INCOME',
      merchant: 'Empleador',
      date: '2026-09-15',
    });

    const byCategory = await request(app)
      .get(`/api/transactions?categoryId=${category.id as string}`)
      .set(...authHeader(user));
    expect(byCategory.body.data).toHaveLength(1);

    const byType = await request(app)
      .get('/api/transactions?type=INCOME')
      .set(...authHeader(user));
    expect(byType.body.data).toHaveLength(1);

    const byRange = await request(app)
      .get('/api/transactions?from=2026-10-01&to=2026-10-31')
      .set(...authHeader(user));
    expect(byRange.body.data).toHaveLength(1);
  });

  it('ordena por monto ascendente y descendente', async () => {
    const user = await createTestUser(app);
    const account = await createAccount(app, user);
    for (const amount of [500, 3000, 100]) {
      await createTransaction(app, user, {
        accountId: account.id,
        amount,
        type: 'EXPENSE',
        date: '2026-10-05',
      });
    }
    const asc = await request(app)
      .get('/api/transactions?sort=amount&order=asc')
      .set(...authHeader(user));
    const amounts = asc.body.data.map((t: { amount: string }) => Number(t.amount));
    expect(amounts).toEqual([100, 500, 3000]);
  });

  it('actualiza una transaccion ajustando el saldo correctamente', async () => {
    const user = await createTestUser(app);
    const account = await createAccount(app, user, { balance: 100000 });
    const tx = await createTransaction(app, user, {
      accountId: account.id,
      amount: 30000,
      type: 'EXPENSE',
      date: '2026-10-05',
    });

    const res = await request(app)
      .put(`/api/transactions/${tx.id as string}`)
      .set(...authHeader(user))
      .send({ amount: 50000 });
    expect(res.status).toBe(200);
    expect(await getAccountBalance(app, user, account.id as string)).toBe(50000);
  });

  it('elimina una transaccion revirtiendo el saldo', async () => {
    const user = await createTestUser(app);
    const account = await createAccount(app, user, { balance: 100000 });
    const tx = await createTransaction(app, user, {
      accountId: account.id,
      amount: 30000,
      type: 'EXPENSE',
      date: '2026-10-05',
    });

    const del = await request(app)
      .delete(`/api/transactions/${tx.id as string}`)
      .set(...authHeader(user));
    expect(del.status).toBe(204);
    expect(await getAccountBalance(app, user, account.id as string)).toBe(100000);
  });

  it('categoriza manualmente y permite quitar la categoria', async () => {
    const user = await createTestUser(app);
    const account = await createAccount(app, user);
    const category = await createCategory(app, user, { name: 'Comida' });
    const tx = await createTransaction(app, user, {
      accountId: account.id,
      amount: 1000,
      type: 'EXPENSE',
      date: '2026-10-05',
    });

    const set = await request(app)
      .patch(`/api/transactions/${tx.id as string}/category`)
      .set(...authHeader(user))
      .send({ categoryId: category.id });
    expect(set.status).toBe(200);
    expect(set.body.data.category.id).toBe(category.id);

    const clear = await request(app)
      .patch(`/api/transactions/${tx.id as string}/category`)
      .set(...authHeader(user))
      .send({ categoryId: null });
    expect(clear.status).toBe(200);
    expect(clear.body.data.category).toBeNull();
  });

  it('sugiere categoria segun el comercio', async () => {
    const user = await createTestUser(app);
    const account = await createAccount(app, user);
    const category = await createCategory(app, user, { name: 'Transporte' });
    await createTransaction(app, user, {
      accountId: account.id,
      categoryId: category.id,
      amount: 5000,
      type: 'EXPENSE',
      merchant: 'Uber',
      date: '2026-10-01',
    });
    await createTransaction(app, user, {
      accountId: account.id,
      categoryId: category.id,
      amount: 7000,
      type: 'EXPENSE',
      merchant: 'Uber',
      date: '2026-10-02',
    });

    const res = await request(app)
      .get('/api/transactions/suggestions?merchant=Uber')
      .set(...authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.suggestions[0].category.id).toBe(category.id);
  });

  it('aísla las transacciones entre usuarios (404)', async () => {
    const userA = await createTestUser(app);
    const userB = await createTestUser(app);
    const accountA = await createAccount(app, userA);
    const tx = await createTransaction(app, userA, {
      accountId: accountA.id,
      amount: 1000,
      type: 'EXPENSE',
      date: '2026-10-05',
    });

    const res = await request(app).get(`/api/transactions/${tx.id as string}`).set(...authHeader(userB));
    expect(res.status).toBe(404);

    const listB = await request(app).get('/api/transactions').set(...authHeader(userB));
    expect(listB.body.data).toHaveLength(0);
  });

  it('rechaza crear con cuenta o categoria ajena (404)', async () => {
    const userA = await createTestUser(app);
    const userB = await createTestUser(app);
    const accountA = await createAccount(app, userA);
    const categoryA = await createCategory(app, userA, { name: 'Ajena' });
    const accountB = await createAccount(app, userB);

    const foreignAccount = await request(app)
      .post('/api/transactions')
      .set(...authHeader(userB))
      .send({ accountId: accountA.id, amount: 10, type: 'EXPENSE', date: '2026-10-05' });
    expect(foreignAccount.status).toBe(404);

    const foreignCategory = await request(app)
      .post('/api/transactions')
      .set(...authHeader(userB))
      .send({
        accountId: accountB.id,
        categoryId: categoryA.id,
        amount: 10,
        type: 'EXPENSE',
        date: '2026-10-05',
      });
    expect(foreignCategory.status).toBe(404);
  });

  it('rechaza actualizar hacia cuenta o categoria ajena (404)', async () => {
    const userA = await createTestUser(app);
    const userB = await createTestUser(app);
    const accountA = await createAccount(app, userA);
    const categoryA = await createCategory(app, userA, { name: 'Ajena' });
    const accountB = await createAccount(app, userB);
    const tx = await createTransaction(app, userB, {
      accountId: accountB.id,
      amount: 1000,
      type: 'EXPENSE',
      date: '2026-10-05',
    });

    const toForeignAccount = await request(app)
      .put(`/api/transactions/${tx.id as string}`)
      .set(...authHeader(userB))
      .send({ accountId: accountA.id });
    expect(toForeignAccount.status).toBe(404);

    const toForeignCategory = await request(app)
      .patch(`/api/transactions/${tx.id as string}/category`)
      .set(...authHeader(userB))
      .send({ categoryId: categoryA.id });
    expect(toForeignCategory.status).toBe(404);
  });
});
