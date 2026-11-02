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

# E2E (Playwright) — runs against a running instance, default http://localhost:8085
pnpm test                                        # full suite (includes auth setup project first)
npx playwright test tests/e2e/auth.setup.ts tests/e2e/<spec>.spec.ts   # one spec with fresh login
E2E_BASE_URL=http://localhost:8086 E2E_ADMIN_PASSWORD='<current admin pw>' npx playwright test   # other instance/volume
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
- Default admin: `admin@otqueue.local` / `Admin@123!` (freshly seeded accounts must change this password before the API accepts requests — see Testing)
- Releases are cut by `scripts/release.sh` (git-ignored, local-only): schema-migration guardrail + docker build/push of `alex12342/otqueue` (tags `vX` and `latest`). There is no CI — published images are exactly what release.sh built.

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
- **Radix Select 2.2.6 pre-fill traps**: `<SelectValue />` with no children renders an EMPTY trigger for a controlled value (pass the resolved label as children), and Radix fires `onValueChange("")` on mount when the value has no mounted item — handlers must ignore empty values (`if (!v) return;`) or prefilled state is clobbered. All pre-filled selects follow this pattern now
- **PATCH routes are partial updates**: write only keys present in the parsed body (see PATCH `/events/:id` + `UpdateEventInput`). Never reuse a create schema's `.default()`/`?? fallback` on update — it silently resets omitted fields (cause of the event day-type loss bug)
- **`dayType: "system"` is reserved** for auto-created fairness-baseline/admin-adjustment events; it never appears in roster day-type config rows, so any UI listing day types must special-case it
- **Scheduled (future-dated) events don't count until their date**: every hours/fairness/stats sum must include `activeEventWhere()` from `artifacts/api-server/src/lib/active-events.ts` (`events.date <= today`, evaluated at query time — no cron; totals self-correct when the day arrives). On future events the entry's `worked` flag means "agreed" (UI relabels to Agreed / Upcoming badge); once the date passes it counts as worked

## Testing

- Playwright e2e in `tests/e2e/` (`pnpm test`). No unit test framework configured.
- Tests run against a **deployed instance** (default `http://localhost:8085`; override `E2E_BASE_URL`) — there is no mock/dev-server mode.
- Auth flow: the `setup` project logs in and saves `tests/e2e/.auth/state.json`, which the chromium project reuses. The state file is instance-specific — when switching `E2E_BASE_URL`, include `tests/e2e/auth.setup.ts` in the run or you silently reuse another container's session.
- A **freshly seeded** admin has `passwordChangeRequired=true`: every API endpoint 403s until one `POST /auth/change-password`. Do that once against a new volume before e2e, or point `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` at an instance already past it.
- Specs are self-contained: they seed data through the `api()` helper (uses the storage-state session) and delete their rosters in `afterEach`. Unique names via `Date.now().toString(36)` suffix — suites may share a volume.

## Build artifacts to ignore

- `dist/`, `*.tsbuildinfo` — regenerated
- `lib/*/src/generated/` — codegen output
- `.playwright-mcp/` — MCP runtime cache
