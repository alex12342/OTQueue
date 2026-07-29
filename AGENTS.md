# OTQueue — Agent Instructions

## Monorepo layout

```
artifacts/overtime-tracker   — React frontend (Vite, Tailwind, shadcn/ui, wouter, TanStack Query)
artifacts/api-server         — Express 5 backend (esbuild bundle, pino logging)
artifacts/mockup-sandbox     — experimental sandbox (Vite, standalone)
lib/db                       — Drizzle ORM schema (@workspace/db, exports ./schema)
lib/api-client-react         — Orval-generated React Query client (@workspace/api-client-react)
lib/api-spec                 — Orval codegen from openapi.yaml (@workspace/api-spec)
lib/api-zod                  — Orval-generated Zod schemas (@workspace/api-zod)
scripts                      — dev utility scripts
```

## Commands

```bash
# Full build (typecheck + all packages)
pnpm run build

# Typecheck only
pnpm run typecheck               # all packages
pnpm run typecheck:libs          # lib/* only (faster)

# Per-package
pnpm --filter @workspace/overtime-tracker dev   # frontend dev server (PORT/BASE_PATH required)
pnpm --filter @workspace/api-server dev          # build + start API on $PORT
pnpm --filter @workspace/api-spec codegen        # regenerate api-client-react + api-zod from openapi.yaml
pnpm --filter db push                            # drizzle-kit push
pnpm --filter db push-force                      # drizzle-kit push --force
```

## Environment

- `PORT` — required by both frontend and API
- `BASE_PATH` — required by Vite (frontend deploy path)
- `DATABASE_URL` — required by Drizzle and API server
- `JWT_SECRET` — generated at runtime by entrypoint.sh (persisted to /app/data/.jwt-secret)
- `NODE_ENV=development` triggers Replit dev plugins (cartographer, dev-banner)

## Docker / deploy

- `docker compose up` — runs full stack: embedded PostgreSQL, Nginx (port 8080→80), API, frontend
- Data volume: `./data:/app/data` (Postgres + JWT secret)
- Frontend build output: `artifacts/overtime-tracker/dist/public`
- Nginx proxies `/api` → `127.0.0.1:8080`

## Codegen flow

1. Maintain `lib/api-spec/openapi.yaml`
2. Run `pnpm --filter @workspace/api-spec codegen`
3. Generates into `lib/api-client-react/src/generated/` and `lib/api-zod/src/generated/`
4. Runs `typecheck:libs` to validate

## Dev quirks

- pnpm required (preinstall script rejects npm/yarn)
- `minimumReleaseAge: 1440` in pnpm-workspace.yaml — new packages can't be installed for 24h
- esbuild externalizes many native modules (see artifacts/api-server/build.mjs); adding a new native dep requires updating the external list
- `catalog:` in pnpm-workspace.yaml pins exact versions for core deps — use `catalog:` in package.json to inherit
- React 19.1.0 pinned exactly (Expo requirement)
- `autoInstallPeers: false` — manual peer dep management

## Testing

- `@playwright/test` installed at workspace root (no test files committed yet)
- No unit test framework configured

## Build artifacts to ignore

- `dist/`, `*.tsbuildinfo` — regenerated
- `lib/*/src/generated/` — codegen output
