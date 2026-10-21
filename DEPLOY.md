# DEPLOY.md — Despliegue en Coolify

Documento operativo del proyecto **Aplicacion-finanzas** (FastAPI + React + PostgreSQL).
Última revisión: **2026-10-21**.

> Este documento no contiene valores secretos. Los secretos se definen únicamente en el
> panel de Coolify.

---

## 1. Veredicto actual

| Fecha | Veredicto | Motivo |
|---|---|---|
| 2026-10-21 | **NO-GO** | Pendientes: backups de PostgreSQL programados y restauración probada; verificación de la configuración real en Coolify (secretos, `CORS_ORIGIN`, dominio→puerto). El plan de rollback ya está documentado (sección 8). |

Pasa a **GO con riesgos asumidos** cuando:

1. Exista un backup programado de PostgreSQL y se haya probado una restauración (sección 7).
2. Se hayan verificado en Coolify las variables obligatorias, el `CORS_ORIGIN` exacto y la
   asignación del dominio con puerto interno `8080` (secciones 5 y 6).
3. Se ejecuten las pruebas de humo de la sección 9 sobre el despliegue real.

---

## 2. Arquitectura

```
Internet
  │  HTTPS
  ▼
Coolify / Traefik  ──►  web (nginx, :8080)  ──►  /api/  ──►  backend (uvicorn, :4000)
                          │                                    │
                          └─ SPA estática (dist)                └─► postgres (:5432)
```

| Servicio | Imagen | Puerto interno | Persistencia |
|---|---|---|---|
| `web` | `nginxinc/nginx-unprivileged:1.27-alpine` (digest fijado) | 8080 (único expuesto a Coolify) | ninguna |
| `backend` | `python:3.12-slim` (digest fijado) | 4000 | ninguna |
| `postgres` | `postgres:16-alpine` (digest fijado) | 5432 (solo red interna) | volumen `postgres_data` |

- No se publica ningún puerto en el host (`ports:` no existe en el compose).
- `backend` y `postgres` solo son alcanzables por nombre de servicio dentro de la red del compose.
- El backend aplica `alembic upgrade head` en cada arranque (`backend/docker-entrypoint.sh`).
- Una sola réplica del backend: el rate limit es en memoria y las migraciones corren en el
  entrypoint.

---

## 3. Archivos relevantes

| Archivo | Función |
|---|---|
| `docker-compose.yml` | Compose de producción (build + variables + healthchecks + límites + logs) |
| `backend/Dockerfile` | Imagen del API, usuario `appuser` (uid 10001), healthcheck con `curl` |
| `backend/docker-entrypoint.sh` | Migraciones + arranque de uvicorn con `--proxy-headers` |
| `frontend/Dockerfile` | Multi-stage: build Vite + runtime nginx unprivileged |
| `frontend/nginx.conf` | SPA fallback, proxy `/api`, cabeceras reenviadas |
| `frontend/security-headers.conf` | CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` |
| `postgres/init/01-app-role.sh` | Crea el rol de aplicación (mínimo privilegio) |
| `.github/workflows/ci.yml` | Lint, tipos, tests, build, smoke del compose y escaneo de seguridad |

---

## 4. Requisitos previos

- VPS con Docker y Coolify actualizado, accesible por HTTPS.
- Repositorio: `https://github.com/RobinsonAG1/Aplicacion-finanzas`, rama `main`.
- Docker Compose de Coolify apuntando a `docker-compose.yml` en la raíz del repo.
- Dominio con DNS apuntando al servidor (gestionado por Coolify/Traefik).
- Solo puertos 22, 80, 443 y los del panel de Coolify abiertos. **5432 nunca público.**
- Acceso SSH por clave y panel de Coolify con 2FA.

---

## 5. Variables de entorno (definir en Coolify)

Marcadas con `${VAR:?}` en el compose: el despliegue falla si faltan.

| Variable | Obligatoria | Propósito |
|---|---|---|
| `POSTGRES_ADMIN_PASSWORD` | Sí | Superusuario del contenedor (init y healthcheck) |
| `APP_DB_USER` | No (def. `finanzas`) | Rol de aplicación usado por el backend |
| `APP_DB_PASSWORD` | Sí | Password del rol de aplicación (usar hexadecimal, va dentro de `DATABASE_URL`) |
| `POSTGRES_DB` | No (def. `finanzas`) | Nombre de la base |
| `CORS_ORIGIN` | Sí | Origen público exacto: `https://<dominio>` **sin barra final** |
| `LOG_LEVEL` | No (def. `info`) | Nivel de logs (`fatal`…`trace`, `silent`) |
| `JWT_ACCESS_SECRET` | Sí | Secreto de access tokens (≥32 caracteres) |
| `JWT_REFRESH_SECRET` | Sí | Secreto de refresh tokens (≥32 caracteres, **distinto** del anterior) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | No (900 / 604800) | TTL en segundos |
| `FORWARDED_ALLOW_IPS` | No (def. `*`) | IPs de proxy confiables para `X-Forwarded-*` |
| `SEED_FORCE` | No (def. `false`) | Solo para ejecutar el seed destructivo de forma manual |

Generación de secretos (ejecutar donde prefieras, no pegarlos en Git):

```bash
# Secretos JWT (uno distinto para cada variable)
python -c "import secrets; print(secrets.token_hex(48))"

# Password de base (solo hexadecimal, para no romper la DATABASE_URL)
python -c "import secrets; print(secrets.token_hex(32))"
```

Reglas:

- `JWT_ACCESS_SECRET` ≠ `JWT_REFRESH_SECRET`. El código valida longitud, **no** la desigualdad.
- `CORS_ORIGIN` no es solo CORS: también se usa como validación CSRF en
  `POST /api/auth/refresh` y `/logout`. Un valor incorrecto devuelve 403 y rompe la sesión.
- No hay variables `VITE_*` en ejecución: `VITE_API_URL=/api` se incrusta al construir la SPA.

---

## 6. Configuración en Coolify

1. Crear un recurso **Docker Compose** desde el repositorio y la rama `main`.
2. Archivo compose: `docker-compose.yml` (raíz). Directorio base: raíz del repo.
3. Método de construcción: **Docker Compose** (Coolify construye `backend` y `web` desde sus
   Dockerfiles).
4. Definir todas las variables de la sección 5 en el panel antes del primer despliegue.
5. Asignar el dominio **al servicio `web`** con el puerto interno:

   ```text
   https://<dominio>:8080
   ```

   El sufijo `:8080` indica el puerto del contenedor. La URL pública es `https://<dominio>`
   (sin `:8080`) y es exactamente la que va en `CORS_ORIGIN`, sin barra final.
6. Confirmar que el despliegue automático por webhook quede **desactivado** para producción, o
   que solo se dispare desde una rama controlada. Revisar también las *previews* de PR.
7. No definir replicas > 1 en `backend` (rate limit en memoria + migraciones al arranque).

---

## 7. Backups y restauración de PostgreSQL

El PostgreSQL es un servicio del compose (no un recurso "Database" de Coolify), por lo que
**no está cubierto por los backups automáticos de Coolify**. Las copias programadas deben
configurarse aparte.

### 7.1 Copia manual (servidor, como referencia)

```bash
cd <directorio-del-proyecto-en-el-servidor>
docker compose exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "finanzas-$(date +%F-%H%M).dump"
```

> `docker compose` añade prefijos al nombre del proyecto y del volumen. No asumir el nombre
> literal `postgres_data`: comprobar con `docker volume ls`.

### 7.2 Copia programada

Programar el comando anterior (cron del host o contenedor dedicado) y enviar el resultado a
almacenamiento externo (S3/Backblaze/rsync). Retención sugerida: 7 diarios + 4 semanales.
Verificar el tamaño y la fecha de los archivos generados.

### 7.3 Restauración (probarla en una base separada, nunca sobre producción al probar)

```bash
# 1) Crear base de verificación
docker compose exec -T postgres sh -lc 'createdb -U "$POSTGRES_USER" finanzas_restore'

# 2) Restaurar
docker compose exec -T postgres sh -lc \
  'pg_restore -U "$POSTGRES_USER" -d finanzas_restore --no-owner --no-privileges' < backup.dump

# 3) Verificar datos
docker compose exec -T postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d finanzas_restore -c "select count(*) from transactions;"'

# 4) Limpiar
docker compose exec -T postgres sh -lc 'dropdb -U "$POSTGRES_USER" finanzas_restore'
```

**Nunca** usar `docker compose down -v` como parte de una recuperación: elimina el volumen y
los datos.

El script `postgres/init/01-app-role.sh` solo se ejecuta con el volumen **vacío**. Si se cambia
`APP_DB_PASSWORD` después del primer despliegue, hay que actualizar el rol en PostgreSQL
(`ALTER ROLE ... PASSWORD ...`); recrear el volumen borra los datos.

---

## 8. Rollback

### 8.1 Antes de cada despliegue que toque el esquema o los datos

1. Anotar el commit desplegado (`git rev-parse --short HEAD`) y el anterior.
2. Tomar un backup inmediato (sección 7.1) y confirmar que el archivo es válido.
3. Revisar qué migraciones se aplicarán (`alembic history`, `alembic upgrade head --sql`).

### 8.2 Volver a la versión anterior

1. En Coolify, redesplegar el commit/tag anterior (o hacer `git revert` en `main` y redesplegar).
2. Las migraciones **no se revierten solas**: el entrypoint solo aplica `upgrade head`.
3. `alembic downgrade` solo si la migración lo soporta y con backup previo. En este proyecto la
   migración inicial elimina todas las tablas al bajar: **no ejecutarla sin decisión explícita**.
4. Si el esquema ya cambió y hay que volver atrás: restaurar el backup en una base aparte,
   validarla y luego reapuntar el despliegue con autorización explícita.

### 8.3 Criterio de rollback

Activar rollback si:

- El healthcheck de `backend` o `web` falla de forma sostenida (> 5 min) tras el despliegue.
- Errores 5xx persistentes o caída del login.
- Pruebas de humo de la sección 9 fallidas.
- Datos visiblemente inconsistentes.

Decide: el responsable del proyecto (usuario). Ventana recomendada: 30 minutos tras el
despliegue o hasta el primer uso real de usuarios.

---

## 9. Pruebas de humo posteriores al despliegue

Ejecutar en el servidor o desde fuera. Sustituir `<dominio>`.

```bash
# 1. HTTPS y certificado
curl -sSI https://<dominio> | head -n 1          # 200
curl -sSI http://<dominio>  | head -n 1          # redirección a https

# 2. Salud del backend a través del proxy
curl -sS https://<dominio>/api/health            # {"status":"ok",...}

# 3. SPA en ruta profunda (no debe dar 404)
curl -sS -o /dev/null -w '%{http_code}\n' https://<dominio>/transacciones

# 4. Documentación deshabilitada en producción
curl -sS -o /dev/null -w '%{http_code}\n' https://<dominio>/api/docs   # 404

# 5. PostgreSQL no accesible desde fuera
nc -vz <IP-del-servidor> 5432                     # rechazado / timeout
```

En el servidor (compose):

```bash
docker compose ps                                  # 3 servicios "healthy"
docker compose exec backend id -u                  # 10001 (no root)
docker compose exec web id -u                      # 101 (no root)
docker compose logs --tail=100 backend             # migraciones aplicadas, sin trazas
docker compose exec postgres sh -lc 'psql -U "$POSTGRES_USER" -c "\du"'
# El rol de la aplicación debe mostrar: no superusuario, no crear BD, no crear roles
```

En el navegador:

1. Login correcto y acceso al dashboard.
2. Esperar a que expire el access token (15 min) y comprobar que el refresh devuelve 200 (no 403).
3. Crear una transacción, recargar y verificar que persiste.
4. Redeploy/restart del stack y comprobar que el dato sigue.
5. Cookie `refresh_token`: `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/auth`.

Comprobar en logs que la IP registrada es la del cliente y no la del proxy (afecta al rate
limit). Si aparece la IP del proxy, revisar `FORWARDED_ALLOW_IPS` y el `X-Forwarded-For`.

---

## 10. Observabilidad

- Notificaciones de despliegue y backup en Coolify (correo/Slack/Discord).
- Monitor de disponibilidad externo sobre `https://<dominio>/api/health` cada 1-5 min con alerta.
- Alertas de disco, memoria y CPU del VPS (Coolify muestra métricas; configurar umbrales).
- Revisión periódica de logs del backend (`LOG_LEVEL=info`) y de los errores 5xx en el proxy.

---

## 11. Mantenimiento

### Actualizar una imagen base (digest fijado)

1. Consultar el digest actual del tag, por ejemplo:
   `https://hub.docker.com/v2/repositories/library/postgres/tags/16-alpine`
2. Sustituir el digest en `docker-compose.yml` o en el `Dockerfile` correspondiente.
3. Redesplegar y repetir las pruebas de humo.

Los digests están fijados para que un redespliegue no cambie de versión sin decisión explícita.

### Cambiar `APP_DB_PASSWORD`

El rol se crea solo con el volumen vacío. Para cambiarlo, abrir `psql` como superusuario:

```bash
docker compose exec postgres psql -U postgres -d finanzas
-- dentro de psql (sustituir por el usuario y la password reales, no versionarlos):
-- ALTER ROLE finanzas WITH PASSWORD 'nueva_password';
\q
```

Actualizar también la variable en Coolify y redesplegar. No recrear el volumen.

---

## 12. Riesgos asumidos y pendientes

| Riesgo | Estado |
|---|---|
| Rate limit en memoria (una réplica obligatoria) | Documentado, aceptado |
| `FORWARDED_ALLOW_IPS='*'` confía en el saneado de `X-Forwarded-For` por Traefik | Aceptado; verificar IP real en logs tras desplegar |
| Healthchecks duplicados en Dockerfile y compose | Aceptado (compose prevalece); pendiente de simplificar |
| `SEED_FORCE` presente en el entorno del backend (por defecto `false`) | Aceptado; solo se usa en el `exec` manual |
| Backups programados y restauración probada | **Pendiente (bloqueante)** |
| Configuración verificada en Coolify | **Pendiente (bloqueante)** |
| Monitoreo de uptime y alertas | Pendiente (recomendable) |

---

## 13. Historial de cambios de este documento

- 2026-10-21 — Creación tras auditoría de preparación. Se fijaron digests de imágenes, se
  añadieron límites de recursos y rotación de logs, se preservó `X-Forwarded-Proto` original
  en nginx y se marcó como ejecutable el script de inicialización de PostgreSQL.
