# P1. Project Environment And Resource Binding Progress

## Goal

P1 makes project environments the ownership boundary for servers, managed
resources, resource instances, CDN configs, secrets, and resource-control
operations. This supports Devpilot's target shape as a project/environment
centered development and operations resource-control platform.

## Current Status

- F14 completed the environment resource binding closure: servers, Docker/cloud
  resources, resource requests/instances, CDN configs, secrets, project details,
  and the resource-control page can carry project/environment ownership.
- F24-F31 completed the first resource-control operation chain: connection
  probe runs, read-only query runs, binding updates, credential profiles,
  DB/Redis readonly credentials, DB/Redis live readonly adapters, and Docker
  Server executor live actions.
- F55 completed contextual operation entry links from the environment workbench
  into resource-control, applications, and sites with project/environment URL
  context.
- Current source-backed structure gap: `ResourceControlService` still contains
  many unrelated orchestration responsibilities. New work should split verified
  boundaries without changing the public controller API.

## F261. Resource Control Capabilities Service Split

Purpose: restore the P1 progress anchor and split the resource-control
capabilities contract out of the over-large service. This keeps the UI/API
contract for source types, credential profiles, query adapters, reusable
resources, and safety notes reviewable without touching binding, query,
execution, approval, or audit behavior.

| Task   | Status | Description                                                                                                | Evidence                                                                                                                                                                                                                                                                                           |
| ------ | ------ | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F261.1 | done   | Restore P1 as the stable progress anchor for project/environment resource binding.                         | This file now records the current P1 capability chain from the TODO ledger and `progress/INDEX.md` routes P1 here.                                                                                                                                                                                 |
| F261.2 | done   | Map the smallest safe split boundary in `ResourceControlService`.                                          | Manual graph confirmed `/resource-control/capabilities` calls `ResourceControlService.getCapabilities()`, and that method is a pure capability contract except for `RESOURCE_ACTIONS.map(...)`.                                                                                                    |
| F261.3 | done   | Extract capabilities into `ResourceControlCapabilitiesService` while preserving the public service facade. | `ResourceControlService.getCapabilities()` delegates to the focused service; `ResourceControlModule` provides the new service; existing controller route behavior is unchanged.                                                                                                                    |
| F261.4 | done   | Run focused API verification and sync final evidence.                                                      | Focused resource-control Jest passed: `/tmp/codex-tool-runs/svton/f261-resource-control-jest-20260705-133343.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f261-api-type-check-20260705-133355.log`; API build passed: `/tmp/codex-tool-runs/svton/f261-api-build-20260705-133355.log`. |

## F262. Resource Control Cloud Provider Health Service Split

Purpose: split cloud provider sync-health read and summarization behavior out
of the over-large resource-control service. This keeps the project/environment
resource-control dashboard's provider health signal intact while isolating
Prisma read projection, diagnostic parsing, fallback/provider-failure scoring,
and response shaping from binding, query, action, approval, audit, and inventory
write paths.

| Task   | Status | Description                                                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F262.1 | done   | Map cloud-provider-health entrypoints, callers, data flow, and page impact. | CodeGraph CLI exists but is not initialized; manual graph confirmed `GET /resource-control/cloud/provider-health` calls `ResourceControlService.listCloudProviderHealthRuns()`, filters readable sync runs, then calls `summarizeCloudProviderHealth()`. Business map: cloud sync run -> readable resource-sync-run filter -> provider health summary -> `/resource-control` health panel. |
| F262.2 | done   | Extract cloud provider health read/summarization into focused files.        | Added `ResourceControlCloudProviderHealthService`, `resource-control-cloud-provider-health.utils.ts`, `resource-control-cloud-provider-health.types.ts`, and shared `resource-control-value.utils.ts`; `ResourceControlService` keeps public delegate methods and drops the cloud health private helpers.                                                                                  |
| F262.3 | done   | Run focused API verification and sync final evidence.                       | Focused resource-control Jest passed: `/tmp/codex-tool-runs/svton/f262-resource-control-jest-20260705-134225.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f262-api-type-check-20260705-134239.log`; API build passed: `/tmp/codex-tool-runs/svton/f262-api-build-20260705-134239.log`.                                                                                         |

## F263. Resource Provisioning Run Supervisor Service Split

Purpose: begin splitting the over-limit `resource-request.service.ts` (4385 lines)
by moving the read-only provisioning-run supervisor snapshot behind a focused
service. Source inspection confirmed `getProvisioningRunSupervisor` is consumed
only by `ResourceRequestController` (`GET /resource-requests/provisioning-runs/supervisor`)
and is a self-contained read model (status counts + queued/stale/recent-problem
samples + scheduler config). This slice preserves the public snapshot response
shape and every provisioning/lifecycle write path.

| Task   | Status | Description                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F263.1 | done   | Map the provisioning-run supervisor boundary, callers, helpers, and data flow.                           | CodeGraph CLI is present but uninitialized; manual graph confirmed `getProvisioningRunSupervisor` is called only by `ResourceRequestController` and reads `resourceProvisioningRun` counts/samples plus scheduler env config; `serializeProvisioningRun` (9 reuse) stays on the host service and is passed as a callback.                                                                                                                                                                                                                                                       |
| F263.2 | done   | Extract the supervisor snapshot into a focused service with shared types and config utils.               | `ResourceProvisioningRunSupervisorService` (156 lines) owns the team-scoped count/sample reads and snapshot assembly; `resource-provisioning-run-supervisor-config.utils.ts` (82 lines) owns list-limit/stale-after/scheduler config reads; `resource-provisioning-run.types.ts` (13 lines) owns `JsonRecord`/`ProvisioningRunStatusCounts`; `ResourceRequestService.getProvisioningRunSupervisor()` is a one-line delegate passing `serializeProvisioningRun` as a callback. `resource-request.service.ts` dropped from 4385 to 4285 lines. |
| F263.3 | done   | Run focused API verification and hygiene checks, then sync final evidence.                               | Focused resource-request Jest passed (44 tests, 5 suites): `/tmp/codex-tool-runs/svton/f263-jest2-20260705.log`; API type-check passed (0 errors): `/tmp/codex-tool-runs/svton/f263-tc4-20260705.log`; API build passed: `/tmp/codex-tool-runs/svton/f263-build2-20260705.log`; Prettier check, diff check, and conflict-marker scan all clean.                                                                                                                                                                                                                                    |

## F264. Resource Provisioning Run Read Service Split

Purpose: continue splitting the over-limit `resource-request.service.ts`
(4394 lines at the verified HEAD base) by moving the read-only
provisioning-run listing behind a focused service. Source inspection confirmed
`listProvisioningRuns` is consumed only by `ResourceRequestController`
(`GET /resource-requests/:id/provisioning-runs`) and is a self-contained read
(query filters + Prisma `findMany` + `serializeProvisioningRun`). This slice
preserves the public list response shape and every provisioning/lifecycle write
path; it re-applies F263 (supervisor split) cleanly on the HEAD base so both
extracts land together.

| Task   | Status | Description                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F264.1 | done   | Map the provisioning-run list boundary, callers, and data flow.                                          | CodeGraph CLI is present but uninitialized; manual graph confirmed `listProvisioningRuns` is called only by `ResourceRequestController` and reads `resourceProvisioningRun.findMany` scoped by team/request with status/mode/trigger filters; `serializeProvisioningRun` (shared) stays on the host service and is passed as a callback.                                                                                                                                                                                                                                       |
| F264.2 | done   | Extract the provisioning-run listing into a focused read service.                                        | `ResourceProvisioningRunReadService` (74 lines) owns the team/request-scoped `findMany` and list-limit read; `ResourceRequestService.listProvisioningRuns()` is a one-line delegate passing `serializeProvisioningRun` as a callback; the module registers the new service. Combined with F263, `resource-request.service.ts` dropped from 4394 to 4272 lines.                                                                                                                                                                                                              |
| F264.3 | done   | Run focused API verification and hygiene checks, then sync final evidence.                               | Focused resource-request Jest passed (44 tests, 5 suites): `/tmp/codex-tool-runs/svton/f264-jest2-20260705.log`; API type-check passed (0 errors): `/tmp/codex-tool-runs/svton/f264-tc2-20260705.log`; API build passed: `/tmp/codex-tool-runs/svton/f264-build2-20260705.log`; `git diff --check` clean with a small touched-file diff (3 files, 27 insertions / 135 deletions); conflict-marker scan clean.                                                                                                                                                                  |

## F265. Project Environment Site-Copy Service Split

Purpose: split the `copySites` + `getSiteCopyAccessScope` site-copy orchestration
out of the over-limit `ProjectEnvironmentService`. Source inspection confirmed
both methods are consumed only by `ProjectEnvironmentController`
(`POST /project-environments/copy-sites`) and form a self-contained site-copy
boundary (draft-skeleton copy + optional OpenResty dry-run/queued-live takeover),
independent of environment CRUD, sync-from-project, server binding, and secret
management. This slice preserves the public controller API and every copy-step
behavior (dry-run planning, sanitization, queued-live metadata, audit follow-up).

| Task   | Status | Description                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F265.1 | done   | Map the site-copy boundary, callers, helpers, and data flow.                                             | CodeGraph CLI is present but uninitialized; manual graph confirmed `copySites`/`getSiteCopyAccessScope` are called only by `ProjectEnvironmentController` and depend on `repo.findSites`/`createSite`/`findProjectEnvironment`/`findServer`, `siteService.createSyncPlan`, and `auditEventService.create`; pure helpers (`sanitizeSiteTlsForCopy`, `buildSiteCopyQueuedLiveSyncFollowUp`, `buildSiteCopyAuditInput`) already live in shared utils. |
| F265.2 | done   | Extract site-copy into a focused service while preserving the public service facade and fixing spec wiring. | New `ProjectEnvironmentCopySiteService` (99 lines) owns `copySites` + `getSiteCopyAccessScope` + private `resolveProjectEnvironment`/`assertServer`; `ProjectEnvironmentService` keeps one-line arrow-function delegates and drops the 273-line inline copy body; module registers the new provider. Spec constructor rewired to inject a real `ProjectEnvironmentCopySiteService(repo, siteService, auditEventService)` so the existing copy integration tests still exercise real copy behavior. Host service dropped from ~1986 to 1713 lines. |
| F265.3 | done   | Run focused API verification and hygiene checks, then sync final evidence.                               | Focused project-environment Jest passed (34 tests, 2 suites): `/tmp/codex-tool-runs/svton/pe-final-jest-20260707-095948.log`; API type-check passed (0 errors): `/tmp/codex-tool-runs/svton/pe-final-tc-20260707.log`; new file 99 lines (≤200); `git diff --check` clean; conflict-marker scan clean; single-quote API convention preserved (no Prettier double-quote regressions).                                                                                                                                            |

## F266. Project Environment Sync-Suggestions Service Split

Purpose: split the cross-environment sync diff/apply orchestration out of the
over-limit `ProjectEnvironmentService` (1713 lines). Source inspection confirmed
`listSyncSuggestions` (read-only diff against a reference environment),
`getSyncApplyAccessScope`, and `applySyncSuggestions` (create-missing-service
skeletons + complete-deploy-config, dry-run or applied) form a self-contained
sync-suggestions boundary independent of environment CRUD, server binding, and
resource/CDN/secret copy. `syncFromProject` stays in the host because it
orchestrates `ensureDefaultsForProject` + `list` and has no tests. This slice
preserves the public controller API and every diff/apply behavior; to respect
the 200-line ceiling the boundary is split into a read service, an apply service,
and two pure-utils files.

| Task   | Status | Description                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F266.1 | done   | Map the sync-suggestions boundary, callers, helpers, and data flow.                                      | CodeGraph CLI is present but uninitialized; manual graph confirmed `listSyncSuggestions`/`getSyncApplyAccessScope`/`applySyncSuggestions` are called only by `ProjectEnvironmentController`; the diff/apply path depends on `repo.*` reads/writes, `auditEventService.create`, and the existing pure helpers in `project-environment-sync-diff.utils.ts` / `project-environment-audit.utils.ts`. |
| F266.2 | done   | Extract sync-suggestions into focused services + pure utils while preserving the public facade.          | New `ProjectEnvironmentSyncService` (174 lines, owns `listSyncSuggestions`) and `ProjectEnvironmentSyncApplyService` (198 lines, owns `applySyncSuggestions` + `getSyncApplyAccessScope`, depends on the read service); new pure `project-environment-sync.utils.ts` (181 lines: constants, types, profile builder, query-arg builders) and `project-environment-sync-step.utils.ts` (178 lines: dry-run/applied step builders, create payload, missing-field computation). `ProjectEnvironmentService` keeps one-line arrow-function delegates and drops ~494 lines; module registers both new providers; spec rewired to inject real `ProjectEnvironmentSyncService(repo)` and `ProjectEnvironmentSyncApplyService(repo, syncService, auditEventService)`. Host dropped from 1713 to 1197 lines. |
| F266.3 | done   | Run focused API verification and hygiene checks, then sync final evidence.                               | Focused project-environment Jest passed (34 tests, 2 suites, all 8 sync tests green): `/tmp/codex-tool-runs/svton/f266-jest-ceil-20260707.log`; API type-check passed (0 errors): `/tmp/codex-tool-runs/svton/f266-tc-ceil-20260707.log`; all 5 new sync files ≤200 lines (198/181/178/174/118); `git diff --check` clean; conflict-marker scan clean; single-quote API convention preserved.      |

## F267. Project Environment Resource-Copy Service Split

Purpose: split the ManagedResource + SecretKey cross-environment copy
orchestration out of the over-limit `ProjectEnvironmentService` (1197 lines).
Source inspection confirmed `copyResources` (~268 lines: per-resource and
per-secret dry-run/applied copy with dedup skips, server/credential assertions,
encrypted secret values, and an audit record) and `getResourceCopyAccessScope`
form a self-contained resource-copy boundary independent of environment CRUD,
sync-suggestions, and CDN/site copy. This slice preserves the public controller
API and every copy-step behavior; the step shaping and create payloads move to
a pure-utils file to respect the 200-line ceiling.

| Task   | Status | Description                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F267.1 | done   | Map the resource-copy boundary, callers, helpers, and data flow.                                         | CodeGraph CLI is present but uninitialized; manual graph confirmed `copyResources`/`getResourceCopyAccessScope` are called only by `ProjectEnvironmentController` and depend on `repo.findManagedResources`/`findSecretKeys`/`createManagedResource`/`createSecretKey`, `assertServer`/`assertTeamCredential`, `cryptoService.encryptCbc`, `auditEventService.create`, and `buildResourceCopyAuditInput`. |
| F267.2 | done   | Extract resource-copy into a focused service + pure utils while preserving the public facade.            | New `ProjectEnvironmentResourceCopyService` (197 lines, owns `copyResources` + `getResourceCopyAccessScope` + private `copyManagedResources`/`copySecrets`/`resolveProjectEnvironment`/`assertServer`/`assertTeamCredential`/`encryptSecretValue`) and pure `project-environment-resource-copy.utils.ts` (179 lines: skipped/planned/applied step builders for resource and secret, create payloads, result assembly). `ProjectEnvironmentService` keeps one-line arrow-function delegates, drops the `EnvironmentResourceCopyStep` type and ~278 lines, and the now-unused `buildResourceCopyAuditInput` import; module registers the new provider; spec rewired to inject a real `ProjectEnvironmentResourceCopyService(repo, cryptoService, auditEventService)`. Host dropped from 1197 to 916 lines. |
| F267.3 | done   | Run focused API verification and hygiene checks, then sync final evidence.                               | Focused project-environment Jest passed (34 tests, 2 suites, both resource-copy tests green): `/tmp/codex-tool-runs/svton/f267-jest-20260707.log`; API type-check passed (0 errors): `/tmp/codex-tool-runs/svton/f267-tc2-20260707.log`; both new files ≤200 lines (197/179); `git diff --check` clean; conflict-marker scan clean; single-quote API convention preserved.                       |

## Source-Backed Maps

Business logic map: environment workbench gap -> resource-control page context
filter -> managed resource inventory/binding -> connection probe/read-only query
or action run -> server/cloud executor boundary -> audit and approval records.

Organization map: `ResourceControlController` keeps HTTP routes;
`ResourceControlService` remains the compatibility facade for resource-control
business operations; `ResourceControlCapabilitiesService` owns the read-only
capabilities contract; executor, credential, inventory, and query helpers remain
in their focused subfolders.

Function map: capabilities describe available source types, executor adapters,
credential/auth adapters, credential profiles, query adapters, planned actions,
reusable svton libraries/resources, and safety notes for live execution.
Provider health functions now split into recent cloud sync-run read projection,
diagnostic parsing, failure/fallback signal scoring, and summary response
shaping.

Data-flow map: project/environment identifiers flow from URL or API queries into
resource filters and binding updates; managed resources carry optional
`projectId`/`environmentId`/credential bindings; action/query/connection runs
write auditable operation records without exposing credential material.

Page structure map: `/projects/[id]` surfaces environment gaps and contextual
entry links; `/resource-control` consumes capabilities plus projects,
environments, credentials, managed resources, action runs, connection runs, and
query runs to render inventory, binding, credential, query, and action panels.

## Next Candidates

- Continue splitting `ProjectEnvironmentService` (now 916 lines, still over
  the 200-line ceiling) by verified behavior boundary: environment
  CRUD/listing, sync-from-project, server binding, secret management, and
  CDN-config copy / bulk resource binding (the remaining copy/bind
  boundaries).
- Continue splitting `ResourceControlService` by verified behavior boundary:
  binding validation/write orchestration, query run orchestration, connection
  probe orchestration, action execution/approval orchestration, inventory sync,
  and resource metric summaries.
- Keep every split tied to the existing project/environment resource-control
  contract. Do not add new product behavior without TODO/roadmap evidence.
