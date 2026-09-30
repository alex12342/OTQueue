# OTQueue — Agent Instructions

## Monorepo layout

```
artifacts/overtime-tracker   — React frontend (Vite 7, Tailwind 4, shadcn/ui, wouter, TanStack Query)
artifacts/api-server         — Express 5 backend (esbuild bundle, pino)
lib/db                       — Drizzle ORM schema (@workspace/db)
lib/api-client-react         — Orval-generated React Query client (@workspace/api-client-react)
lib/api-spec                 — Orval codegen source: openapi.yaml (@workspace/api-spec)
lib/api-zod                  — Orval-generated Zod schemas (@workspace/api-zod)
scripts                      — dev utility scripts (post-merge hook)
```

## Required setup

```bash
pnpm install          # pnpm only — preinstall script rejects npm/yarn
```

## Commands

```bash
# Full build (typecheck all packages → build all)
pnpm run build

# Typecheck
pnpm run typecheck               # all packages
pnpm run typecheck:libs          # lib/* only (faster)

# Per-package dev
pnpm --filter @workspace/overtime-tracker dev   # Vite dev server (PORT + BASE_PATH env required)
pnpm --filter @workspace/api-server dev          # esbuild → start API on $PORT

# Per-package build/typecheck
pnpm --filter @workspace/overtime-tracker build
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/overtime-tracker typecheck
pnpm --filter @workspace/api-server typecheck

# Codegen (after editing lib/api-spec/openapi.yaml)
pnpm --filter @workspace/api-spec codegen
# then: pnpm run typecheck:libs  to validate generated code

# Database
pnpm --filter db generate      # drizzle-kit generate (after schema changes — emits new SQL migration)
pnpm --filter db migrate       # drizzle-kit migrate (applies pending migrations; transactional)
pnpm --filter db push          # drizzle-kit push (dev-only; interactive — do NOT use in containers)

# Post-merge hook
./scripts/post-merge.sh   # pnpm install --frozen-lockfile + db push
```

## Environment

| Variable | Purpose |
|---|---|
| `PORT` | Required by both frontend and API |
| `BASE_PATH` | Required by Vite (frontend deploy path) |
| `DATABASE_URL` | Required by Drizzle and API server |
| `JWT_SECRET` | Generated at runtime by entrypoint.sh (persisted to `/app/data/.jwt-secret`) |
| `NODE_ENV` | `production` in the Docker image (JSON logs, no pino-pretty) |

See `.env.example` for full list (CORS, SSO, email, session, logging).

## Docker / deploy

Single-container image (Dockerfile): Node app with embedded PostgreSQL + Nginx.

```bash
docker compose up          # runs otqueue-app on port 8085→80
docker compose down        # stops all; data persists in ./data
```

- Data volume: `/app/data` (Postgres WAL + JWT secret)
- Nginx proxies `/api` → `127.0.0.1:8080` (Express)
- Serves frontend from `artifacts/overtime-tracker/dist/public`
- entrypoint.sh bootstraps Postgres, baselines+migrates the schema (`drizzle-kit migrate`), verifies it, seeds admin user
- Default admin: `admin@otqueue.local` / `Admin@123!`

## Database migrations

- Committed SQL in `lib/db/drizzle/` (+ `meta/` journal/snapshots). Applied at container start by `drizzle-kit migrate` — non-interactive and transactional: a failed run rolls back completely, so `migrate` can never leave a partial schema.
- Applied state lives in `drizzle.__drizzle_migrations` (hash + journal timestamp). Pre-migration (0.3.x) databases are baselined by entrypoint.sh, which records 0000 as already-applied (exactly what `migrate` would record).
- **Convention: migration SQL is idempotent by design** — `ADD COLUMN IF NOT EXISTS`, constraints inside `DO $$ ... IF NOT EXISTS ...` blocks. This lets `migrate` converge push-era partially-migrated databases non-destructively (adds only missing objects, never touches existing data). `0000_baseline.sql` / `0001_seniority_mode.sql` must NOT be regenerated with `drizzle-kit generate` (generated output is non-idempotent).
- entrypoint.sh then verifies the post-migration schema (0001 objects + their type/nullability/default + FK) and `exit 1`s on any mismatch — the container refuses to boot half-migrated.

## Codegen flow

1. Edit `lib/api-spec/openapi.yaml`
2. Run `pnpm --filter @workspace/api-spec codegen`
3. Output: `lib/api-client-react/src/generated/` + `lib/api-zod/src/generated/`
4. Verify: `pnpm run typecheck:libs`

## Dev quirks (easy to miss)

- **pnpm only** — preinstall script rejects npm/yarn
- **`minimumReleaseAge: 1440`** in pnpm-workspace.yaml — new packages blocked for 24h (supply-chain defense). Exclude via `minimumReleaseAgeExclude` if needed
- **`autoInstallPeers: false`** + **`strict-peer-dependencies: false`** (.npmrc) — manual peer dep management; adding deps may require explicit peer declarations
- **`catalog:` pinning** — core deps inherit exact versions from pnpm-workspace.yaml. Use `catalog:` in package.json to inherit
- **React 19.1.0 pinned exactly** (Expo requirement) — do not upgrade
- **esbuild externalizes** many native modules (see `artifacts/api-server/build.mjs`). Adding a new native dep requires updating the external list there
- **TypeScript**: `noUnusedLocals: false`, `strictFunctionTypes: false`, `customConditions: ["workspace"]` for workspace protocol resolution
- **Migrations are applied at container start by `drizzle-kit migrate`** (non-interactive, transactional, fails loud). `push`/`push-force` must never be used in the container — `push` prompts interactively on risky changes and can crash without a TTY

## Testing

- `@playwright/test` installed at workspace root (no test files committed yet)
- No unit test framework configured

## Build artifacts to ignore

- `dist/`, `*.tsbuildinfo` — regenerated
- `lib/*/src/generated/` — codegen output
- `.playwright-mcp/` — MCP runtime cache
