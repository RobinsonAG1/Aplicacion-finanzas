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
|-- docker-compose.yml  Postgres + backend + web (local / Coolify)
|-- .github/workflows/  CI (GitHub Actions)
`-- .env.example        variables para docker compose
```

## Requisitos

- Python 3.12
- Node.js >= 20
- PostgreSQL 16+ (o Docker)
- En Windows, usar `npm.cmd` si la ExecutionPolicy bloquea `npm.ps1`.

## Puesta en marcha

### Opcion A: Docker Compose (recomendada)

```bash
cp .env.example .env          # editar secretos JWT y passwords de Postgres
docker compose up --build
```

> El backend se conecta con un rol de aplicacion de minimo privilegio (`POSTGRES_USER`),
> creado por `postgres/init/01-app-role.sh` al inicializar un volumen nuevo. Si ya tenias
> un volumen previo, recrealo con `docker compose down -v` para aplicar el rol.

El backend aplica las migraciones automaticamente al iniciar (`alembic upgrade head`).
- Frontend (nginx): `http://localhost:8080`
- API: `http://localhost:4000/api`

### Opcion B: Local (Postgres nativo)

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

`.github/workflows/ci.yml` corre en cada push/PR a `main`:

- **Backend**: PostgreSQL 16 como servicio, `pip install -r requirements-dev.txt`,
  `alembic upgrade head`, `ruff check`, `ruff format --check`, `mypy`, `pytest` y
  `compileall`.
- **Frontend**: `npm ci`, `typecheck`, `lint`, `test` y `build`.
- **Seguridad**: `pip-audit`, `npm audit` y Trivy.

## Deploy en Coolify

1. Crear el recurso apuntando a este repositorio con el `docker-compose.yml`.
2. Definir las variables de `.env.example` en el panel (secretos JWT, password de Postgres).
3. El contenedor del backend corre `alembic upgrade head` antes de arrancar.
4. El servicio `web` compila la SPA y la sirve con nginx, proxyeando `/api` al backend;
   exponer su puerto (`WEB_PORT`, def. 8080) en el dominio publico.
5. Configurar dominios: si el frontend accede al API por el mismo origen (proxy nginx) no
   se necesita CORS; si se sirven en dominios distintos, apuntar `CORS_ORIGIN` al del frontend.

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
