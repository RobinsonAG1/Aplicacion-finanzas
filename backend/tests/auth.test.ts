import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closeDatabase, resetDatabase } from './helpers/db.js';

const app = createApp();

const credentials = {
  name: 'Usuario Prueba',
  email: 'auth@finanzas.test',
  password: 'Secreta123!',
};

async function register() {
  return request(app).post('/api/auth/register').send(credentials);
}

describe('Autenticacion', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('registra un usuario y devuelve tokens sin exponer el hash', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(credentials.email);
    expect(res.body.user.name).toBe(credentials.name);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.refreshToken).toBeTypeOf('string');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rechaza un email ya registrado con 409', async () => {
    await register();
    const res = await register();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rechaza datos invalidos con 422', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'X', email: 'no-es-email', password: '123' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('inicia sesion con credenciales correctas', async () => {
    await register();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf('string');
  });

  it('rechaza credenciales incorrectas con 401', async () => {
    await register();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: 'incorrecta' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('protege /me y devuelve el usuario con token valido', async () => {
    const reg = await register();
    const accessToken = reg.body.accessToken as string;

    const unauthorized = await request(app).get('/api/auth/me');
    expect(unauthorized.status).toBe(401);

    const authorized = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(authorized.status).toBe(200);
    expect(authorized.body.user.email).toBe(credentials.email);
  });

  it('rota el refresh token y rechaza su reutilizacion', async () => {
    const reg = await register();
    const refreshToken = reg.body.refreshToken as string;
    expect(refreshToken).toBeTypeOf('string');

    const refreshed = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.refreshToken).not.toBe(refreshToken);

    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(reuse.status).toBe(401);
  });

  it('cierra sesion y luego el refresh deja de funcionar', async () => {
    const reg = await register();
    const refreshToken = reg.body.refreshToken as string;

    const logout = await request(app).post('/api/auth/logout').send({ refreshToken });
    expect(logout.status).toBe(200);

    const afterLogout = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(afterLogout.status).toBe(401);
  });

  it('rechaza un token de acceso invalido con 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer token.falso.xxx');
    expect(res.status).toBe(401);
  });
});
