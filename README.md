# Aplicacion de Finanzas Personales (COP)

Gestor de finanzas personales estilo dashboard (tipo Monzo) con modelado relacional
completo y visualizacion de datos. Moneda: **Peso colombiano (COP)**, locale `es-CO`.

- **Backend**: FastAPI + Python 3.12 + SQLAlchemy 2 async + asyncpg + Alembic
  -> PostgreSQL -> SQL raw con window functions -> JWT (access + refresh con rotacion)
  -> Argon2id -> Pydantic v2.
- **Frontend**: React 19 + Vite + TypeScript -> React Router 7 -> Recharts -> TanStack-style
  data hook propio -> oxlint -> Vitest + Testing Library. SPA servida por nginx con proxy `/api`.

## Estructura

```text
.
|-- backend/            API REST (proyecto independiente)
|   |-- app/            core, db, dependencies, routers, schemas, services, repositories
|   |-- migrations/     migraciones Alembic
|   |-- scripts/        seed determinista (usuario demo)
|   |-- tests/          pruebas de integracion (pytest + httpx)
|   `-- Dockerfile      imagen del API
|-- frontend/           SPA React (proyecto independiente)
|   |-- src/            api, hooks, lib, features, pages y estilos
|   |-- Dockerfile      build Vite + nginx
|   `-- nginx.conf      SPA fallback + proxy /api -> backend
|-- docker-compose.yml  Postgres + backend + web (Coolify)
|-- .github/workflows/  CI (GitHub Actions)
`-- .env.example        variables para Coolify
```

## Requisitos

- Python 3.12
- Node.js >= 20
- PostgreSQL 16+ para desarrollo local
- En Windows, usar `npm.cmd` si la ExecutionPolicy bloquea `npm.ps1`.

## Puesta en marcha local

Backend:

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
copy .env.example .env          # ajustar DATABASE_URL y secretos JWT
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m scripts.seed
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 4000
```

Datos demo: `demo@finanzas.test` / `Demo1234!`.

Frontend, en otra terminal:

```bash
cd frontend
copy .env.example .env          # VITE_API_URL apuntando al backend
npm.cmd install
npm.cmd run dev                 # http://localhost:5173
```

## Variables de entorno (backend)

| Variable | Descripcion |
|---|---|
| `APP_ENV` | `development` \| `test` \| `production` (`NODE_ENV` tambien se acepta) |
| `PORT` | Puerto HTTP (def. 4000) |
| `DATABASE_URL` | Conexion PostgreSQL |
| `CORS_ORIGIN` | Origen permitido para el frontend |
| `LOG_LEVEL` | Nivel de logs |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Secretos (min. 32 caracteres, distintos) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | TTL en segundos (900 / 604800) |
| `DEMO_SEED_ENABLED` | En Docker, crea datos demo si falta la cuenta (def. `true`) |
| `SEED_FORCE` | Solo seed: `true` permite borrar datos en produccion |

## Comandos (backend)

| Comando | Descripcion |
|---|---|
| `.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload` | Servidor en modo desarrollo |
| `.\.venv\Scripts\python.exe -m alembic upgrade head` | Aplicar migraciones |
| `.\.venv\Scripts\python.exe -m alembic revision --autogenerate -m "..."` | Nueva migracion |
| `.\.venv\Scripts\python.exe -m scripts.seed` | Datos demo deterministas |
| `.\.venv\Scripts\python.exe -m ruff check app tests scripts` | Lint |
| `.\.venv\Scripts\python.exe -m ruff format --check app tests scripts` | Formato |
| `.\.venv\Scripts\python.exe -m mypy app scripts` | Tipos |
| `.\.venv\Scripts\python.exe -m pytest -q` | Pruebas de integracion |

## Variables de entorno (frontend)

| Variable | Descripcion |
|---|---|
| `VITE_API_URL` | URL base del API (def. `http://localhost:4000/api`; en Docker se compila como `/api`) |

## Comandos (frontend)

| Comando | Descripcion |
|---|---|
| `npm run dev` | Servidor de desarrollo Vite |
| `npm run build` / `npm run preview` | Compilar / previsualizar `dist` |
| `npm run typecheck` / `npm run lint` | Tipos / lint (oxlint) |
| `npm run test` / `npm run test:watch` | Pruebas (Vitest + Testing Library) |

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
| Metas de ahorro | `GET|POST /pots`, `GET|PUT|DELETE /pots/:id`, `POST /pots/:id/deposit`, `POST /pots/:id/withdraw` |
| Facturas | `GET|POST /bills`, `GET /bills/upcoming`, `POST /bills/reminders/run`, `GET|PUT|DELETE /bills/:id`, `GET|POST /bills/:id/reminders`, `POST /bills/:id/pay` |
| Analitica | `GET /analytics/summary`, `GET /analytics/monthly`, `GET /analytics/category-trends`, `GET /analytics/balance-timeline` |

La lista de transacciones soporta paginacion, busqueda, orden y filtros:
`?page=1&limit=10&search=&sort=date|amount|createdAt&order=asc|desc&categoryId=&accountId=&type=&from=&to=`.

En desarrollo, la documentacion interactiva esta en `http://localhost:4000/api/docs`
(deshabilitada en produccion).

## Integracion continua

`.github/workflows/ci.yml` corre en push/PR a `main` y tambien puede lanzarse manualmente
(`workflow_dispatch`):

- **Backend**: PostgreSQL 16 como servicio, `pip install -r requirements-dev.txt`,
  `alembic upgrade head`, `ruff check`, `ruff format --check`, `mypy`, `pytest` y
  `compileall`.
- **Frontend**: `npm ci`, `typecheck`, `lint`, `test` y `build`.
- **Docker**: valida `docker compose config`, construye ambas imagenes, levanta el stack,
  ejecuta el seed y prueba healthcheck, frontend y login.
- **Seguridad**: `pip-audit`, `npm audit` y Trivy.

## Deploy en Coolify

El `docker-compose.yml` esta preparado para produccion:

- No publica puertos en el host.
- Solo `web` expone el puerto interno `8080` al proxy de Coolify.
- `postgres` y `backend` quedan en la red privada del compose.
- El backend aplica `alembic upgrade head` al arrancar.

1. Crear un recurso **Docker Compose** desde el repositorio.
2. Usar `docker-compose.yml` como compose de produccion.
3. Definir las variables de `.env.example` en el panel de Coolify:
   - `POSTGRES_ADMIN_PASSWORD`
   - `APP_DB_USER`, `APP_DB_PASSWORD` (password URL-safe/hexadecimal)
   - `POSTGRES_DB`
   - `CORS_ORIGIN=https://tu-dominio`
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
4. Asignar el dominio al servicio `web` con puerto interno `8080`:

   ```text
   https://tu-dominio:8080
   ```

   El sufijo `:8080` solo indica el puerto interno del contenedor. La URL publica es
   `https://tu-dominio` (sin `:8080`); usa esa misma URL, sin barra final, en `CORS_ORIGIN`.

5. Desplegar y revisar los logs de `postgres`, migraciones y `backend`.
6. Configurar backup del volumen `postgres_data`.
7. Mantener una sola replica del backend (el rate limit es en memoria).

Datos demo opcionales (destructivo):

```bash
docker compose exec -T -e SEED_FORCE=true backend python -m scripts.seed
```

> El rol `APP_DB_USER` se crea solo al inicializar un volumen nuevo (script
> `postgres/init/01-app-role.sh`, ejecutado por el entrypoint oficial de postgres). Si cambias
> `APP_DB_PASSWORD` despues del primer despliegue, vuelve a ejecutar ese script dentro del
> contenedor (`docker compose exec -T postgres sh /docker-entrypoint-initdb.d/01-app-role.sh`) o
> recrea el volumen de forma consciente.

## Roadmap

- [x] Modelo de datos y migraciones
- [x] Autenticacion JWT
- [x] Cuentas, categorias y transacciones (CRUD, filtros, CSV)
- [x] Presupuestos, metas de ahorro, facturas y recordatorios (stub)
- [x] Analitica con window functions
- [x] Frontend React + Recharts (dashboard, cuentas, categorias, transacciones, presupuestos, metas de ahorro, facturas, analitica)
- [x] Integracion continua (GitHub Actions)
- [x] Migracion del backend a FastAPI + SQLAlchemy
- [ ] Despliegue continuo
