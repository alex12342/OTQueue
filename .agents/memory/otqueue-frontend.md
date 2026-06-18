---
name: OTQueue frontend patterns
description: Key frontend patterns for the OTQueue React app
---

## Rule
Active roster is stored in localStorage under key `otqueue_active_roster_id` and provided to all pages via the `useRoster()` hook (RosterContext). Pages never accept `rosterId` as a prop — they always read it from context.

**Why:** Roster switching is global and persists across page navigations and refreshes.

**How to apply:** Any page or component that needs the active roster should call `const { activeRosterId, activeRoster } = useRoster()`. The `RosterProvider` wraps the entire router inside `App.tsx`.

## Vite HMR behavior
If Vite shows "Failed to reload" for a module (e.g. after a bad import), HMR gets stuck in a broken module graph. A full workflow restart clears this — `restart_workflow "artifacts/overtime-tracker: web"`. The typecheck result is the reliable indicator of code correctness, not the HMR error messages.

## lib package resolution
`lib/api-client-react` is not a composite/emit lib — it exports TypeScript source directly via Vite's FS resolution. If Vite can't find generated files, it's usually because codegen hasn't been run yet (files don't exist), not a build issue.

## Query key pattern
Always pass params into both the hook's first argument and the `queryKey` option so cache invalidation targets the right key:
```ts
useListEmployees(
  { rosterId },
  { query: { queryKey: getListEmployeesQueryKey({ rosterId }) } }
)
```
