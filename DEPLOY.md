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
| `web` | `nginxinc/nginx-unprivileged:1.27-alpine` | 8080 (único expuesto a Coolify) | ninguna |
| `backend` | `python:3.12-slim` | 4000 | ninguna |
| `postgres` | `postgres:16-alpine` | 5432 (solo red interna) | volumen `postgres_data` |

- No se publica ningún puerto en el host (`ports:` no existe en el compose).
- `backend` y `postgres` solo son alcanzables por nombre de servicio dentro de la red del compose.
- El backend aplica `alembic upgrade head` en cada arranque (`backend/docker-entrypoint.sh`).
- El backend se conecta con `POSTGRES_ADMIN_USER`/`POSTGRES_ADMIN_PASSWORD`, el mismo usuario con
  el que PostgreSQL inicializa el volumen: una sola credencial, sin rol aparte ni scripts de
  inicialización que puedan quedar desincronizados. Si el volumen se creó con otra contraseña,
  hay que recrearlo (13.3) o cambiarla dentro de PostgreSQL (13.2).
- Sin healthchecks en el compose: `backend` reintenta la conexión durante 2 minutos y Coolify no
  falla el despliegue por un contenedor aún arrancando. El estado real se ve en los logs.
- Una sola réplica del backend: el rate limit es en memoria y las migraciones corren en el
  entrypoint.

---

## 3. Archivos relevantes

| Archivo | Función |
|---|---|
| `docker-compose.yml` | Compose de producción (build + variables + red de Coolify) |
| `backend/Dockerfile` | Imagen del API, usuario `appuser` (uid 10001) |
| `backend/docker-entrypoint.sh` | Migraciones + arranque de uvicorn con `--proxy-headers` |
| `frontend/Dockerfile` | Multi-stage: build Vite + runtime nginx unprivileged |
| `frontend/nginx.conf` | SPA fallback, proxy `/api`, cabeceras reenviadas |
| `frontend/security-headers.conf` | CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` |
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
| `POSTGRES_ADMIN_USER` | No (def. `postgres`) | Usuario de PostgreSQL (lo usan el contenedor y el backend) |
| `POSTGRES_ADMIN_PASSWORD` | Sí | Contraseña de ese usuario (`${VAR:?}`) |
| `POSTGRES_DB` | No (def. `finanzas`) | Nombre de la base |
| `CORS_ORIGIN` | Sí | Origen público exacto: `https://<dominio>` **sin barra final** |
| `LOG_LEVEL` | No (def. `info`) | Nivel de logs (`fatal`…`trace`, `silent`) |
| `JWT_ACCESS_SECRET` | Sí | Secreto de access tokens (≥32 caracteres) |
| `JWT_REFRESH_SECRET` | Sí | Secreto de refresh tokens (≥32 caracteres, **distinto** del anterior) |
| `DEMO_SEED_ENABLED` | No (def. `true`) | Crea datos de muestra solo si no existe la cuenta demo; `false` lo desactiva |

Opcionales con valor por defecto en el código (no hace falta definirlas): `JWT_ACCESS_TTL`
(900 s), `JWT_REFRESH_TTL` (604800 s), `FORWARDED_ALLOW_IPS` (`*`), `DATABASE_URL` (se construye
con URL-encoding a partir de `POSTGRES_DB`/`POSTGRES_ADMIN_*`).

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
  El seed automático nunca borra otras cuentas ni sobrescribe la cuenta demo ya existente. Si el
  seed falla, el backend arranca igualmente y deja un aviso en los logs (no bloquea el
  despliegue).
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

### Actualizar una imagen base

Las imágenes usan tags normales: `postgres:16-alpine` en el compose, `python:3.12-slim`
en `backend/Dockerfile`, `node:22-slim` y `nginxinc/nginx-unprivileged:1.27-alpine` en
`frontend/Dockerfile`. No hay digests fijados: un redespliegue puede traer una revisión menor
nueva del tag. Para fijar una versión concreta, cambia el tag (por ejemplo
`postgres:16.4-alpine`), redespliega y repite las pruebas de humo.

### Cambiar la contraseña de PostgreSQL

`POSTGRES_ADMIN_PASSWORD` solo se aplica al **inicializar** el volumen. Para cambiarla después,
actualiza la variable en Coolify y haz `ALTER ROLE` dentro de PostgreSQL (con el usuario dueño):

```bash
docker compose exec postgres psql -U postgres -d postgres -c "ALTER ROLE postgres WITH PASSWORD 'nueva_password';"
```

Y redespliega para que el backend reciba la nueva variable. Si prefieres no tocar la BD, recrea el
volumen (sección 13.3): el usuario se crea de nuevo con la contraseña del entorno.

La contraseña admite cualquier carácter: el entrypoint construye el DSN con URL-encoding
(`quote` de usuario y password), así que `@ : / #` no la rompen. Aun así, hexadecimal es lo
recomendado (`python -c "import secrets; print(secrets.token_hex(32))"`).

---

## 12. Riesgos asumidos y pendientes

| Riesgo | Estado |
|---|---|
| Rate limit en memoria (una réplica obligatoria) | Documentado, aceptado |
| `FORWARDED_ALLOW_IPS='*'` confía en el saneado de `X-Forwarded-For` por Traefik | Aceptado; verificar IP real en logs tras desplegar |
| Healthchecks: ninguno | Aceptado: el backend reintenta 2 min; Coolify no falla el deploy por eso |
| Imágenes por tag (no por digest) | Aceptado: un redeploy puede traer una revisión menor nueva del tag |
| `SEED_FORCE` presente en el entorno del backend (por defecto `false`) | Aceptado; solo se usa en el `exec` manual |
| Backups programados y restauración probada | **Pendiente (bloqueante)** |
| Configuración verificada en Coolify | **Pendiente (bloqueante)** |
| Monitoreo de uptime y alertas | Pendiente (recomendable) |

---

## 13. Diagnóstico: despliegue atascado en "Waiting"

Si el log de despliegue se queda en `Container backend-... Waiting`, el contenedor del API no
llega a estado *healthy* y Coolify espera indefinidamente. Causa habitual: **el backend no
puede conectarse a PostgreSQL con el rol de aplicación**.

### 13.0 `password authentication failed for user "postgres"`

Causa: el volumen `postgres_data` **ya estaba inicializado** (de otra aplicación o de un
despliegue anterior) con otra contraseña. `POSTGRES_ADMIN_PASSWORD` solo se aplica al crear el
volumen, así que la contraseña guardada y la del entorno no coinciden.

Solución: cambiar la contraseña dentro de PostgreSQL (13.2) o recrear el volumen (13.3).

### 13.1 Ver el error real

Sin acceso por SSH: en Coolify, abre el deployment → contenedor `backend` → botón de **logs**
(o *Show logs*). Ahí está la salida real del entrypoint. También puedes ejecutar en la terminal
del backend:

```bash
python -m alembic upgrade head
```

Con acceso al servidor:

```bash
docker compose ps -a                 # el backend sale/reinicia en bucle
docker compose logs --tail=100 backend
docker compose logs --tail=100 postgres   # aquí se ve la inicialización del volumen
```

Los mensajes típicos:

| Error | Causa | Solución |
|---|---|---|
| `password authentication failed for user "postgres"` | La contraseña del volumen no coincide con `POSTGRES_ADMIN_PASSWORD` | Cambiarla en la BD (13.2) o recrear el volumen (13.3) |
| `database "finanzas" does not exist` | Se cambió `POSTGRES_DB` después de inicializar el volumen | Recrear el volumen (13.3) |
| `invalid dsn` / `could not translate host name` | `DATABASE_URL` manual mal formado | Quitarlo: el entrypoint construye el DSN solo |

El backend reintenta la conexión durante 2 minutos y luego sale; el contenedor se reinicia en
bucle hasta que la conexión funcione.

### 13.2 Cambiar la contraseña dentro de PostgreSQL

Sin perder datos:

```bash
docker compose exec postgres psql -U postgres -d postgres \
  -c "ALTER ROLE postgres WITH PASSWORD 'nueva_password';"
docker compose restart backend
```

Desde la UI de Coolify: contenedor `postgres` → **Execute Command / Terminal** → el `psql` de
arriba (después, reinicia `backend`). La nueva contraseña debe ser la misma que pongas en
`POSTGRES_ADMIN_PASSWORD` en Coolify.

### 13.3 Empezar de cero (borra los datos)

Solo si no hay datos que conservar. **Nunca** usar `down -v` como parte de una recuperación.

Con acceso al servidor:

```bash
docker compose down -v
docker compose up -d
```

Sin acceso al servidor, desde la UI de Coolify (el volumen se vacía desde dentro del contenedor
`postgres`, que corre como root; el servidor se cae y el contenedor se reinicia solo, ya con el
volumen vacío y PostgreSQL inicializándolo con las variables del entorno):

1. Contenedor `postgres` → **Execute Command / Terminal**.
2. `rm -rf /var/lib/postgresql/data/*`
3. Reinicia el contenedor `postgres` (o redespliega) y revisa sus logs: debe aparecer
   `database system is ready to accept connections`.

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
- 2026-10-21 — Compose limpio: imágenes por tag (sin digests) para que se lea fácil, fuera los
  `deploy.resources.limits` y el healthcheck de `web` (y los `HEALTHCHECK` de los Dockerfiles,
  que eran redundantes). El seed de la cuenta demo pasa a ser **no fatal**: si falla, el backend
  arranca igualmente y solo deja un aviso en los logs.
- 2026-10-21 — El script de roles pasa **dentro de la imagen** de postgres (`postgres/Dockerfile`
  lo copia a `/docker-entrypoint-initdb.d`). En Coolify el bind mount `./postgres/init` llegaba
  vacío (directorio sin montar), así que el script no existía en el contenedor y el rol nunca se
  creaba. Si el contexto no trae `init/`, el build falla de forma visible en vez de arrancar sin
  el script.
- 2026-10-22 — Se elimina la separación de roles: el backend usa `POSTGRES_ADMIN_USER`/
  `POSTGRES_ADMIN_PASSWORD`, el mismo usuario con el que PostgreSQL inicializa el volumen. Se
  borran `postgres/Dockerfile`, `postgres/init/01-app-role.sh` y las variables `APP_DB_*`. El
  compose queda en 3 servicios sin `healthcheck`, sin `depends_on: condition`, sin `deploy`, sin
  `logging`, sin `expose` y sin `SEED_FORCE`/`DATABASE_URL`; `backend` reintenta la conexión 2
  minutos y Coolify ya no puede fallar el despliegue por un contenedor aún arrancando.
