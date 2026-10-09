# Shipkit formal web MVP

The frontend is `apps/shipkit-web`, running Next 15 / React 19. It preserves the confirmed prototype's table layout, green/white tokens, transparent title return, fixed 256px navigation, mobile overlay drawer and four-step release flow. The prototype remains untouched and available separately.

## Runtime

From the workspace root:

```sh
pnpm --filter @svton/shipkit-web type-check
pnpm --filter @svton/shipkit-web test
pnpm --filter @svton/shipkit-web build
pnpm --filter @svton/shipkit-web start
```

Web: `http://127.0.0.1:8769`. API: `http://127.0.0.1:8770`. Next forwards `/api/*` to the local Nest process. Frontend requests send JSON and `x-shipkit-local: 1`; request identity and write policy remain backend-owned. API credentials are never loaded by the frontend.

Dependencies use `workspace:*` for `@svton/api-client`, `@svton/hooks` and `@svton/ui`. Their exported artifacts must be built before starting a fresh checkout. Existing workspace installation and the root coordinator own dependency setup.

## Responsibilities and state flow

- `src/components/platform-app.tsx`: selects the current page from URL parameters and requests project/live/task facts.
- `src/hooks/use-navigation.ts`: navigation URL includes project, view, task and step. A task can be reopened after refresh.
- `src/lib/api-registry.ts` / `api.ts`: svton typed route registry and raw JSON transport with AbortSignal.
- `src/lib/contracts.ts`: public presentation DTOs aligned with the stable API and executor contracts.
- `src/hooks/use-release.ts`: fresh selection/version and explicit task actions. Existing task URLs restore the saved plan as read-only, including selection/review steps. Again-release opens an independent fresh flow against the latest baseline; unedited defaults follow project.nextVersion.
- `src/components/release-*`: the four-step flow; completion stays on execution until the user chooses results.
- `src/hooks/use-stage-log.ts` / `stage-log-drawer.tsx`: append archived log chunks by offset, poll only the chosen stage/service and abort when closed. A nonmodal inspection panel reserves room for clickable page stages on desktop and provides a stage selector on small screens. Readable logs have a white background; Anser JSON tokens render as escaped React text and BuildKit steps/outcomes are coloured semantically. A download is enabled only after the entire archive is read. Structured results, remote tasks and grouped transport events follow the log; raw JSON is secondary.
- `release-execution.tsx` owns log selection and its panel. Leaving execution unmounts the panel and aborts its reads; returning does not reopen it. Agent connection URLs are presented as “Agent访问地址”, with server identity remaining in project/target metadata.
- `src/components/image-reference.tsx`: shows a shortened digest, a hover/focus tooltip with the original reference, and an independent copy icon. Rollback, archived and current images use the same component without expanding rows.
- `src/components/history-page.tsx` / `runtime-history.tsx` / `rollback-modal.tsx`: platform tasks are the primary collection; Agent changes are a folded supplement including CLI history. Remote release IDs associate runtime changes to a platform version when known. Historical rollback shows the change, current baseline and exact parent image references before explicit confirmation.
- `src/lib/task-state.ts`: pure presentation of stage outcomes, recovery/cleanup independence and noncancellable commit phases.
- `src/components/project-*`, `settings-page.tsx`: project registration, actual config/Git/Agent facts, persisted display names/entry URLs and diagnostic verification levels.

Components depend on hooks/contracts/pure projections. Transport and projections do not depend on views. Durable execution belongs to the backend; browser memory only stores pre-start form/step choices. No scenario selector, credential form, localStorage task authority or arbitrary shell endpoint is present.

The sidebar contains the project collection and a global Agent resources entry. Project header actions lead to history and connection/configuration. Agent resources aggregate existing configured endpoints, runtime/build purposes and project/target bindings; explicit checks show real connection, version, role and Docker results per binding. Shared endpoints are merged, dynamic builder strategies remain separate, and config/check failures are local to the affected project or binding. The page does not add/edit connections or create cloud resources.

Metadata names and browser entry URLs are manual local-platform fields; target/service keys and Agent endpoints come from the referenced project config. A selected target corresponds to one runtime endpoint; an SSH tunnel endpoint is not presented as the physical server IP.

Versions identify platform attempts (including failed/rollback attempts), starting at 0.0.1 per project. Plans propose a default next-patch version or explicit newer stable x.y.z; task start atomically allocates it. A stale plan returns VERSION_CONFLICT. Idempotent retries retain their version. Task IDs, remote IDs and image digests retain their original values. Migration 2026100802_release_versions backfills existing tasks by project/createdAt/id inside one transaction.

## Verification

- Type check passed: `/tmp/codex-tool-runs/svton/shipkit-web-typecheck.log`.
- Production build passed: `/tmp/codex-tool-runs/svton/shipkit-web-build.log`.
- Seven focused state/command/input tests passed: `/tmp/codex-tool-runs/svton/shipkit-web-tests.log`.
- Mechanical design detector returned `[]`: `/tmp/codex-tool-runs/svton/shipkit-web-design-detect.json`.
- All 44 source files were below the 200-line ceiling; largest file was 115 lines.

Desktop/mobile browser and real API/Docker acceptance are recorded by the coordinator with the integration evidence; static checks alone do not establish release or cancellation correctness.

The 15-item October 8 refinement and its numbered acceptance evidence are recorded in `audits/2026-10-08/platform-ui-refinement.md`.
The subsequent six interaction adjustments and existing Agent resource management are recorded in `audits/2026-10-08/platform-ui-followup.md`.
