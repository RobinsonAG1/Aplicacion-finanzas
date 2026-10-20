# AGENTS.md

## Layout
- **Python backend + npm frontend**, no root package manager files: `backend/` (FastAPI + async SQLAlchemy + Alembic) and `frontend/` (React 19 + Vite SPA).
- Backend commands run from `backend/` using the venv interpreter: `.venv\Scripts\python.exe`. Frontend npm commands run from `frontend/`.
- `DOCUMENTACION.md` is the deep technical reference (Spanish); `README.md` is a quick start. Trust code/config over prose when they disagree.
- Deployment targets Coolify via root `docker-compose.yml`: no host ports; only `web:8080` is exposed to Coolify's proxy. CI has a Docker smoke job.

## Windows shell
- Use `npm.cmd` — ExecutionPolicy blocks `npm.ps1`.
- Use `.\.venv\Scripts\python.exe -m <tool>` instead of bare `python`/`pytest`.

## Backend (`backend/`)
- Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 async + asyncpg, Alembic. Install with `pip install -r requirements-dev.txt`; recreate `.venv` on fresh clones.
- Config lives in `app/core/config.py` (pydantic-settings). `APP_ENV` accepts `NODE_ENV` as fallback. Startup aborts on missing/invalid env.
- Migrations: `alembic upgrade head`, `alembic revision --autogenerate -m "..."`. Test DB is migrated automatically by `tests/conftest.py`.
- Seed: `.\.venv\Scripts\python.exe -m scripts.seed` (destructive; requires `SEED_FORCE=true` in production). Demo: `demo@finanzas.test` / `Demo1234!`.
- Layered flow: `router → service → repository`. Repositories expose `find_owned(...)`; keep ownership checks (anti-IDOR) — foreign resources return `404`.
- Errors: raise `AppError(message, status, code=...)`; handlers serialize `{ error: { message, code?, details? } }`. Success is `{ data }` (paginated lists add `meta`).
- Request schemas inherit `CamelRequest`; response schemas inherit `CamelModel`. Amounts are Decimal strings in JSON; timestamps are UTC with `Z`.
- The DB session runs with `timezone=UTC` (`app/db/session.py`). Use UTC for date math and SQL `date_trunc`/`to_char`; do not assume server-local time.
- CSV export/import lives in `app/services/transaction_csv_service.py` and `app/utils/csv.py` (formula neutralization, UTF-8 BOM, 5000-row / 2000-char limits).
- Code style: `ruff` (lint + format), `mypy app scripts`. No comments unless they explain non-obvious behavior.

### Backend tests
- Integration tests hit a **real Postgres**. They read `backend/.env.test` (gitignored, so recreate on fresh clones); `tests/conftest.py` runs `alembic upgrade head` against `finanzas_test`. Local Postgres 18, role/password `finanzas`; dev DB `finanzas`, test DB `finanzas_test`.
- Tests are async (`pytest-asyncio`); tables are truncated between tests.
- Full suite: `.\.venv\Scripts\python.exe -m pytest -q`. Single file: `... -m pytest tests/test_auth.py -q`.
- Order: `ruff check` → `ruff format --check` → `mypy` → `pytest` → `compileall`.

## Frontend (`frontend/`)

## Frontend Design Philosophy & UI/UX

### Role
Act as a Senior Frontend Engineer and UI/UX Designer specializing in React 19, TypeScript, modern CSS, design systems, and production-quality interfaces.

Your responsibility is not only to implement functional components but also to create distinctive, polished, accessible, and coherent user experiences.

### Visual identity
- Design each page according to the product's purpose, target audience, and existing brand identity.
- Avoid generic AI-generated aesthetics. Do not default to purple/blue gradients, neon glows, excessive glassmorphism, futuristic dark backgrounds, oversized rounded cards, or decorative shadows.
- Do not use the same layout, hero section, card grid, or visual hierarchy for every project.
- Avoid excessive centered content, unnecessary floating elements, decorative badges, and meaningless animations.
- Never use emojis as substitutes for professional interface icons.
- Do not add visual effects simply to make the interface look modern.
- Use gradients, shadows, animations, and glass effects only when they have a clear design purpose.

### Design direction
Before implementing a page:
1. Understand its purpose, users, content, and existing functionality.
2. Inspect the current components, styles, assets, and dependencies.
3. Establish a coherent visual direction instead of applying a generic template.
4. Define appropriate typography, colors, spacing, borders, and component states.
5. Consider composition and visual hierarchy before adding decorative elements.

Prefer intentional layouts, balanced whitespace, strong typography, restrained color palettes, meaningful contrast, and visual details that reinforce the product's identity.

Different sections may use different compositions when appropriate. Do not force all content into identical cards.

### React and TypeScript
- Follow the existing React 19 and TypeScript architecture.
- Reuse existing components and dependencies when appropriate.
- Keep components focused, reusable, and easy to maintain.
- Avoid unnecessary abstractions, duplicated logic, and oversized components.
- Use explicit TypeScript types and avoid `any` unless genuinely necessary.
- Follow the project's existing conventions for routing, data fetching, forms, and state management.
- Do not introduce new libraries without a clear benefit.
- Respect `erasableSyntaxOnly`: do not use TypeScript enums or constructor parameter properties.
- Preserve existing API integrations, authentication flows, route protection, and business logic.
- Keep API calls routed through the existing `src/api/client.ts` utilities.

### Styling and design systems
- Inspect the existing styling approach before making changes.
- Use the current CSS architecture and dependencies rather than introducing a competing styling system.
- Create or reuse design tokens for colors, typography, spacing, borders, shadows, and transitions when appropriate.
- Maintain consistent component states, including hover, focus, active, disabled, loading, and error.
- Avoid arbitrary values and inconsistent styling when shared tokens can solve the problem.
- Keep visual consistency without making every page look identical.

### Responsive design and accessibility
- Ensure layouts work on mobile, tablet, laptop, and desktop screens.
- Use responsive layouts based on content requirements.
- Use semantic HTML and accessible form labels.
- Support keyboard navigation and visible focus states.
- Maintain sufficient color contrast.
- Respect `prefers-reduced-motion`.
- Do not rely exclusively on color or hover to communicate important information.
- Avoid horizontal overflow and broken layouts at narrow widths.

### Functional completeness
- Do not sacrifice existing functionality for visual improvements.
- Preserve real data, validation, API calls, permissions, and navigation.
- Implement appropriate loading, empty, error, and success states.
- Do not invent financial data, metrics, transactions, testimonials, or other business information.
- Use realistic interface copy appropriate to the application.
- Ensure every interactive element has a meaningful behavior.

### Implementation and verification
- Inspect the relevant files before editing.
- Make targeted changes and avoid unrelated refactoring.
- Verify the interface at relevant viewport sizes.
- Run the available frontend checks from the `frontend/` directory:
  - `npm.cmd run lint`
  - `npm.cmd run typecheck`
  - `npm.cmd run build`
- Fix errors introduced by the changes.
- Report which files were modified and which checks were completed. Never claim a check passed unless it was actually executed successfully.

### Final design quality check
Before considering a UI task complete, verify:
- The interface has a recognizable visual identity.
- The design avoids generic AI-generated patterns.
- Typography, spacing, colors, and component states are consistent.
- The page hierarchy and layout suit the actual content.
- Responsive behavior and accessibility have been considered.
- Existing functionality and integrations remain intact.
- The implementation follows the project's architecture.

Prioritize product identity over visual trends, usability over decoration, consistency over isolated effects, and maintainable code over unnecessary complexity.

- TS has `erasableSyntaxOnly`: **no enums**, no constructor parameter properties.
- Lint is `oxlint` (`npm run lint`); `typecheck` / `build` use `tsc -b` (project references).
- Access token kept in memory only (`src/lib/tokens.ts`); refresh token is an HttpOnly cookie. Route new calls through `src/api/client.ts` (`apiRequest` / `apiUpload` / `apiDownload`), which adds the bearer token and auto-refreshes once on `401` — requests use `credentials: 'include'`.
- `useAsyncData` deps are `[fetcher, reloadKey]`; pass a stable `fetcher` (wrap in `useCallback`).
- `src/test/setup.ts` polyfills `ResizeObserver` (required by Recharts tests).

## Verify before finishing
- CI (`.github/workflows/ci.yml`) runs per project: backend installs `requirements-dev.txt`, runs `alembic upgrade head`, `ruff check`, `ruff format --check`, `mypy`, `pytest`, `compileall`; frontend runs `npm ci`, `typecheck`, `lint`, `test`, `build`.
- From `backend/`: `.\.venv\Scripts\python.exe -m ruff check app tests scripts`, `... -m ruff format --check app tests scripts`, `... -m mypy app scripts`, `... -m pytest -q`.
- From `frontend/`: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, `npm.cmd run build`.
