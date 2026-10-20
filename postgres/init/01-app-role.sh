#!/bin/sh
# Crea/actualiza el rol de aplicacion (sin privilegios de superusuario) y le cede
# la base y el esquema public. Solo se ejecuta al inicializar un volumen vacio.
set -e

: "${APP_DB_USER:?falta APP_DB_USER}"
: "${APP_DB_PASSWORD:?falta APP_DB_PASSWORD}"
: "${POSTGRES_DB:?falta POSTGRES_DB}"
: "${POSTGRES_USER:?falta POSTGRES_USER}"

if [ "$APP_DB_USER" = "$POSTGRES_USER" ]; then
  echo "APP_DB_USER no puede ser igual al superusuario POSTGRES_USER" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v app_user="$APP_DB_USER" \
  -v app_password="$APP_DB_PASSWORD" \
  -v db_name="$POSTGRES_DB" <<'EOSQL'
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE',
  :'app_user',
  :'app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') \gexec

SELECT format(
  'ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE',
  :'app_user',
  :'app_password'
) \gexec

SELECT format('ALTER DATABASE %I OWNER TO %I', :'db_name', :'app_user') \gexec
SELECT format('ALTER SCHEMA public OWNER TO %I', :'app_user') \gexec
GRANT ALL ON SCHEMA public TO :"app_user";
EOSQL

echo "Rol de aplicacion '${APP_DB_USER}' listo con privilegios minimos."
