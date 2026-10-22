#!/bin/sh
# Crea el rol de aplicacion (minimo privilegio) y le asigna la base de datos.
#
# Se ejecuta desde /docker-entrypoint-initdb.d al inicializar un volumen nuevo:
# el entrypoint oficial de postgres ya ha creado el superusuario y la base con
# las variables del entorno, asi que aqui solo queda el rol que usa el backend.
#
# La conexion va por el socket Unix local: durante la inicializacion el
# servidor temporal de postgres solo escucha ahi y autentica con trust.
#
# Si hay que resincronizarlo mas adelante (por ejemplo, tras cambiar
# APP_DB_PASSWORD) se puede ejecutar a mano dentro del contenedor de postgres:
#   docker compose exec postgres sh /docker-entrypoint-initdb.d/01-app-role.sh
set -e

: "${APP_DB_USER:?falta APP_DB_USER}"
: "${APP_DB_PASSWORD:?falta APP_DB_PASSWORD}"
: "${POSTGRES_DB:?falta POSTGRES_DB}"
: "${POSTGRES_USER:?falta POSTGRES_USER}"

if [ "$APP_DB_USER" = "$POSTGRES_USER" ]; then
  echo "APP_DB_USER no puede ser igual al superusuario POSTGRES_USER" >&2
  exit 1
fi

if ! PGHOST= PGHOSTADDR= psql --no-password -U "$POSTGRES_USER" -d postgres \
  -v ON_ERROR_STOP=1 \
  -v app_user="$APP_DB_USER" \
  -v app_password="$APP_DB_PASSWORD" \
  -v db_name="$POSTGRES_DB" <<'EOSQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE', :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') \gexec

SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE', :'app_user', :'app_password') \gexec

SELECT format('ALTER DATABASE %I OWNER TO %I', :'db_name', :'app_user') \gexec
EOSQL
then
  echo "No se pudo crear el rol de aplicacion: revisa el error de PostgreSQL anterior" >&2
  exit 1
fi

if ! PGHOST= PGHOSTADDR= psql --no-password -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1 \
  -v app_user="$APP_DB_USER" <<'EOSQL'
SELECT format('ALTER SCHEMA public OWNER TO %I', :'app_user') \gexec
GRANT ALL ON SCHEMA public TO :"app_user";
EOSQL
then
  echo "No se pudieron aplicar los permisos del esquema public en '$POSTGRES_DB'" >&2
  exit 1
fi

echo "Rol de aplicacion '$APP_DB_USER' listo sobre la base '$POSTGRES_DB'."
