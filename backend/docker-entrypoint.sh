#!/bin/sh
set -eu

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
