import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closeDatabase, resetDatabase } from './helpers/db.js';
import { extractRefreshCookie } from './helpers/auth.js';

const app = createApp();

const credentials = {
  name: 'Usuario Prueba',
  email: 'auth@finanzas.test',
  password: 'Secreta123!',
};

async function register() {
  return request(app).post('/api/auth/register').send(credentials);
}

function cookiesOf(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  return Array.isArray(raw) ? raw.join('; ') : String(raw ?? '');
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
    expect(res.body.user.passwordHash).toBeUndefined();
    // El refresh token va en cookie HttpOnly, nunca en el cuerpo.
    expect(res.body.refreshToken).toBeUndefined();
    const cookies = cookiesOf(res);
    expect(cookies).toContain('refresh_token=');
    expect(cookies).toContain('HttpOnly');
    expect(cookies).toContain('SameSite=Strict');
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
    expect(res.body.refreshToken).toBeUndefined();
    expect(extractRefreshCookie(res)).toContain('refresh_token=');
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

  it('rota el refresh token (cookie) y rechaza su reutilizacion', async () => {
    const reg = await register();
    const firstCookie = extractRefreshCookie(reg);
    expect(firstCookie).toContain('refresh_token=');

    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', firstCookie);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTypeOf('string');
    const secondCookie = extractRefreshCookie(refreshed);
    expect(secondCookie).not.toBe(firstCookie);

    const reuse = await request(app).post('/api/auth/refresh').set('Cookie', firstCookie);
    expect(reuse.status).toBe(401);
  });

  it('revoca toda la familia al detectar reuso de un refresh rotado', async () => {
    const reg = await register();
    const firstCookie = extractRefreshCookie(reg);

    const rotated = await request(app).post('/api/auth/refresh').set('Cookie', firstCookie);
    expect(rotated.status).toBe(200);
    const secondCookie = extractRefreshCookie(rotated);
    expect(secondCookie).not.toBe(firstCookie);

    const reuse = await request(app).post('/api/auth/refresh').set('Cookie', firstCookie);
    expect(reuse.status).toBe(401);

    const afterReuse = await request(app).post('/api/auth/refresh').set('Cookie', secondCookie);
    expect(afterReuse.status).toBe(401);
  });

  it('cierra sesion y luego el refresh deja de funcionar', async () => {
    const reg = await register();
    const cookie = extractRefreshCookie(reg);

    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(200);

    const afterLogout = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(afterLogout.status).toBe(401);
  });

  it('rechaza el refresh cuando no hay cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('rechaza el refresh con un Origin no permitido (CSRF)', async () => {
    const reg = await register();
    const cookie = extractRefreshCookie(reg);

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .set('Origin', 'https://sitio-malicioso.example');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_ORIGIN_MISMATCH');
  });

  it('rechaza un token de acceso invalido con 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer token.falso.xxx');
    expect(res.status).toBe(401);
  });
});
