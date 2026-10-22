#!/bin/sh
# Sincroniza los roles de PostgreSQL con las variables de entorno.
#
# Es idempotente y se ejecuta en dos momentos:
#   - al inicializar un volumen vacio (/docker-entrypoint-initdb.d)
#   - en cada despliegue (servicio postgres-init, que comparte el socket local)
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

# Destino de la conexion: preferimos el socket Unix local (autenticacion trust);
# si no existe, se cae a TCP con la contrasena del superusuario.
CONN_ARGS=""
SOCKET_DIR=""
for dir in ${PGSOCKET_DIR:-/var/run/postgresql} /tmp; do
  if [ -S "$dir/.s.PGSQL.$PORT" ]; then
    SOCKET_DIR="$dir"
    CONN_ARGS="-h $SOCKET_DIR -p $PORT"
    break
  fi
done

if [ -z "$CONN_ARGS" ]; then
  if [ -n "${PGHOST:-}" ]; then
    CONN_ARGS="-h $PGHOST -p $PORT"
    echo "Socket local no disponible: se usa TCP contra $PGHOST:$PORT" >&2
  else
    echo "No se encuentra el socket de PostgreSQL en ${PGSOCKET_DIR:-/var/run/postgresql} ni en /tmp" >&2
    exit 1
  fi
fi

# El superusuario real puede tener otro nombre que el del entorno: se prueba
# con el del entorno y, si no existe, con "postgres".
SUPERUSER=""
for candidate in "$POSTGRES_USER" postgres; do
  # shellcheck disable=SC2086
  if psql $CONN_ARGS -U "$candidate" -d postgres -tAc 'SELECT 1' >/dev/null 2>&1; then
    SUPERUSER="$candidate"
    break
  fi
done

if [ -z "$SUPERUSER" ]; then
  echo "No se puede conectar como superusuario ($CONN_ARGS)" >&2
  exit 1
fi

echo "Sincronizando roles con el superusuario '$SUPERUSER' ($CONN_ARGS)..."

# shellcheck disable=SC2086
psql $CONN_ARGS -U "$SUPERUSER" -d postgres \
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

psql $CONN_ARGS -U "$SUPERUSER" -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1 \
  -v app_user="$APP_DB_USER" <<'EOSQL'
SELECT format('ALTER SCHEMA public OWNER TO %I', :'app_user') \gexec
GRANT ALL ON SCHEMA public TO :"app_user";
EOSQL

echo "Roles sincronizados: superusuario '$POSTGRES_USER', aplicacion '$APP_DB_USER' sobre la base '$POSTGRES_DB'."
