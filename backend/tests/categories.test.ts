import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closeDatabase, resetDatabase } from './helpers/db.js';
import { authHeader, createTestUser } from './helpers/auth.js';

const app = createApp();

describe('Categorias (categories)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('crea una categoria personalizada (isCustom = true)', async () => {
    const user = await createTestUser(app);
    const res = await request(app)
      .post('/api/categories')
      .set(...authHeader(user))
      .send({ name: 'Mascotas', type: 'EXPENSE', color: '#ff8800' });
    expect(res.status).toBe(201);
    expect(res.body.data.isCustom).toBe(true);
    expect(res.body.data.color).toBe('#ff8800');
  });

  it('rechaza color invalido (422)', async () => {
    const user = await createTestUser(app);
    const res = await request(app)
      .post('/api/categories')
      .set(...authHeader(user))
      .send({ name: 'Mascotas', type: 'EXPENSE', color: 'rojo' });
    expect(res.status).toBe(422);
  });

  it('rechaza nombre y tipo duplicados del mismo usuario (409)', async () => {
    const user = await createTestUser(app);
    const payload = { name: 'Viajes', type: 'EXPENSE' };
    const first = await request(app).post('/api/categories').set(...authHeader(user)).send(payload);
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/categories').set(...authHeader(user)).send(payload);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CATEGORY_EXISTS');
  });

  it('permite el mismo nombre con distinto tipo', async () => {
    const user = await createTestUser(app);
    const a = await request(app)
      .post('/api/categories')
      .set(...authHeader(user))
      .send({ name: 'Ajuste', type: 'EXPENSE' });
    const b = await request(app)
      .post('/api/categories')
      .set(...authHeader(user))
      .send({ name: 'Ajuste', type: 'INCOME' });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
  });

  it('aísla las categorias entre usuarios', async () => {
    const userA = await createTestUser(app);
    const userB = await createTestUser(app);
    await request(app)
      .post('/api/categories')
      .set(...authHeader(userA))
      .send({ name: 'Solo A', type: 'EXPENSE' });

    const listB = await request(app).get('/api/categories').set(...authHeader(userB));
    expect(listB.status).toBe(200);
    expect(listB.body.data).toHaveLength(0);
  });

  it('no permite modificar ni borrar categorias de otro usuario (404)', async () => {
    const userA = await createTestUser(app);
    const userB = await createTestUser(app);
    const created = await request(app)
      .post('/api/categories')
      .set(...authHeader(userA))
      .send({ name: 'Privada', type: 'EXPENSE' });
    const categoryId = created.body.data.id as string;

    const put = await request(app)
      .put(`/api/categories/${categoryId}`)
      .set(...authHeader(userB))
      .send({ name: 'Hackeada' });
    expect(put.status).toBe(404);

    const del = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set(...authHeader(userB));
    expect(del.status).toBe(404);
  });

  it('actualiza el color de una categoria propia', async () => {
    const user = await createTestUser(app);
    const created = await request(app)
      .post('/api/categories')
      .set(...authHeader(user))
      .send({ name: 'Mascotas', type: 'EXPENSE' });
    const id = created.body.data.id as string;

    const put = await request(app)
      .put(`/api/categories/${id}`)
      .set(...authHeader(user))
      .send({ color: '#00ccff' });
    expect(put.status).toBe(200);
    expect(put.body.data.color).toBe('#00ccff');
  });
});
