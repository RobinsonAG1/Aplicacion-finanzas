# syntax=docker/dockerfile:1

# Imagen propia de postgres con el script de inicializacion ya dentro.
# Asi no depende de un bind mount del repo al contenedor (que en Coolify
# llegaba vacio): si el contexto no trae init/, el build falla de forma visible.
FROM postgres:16-alpine

COPY init/ /docker-entrypoint-initdb.d/
