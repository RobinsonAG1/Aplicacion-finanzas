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
- El rol de aplicación lo crea `postgres/init/01-app-role.sh`, que el entrypoint oficial de
  postgres ejecuta desde `/docker-entrypoint-initdb.d` **al inicializar el volumen** (con las
  variables `APP_DB_USER`/`APP_DB_PASSWORD` del entorno). El backend se conecta con ese rol, que
  no tiene privilegios de superusuario.
- El script es idempotente y se puede volver a ejecutar a mano dentro del contenedor para
  resincronizar el rol (ver 13.2). Si se cambia `APP_DB_PASSWORD` después del primer despliegue,
  hay que ejecutarlo de nuevo o recrear el volumen (ver 11).
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
| `postgres/init/01-app-role.sh` | Crea el rol de aplicación (mínimo privilegio) al inicializar el volumen |
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
| `POSTGRES_ADMIN_USER` | No (def. `postgres`) | Superusuario del contenedor |
| `POSTGRES_ADMIN_PASSWORD` | Sí | Superusuario del contenedor (init y healthcheck) |
| `APP_DB_USER` | No (def. `finanzas`) | Rol de aplicación usado por el backend |
| `APP_DB_PASSWORD` | Sí | Password del rol de aplicación (el entrypoint la URL-encodea al montar el DSN) |
| `POSTGRES_DB` | No (def. `finanzas`) | Nombre de la base |
| `DATABASE_URL` | No | Solo si se quiere forzar el DSN completo; por defecto se construye con `DB_*` |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | No | Override del DSN. Por defecto: `postgres` / `5432` / `POSTGRES_DB` / `APP_DB_USER` / `APP_DB_PASSWORD` |
| `CORS_ORIGIN` | Sí | Origen público exacto: `https://<dominio>` **sin barra final** |
| `LOG_LEVEL` | No (def. `info`) | Nivel de logs (`fatal`…`trace`, `silent`) |
| `JWT_ACCESS_SECRET` | Sí | Secreto de access tokens (≥32 caracteres) |
| `JWT_REFRESH_SECRET` | Sí | Secreto de refresh tokens (≥32 caracteres, **distinto** del anterior) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | No (900 / 604800) | TTL en segundos |
| `FORWARDED_ALLOW_IPS` | No (def. `*`) | IPs de proxy confiables para `X-Forwarded-*` |
| `DEMO_SEED_ENABLED` | No (def. `true`) | Crea datos de muestra solo si no existe la cuenta demo; `false` lo desactiva |
| `SEED_FORCE` | No (def. `false`) | Solo para ejecutar el seed destructivo de forma manual |

Generación de secretos (ejecutar donde prefieras, no pegarlos en Git):

```bash
# Secretos JWT (uno distinto para cada variable)
python -c "import secrets; print(secrets.token_hex(48))"

# Password de base (hexadecimal recomendado; si usa otros caracteres, el
# entrypoint los URL-encodea al construir el DSN)
python -c "import secrets; print(secrets.token_hex(32))"
```

Reglas:

- `JWT_ACCESS_SECRET` ≠ `JWT_REFRESH_SECRET`. El código valida longitud, **no** la desigualdad.
- `CORS_ORIGIN` no es solo CORS: también se usa como validación CSRF en
  `POST /api/auth/refresh` y `/logout`. Un valor incorrecto devuelve 403 y rompe la sesión.
- No hay variables `VITE_*` en ejecución: `VITE_API_URL=/api` se incrusta al construir la SPA.
- `DEMO_SEED_ENABLED=true` crea al iniciar `demo@finanzas.test` / `Demo1234!` y datos de muestra
  durante el primer despliegue. La contraseña es pública y la cuenta no es privada: úsala solo
  para demostración; los datos y cambios de ese usuario quedan visibles para quien inicie sesión.
  El seed automático nunca borra otras cuentas ni sobrescribe la cuenta demo ya existente.
- Para desplegar sin la cuenta de demostración, define `DEMO_SEED_ENABLED=false` en Coolify.

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

El script `postgres/init/01-app-role.sh` lo ejecuta el entrypoint de postgres **al inicializar el
volumen** (directorio `/docker-entrypoint-initdb.d`). Si el volumen ya estaba inicializado, el
script no se ejecuta: en ese caso hay que ejecutarlo a mano (sección 13.2) o recrear el volumen
(sección 13.3).

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

Actualiza la variable en Coolify, **redespliega** (para que el contenedor de postgres reciba la
nueva variable) y **ejecuta el script de roles** (sección 13.2): el directorio
`/docker-entrypoint-initdb.d` solo se procesa al crear el volumen, así que un cambio de
`APP_DB_PASSWORD` no se aplica solo. Sin redesplegar:

```bash
docker compose exec -T postgres sh /docker-entrypoint-initdb.d/01-app-role.sh
```

O, a mano, dentro de `psql`:

```bash
docker compose exec postgres psql -U postgres -d finanzas
-- dentro de psql (sustituir por el usuario y la password reales, no versionarlos):
-- ALTER ROLE finanzas WITH PASSWORD 'nueva_password';
\q
```

La contraseña admite cualquier carácter: el entrypoint construye el DSN con URL-encoding
(`quote` de usuario y password), así que `@ : / #` no la rompen. Aun así, hexadecimal es lo
recomendado (`python -c "import secrets; print(secrets.token_hex(32))"`).

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

## 13. Diagnóstico: despliegue atascado en "Waiting"

Si el log de despliegue se queda en `Container backend-... Waiting`, el contenedor del API no
llega a estado *healthy* y Coolify espera indefinidamente. Causa habitual: **el backend no
puede conectarse a PostgreSQL con el rol de aplicación**.

### 13.0 `role "finanzas" does not exist` o `password authentication failed`

Causa: el volumen `postgres_data` **ya estaba inicializado** (heredado de otra aplicación o de un
despliegue anterior con otras credenciales). El directorio `/docker-entrypoint-initdb.d` solo se
procesa cuando el volumen está vacío, así que el script que crea el rol de aplicación no llegó
a ejecutarse.

Solución: ejecutar el script a mano (13.2) o recrear el volumen (13.3). No hace falta tocar el
compose ni añadir servicios: el rol se crea con el script que ya está montado.

### 13.1 Ver el error real

Sin acceso por SSH: en Coolify, abre el deployment → contenedor `backend` → botón de **logs**
(o *Show logs*). Ahí está la salida real del entrypoint.

Con acceso al servidor:

```bash
docker compose ps -a                 # el backend sale/reinicia en bucle
docker compose logs --tail=100 backend
docker compose logs --tail=100 postgres   # aquí se ve la inicialización del volumen
```

El entrypoint imprime el error de conexión real (no lo oculta). Los mensajes típicos:

| Error | Causa | Solución |
|---|---|---|
| `role "finanzas" does not exist` | El volumen ya estaba inicializado y el script no se ejecutó | Ejecutar el script a mano (13.2) o recrear el volumen (13.3) |
| `password authentication failed for user "finanzas"` | `APP_DB_PASSWORD` no coincide con el del rol | Ejecutar el script a mano (13.2) o recrear el volumen (13.3) |
| `invalid dsn` / `could not translate host name` | La contraseña tiene caracteres que rompen la URL (`@`, `:`, `#`, `/`) | Ya no ocurre: el DSN se construye con URL-encoding. Si aparece, hay un `DATABASE_URL` manual definido |

### 13.2 Crear o sincronizar el rol a mano

El script del compose hace exactamente esto (es idempotente) y usa las variables del contenedor
(`APP_DB_USER`, `APP_DB_PASSWORD`, `POSTGRES_DB`, `POSTGRES_USER`):

```bash
docker compose exec -T postgres sh /docker-entrypoint-initdb.d/01-app-role.sh
docker compose restart backend
```

Sin acceso al servidor, desde la UI de Coolify: contenedor `postgres` → **Execute Command /
Terminal** → `sh /docker-entrypoint-initdb.d/01-app-role.sh`; después, reinicia el backend.

Si lo prefieres a mano, por si el script no está disponible:

```bash
docker compose exec -T postgres psql -U postgres -d finanzas -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finanzas') THEN
    CREATE ROLE finanzas LOGIN PASSWORD 'PEGA_AQUI_APP_DB_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;
ALTER ROLE finanzas WITH LOGIN PASSWORD 'PEGA_AQUI_APP_DB_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER DATABASE finanzas OWNER TO finanzas;
ALTER SCHEMA public OWNER TO finanzas;
GRANT ALL ON SCHEMA public TO finanzas;
SQL
```

Después, reinicia el backend: `docker compose restart backend`.

### 13.3 Empezar de cero (borra los datos)

Solo si no hay datos que conservar. **Nunca** usar `down -v` como parte de una recuperación.

Con acceso al servidor:

```bash
docker compose down -v
docker compose up -d
```

Sin acceso al servidor, desde la UI de Coolify (el volumen se vacía desde dentro del contenedor
`postgres`, que corre como root; el servidor se cae y el contenedor se reinicia solo, ya con el
volumen vacío y el entrypoint oficial inicializándolo con las variables del entorno):

1. Contenedor `postgres` → **Execute Command / Terminal**.
2. `rm -rf /var/lib/postgresql/data/*`
3. Reinicia el contenedor `postgres` (o redespliega) y revisa sus logs: debe aparecer
   `Rol de aplicacion 'finanzas' listo sobre la base 'finanzas'.`

---

## 14. Historial de cambios de este documento

- 2026-10-21 — Creación tras auditoría de preparación. Se fijaron digests de imágenes, se
  añadieron límites de recursos y rotación de logs y se preservó `X-Forwarded-Proto` original
  en nginx.
- 2026-10-21 — El compose vuelve a desplegar `postgres`, `backend` (4000) y `web` (8080) con
  `nginxinc/nginx-unprivileged`. Se añade el servicio `postgres-init` (tarea de un solo uso) que
  crea/actualiza el rol de aplicación en cada despliegue, se hace visible el error real de
  conexión en `docker-entrypoint.sh` y se documenta el diagnóstico de despliegues atascados
  (sección 13).
- 2026-10-21 — El DSN de PostgreSQL se compone en el entrypoint y en `Settings` a partir de
  `DB_USER`/`DB_PASSWORD`/... con URL-encoding, de modo que una contraseña con `@ : / #` ya no
  rompe la conexión. `DATABASE_URL` sigue mandando si se define explícitamente.
- 2026-10-21 — `postgres-init` entra por el socket Unix local compartido (volumen `pg_socket`),
  que autentica con `trust`, y sincroniza superusuario, rol de aplicación y base de datos con
  las variables del entorno. Resuelve el `exit 2` observado cuando el volumen ya estaba
  inicializado con otras credenciales (sección 13.0).
- 2026-10-21 — La sincronización de roles se traslada **dentro** del contenedor de `postgres`
  (entrypoint propio `postgres/init/entrypoint.sh`) y se elimina el servicio `postgres-init` y el
  volumen `pg_socket`: entrar por el socket local del propio contenedor no depende de compartir
  rutas entre contenedores (en `postgres:16-alpine` el socket no siempre está en
  `/var/run/postgresql`). El healthcheck de `postgres` exige el marcador `/tmp/roles-synced`, de
  modo que `backend` no arranca hasta que el rol de aplicación existe.
- 2026-10-21 — Se vuelve al diseño **simple**: el compose tiene solo `postgres`, `backend` y
  `web`, y el rol de aplicación lo crea `postgres/init/01-app-role.sh` desde
  `/docker-entrypoint-initdb.d` al inicializar el volumen (sin servicio extra, sin wrapper y sin
  marcadores). El script es idempotente y se puede ejecutar a mano (13.2) para resincronizar el
  rol sin recrear el volumen. El entrypoint oficial de postgres **sourcea** los `.sh` de
  `/docker-entrypoint-initdb.d` (no los ejecuta): el script usa `set -e` sin `set -u` y conexiones
  explícitas por el socket Unix local (`trust` durante la inicialización) con `--no-password`.
