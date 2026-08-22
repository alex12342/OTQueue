# =============================================================================
# Builder — full workspace toolchain. Compiles the app and produces
# self-contained runtime artifacts. Nothing from this stage except the
# artifacts below ends up in the final image.
# =============================================================================
FROM node:24-bookworm AS builder

RUN npm install -g pnpm@10

WORKDIR /app

# Workspace manifests + lockfile first, so the dependency layer stays cached
# as long as the lockfile does not change.
COPY package.json .npmrc pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/overtime-tracker/package.json artifacts/overtime-tracker/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/db/package.json lib/db/
COPY scripts/package.json scripts/

RUN pnpm install --frozen-lockfile

# Source tree (small — heavy directories are excluded via .dockerignore)
COPY . .

# Build only the two packages that ship in the image.
# Typechecking is skipped here (run it locally / in CI).
ENV PORT=8080
ENV BASE_PATH=/
# Build-time identity, baked into the frontend bundle via Vite `define`
# (read as process.env.* inside vite.config.ts) and carried into the
# runtime stage below for the API's /healthz.
ARG VERSION=dev
ARG GIT_SHA=dev
ARG BUILD_DATE=
ENV VERSION=$VERSION GIT_SHA=$GIT_SHA BUILD_DATE=$BUILD_DATE
RUN pnpm --filter @workspace/api-server build \
  && pnpm --filter @workspace/overtime-tracker build

# Self-contained runtime dependencies:
#   /prod/api — api-server production node_modules (the API bundle is
#               self-contained except for externalized packages like nodemailer)
#   /prod/db  — @workspace/db including dev deps, so drizzle-kit is available
#               for the schema sync that runs at container boot
#
# `--legacy` is required by pnpm v10 for workspace deploys. Legacy mode also
# unions in the workspace root's devDependencies (typescript, prettier,
# @playwright/test), so we prune those from the db package afterwards.
RUN pnpm --filter @workspace/api-server deploy --legacy --prod /prod/api \
  && pnpm --filter @workspace/db deploy --legacy /prod/db \
  && cd /prod/db/node_modules \
  && rm -rf typescript prettier playwright @playwright \
  && find .pnpm -maxdepth 1 -depth -type d \
       \( -name 'typescript@*' -o -name 'prettier@*' -o -name 'playwright@*' \
          -o -name 'playwright-core@*' -o -name '@playwright+test@*' \) \
       -exec rm -rf {} +

# =============================================================================
# Runtime — Node + embedded PostgreSQL + Nginx + built artifacts only.
#
# Kept on Debian bookworm (Postgres 15, glibc) so existing /app/data volumes
# created by earlier images remain compatible.
# =============================================================================
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql nginx sudo openssl \
  && rm -rf /var/lib/apt/lists/*

# The deployment runs as root (entrypoint drops privileges per process via
# `sudo -u postgres` for the database, and nginx workers run as www-data).
USER root

WORKDIR /app

COPY --from=builder /prod/api/node_modules ./node_modules
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=builder /app/artifacts/overtime-tracker/dist/public ./artifacts/overtime-tracker/dist/public
COPY --from=builder /prod/db ./db

# Source maps are dev-only — strip them from the runtime image
RUN rm -f ./artifacts/api-server/dist/*.map

COPY nginx.conf /etc/nginx/sites-available/default
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ARG VERSION=dev
ARG GIT_SHA=dev
ARG BUILD_DATE=
ENV NODE_ENV=production
ENV PORT=8080
ENV BASE_PATH=/
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/otqueue
ENV VERSION=$VERSION GIT_SHA=$GIT_SHA BUILD_DATE=$BUILD_DATE

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
