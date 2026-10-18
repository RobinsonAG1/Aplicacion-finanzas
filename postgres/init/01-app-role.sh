#!/bin/sh
# Crea el rol de aplicacion (sin privilegios de superusuario) y le cede la base
# y el esquema public. El backend se conecta con este rol, nunca con el admin.
# Punto 9 de la auditoria de seguridad.
set -e

: "${APP_DB_USER:?falta APP_DB_USER}"
: "${APP_DB_PASSWORD:?falta APP_DB_PASSWORD}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE "${APP_DB_USER}" LOGIN PASSWORD '${APP_DB_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  ALTER DATABASE "${POSTGRES_DB}" OWNER TO "${APP_DB_USER}";
  ALTER SCHEMA public OWNER TO "${APP_DB_USER}";
  GRANT ALL ON SCHEMA public TO "${APP_DB_USER}";
EOSQL

echo "Rol de aplicacion '${APP_DB_USER}' creado con privilegios minimos."
