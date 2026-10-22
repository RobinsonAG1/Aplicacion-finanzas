#!/bin/sh
# Sincroniza los roles de PostgreSQL con las variables de entorno.
#
# Se ejecuta en cada arranque del contenedor de postgres (ver entrypoint.sh) y
# es idempotente.
#
# La conexion se hace por el socket Unix local, cuyas reglas de pg_hba.conf son
# "trust" por defecto en la imagen oficial: asi el rol de aplicacion se puede
# crear o sincronizar aunque la contrasena guardada en el volumen no coincida
# con la del entorno (por ejemplo, un volumen inicializado con otra clave).
set -eu

: "${APP_DB_USER:?falta APP_DB_USER}"
: "${APP_DB_PASSWORD:?falta APP_DB_PASSWORD}"
: "${POSTGRES_DB:?falta POSTGRES_DB}"
: "${POSTGRES_USER:?falta POSTGRES_USER}"

ADMIN_PASSWORD="${POSTGRES_ADMIN_PASSWORD:-${POSTGRES_PASSWORD:-}}"
: "${ADMIN_PASSWORD:?falta POSTGRES_ADMIN_PASSWORD}"

if [ "$APP_DB_USER" = "$POSTGRES_USER" ]; then
  echo "APP_DB_USER no puede ser igual al superusuario POSTGRES_USER" >&2
  exit 1
fi

PORT="${PGPORT:-5432}"

# Destino de la conexion:
#   - PGSOCKET_DIR: socket concreto (tests o despliegues con ruta fija).
#   - PGHOST: fallback por TCP con la contrasena del superusuario.
#   - sin nada: socket Unix por defecto de psql, que coincide con el del
#     servidor. Es el caso normal dentro del contenedor de postgres y no
#     depende de en que directorio concreto cree el socket el servidor.
CONN_ARGS=""
if [ -n "${PGSOCKET_DIR:-}" ]; then
  CONN_ARGS="-h $PGSOCKET_DIR -p $PORT"
elif [ -n "${PGHOST:-}" ]; then
  CONN_ARGS="-h $PGHOST -p $PORT"
  echo "Socket local no disponible: se usa TCP contra $PGHOST:$PORT" >&2
else
  echo "Conexion por el socket Unix local por defecto de psql." >&2
fi

# El superusuario real puede tener otro nombre que el del entorno: se prueba
# con el del entorno y, si no existe, con "postgres".
CANDIDATES="$POSTGRES_USER"
[ "$POSTGRES_USER" = "postgres" ] || CANDIDATES="$CANDIDATES postgres"

SUPERUSER=""
for candidate in $CANDIDATES; do
  # shellcheck disable=SC2086
  if psql $CONN_ARGS -U "$candidate" -d postgres -tAc 'SELECT 1' >/dev/null 2>&1; then
    SUPERUSER="$candidate"
    break
  fi
done

if [ -z "$SUPERUSER" ]; then
  echo "No se puede conectar como superusuario (probados: $CANDIDATES)." >&2
  echo "Si el volumen se inicializo con otro superusuario, define POSTGRES_ADMIN_USER con ese nombre." >&2
  exit 1
fi

echo "Sincronizando roles con el superusuario '$SUPERUSER'..."

if ! psql $CONN_ARGS -U "$SUPERUSER" -d postgres \
  -v ON_ERROR_STOP=1 \
  -v admin_user="$POSTGRES_USER" \
  -v admin_password="$ADMIN_PASSWORD" \
  -v superuser="$SUPERUSER" \
  -v app_user="$APP_DB_USER" \
  -v app_password="$APP_DB_PASSWORD" \
  -v db_name="$POSTGRES_DB" <<'EOSQL'
-- Superusuario del entorno: se crea si el volumen se inicializo con otro nombre.
SELECT format('CREATE ROLE %I WITH LOGIN SUPERUSER PASSWORD %L', :'admin_user', :'admin_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'admin_user') \gexec

-- La contrasena del superusuario la manda el entorno.
SELECT format('ALTER ROLE %I WITH LOGIN SUPERUSER PASSWORD %L', :'admin_user', :'admin_password') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN SUPERUSER PASSWORD %L', :'superuser', :'admin_password') \gexec

-- Rol de aplicacion con privilegios minimos.
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE', :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') \gexec

SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE', :'app_user', :'app_password') \gexec

-- Base de datos del entorno: se crea si el volumen traia otra.
SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'app_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name') \gexec

SELECT format('ALTER DATABASE %I OWNER TO %I', :'db_name', :'app_user') \gexec
EOSQL
then
  echo "No se pudieron sincronizar los roles: revisa el error de PostgreSQL anterior" >&2
  exit 1
fi

if ! psql $CONN_ARGS -U "$SUPERUSER" -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1 \
  -v app_user="$APP_DB_USER" <<'EOSQL'
SELECT format('ALTER SCHEMA public OWNER TO %I', :'app_user') \gexec
GRANT ALL ON SCHEMA public TO :"app_user";
EOSQL
then
  echo "No se pudieron aplicar los permisos del esquema public en '$POSTGRES_DB'" >&2
  exit 1
fi

echo "Roles sincronizados: superusuario '$POSTGRES_USER', aplicacion '$APP_DB_USER' sobre la base '$POSTGRES_DB'."
