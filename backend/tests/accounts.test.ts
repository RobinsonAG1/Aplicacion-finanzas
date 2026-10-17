import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closeDatabase, resetDatabase } from './helpers/db.js';
import { authHeader, createTestUser } from './helpers/auth.js';

const app = createApp();

describe('Cuentas (accounts)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('requiere autenticacion (401)', async () => {
    const res = await request(app).get('/api/accounts');
    expect(res.status).toBe(401);
  });

  it('crea una cuenta con valores por defecto de moneda', async () => {
    const user = await createTestUser(app);
    const res = await request(app)
      .post('/api/accounts')
      .set(...authHeader(user))
      .send({ name: 'Ahorros', type: 'SAVINGS', balance: 500000 });
    expect(res.status).toBe(201);
    expect(res.body.data.currency).toBe('COP');
    expect(res.body.data.name).toBe('Ahorros');
  });

  it('rechaza un tipo de cuenta invalido (422)', async () => {
    const user = await createTestUser(app);
    const res = await request(app)
      .post('/api/accounts')
      .set(...authHeader(user))
      .send({ name: 'X', type: 'NO_EXISTE' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lista solo las cuentas del usuario autenticado', async () => {
    const userA = await createTestUser(app);
    const userB = await createTestUser(app);
    await request(app).post('/api/accounts').set(...authHeader(userA)).send({ name: 'A', type: 'CASH' });
    await request(app).post('/api/accounts').set(...authHeader(userB)).send({ name: 'B', type: 'CASH' });

    const res = await request(app).get('/api/accounts').set(...authHeader(userA));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('A');
  });

  it('no permite leer una cuenta de otro usuario (404)', async () => {
    const userA = await createTestUser(app);
    const userB = await createTestUser(app);
    const created = await request(app)
      .post('/api/accounts')
      .set(...authHeader(userA))
      .send({ name: 'Privada', type: 'SAVINGS' });
    const accountId = created.body.data.id as string;

    const res = await request(app).get(`/api/accounts/${accountId}`).set(...authHeader(userB));
    expect(res.status).toBe(404);
  });

  it('no permite actualizar ni borrar cuentas de otro usuario (404)', async () => {
    const userA = await createTestUser(app);
    const userB = await createTestUser(app);
    const created = await request(app)
      .post('/api/accounts')
      .set(...authHeader(userA))
      .send({ name: 'Privada', type: 'SAVINGS' });
    const accountId = created.body.data.id as string;

    const put = await request(app)
      .put(`/api/accounts/${accountId}`)
      .set(...authHeader(userB))
      .send({ name: 'Hackeada' });
    expect(put.status).toBe(404);

    const del = await request(app).delete(`/api/accounts/${accountId}`).set(...authHeader(userB));
    expect(del.status).toBe(404);
  });

  it('actualiza y elimina una cuenta propia', async () => {
    const user = await createTestUser(app);
    const created = await request(app)
      .post('/api/accounts')
      .set(...authHeader(user))
      .send({ name: 'Vieja', type: 'SAVINGS' });
    const accountId = created.body.data.id as string;

    const put = await request(app)
      .put(`/api/accounts/${accountId}`)
      .set(...authHeader(user))
      .send({ name: 'Nueva', balance: 123400 });
    expect(put.status).toBe(200);
    expect(put.body.data.name).toBe('Nueva');

    const del = await request(app).delete(`/api/accounts/${accountId}`).set(...authHeader(user));
    expect(del.status).toBe(204);

    const get = await request(app).get(`/api/accounts/${accountId}`).set(...authHeader(user));
    expect(get.status).toBe(404);
  });
});
