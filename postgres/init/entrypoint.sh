#!/bin/sh
# Wrapper del entrypoint oficial de PostgreSQL.
#
# Arranca el servidor (el entrypoint oficial hace el initdb cuando el volumen
# esta vacio) y, en cuanto el servidor real acepta conexiones, sincroniza los
# roles con las variables de entorno.
#
# La sincronizacion se hace por el socket Unix local, que autentica con "trust"
# en la imagen oficial: por eso funciona aunque la contrasena guardada en el
# volumen no coincida con la del entorno (volumen inicializado con otra clave).
set -eu

child=""

forward() {
  if [ -n "$child" ]; then
    kill -TERM "$child" 2>/dev/null || true
  fi
}
trap forward TERM INT

docker-entrypoint.sh "$@" &
child=$!

# El servidor temporal del init solo escucha en el socket local, nunca en TCP:
# esperar a TCP garantiza que el servidor definitivo ya esta en marcha.
until pg_isready -h 127.0.0.1 -p "${PGPORT:-5432}" -U "${POSTGRES_USER:-postgres}" >/dev/null 2>&1; do
  if ! kill -0 "$child" 2>/dev/null; then
    echo "El servidor de PostgreSQL termino durante el arranque" >&2
    wait "$child" || true
    exit 1
  fi
  sleep 1
done

echo "Sincronizando roles de PostgreSQL con el entorno..."
rm -f /tmp/roles-synced
if sh /init/01-app-role.sh; then
  touch /tmp/roles-synced
else
  # El servidor se queda en marcha para poder diagnosticar, pero sin el
  # marcador el healthcheck no da el contenedor por sano y el despliegue se
  # detiene con el error visible en los logs.
  echo "La sincronizacion de roles ha fallado: revisa el error anterior." >&2
fi

wait "$child"
