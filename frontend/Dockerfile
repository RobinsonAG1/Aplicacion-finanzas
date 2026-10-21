# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Etapa de build: compila la SPA con Vite
# ---------------------------------------------------------------------------
# Digests fijados (multi-arch) para builds reproducibles. Actualizar de forma consciente.
FROM node:22-slim@sha256:3ed98443660ff48413b5af19ecefce3b9d50845a901a43420d47cc63a9fddbe9 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# En produccion la SPA llama al mismo origen; nginx hace proxy de /api al backend.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---------------------------------------------------------------------------
# Etapa de runtime: nginx sirviendo estaticos + proxy de /api
# ---------------------------------------------------------------------------
# Imagen unprivileged: nginx corre como usuario 'nginx' (no root) y escucha en 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine@sha256:65e3e85dbaed8ba248841d9d58a899b6197106c23cb0ff1a132b7bfe0547e4c0 AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:8080/ || exit 1
