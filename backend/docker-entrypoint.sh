#!/bin/sh
set -e

echo "Aplicando migraciones de base de datos..."
npx --no-install prisma migrate deploy

echo "Iniciando servidor..."
exec node dist/server.js
