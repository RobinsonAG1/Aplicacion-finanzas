#!/bin/sh
set -eu

# Espera a que PostgreSQL acepte conexiones reales con el rol de aplicacion.
# pg_isready pasa cuando el proceso arranca, pero el rol de app puede no estar
# listo aun (el script 01-app-role.sh se ejecuta despues del arranque inicial).
echo "Esperando conexion a PostgreSQL..."
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
        print(e, file=sys.stderr)
        sys.exit(1)
asyncio.run(check())
" 2>/dev/null; do
  i=$((i+1))
  if [ "$i" -ge 30 ]; then
    echo "Timeout esperando PostgreSQL. Abortando." >&2
    exit 1
  fi
  echo "PostgreSQL no disponible aun, reintentando en 2s... (intento $i/30)"
  sleep 2
done
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
  --forwarded-allow-ips="${FORWARDED_ALLOW_IPS:-127.0.0.1}" \
  --no-access-log
