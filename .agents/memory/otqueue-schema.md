---
name: OTQueue schema conventions
description: Multi-roster DB schema layout and codegen workflow for OTQueue
---

## Rule
Every DB resource (employees, events, roles, subclasses, roster_settings) belongs to exactly one roster via `roster_id` FK. All list endpoints accept `rosterId` as an optional query param.

**Why:** The app supports multiple independent rosters (e.g. Cleaners, Security) each with their own employees, fairness tracking, and configuration.

**How to apply:** When adding a new resource type, always add a `roster_id` FK and expose `rosterId` filtering in the list endpoint. Update the OpenAPI spec first, then run codegen.

## Codegen workflow
1. Edit `lib/api-spec/openapi.yaml`
2. Run `pnpm --filter @workspace/api-spec run codegen`
3. Generated files land in `lib/api-client-react/src/generated/api.ts` and `api.schemas.ts`
4. Frontend imports hooks directly from `@workspace/api-client-react`

## Generated Zod schema param names
Query param types use `Params` suffix (e.g. `ListEmployeesParams`, `GetUpNextParams`). The `GetUpNextParams` requires `rosterId` (non-optional).

## DB push (dev)
`pnpm --filter @workspace/db run push-force` — non-interactive version for scripted use.

## Date handling
`date` field in EventInput uses `zod.coerce.date()` on the server. Pass as `yyyy-MM-dd` string from frontend. The server coerces it to a JS Date before DB insert.
