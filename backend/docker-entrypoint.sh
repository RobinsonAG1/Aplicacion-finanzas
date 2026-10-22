#!/bin/sh
set -eu

# Construye la URL de conexion a partir de las piezas sueltas, con URL-encoding
# de usuario y contrasena (una contrasena con @ : / # no rompe el DSN).
if [ -z "${DATABASE_URL:-}" ]; then
  : "${DB_HOST:?falta DB_HOST}"
  : "${DB_PORT:?falta DB_PORT}"
  : "${DB_NAME:?falta DB_NAME}"
  : "${DB_USER:?falta DB_USER}"
  : "${DB_PASSWORD:?falta DB_PASSWORD}"
  DATABASE_URL=$(python -c "
import os
from urllib.parse import quote
user = quote(os.environ['DB_USER'], safe='')
password = quote(os.environ['DB_PASSWORD'], safe='')
host = os.environ['DB_HOST']
port = os.environ['DB_PORT']
name = quote(os.environ['DB_NAME'], safe='')
print(f'postgresql://{user}:{password}@{host}:{port}/{name}')
")
  export DATABASE_URL
fi

# Espera a que PostgreSQL acepte conexiones reales con el rol de aplicacion.
# pg_isready pasa cuando el proceso arranca, pero el rol de app puede no estar
# listo aun (el script 01-app-role.sh se ejecuta despues del arranque inicial).
echo "Esperando conexion a PostgreSQL..."
DB_ERROR=$(mktemp)
i=0
until python -c "
import asyncio, asyncpg, os, sys
async def check():
    url = os.environ['DATABASE_URL']
    if url.startswith('postgresql://'):
        url = 'postgres://' + url[len('postgresql://'):]
    try:
        conn = await asyncpg.connect(url)
        await conn.close()
    except Exception as e:
        print(f'{type(e).__name__}: {e}', file=sys.stderr)
        sys.exit(1)
asyncio.run(check())
" 2>"$DB_ERROR"; do
  i=$((i+1))
  echo "PostgreSQL no disponible aun (intento $i/30): $(cat "$DB_ERROR")"
  if [ "$i" -eq 1 ]; then
    echo "Revisa DATABASE_URL (host, usuario y contrasena) y que el rol exista en PostgreSQL." >&2
  fi
  if [ "$i" -ge 30 ]; then
    echo "Timeout esperando PostgreSQL. Abortando." >&2
    echo "Si el error indica 'role ... does not exist' o 'password authentication failed':" >&2
    echo "  el rol de aplicacion lo crea el entrypoint de postgres (postgres/init/01-app-role.sh)." >&2
    echo "  Revisa los logs del contenedor postgres y que APP_DB_PASSWORD coincida con la del compose." >&2
    exit 1
  fi
  sleep 2
done
rm -f "$DB_ERROR"
echo "PostgreSQL listo."

echo "Aplicando migraciones de base de datos..."
python -m alembic upgrade head

if [ "${DEMO_SEED_ENABLED:-false}" = "true" ]; then
  echo "Verificando cuenta demo..."
  python -m scripts.seed --if-missing
fi

echo "Iniciando servidor..."
exec python -m uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-4000}" \
  --proxy-headers \
  --forwarded-allow-ips="${FORWARDED_ALLOW_IPS:-*}" \
  --no-access-log
