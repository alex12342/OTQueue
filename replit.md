# OTQue

A web app for tracking and fairly distributing overtime at shift-based jobs. Supports multiple rosters, role/subclass classification, holiday day types, and weighted fairness hours.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at /api)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only, use `push-force` for non-interactive)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- Frontend: React + Vite + Wouter + TanStack Query + shadcn/ui
- Build: esbuild (CJS bundle for API server)

## Where things live

- `lib/db/src/schema/` — DB schema (rosters, employees, events, roles, subclasses, roster_settings, dayTypeConfig)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/src/generated/` — generated hooks and Zod schemas (do not edit manually)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/overtime-tracker/src/pages/` — React pages
- `artifacts/overtime-tracker/src/hooks/use-roster.tsx` — RosterContext (active roster stored in localStorage)

## Architecture decisions

- **Contract-first**: OpenAPI spec drives both server validation (Zod) and client hooks (Orval codegen). Always update spec first, then run codegen.
- **Multi-roster**: Every employee, event, role, and subclass belongs to exactly one roster. All list endpoints accept `rosterId` query param.
- **Roster context**: Active roster is stored in localStorage and provided via `useRoster()` hook. All pages pull from this context rather than accepting rosterId as a prop.
- **Event-level multiplier**: Each event stores a `multiplier` field (numeric, default 1.0). Fairness score = SUM(hours × event.multiplier). The multiplier auto-populates from the day type config when logging, and is editable per-event.
- **Day type config**: Per-roster per-day-type settings stored in `roster_day_type_config`. Each row has `enabled` (controls Up Next tab visibility) and `multiplier` (auto-filled default when logging events of that type). Configured in Settings → Day Types tab.
- **Holiday day type**: Third day type alongside weekday/weekend. API has `/suggest-day-type?date=` to auto-detect based on weekends (holiday detection is a stub — extend with a holiday library if needed).

## Product

- **Overview (Up Next)**: Shows employees ordered by subclass priority → fairness hours → seniority. Toggle between Weekday / Weekend / Holiday views.
- **Log Event**: Record an overtime event with employees offered/worked. Day type is auto-suggested from the date. Holiday type supported.
- **Event Log**: History of all events with search and CSV export. Filtered by active roster.
- **Employees**: Manage the active roster's employees with role and subclass assignment.
- **Settings**: Per-roster configuration — sorting criteria toggles, subclass definitions (priority + weighted multipliers), role definitions, and roster management.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing the OpenAPI spec, always run codegen before touching frontend code: `pnpm --filter @workspace/api-spec run codegen`
- DB push command for dev (non-interactive): `pnpm --filter @workspace/db run push-force`
- The API server bundles everything with esbuild — restart the workflow after any route changes for them to take effect.
- Generated Zod schema names use `QueryParams` suffix (e.g., `ListEmployeesQueryParams`, `GetUpNextQueryParams`) — not just `Params`.
- `date` field in event Zod schema uses `zod.coerce.date()` — pass as ISO string `yyyy-MM-dd`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
