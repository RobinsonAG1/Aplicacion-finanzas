# Aplicacion de Finanzas Personales (COP)

Gestor de finanzas personales estilo dashboard (tipo Monzo) con modelado relacional
completo y visualizacion de datos. Moneda: **Peso colombiano (COP)**, locale `es-CO`.

- **Backend**: Express 5 + TypeScript (ESM) · PostgreSQL · Prisma 7 (driver adapter `pg`)
  · SQL raw con window functions · JWT (access + refresh con rotacion) · Argon2id · Zod.
- **Frontend**: React + Vite + TypeScript + Recharts _(pendiente)_.

## Estructura

```
.
├── backend/            API REST (proyecto independiente)
│   ├── prisma/         schema.prisma, migraciones y seed
│   ├── src/            codigo fuente (config, db, middlewares, rutas, servicios, repos)
│   └── tests/          pruebas de integracion (vitest + supertest)
├── docker-compose.yml  Postgres + backend (local / Coolify)
└── .env.example        variables para docker compose
```

## Requisitos

- Node.js >= 20
- PostgreSQL 16+ (o Docker)
- `npm` (en Windows, usar `npm.cmd` si la ExecutionPolicy bloquea `npm.ps1`)

## Puesta en marcha

### Opcion A: Docker Compose (recomendada)

```bash
cp .env.example .env          # editar secretos JWT y password de Postgres
docker compose up --build
```

El backend aplica las migraciones automaticamente al iniciar (`prisma migrate deploy`).
Queda disponible en `http://localhost:4000/api`.

### Opcion B: Local (Postgres nativo)

```bash
cd backend
cp .env.example .env          # ajustar DATABASE_URL y secretos JWT
npm install
npm run prisma:generate
npm run prisma:migrate        # crea/aplica migraciones
npm run seed                  # datos demo (usuario demo@finanzas.test / Demo1234!)
npm run dev                   # http://localhost:4000
```

## Variables de entorno (backend)

| Variable | Descripcion |
|---|---|
| `NODE_ENV` | `development` \| `test` \| `production` |
| `PORT` | Puerto HTTP (def. 4000) |
| `DATABASE_URL` | Conexion PostgreSQL |
| `CORS_ORIGIN` | Origen permitido para el frontend |
| `LOG_LEVEL` | Nivel de logs pino |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Secretos (min. 32 caracteres, distintos) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | TTL en segundos (900 / 604800) |

## Comandos (backend)

| Comando | Descripcion |
|---|---|
| `npm run dev` | Servidor en modo watch |
| `npm run build` / `npm start` | Compilar / ejecutar `dist` |
| `npm run typecheck` / `npm run lint` | Tipos / lint |
| `npm run test` | Pruebas de integracion |
| `npm run prisma:migrate` | Migraciones en desarrollo |
| `npm run db:migrate:deploy` | Migraciones en produccion |
| `npm run prisma:studio` | Explorador de base de datos |
| `npm run seed` | Datos demo deterministicos |

## API

Todas las rutas viven bajo `/api`. Salvo `auth` y `health`, requieren
`Authorization: Bearer <accessToken>`.

| Recurso | Rutas |
|---|---|
| Salud | `GET /health` |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Cuentas | `GET|POST /accounts`, `GET|PUT|DELETE /accounts/:id` |
| Categorias | `GET|POST /categories`, `GET|PUT|DELETE /categories/:id` |
| Transacciones | `GET|POST /transactions`, `GET|PUT|DELETE /transactions/:id`, `PATCH /transactions/:id/category`, `GET /transactions/suggestions`, `GET /transactions/export.csv`, `POST /transactions/import` |
| Presupuestos | `GET|POST /budgets`, `GET /budgets/overview`, `GET|PUT|DELETE /budgets/:id` |
| Huchas | `GET|POST /pots`, `GET|PUT|DELETE /pots/:id`, `POST /pots/:id/deposit`, `POST /pots/:id/withdraw` |
| Facturas | `GET|POST /bills`, `GET /bills/upcoming`, `POST /bills/reminders/run`, `GET|PUT|DELETE /bills/:id`, `GET|POST /bills/:id/reminders`, `POST /bills/:id/pay` |
| Analitica | `GET /analytics/summary`, `GET /analytics/monthly`, `GET /analytics/category-trends`, `GET /analytics/balance-timeline` |

La lista de transacciones soporta paginacion, busqueda, orden y filtros:
`?page=1&limit=10&search=&sort=date|amount|createdAt&order=asc|desc&categoryId=&accountId=&type=&from=&to=`.

## Deploy en Coolify

1. Crear el recurso apuntando a este repositorio con el `docker-compose.yml`.
2. Definir las variables de `.env.example` en el panel (secretos JWT, password de Postgres).
3. El contenedor del backend corre `prisma migrate deploy` antes de arrancar.
4. Configurar el dominio del backend y apuntar `CORS_ORIGIN` al dominio del frontend.

## Roadmap

- [x] Modelo de datos y migraciones
- [x] Autenticacion JWT
- [x] Cuentas, categorias y transacciones (CRUD, filtros, CSV)
- [x] Presupuestos, huchas, facturas y recordatorios (stub)
- [x] Analitica con window functions
- [ ] Frontend React + Recharts
- [ ] CI y despliegue continuo
