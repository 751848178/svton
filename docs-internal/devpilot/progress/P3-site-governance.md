# P3. Site Governance Progress

## Goal

`Site` is the project/environment-scoped governance surface for Nginx/OpenResty
sync, diagnostics, smoke checks, config diffs, approvals, rollback, and TLS
certificate lifecycle.

## Current Status

- Roadmap status: main Site control-plane loops are in place; module management,
  certificate library/upload/binding, real-environment smoke automation,
  log-archive automation, and queue/concurrency governance remain follow-ups.
- Recent verified structure slices: F143 split TLS/date formatting utilities;
  F144 split live/approval action flows out of `use-site-actions.ts`.
- F145-F147 source result: `use-sites.ts` owns data loading, delete,
  queue/modal state, and Site action composition; focused takeover moved into
  `use-site-takeover.hooks.ts`; card actions moved into
  `site-card-actions.component.tsx`; Add Site basic fields moved into
  `add-site-basic-fields.component.tsx` with shared `AddSiteFormData`.
- Current source-backed Sites structure result: all `sites` source files are now
  under 200 lines; largest files are `site-plan-run-panel.tsx` at 192 lines and
  `takeover-binding-form.tsx` at 186 lines.

## F145. Sites Data Hook Structure Slice

Purpose: continue P3 Site governance structure work from the smallest current
source-backed over-limit surface. This slice must first map `use-sites.ts`,
its callers, and its state/data flow, then only make the smallest confirmed
split that preserves existing Sites API calls, UI behavior, alerts, and return
contract.

| Task   | Status | Description                                                                                                        | Evidence                                                                                                                                                                                                        |
| ------ | ------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F145.1 | done   | Build a source-backed map of `sites/hooks/use-sites.ts`, route callers, state ownership, and verification targets. | CodeGraph CLI exists but is not initialized; manual graph confirmed `page.tsx -> useSites() -> SiteListSection/SiteCard/FocusedSitePanel`, with focused takeover fields consumed only by `FocusedSitePanel`.    |
| F145.2 | done   | Implement the smallest confirmed hook split while preserving public hook return fields and Sites page behavior.    | `use-sites.ts` is 140 lines after Prettier; new `use-site-takeover.hooks.ts` is 124 lines; `useSites()` still returns the same focused/takeover/action fields.                                                  |
| F145.3 | done   | Sync TODO/progress docs and run targeted Web verification plus hygiene checks.                                     | Prettier check, touched ESLint, Web build, Web type-check, diff check, conflict marker scan, trailing-whitespace scan, and touched source line-count scan passed; logs are under `/tmp/codex-tool-runs/svton/`. |

## F146. Site Card Action View Slice

Purpose: continue P3 Site governance structure work by splitting the next
smallest source-confirmed over-limit Sites view. `site-card.tsx` is 231 lines
and combines Site identity/metadata rendering, the full action-button cluster,
and plan/run panel composition.

| Task   | Status | Description                                                                                                        | Evidence                                                                                                                                                                                                 |
| ------ | ------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F146.1 | done   | Confirm the SiteCard action-button view boundary, caller graph, and behavior-preservation contract.                | Manual graph confirmed `SiteListSection -> SiteCard -> SiteCardActions/SitePlanRunPanel`; the extracted boundary consumes only `site`, `sites`, and `canRenewTls`.                                       |
| F146.2 | done   | Extract the action-button cluster to a focused component while preserving labels, disabled states, and hook calls. | `site-card.tsx` is 93 lines after Prettier; new `site-card-actions.component.tsx` is 162 lines; button labels, disabled checks, TLS renewal condition, and handler calls remain unchanged.               |
| F146.3 | done   | Sync docs/board and run targeted Web verification plus hygiene checks.                                             | Touched Prettier/ESLint, Web build, Web type-check, diff check, conflict marker scan, trailing-whitespace scan, and touched source line-count scan passed; logs are under `/tmp/codex-tool-runs/svton/`. |

## F147. Add Site Modal Form View Slice

Purpose: continue P3 Site governance structure work by splitting the next
smallest source-confirmed over-limit Sites view. `add-site-modal.tsx` is 237
lines and is the smaller remaining over-limit Site component after F146.

| Task   | Status | Description                                                                                            | Evidence                                                                                                                                                                                                                                               |
| ------ | ------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F147.1 | done   | Map AddSiteModal responsibilities, caller contract, form state, payload creation, and field rendering. | Manual graph confirmed `page.tsx -> AddSiteModal`; the modal owned shell/submission/payload plus basic fields, project-environment filtering, runtime config, and footer buttons.                                                                      |
| F147.2 | done   | Extract only the smallest confirmed form view/state boundary while preserving create payload behavior. | Basic identity/project/server/environment fields moved to `add-site-basic-fields.component.tsx`; shared `AddSiteFormData` replaced duplicate runtime field typing; create endpoint, payload, defaults, labels, and callbacks remain in the modal path. |
| F147.3 | done   | Sync docs/board and run targeted Web verification plus hygiene checks.                                 | Touched Prettier/ESLint, Web build, sequential Web type-check, diff check, conflict marker scan, trailing-whitespace scan, and touched source line-count scan passed; logs are under `/tmp/codex-tool-runs/svton/`.                                    |

## F148. Focused Site Panel View Slice

Purpose: finish the current P3/Sites source-backed line-ceiling pass by
splitting the only remaining over-limit Site source file. `focused-site-panel.tsx`
is 240 lines and combines focused identity/actions, takeover form composition,
focused plan preview, and recent run summary.

| Task   | Status | Description                                                                                                     | Evidence                                                                                                                                                                                                    |
| ------ | ------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F148.1 | done   | Map FocusedSitePanel responsibilities, caller contract, action handlers, takeover form, plan, and run sections. | Manual graph confirmed `page.tsx -> FocusedSitePanel`; the panel combines identity/action controls, takeover form composition, focused plan preview, and recent run summary.                                |
| F148.2 | done   | Extract the smallest confirmed view section while preserving focused panel behavior and hook calls.             | Focused plan preview and recent run summary moved to `focused-site-plan-run-summary.component.tsx`; focused action buttons, takeover form props, labels, and hook calls remain in `FocusedSitePanel`.       |
| F148.3 | done   | Sync docs/board and run targeted Web verification plus hygiene checks.                                          | Touched Prettier/ESLint, Web build, Web type-check, diff check, conflict marker scan, trailing-whitespace scan, and full Sites source line-count scan passed; logs are under `/tmp/codex-tool-runs/svton/`. |

## F275. Site Service Config-Generator Extraction (backend split started)

Purpose: begin the **backend** Site god-service split. Prior P3 slices (F143–F148)
addressed the Web `sites/` source; the backend `site.service.ts` was untouched at
2177 lines. This slice extracts the largest cohesive pure boundary — the
Nginx/OpenResty config + certificate-command generators and their safety checks
(~180 lines) — into focused pure-utils files, and moves the shared plan/config
types + small readers into a shared types file. This is the first of several
backend slices needed to bring `site.service.ts` under the ceiling.

| Task   | Status | Description                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F275.1 | done   | Map the config-generator boundary.                                                                       | Manual graph confirmed `generateNginxConfig`/`generateAccessPolicy`/`resolveUpstream`/`buildCertificateCommand`/`buildCertificateRenewCommand`/`resolveCertificateName`/`isPreviewSitePlaceholder` + 5 safety checks (`isSafeDomain`/`isSafeProbeHostname`/`isSafeNginxPath`/`isSafeNginxSiteConfigPath`/`isSafeUpstream`) + `filenameForDomain` are pure (no `this` state, no I/O) and used by the plan builders + create/update/takeover paths. |
| F275.2 | done   | Extract generators/safety into pure utils + shared types.                                                | New `site-plan.types.ts` (58 lines: `JsonRecord`/`SiteRecordLike`/`SiteSyncExecutionPlan` + `isRecord`/`readString`/`readBoolean`/`readStringArray` readers, preserving the original non-empty-trim filter) and `site-config-gen.utils.ts` (184 lines: all generators + safety checks + `filenameForDomain`). `site.service.ts` imports them, drops the inline type/readers + 14 private config methods, and calls the pure functions directly. `cleanAliases` stays (used by create/update). Host dropped from 2177 to 1996 lines. |
| F275.3 | done   | Run focused API verification and hygiene checks, then sync final evidence + add full site-module maps.  | Focused site Jest passed (27 tests, 4 suites): `/tmp/codex-tool-runs/svton/f275-jest-20260707.log`; API type-check passed (0 errors): `/tmp/codex-tool-runs/svton/f275-tc2-20260707.log`; both new files ≤200 lines (58/184); `git diff --check` clean; conflict-marker scan clean; single-quote API convention preserved. Full site-module map set (below) added for the backend. |

## F276. Site Service Plan-Builder + Warnings Extraction

Purpose: continue the site backend split by extracting the next largest pure
boundary — the 9 execution-plan builders (`buildSyncPlan`/`buildRollbackPlan`/
`buildDiagnosticsPlan`/3 OpenResty plans/`buildSmokeCheckPlan`/`buildTlsProbePlan`/
`buildTlsRenewPlan`) + the 7 `collect*Warnings`/`collectWarnings` collectors +
`normalizeTailLines` (~600 lines of pure functions). Split across three focused
pure-utils files by resource family so each stays ≤200 lines.

| Task   | Status | Description                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F276.1 | done   | Map the plan-builder + warnings boundary.                                                                | Manual graph confirmed the 9 builders + 7 warning collectors + `normalizeTailLines` are pure (no `this` state, no I/O), used by the sync/diagnostics/openresty/smoke/tls/rollback orchestration methods. They split cleanly by family: sync/rollback/diagnostics (uses `collectWarnings`), OpenResty (3 plans + 3 collectors), smoke/TLS (3 plans + 3 collectors). |
| F276.2 | done   | Extract builders/warnings into 3 focused pure-utils files.                                               | New `site-sync-plan.utils.ts` (189 lines: `buildSyncPlan`/`buildRollbackPlan`/`buildDiagnosticsPlan`/`collectWarnings`/`normalizeTailLines`), `site-openresty-plan.utils.ts` (85 lines: 3 OpenResty plans + 3 collectors), `site-ops-plan.utils.ts` (187 lines: smoke/TLS plans + collectors). `site.service.ts` imports them, drops the ~600-line cluster + 17 private methods, and calls the pure functions directly. `SiteRecordLike.server` tightened to `name?: string; host?: string` to satisfy the plan target types (structurally compatible with the host's Prisma `SiteRecord`). Host dropped from 1996 to 1394 lines. |
| F276.3 | done   | Run focused API verification and hygiene checks, then sync final evidence + update maps.                 | Focused site Jest passed (27 tests, 4 suites): `/tmp/codex-tool-runs/svton/f276-jest-20260707.log`; API type-check passed (0 errors): `/tmp/codex-tool-runs/svton/f276-tc2-20260707.log`; all 3 new files ≤200 lines (189/85/187); `git diff --check` clean; conflict-marker scan clean; single-quote API convention preserved. |

## F277. Site Service Operation-Policy + Config-Diff Extraction

Purpose: continue the site backend split by extracting the pure operation-policy
and config-diff helpers that `executeSiteSyncOperation` and its siblings depend
on. This is a safe, high-value pure boundary (~180 lines) that shrinks the host
and makes the policy/diff logic unit-testable. The large `executeSiteSyncOperation`
orchestration method itself remains on the host (it is tightly coupled to prisma,
approval, executor, audit — a service extraction is a separate future slice).

| Task   | Status | Description                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F277.1 | done   | Map the operation-policy + config-diff boundary.                                                         | Manual graph confirmed the 7 policy helpers (`modeForAction`/`mutatesNginxConfig`/`mutatesSiteStatus`/`requiresSiteOperationApproval`/`requiresExecutionConfirmation`/`siteOperationRisk`/`siteOperationLabel`) and 2 diff helpers (`diffConfigText`/`buildNoConfigDiff`) are pure; the 5 site-operation types (`SiteConfigDiff`/`SiteOperationAction`/`SiteOperationKey`/`SiteOperationMode`/`SiteOperationTrigger`) are shared and move to the types file. The async `buildConfigDiff` reads Prisma so stays on the host. |
| F277.2 | done   | Extract policy/diff helpers + operation types.                                                           | New `site-operation-policy.utils.ts` (64 lines: 7 policy functions), `site-config-diff.utils.ts` (99 lines: `diffConfigText`/`buildNoConfigDiff`/`buildConfigDiffFromBaseline` pure diff shaping), and 5 operation types moved into `site-plan.types.ts` (107 lines). `site.service.ts` imports them, drops the 9 private pure methods + 5 inline type aliases, and the async `buildConfigDiff` now delegates to `buildConfigDiffFromBaseline`. Host dropped from 1394 to 1217 lines. |
| F277.3 | done   | Run focused API verification and hygiene checks, then sync final evidence + update maps.                 | Focused site Jest passed (27 tests, 4 suites): `/tmp/codex-tool-runs/svton/f277-jest-20260707.log`; API type-check passed (0 errors): `/tmp/codex-tool-runs/svton/f277-tc1-20260707.log`; all new/updated files ≤200 lines (64/99/107); `git diff --check` clean; conflict-marker scan clean; single-quote API convention preserved. |

## F278. Site Sync Approval/Audit Builder Extraction

Purpose: continue the site backend split by extracting the pure approval-context,
blocked-execution, and audit-input builders that `executeSiteSyncOperation` and
`writeSiteSyncAudit` depend on. Safe pure boundary (~140 lines) that shrinks the
host and makes the approval/audit shaping unit-testable. The `executeSiteSyncOperation`
orchestration loop itself stays on the host (it remains the next large coupled
cluster for a dedicated execution service).

| Task   | Status | Description                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F278.1 | done   | Map the approval/audit builder boundary.                                                                 | Manual graph confirmed `buildSiteApprovalContext`/`buildApprovalBlockedExecution` (private) + the audit-input shaping inside `writeSiteSyncAudit` are pure value shaping; they depend only on the policy label/risk helpers and the plan/config-diff/site inputs. The async I/O (`auditEventService.create`) stays on the host as a thin wrapper. |
| F278.2 | done   | Extract approval/audit builders into a pure utils file.                                                  | New `site-sync-approval.utils.ts` (171 lines: `buildSiteApprovalContext`/`buildApprovalBlockedExecution`/`buildSiteSyncAuditInput` + a local pure `toJsonValue`). `site.service.ts` imports them, drops the 2 private builder methods, and `writeSiteSyncAudit` now delegates to `buildSiteSyncAuditInput` + `auditEventService.create`. `SiteRecordLike` gained `name`/`projectId`/`environmentId` (structurally compatible with the host Prisma `SiteRecord`). Host dropped from 1217 to 1104 lines; the now-unused `siteOperationRisk` import removed. |
| F278.3 | done   | Run focused API verification and hygiene checks, then sync final evidence + update maps.                 | Focused site Jest passed (27 tests, 4 suites): `/tmp/codex-tool-runs/svton/f278-jest-20260707.log`; API type-check passed (0 errors): `/tmp/codex-tool-runs/svton/f278-tc3-20260707.log`; new file 171 + updated types 110 (both ≤200); `git diff --check` clean; conflict-marker scan clean; single-quote API convention preserved. |

## F279. Site Includes Constant Extraction

Purpose: continue the site backend split by extracting the shared Prisma include
shapes (`siteInclude`/`syncRunInclude`) into a pure constants file. This is a
small but high-leverage step: the includes are referenced by ~15 host call sites
and will be reusable by future focused services/utils, and it shrinks the host
without the riskier `executeSiteSyncOperation` service extraction (which is
deferred to a fresh session due to its tight coupling to `createTlsProbe`).

| Task   | Status | Description                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F279.1 | done   | Map the includes boundary.                                                                               | Manual graph confirmed `siteInclude()`/`syncRunInclude()` are pure include objects used by ~15 host methods (CRUD, sync-run create/update, post-sync site update, list/get). Extractable as shared constants. |
| F279.2 | done   | Extract includes into a pure constants file.                                                             | New `site-includes.utils.ts` (44 lines: `SITE_INCLUDE` + `SYNC_RUN_INCLUDE` constants typed via `satisfies Prisma.SiteInclude`/`Prisma.SiteSyncRunInclude`). `site.service.ts` imports them, replaces all `this.siteInclude()`/`this.syncRunInclude()` call sites with the constants, and drops the 2 private methods. Host dropped from 1104 to 1066 lines. |
| F279.3 | done   | Run focused API verification and hygiene checks, then sync final evidence + update maps.                 | Focused site Jest passed (27 tests, 4 suites): `/tmp/codex-tool-runs/svton/f279-jest-20260707.log`; API type-check passed (0 errors): `/tmp/codex-tool-runs/svton/f279-tc1-20260707.log`; new file 44 lines (≤200); `git diff --check` clean; conflict-marker scan clean; single-quote API convention preserved. |

## F280. Site Sync Execution + Post-Sync Service Extraction

Purpose: extract the largest remaining coupled cluster — `executeSiteSyncOperation`
(293 lines, the core sync/diagnostics/probe/renew execution loop) + 5 post-sync
update helpers + `writeSiteSyncAudit` + `buildConfigDiff` — into two focused
services, decomposing the 293-line method into sub-methods (`buildExecutionInput`/
`handleBlockedApproval`/`runQueued`/`runDirect`) to stay ≤200 lines. The circular
dependency (`queueTlsProbeAfterRenewal` → `createTlsProbe`) is broken via a callback
interface. The host `SiteService` constructs `SiteSyncExecutionService` internally
from its own injected deps so specs reuse the same mocks.

| Task   | Status | Description                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F280.1 | done   | Map + design the extraction (blueprint committed in prior turn).                                         | Blueprint documented: `SiteSyncExecutionService` (execute decomposed into 4 sub-methods + writeAudit + buildConfigDiff) and `SitePostSyncUpdateService` (5 post-sync helpers + createTlsProbe callback). Circular dependency broken via `setCreateTlsProbeCallback`. |
| F280.2 | done   | Extract execution + post-sync services.                                                                  | New `SiteSyncExecutionService` (163 lines: `execute`/`buildExecutionInput`/`handleBlockedApproval`/`runQueued`/`runDirect`/`buildConfigDiff`/`writeAudit`) and `SitePostSyncUpdateService` (121 lines: 5 post-sync helpers + `setCreateTlsProbeCallback`). `site.service.ts` constructs `SiteSyncExecutionService` internally (reuses own injected deps), wires the callback, delegates all `executeSiteSyncOperation` calls → `executionService.execute(...)`. Dropped the 8 moved methods + 2 inline types. Host dropped from 1066 to **569 lines**. |
| F280.3 | done   | Run focused API verification and hygiene checks, then sync final evidence + update maps.                 | Focused site Jest passed (27 tests, 4 suites): `/tmp/codex-tool-runs/svton/f280-jest4-20260707.log`; API type-check passed (0 errors): `/tmp/codex-tool-runs/svton/f280-tc8-20260707.log`; both new services ≤200 lines (163/121); `git diff --check` clean; conflict-marker scan clean. |

## Site Module Backend Maps (current, post-F280)

Business logic map: project/environment-scoped Site record → CRUD (list/create/
update/delete) → sync/probe/diagnostics action plan build → server-executor
execution → approval gate (live writes) → sync-run record + audit + config-diff →
post-sync site/TLS status update → TLS probe/renew scheduling → rollback.

Organization map (backend files → responsibility):
- `site.controller.ts` (384, over-ceiling) — HTTP routes.
- `site.service.ts` (1066, over-ceiling) — Site CRUD + sync/diagnostics/
  openresty/smoke/tls action orchestration + `executeSiteSyncOperation` execution
  + post-sync updates + rollback (plan builders, warnings, policy, diff,
  approval/audit builders, includes extracted in F275–F279).
- `site-config-gen.utils.ts` (184) — pure Nginx/access-policy/upstream/certificate
  generators + safety checks (F275).
- `site-sync-plan.utils.ts` (189) — sync/rollback/diagnostics plan builders +
  collectWarnings + normalizeTailLines (F276).
- `site-openresty-plan.utils.ts` (85) — 3 OpenResty plans + collectors (F276).
- `site-ops-plan.utils.ts` (187) — smoke/TLS probe/renew plans + collectors (F276).
- `site-operation-policy.utils.ts` (64) — action→mode/risk/label + approval/confirmation policy (F277).
- `site-config-diff.utils.ts` (99) — pure nginx-config diff math + no-diff/baseline shaping (F277).
- `site-sync-approval.utils.ts` (171) — pure approval-context/blocked-execution/audit-input builders (F278).
- `site-includes.utils.ts` (44) — shared SITE_INCLUDE + SYNC_RUN_INCLUDE Prisma include constants (F279).
- `site-plan.types.ts` (110) — shared plan/config/operation types + readers (F275/F277/F278).
- `site-tls-probe.ts` (282, over-ceiling) + `site-tls-renew.ts` (255, over-ceiling)
  — TLS probe/renew metadata + command builders.
- `site-tls-probe-scheduler.service.ts` (254) + `site-tls-renew-scheduler.service.ts`
  (280) — scheduled TLS probe/renew ticks (both over-ceiling).

Function map: Site list/get/create/update/delete; takeover preview; sync plan;
diagnostics; OpenResty status/modules/module-baseline; smoke check; TLS probe;
TLS renew; rollback; scheduled TLS probe/renew.

Data-flow map: Site DTO + record → plan builder (config-gen utils + command steps)
→ server-executor submit → approval (live) → sync-run write + audit + config-diff
→ site/TLS status update → scheduler follow-up (probe after renewal).

Page-structure map (backend routes): `GET/POST/PUT/DELETE /sites` + `/sites/:id/
sync-runs` + `/sites/:id/{sync-plan,diagnostics,openresty-status,openresty-modules,
openresty-module-baseline,smoke-check,tls-probe,tls-renew,rollback,takeover-preview}`.

## Gaps Identified From The Site Backend Maps (post-F275)

- **`site.service.ts` still 1066 lines** (over ceiling). Plan builders, warnings,
  operation-policy, config-diff, approval/audit builders, and includes (the
  previous largest boundaries) were extracted in F275–F279. Next largest boundary:
  `executeSiteSyncOperation` (lines ~514-805, ~293 lines, the largest remaining
  orchestration method) + post-sync update helpers (lines ~807-961, ~156 lines) +
  `writeSiteSyncAudit` (lines ~964-989). **F280 extraction design blueprint:**
  - **`SiteSyncExecutionService`** (target ≤200 lines): owns `executeSiteSyncOperation`
    — but since it is 293 lines it must be decomposed into sub-methods:
    `buildExecutionInput`, `handleBlockedApproval` (returns early), `runQueuedExecution`
    (returns early), `runDirectExecution` (the happy path). Also owns `writeSiteSyncAudit`
    (delegates to `buildSiteSyncAuditInput` + `auditEventService.create`) and the async
    `buildConfigDiff` (Prisma baseline read + `buildConfigDiffFromBaseline`).
    Injects: `prisma`, `serverExecutor`, `operationApprovalService`, `auditEventService`,
    `postSyncUpdateService`.
  - **`SitePostSyncUpdateService`** (target ≤200 lines): owns `updateSiteAfterSync`,
    `updateSiteTlsAfterProbe`, `updateSiteAfterNonMutatingOperation`,
    `updateSiteTlsAfterRenew`, `queueTlsProbeAfterRenewal`. Injects: `prisma`,
    `logger`, and a **`createTlsProbeCallback`** (`(teamId, userId, siteId, dto,
    trigger, sourceRunId) => Promise<SiteOperationExecutionResult>`) wired from
    the host's `createTlsProbe` to break the circular dependency.
  - Host `site.service.ts` keeps `createTlsProbe`/`createSyncPlan`/etc. public methods,
    delegates `executeSiteSyncOperation` → `executionService.execute(...)`, and wires
    the `createTlsProbe` callback into the post-sync service.
- **Over-ceiling TLS files:** `site-tls-probe.ts` (282), `site-tls-renew.ts` (255),
  `site-tls-probe-scheduler.service.ts` (254), `site-tls-renew-scheduler.service.ts`
  (280) — each needs its own config/metadata extraction.
- **`site.controller.ts` (384)** — thin route layer, over ceiling (split candidate
  like the resource-control controller).

## Next Candidates

- **F280 (next session):** extract `executeSiteSyncOperation` (decomposed into
  sub-methods) + `writeSiteSyncAudit` + `buildConfigDiff` into
  `SiteSyncExecutionService`, and the 5 post-sync update helpers into
  `SitePostSyncUpdateService` (with a `createTlsProbe` callback). This is the
  highest-complexity remaining extraction — needs careful interface design and
  full spec coverage; do it in a fresh session.
- Then the 4 over-ceiling TLS files, then the controller.
- After site, move to monitoring / log-center / ops-governance backend splits
  (each needs its own split pass + full module map set).

## Maps To Maintain

- Business logic map: `/sites` reads URL `projectId/environmentId/siteId/new`,
  loads Site/Server/Project/Environment/ProxyConfig data plus per-site sync
  runs, then composes delete, sync-plan, diagnostics, live/approval, TLS,
  rollback, and takeover actions through hook fields.
- Organization map: `page.tsx` is the route shell; `use-sites.ts` is the data
  composition hook; `use-site-actions.ts` and `use-site-live-actions.hooks.ts`
  own plan/live/TLS/rollback actions; `use-site-takeover.hooks.ts` owns focused
  takeover form state and preview activation; `SiteCard` owns identity/metadata
  composition; `SiteCardActions` owns the action-button cluster; components
  render list, cards, focused panel, focused plan/run summary, takeover form,
  add-site modal fields, runtime config fields, and plan/run panels.
- Functional map: list/create/focus, queue toggle, sync plan, live sync
  approval, diagnostics, OpenResty status/modules/baseline, smoke, TLS probe
  and renewal, rollback, takeover binding, preview activation, and delete.
- Data-flow map: URL filters -> `useSites()` -> API lists/sync runs -> hook
  state -> `SiteListSection`/`FocusedSitePanel` -> user actions -> API
  mutation/plan creation -> `setSites`/`setPlans`/`refreshSyncRuns`/`reload`.
- Page-structure map: `/sites` page -> header actions/filter note/focus warning
  -> focused panel -> loading/empty/list section/cards/actions/plan-runs -> add
  modal/basic fields/runtime fields.
