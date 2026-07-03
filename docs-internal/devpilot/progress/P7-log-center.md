# P7. Log Center Progress

## Goal

`LogCenter` is the project/environment-scoped observability surface for log
streams, archived log entries, collection runs, SSE tail sessions, source
metadata, Server executor follow, SLS read-only ingestion, and future agent-level
continuous follow runtime.

## Current Status

- Roadmap status: log streams, archived entries, collection runs, SSE tail,
  bounded session governance, Server executor scheduled follow, SLS
  credential-backed ingestion, and Agent Follow metadata persistence contract
  exist in the current control plane.
- Remaining product/runtime gaps from the source docs: real agent-level
  continuous log follow runtime, broader provider-backed log sources, and deeper
  production scheduling/e2e coverage remain follow-ups.
- Recent verified structure slices: F129 repaired the Agent Follow metadata
  type/helper contract; F138 split `use-logs-tail.ts` metadata and stream
  effects into focused hooks, keeping those hook files under 200 lines.
- Current source-backed structure result: F149 split stream CRUD, entry append,
  collection run, and retention cleanup mutations into
  `use-logs-actions.hooks.ts`; `use-logs.ts` now owns loading, derived target
  options, selected stream composition, and tail/policy/action hook composition.

## F149. Logs Page Data Hook Structure Slice

Purpose: continue P7 Log Center structure work from the smallest current
source-backed Logs over-limit surface. This slice must first map `use-logs.ts`,
its callers, and its action/data flow, then only make the smallest confirmed
split that preserves existing Logs API calls, UI behavior, alerts, filtering,
tail/follow actions, metadata updates, and return contract.

| Task   | Status | Description                                                                                       | Evidence                                                                                                                                                                                                                                                                   |
| ------ | ------ | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F149.1 | done   | Build a source-backed map of `logs/hooks/use-logs.ts`, route callers, state ownership, and tests. | CodeGraph CLI exists but is not initialized; manual graph confirmed `page.tsx -> useLogs() -> LogsStatsSection/StreamManageSection/LogEntriesSection/TailPanel/PolicyPanels/LogsRunsSection`, with mutation actions only consumed through the `useLogs()` return contract. |
| F149.2 | done   | Implement the smallest confirmed hook split while preserving public hook return fields.           | `use-logs.ts` is 138 lines after Prettier; new `use-logs-actions.hooks.ts` is 153 lines; create/append/collect/retention cleanup endpoints, alerts, payloads, loading flags, `loadData()` refreshes, and returned field names remain unchanged.                            |
| F149.3 | done   | Sync TODO/progress docs and run targeted Web verification plus hygiene checks.                    | Touched Prettier, touched ESLint, Web build, Web type-check, source line-count, diff check, conflict-marker scan, and trailing-whitespace scan passed; key logs are under `/tmp/codex-tool-runs/svton/f149-*`.                                                             |

## Maps To Maintain

- Business logic map: `/logs` loads log streams, entries, collection runs,
  stream-source options, and tail state, then composes stream CRUD, entry append,
  collection planning, SSE tail, Server/Agent Follow metadata, and copy helpers
  through hook fields.
- Organization map: `page.tsx` is the route shell; `use-logs.ts` is the page data
  composition hook; `use-logs-tail.ts` and the extracted metadata/stream effect
  hooks own tail session lifecycle; components render stream forms, stream cards,
  tail controls, entries, collection runs, and metadata/follow controls.
- Functional map: create/update stream, filter streams, append entries, inspect
  entries, collect logs, inspect collection runs, refresh options, manage tail
  sessions, update server/agent follow metadata, and copy command/snippet text.
- Data-flow map: URL/page state -> `useLogs()` -> log-center APIs and tail hook
  -> page/components -> user actions -> API mutation/tail lifecycle -> local
  stream/entry/run/options state refresh.
- Page-structure map: `/logs` page -> stream creation/filter controls -> stream
  list/cards/actions -> selected stream detail -> entry/search/tail/follow panels
  -> collection run summaries.
