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

const HEADER = 'fecha,tipo,monto,cuenta,categoria,comercio,descripcion\r\n';

describe('Transacciones CSV', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('exporta las transacciones en CSV respetando filtros', async () => {
    const user = await createTestUser(app);
    const account = await createAccount(app, user, { name: 'Ahorros' });
    await createTransaction(app, user, {
      accountId: account.id,
      amount: 30000,
      type: 'EXPENSE',
      merchant: 'Uber',
      date: '2026-10-05',
    });
    await createTransaction(app, user, {
      accountId: account.id,
      amount: 4000000,
      type: 'INCOME',
      merchant: 'Empleador',
      date: '2026-10-06',
    });

    const res = await request(app).get('/api/transactions/export.csv').set(...authHeader(user));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text).toContain('fecha,tipo,monto,cuenta,categoria,comercio,descripcion');
    expect(res.text).toContain('gasto');
    expect(res.text).toContain('ingreso');

    const incomeOnly = await request(app)
      .get('/api/transactions/export.csv?type=INCOME')
      .set(...authHeader(user));
    expect(incomeOnly.text).toContain('ingreso');
    expect(incomeOnly.text).not.toContain('gasto');
  });

  it('importa un CSV por multipart y ajusta saldos', async () => {
    const user = await createTestUser(app);
    const account = await createAccount(app, user, { name: 'Ahorros', balance: 100000 });
    await createCategory(app, user, { name: 'Transporte', type: 'EXPENSE' });

    const csv =
      HEADER +
      '2026-10-05,gasto,30000,Ahorros,Transporte,Uber,Viaje\r\n' +
      '2026-10-06,ingreso,"4.000.000",Ahorros,,Empleador,Salario\r\n';

    const res = await request(app)
      .post('/api/transactions/import')
      .set(...authHeader(user))
      .attach('file', Buffer.from(csv, 'utf8'), { filename: 'datos.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 2, imported: 2, skipped: 0, errors: [] });
    expect(await getAccountBalance(app, user, account.id as string)).toBe(4070000);

    const list = await request(app).get('/api/transactions').set(...authHeader(user));
    expect(list.body.meta.total).toBe(2);
    const transporte = list.body.data.find((t: { merchant: string }) => t.merchant === 'Uber');
    expect(transporte.category.name).toBe('Transporte');
  });

  it('acepta el contenido CSV como texto plano', async () => {
    const user = await createTestUser(app);
    await createAccount(app, user, { name: 'Ahorros' });
    const csv =
      HEADER + '2026-10-05,gasto,15000,Ahorros,,"Rappi, Colombia",Domicilio\r\n';

    const res = await request(app)
      .post('/api/transactions/import')
      .set(...authHeader(user))
      .set('Content-Type', 'text/csv')
      .send(csv);

    expect(res.status).toBe(200);
    expect(res.body.data.imported).toBe(1);
  });

  it('reporta filas con error sin bloquear las validas', async () => {
    const user = await createTestUser(app);
    await createAccount(app, user, { name: 'Ahorros' });
    const csv =
      HEADER +
      'no-es-fecha,gasto,10000,Ahorros,,,\r\n' +
      '2026-10-05,gasto,abc,Ahorros,,,\r\n' +
      '2026-10-06,gasto,20000,CuentaInexistente,,,\r\n' +
      '2026-10-07,gasto,25000,Ahorros,,,\r\n';

    const res = await request(app)
      .post('/api/transactions/import')
      .set(...authHeader(user))
      .set('Content-Type', 'text/csv')
      .send(csv);

    expect(res.status).toBe(200);
    expect(res.body.data.imported).toBe(1);
    expect(res.body.data.errors).toHaveLength(3);
  });

  it('omite duplicados en reimportaciones', async () => {
    const user = await createTestUser(app);
    await createAccount(app, user, { name: 'Ahorros' });
    const csv = HEADER + '2026-10-05,gasto,30000,Ahorros,Uber,,Viaje\r\n';

    await request(app)
      .post('/api/transactions/import')
      .set(...authHeader(user))
      .set('Content-Type', 'text/csv')
      .send(csv);
    const second = await request(app)
      .post('/api/transactions/import')
      .set(...authHeader(user))
      .set('Content-Type', 'text/csv')
      .send(csv);

    expect(second.body.data).toMatchObject({ imported: 0, skipped: 1 });
  });

  it('exige un archivo o contenido CSV', async () => {
    const user = await createTestUser(app);
    const res = await request(app)
      .post('/api/transactions/import')
      .set(...authHeader(user))
      .set('Content-Type', 'text/csv')
      .send('');
    expect(res.status).toBe(400);
  });

  it('neutraliza formulas al exportar CSV', async () => {
    const user = await createTestUser(app);
    const account = await createAccount(app, user, { name: 'Ahorros' });
    await createTransaction(app, user, {
      accountId: account.id,
      amount: 1000,
      type: 'EXPENSE',
      merchant: '=SUM(1+1)',
      description: '@peligro',
      date: '2026-10-05',
    });

    const res = await request(app).get('/api/transactions/export.csv').set(...authHeader(user));
    expect(res.status).toBe(200);
    expect(res.text).toContain("'=SUM(1+1)");
    expect(res.text).toContain("'@peligro");
  });

  it('rechaza campos demasiado largos en la importacion', async () => {
    const user = await createTestUser(app);
    await createAccount(app, user, { name: 'Ahorros' });
    const longField = 'x'.repeat(2001);
    const csv = HEADER + `2026-10-05,gasto,10000,Ahorros,,,${longField}\r\n`;

    const res = await request(app)
      .post('/api/transactions/import')
      .set(...authHeader(user))
      .set('Content-Type', 'text/csv')
      .send(csv);

    expect(res.status).toBe(200);
    expect(res.body.data.imported).toBe(0);
    expect(res.body.data.errors[0].message).toBe('campo demasiado largo');
  });

  it('rechaza un CSV con demasiadas filas', async () => {
    const user = await createTestUser(app);
    await createAccount(app, user, { name: 'Ahorros' });
    const rows = Array.from({ length: 5001 }, () => '2026-10-05,gasto,1000,Ahorros,,,').join('\r\n');

    const res = await request(app)
      .post('/api/transactions/import')
      .set(...authHeader(user))
      .set('Content-Type', 'text/csv')
      .send(HEADER + rows + '\r\n');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CSV_TOO_MANY_ROWS');
  });
});
