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

## F268. Project Environment CDN-Config Copy Service Split

Purpose: split the CDN-config cross-environment copy orchestration out of the
over-limit `ProjectEnvironmentService` (916 lines). Source inspection confirmed
`copyCdnConfigs` (~157 lines: per-CDN dry-run/applied skeleton copy with
domain/origin/credential overrides and target-domain dedup skips, plus an audit
record) and `getCdnConfigCopyAccessScope` form a self-contained CDN-copy
boundary independent of environment CRUD, sync-suggestions, and resource/secret
copy. This slice preserves the public controller API and every CDN copy-step
behavior; the step shaping and create payload move to a pure-utils file.

| Task   | Status | Description                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F268.1 | done   | Map the CDN-copy boundary, callers, helpers, and data flow.                                              | CodeGraph CLI is present but uninitialized; manual graph confirmed `copyCdnConfigs`/`getCdnConfigCopyAccessScope` are called only by `ProjectEnvironmentController` and depend on `repo.findCDNConfigs`/`createCDNConfig`, `auditEventService.create`, `buildCdnConfigCopyAuditInput`, and `toJsonValue`. Unlike resource-copy, CDN copy does NOT assert credentials (writes the credentialId verbatim). |
| F268.2 | done   | Extract CDN-copy into a focused service + pure utils while preserving the public facade.                 | New `ProjectEnvironmentCdnCopyService` (120 lines, owns `copyCdnConfigs` + `getCdnConfigCopyAccessScope` + private `resolveProjectEnvironment`) and pure `project-environment-cdn-copy.utils.ts` (114 lines: skipped/planned/applied step builders, create payload, result assembly). `ProjectEnvironmentService` keeps one-line arrow-function delegates, drops the `EnvironmentCdnConfigCopyStep` type and ~167 lines, and the now-unused `buildCdnConfigCopyAuditInput` import; module registers the new provider; spec rewired to inject a real `ProjectEnvironmentCdnCopyService(repo, auditEventService)`. Host dropped from 916 to 747 lines. |
| F268.3 | done   | Run focused API verification and hygiene checks, then sync final evidence.                               | Focused project-environment Jest passed (34 tests, 2 suites, both CDN-copy tests green): `/tmp/codex-tool-runs/svton/f268-jest-20260707.log`; API type-check passed (0 errors): `/tmp/codex-tool-runs/svton/f268-tc1-20260707.log`; both new files ≤200 lines (120/114); `git diff --check` clean; conflict-marker scan clean; single-quote API convention preserved.                          |

## F269. Project Environment Bulk-Bind Service Split + Dead Crypto Cleanup

Purpose: split the bulk resource-binding orchestration out of the over-limit
`ProjectEnvironmentService` (747 lines), and clean up the now-unused crypto
surface flagged in the post-F268 gaps checklist. Source inspection confirmed
`bulkBindResources` (~167 lines: read unbound managed-resource / resource-instance
/ site / CDN / secret rows, build per-type binding steps, apply the environmentId
write, audit), `getResourceBulkBindingAccessScope`, and the private
`applyResourceEnvironmentBinding` (47 lines, only called by bulkBind) form a
self-contained bulk-bind boundary. Separately, the host `cryptoService` field +
`encryptSecretValue` private method + `CryptoService` import were dead after F267
(encryption now lives only in `ProjectEnvironmentResourceCopyService`); they and
the dead `DEFAULT_RESOURCE_BINDING_TYPES` constant are removed here.

| Task   | Status | Description                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F269.1 | done   | Map the bulk-bind boundary + crypto dead code.                                                           | CodeGraph CLI is present but uninitialized; manual graph confirmed `bulkBindResources`/`getResourceBulkBindingAccessScope` are called only by `ProjectEnvironmentController`, `applyResourceEnvironmentBinding` only by `bulkBindResources`, and depend on `repo.*` reads + `update*` writes, `normalizeResourceBindingTypes`, `resourceBindingStep`, `auditEventService.create`, `buildResourceBulkBindingAuditInput`. `cryptoService`/`encryptSecretValue` had no remaining host caller. |
| F269.2 | done   | Extract bulk-bind into a focused service + pure utils; clean up dead crypto + dead constant.             | New `ProjectEnvironmentBulkBindService` (101 lines, owns `bulkBindResources` + `getResourceBulkBindingAccessScope` + private `applyResourceEnvironmentBinding`/`resolveProjectEnvironment`/`unboundWhere`) and pure `project-environment-bulk-bind.utils.ts` (118 lines: per-type binding-step builders, id collection, result assembly). Host keeps one-line delegates, drops `EnvironmentResourceBindingType`/`EnvironmentResourceBindingStep` types, the dead `DEFAULT_RESOURCE_BINDING_TYPES` const, the now-unused `cryptoService` field + `encryptSecretValue` method + `CryptoService` import + 3 unused util imports; module registers the new provider; spec rewired to inject a real `ProjectEnvironmentBulkBindService(repo, auditEventService)` and drop the host `secretCrypto` arg (still used by `ProjectEnvironmentResourceCopyService`). Host dropped from 747 to 501 lines. |
| F269.3 | done   | Run focused API verification and hygiene checks, then sync final evidence.                               | Focused project-environment Jest passed (34 tests, 2 suites, all 4 bulk-bind tests green): `/tmp/codex-tool-runs/svton/f269-jest-20260707.log`; API type-check passed (0 errors): `/tmp/codex-tool-runs/svton/f269-tc1-20260707.log`; both new files ≤200 lines (101/118); `git diff --check` clean; conflict-marker scan clean; single-quote API convention preserved.                          |

## F270. Project Environment Defaults-Seeding Service Split

Purpose: split the environment defaults-seeding orchestration out of the
over-limit `ProjectEnvironmentService` (501 lines). Source inspection confirmed
the visible `ensureDefaultsForProject` body is ~30 lines (resolves
dev/test/staging/prod keys from project config, then issues per-key Prisma
upserts); it is consumed by the host `syncFromProject` and the spec. This slice
preserves the public method (as a one-line delegate), every upsert payload
(`source: project_config`, `initializedBy` string kept verbatim), and the
index-based `sortOrder: index * 10`.

| Task   | Status | Description                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F270.1 | done   | Map the defaults-seeding boundary.                                                                       | CodeGraph CLI is present but uninitialized; manual graph confirmed `ensureDefaultsForProject` is called by host `syncFromProject` and the spec (no controller route), depends only on `repo.upsertProjectEnvironment` + the pure helpers `environmentKeysFromConfig` / `labelForKey` / `toJsonValue`. The visible method body is 30 lines (the earlier ~149 estimate over-counted trailing shared private helpers). |
| F270.2 | done   | Extract defaults-seeding into a focused service + pure utils while preserving the public facade.         | New `ProjectEnvironmentDefaultsService` (23 lines, owns `ensureDefaultsForProject`) and pure `project-environment-defaults.utils.ts` (48 lines: `resolveSeedEnvironmentKeys`, `buildSeedUpsertArgs`). Host keeps a one-line arrow-function delegate, drops the inline body and the now-unused `environmentKeysFromConfigUtil` import; module registers the new provider; spec rewired to inject a real `ProjectEnvironmentDefaultsService(repo)`. The persisted `initializedBy: 'ProjectEnvironmentService.ensureDefaultsForProject'` string is preserved verbatim to avoid any stored-config drift. Host dropped from 501 to 474 lines. |
| F270.3 | done   | Run focused API verification and hygiene checks, then sync final evidence.                               | Focused project-environment Jest passed (34 tests, 2 suites, defaults-seeding tests green): `/tmp/codex-tool-runs/svton/f270-jest-20260707.log`; API type-check passed (0 errors): `/tmp/codex-tool-runs/svton/f270-tc1-20260707.log`; both new files ≤200 lines (23/48); `git diff --check` clean; conflict-marker scan clean; single-quote API convention preserved.                          |

## F271. Project Environment Server-Binding Service Split

Purpose: split the per-environment server role-binding lifecycle out of the
over-limit `ProjectEnvironmentService` (474 lines). Source inspection confirmed
`listServers`, `getAccessScope`, `bindServer`, and `unbindServer` form a
self-contained server-binding boundary; `getAccessScope` is also shared by the
host `update`/`archive` routes, so the host keeps a one-line delegate to the new
service's `getAccessScope`. Private helpers `assertServer`/`assertTeamCredential`/
`resolveProjectEnvironment` became dead in the host after this extract and are
removed; `get` and `assertProject` stay (still used by `update`/`archive`/`create`/
`syncFromProject`). This slice preserves the public controller API and every
bind/unbind/list behavior (including both audit events).

| Task   | Status | Description                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F271.1 | done   | Map the server-binding boundary + dead helpers.                                                          | CodeGraph CLI is present but uninitialized; manual graph confirmed the four server-binding methods are called only by `ProjectEnvironmentController`, depend on `repo.findProjectEnvironmentServers`/`upsertProjectEnvironmentServer`/`findProjectEnvironmentServer`/`deleteProjectEnvironmentServer`, `auditEventService.create`, `buildServerBindingAuditInput`, and private `get`/`assertServer`. `getAccessScope` is also called by `update`/`archive` (shared). `assertServer`/`assertTeamCredential`/`resolveProjectEnvironment` had no remaining host caller after extraction. |
| F271.2 | done   | Extract server-binding into a focused service while preserving the public facade; clean up dead helpers. | New `ProjectEnvironmentServerBindingService` (102 lines, owns `listServers` + `getAccessScope` + `bindServer` + `unbindServer` + private `get`/`assertServer`). Host keeps one-line arrow-function delegates (incl. `getAccessScope` → `serverBindingService.getAccessScope` for the shared `update`/`archive` routes), drops the 4 method bodies, the 3 now-dead private helpers, and the now-unused `buildServerBindingAuditInput` import; module registers the new provider; spec rewired to inject a real `ProjectEnvironmentServerBindingService(repo, auditEventService)`. Host dropped from 474 to 344 lines. |
| F271.3 | done   | Run focused API verification and hygiene checks, then sync final evidence.                               | Focused project-environment Jest passed (34 tests, 2 suites, bind/unbind tests green): `/tmp/codex-tool-runs/svton/f271-jest-20260707.log`; API type-check passed (0 errors): `/tmp/codex-tool-runs/svton/f271-tc1-20260707.log`; new file 102 lines (≤200); `git diff --check` clean; conflict-marker scan clean; single-quote API convention preserved.                          |

## F272. Project Environment CRUD Service Split + Host Ceiling Reached

Purpose: finish the project-environment god-service split. Extract the last
behavior boundary — environment CRUD (`list`/`create`/`update`/`archive`) +
`syncFromProject` — into a focused `ProjectEnvironmentCrudService`, move the
externally-consumed shared domain types into a dedicated `*.types.ts`, and
remove the remaining dead constants/helpers. After this slice the host
`ProjectEnvironmentService` is a 117-line pure delegation facade (≤200 ceiling).

| Task   | Status | Description                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F272.1 | done   | Map the CRUD/syncFromProject boundary + shared-type coupling.                                            | Manual graph confirmed `list`/`create`/`update`/`archive`/`syncFromProject` are the last real host logic; `syncFromProject` calls `ensureDefaultsForProject` + `list`; `get`/`assertProject` move with them. The host also declared the shared sync domain types (`EnvironmentSyncProfile`/`EnvironmentSyncDifferences`/`EnvironmentSyncSuggestionAction`/`DeployConfigCoverage`/`DeployConfigField`) consumed by sync.service/sync.utils/sync-diff.utils via `from './project-environment.service'`, plus dead `ENVIRONMENT_LABELS`/`DEFAULT_PROJECT_ENVIRONMENT_KEYS`/`isSafeUpstreamUrl`/`EnvironmentSiteCopyStep`/`SiteCopyQueuedLiveSync*` types. |
| F272.2 | done   | Extract CRUD service + shared types; reduce host to a thin facade.                                       | New `ProjectEnvironmentCrudService` (102 lines, owns the 5 methods + private `get`/`assertProject`, depends on `ProjectEnvironmentDefaultsService`) and `project-environment.types.ts` (85 lines, owns the 5 shared domain types). Host re-exports the types (`export * from './project-environment.types'`) so every existing import site + the barrel `index.ts` keep resolving; replaces the 5 method bodies + 2 helpers with one-line delegates; removes the dead constants/helpers and unused imports (`BadRequestException`/`NotFoundException`/`Prisma`/`buildSiteCopyAuditInput`/4 helper-utils). Module registers the new provider; spec rewired to inject a real `ProjectEnvironmentCrudService(repo, defaultsService)`. Host dropped from 344 to **117 lines**. |
| F272.3 | done   | Run focused API verification and hygiene checks, then sync final evidence.                               | Focused project-environment Jest passed (34 tests, 2 suites): `/tmp/codex-tool-runs/svton/f272-jest-20260707.log`; API type-check passed (0 errors): `/tmp/codex-tool-runs/svton/f272-tc1-20260707.log`; host 117 lines + both new files ≤200 lines (102/85); `git diff --check` clean; conflict-marker scan clean; single-quote API convention preserved. **Module split essentially complete:** every `.service.ts`/`.utils.ts`/`.types.ts` in the directory is now ≤200 lines (only `project-environment.controller.ts` at 385 remains over, flagged as a thin route layer). |

## Source-Backed Maps

The first map block tracks the **project-environment module itself** (the focus
of F261–F269). A second block retains the cross-cutting resource-control map.

### Project-environment module (current, post-F269)

Business logic map: project → ensure dev/test/staging/prod environments
(`ensureDefaultsForProject`) → per-environment ownership of servers, managed
resources, resource instances, CDN configs, secrets, application services,
deployment runs, and sites. Cross-environment operations: (a) sync diff against
a reference environment → apply create-missing-service / complete-deploy-config;
(b) copy sites / CDN configs / managed-resource+secret indices across
environments (dry-run or applied); (c) bulk-bind managed-resource /
resource-instance / site / CDN / secret to an environment; (d) bind/unbind
servers by role.

Organization map (file → responsibility, all ≤200 lines except host + controller):
- `project-environment.controller.ts` (385) — HTTP routes only.
- `project-environment.service.ts` (117) — pure delegation facade (one-line
  arrow-function delegates to every focused service). All real logic extracted
  in F265–F272.
- `project-environment.types.ts` (85) — shared sync domain types (moved off the
  facade in F272; re-exported by the facade + barrel for back-compat).
- `project-environment.repository.ts` (104) — Prisma access boundary.
- `project-environment-sync.service.ts` (174) — `listSyncSuggestions` read model.
- `project-environment-sync-apply.service.ts` (198) — `applySyncSuggestions` + `getSyncApplyAccessScope`.
- `project-environment-copy-site.service.ts` (99) — site copy + OpenResty takeover.
- `project-environment-resource-copy.service.ts` (197) — managed-resource + secret copy (owns encryption).
- `project-environment-cdn-copy.service.ts` (120) — CDN-config copy.
- `project-environment-bulk-bind.service.ts` (101) — bulk resource binding.
- `project-environment-defaults.service.ts` (23) — dev/test/staging/prod seeding.
- `project-environment-server-binding.service.ts` (102) — server role bind/unbind/list + access scope.
- `project-environment-crud.service.ts` (102) — environment list/create/update/archive + syncFromProject.
- Pure utils: `-helpers` (149), `-sync-diff` (118), `-sync` (181), `-sync-step` (178),
  `-resource-copy` (179), `-cdn-copy` (114), `-bulk-bind` (118), `-defaults` (48),
  `-audit` (93), `-copy` (75).

Function map: environment CRUD; ensure-defaults seeding; sync-suggestions read
+ apply; site/CDN/resource/secret cross-environment copy; bulk resource binding;
server role binding/unbinding. Each copy path produces skipped/planned/applied
steps with warnings + an audit event; none mutate real cloud resources.

Data-flow map: project/environment identifiers flow from URL/DTO into repo
where/select filters and create payloads; cross-environment copies read source
rows, dedup against target (domains / externalIds / secret names), and write
skeleton target rows (draft / pending / unknown) without copying live cloud
state or secret plaintext; every mutating apply writes an audit event via
`build*AuditInput`; secrets are encrypted via `cryptoService.encryptCbc`.

Page structure map (controller routes): `GET /project-environments` (list),
`POST /` (create), `PUT :id` (update), `DELETE :id` (archive),
`GET sync-suggestions` + `POST sync-suggestions/apply` (sync diff/apply),
`POST sync-from-project`, `POST resources/bulk-bind`, `POST sites/copy`,
`POST cdn-configs/copy`, `POST resources/copy`, `GET/POST/DELETE :id/servers`.
The `/projects/[id]` web workbench consumes these to surface environments,
gaps, and contextual entry links into resource-control/applications/sites.

### Cross-cutting resource-control (unchanged anchor)

Business logic map: environment workbench gap -> resource-control page context
filter -> managed resource inventory/binding -> connection probe/read-only query
or action run -> server/cloud executor boundary -> audit and approval records.
Organization: `ResourceControlController` (routes) + `ResourceControlService`
(facade) + `ResourceControlCapabilitiesService` (read-only capabilities) +
`ResourceControlCloudProviderHealthService` + focused executor/credential/
inventory/query subfolders.

## Gaps Identified From The Module Maps (post-F272)

- **Host ceiling — RESOLVED in F272:** `project-environment.service.ts` is now
  117 lines (a pure delegation facade), ≤200. The project-environment
  god-service split is essentially complete: every `.service.ts`/`.utils.ts`/
  `.types.ts` in the directory is ≤200 lines.
- **Controller size (only remaining over-ceiling file):**
  `project-environment.controller.ts` is 385 lines; it is a thin route layer
  (no business logic) but exceeds the ceiling. A future slice could split
  access-scope handlers from write handlers, or split by resource family.
- **No behavioral test gaps added:** all extracted boundaries retain their
  pre-existing behavioral coverage (34/34 spec tests green through F272);
  `getSyncApplyAccessScope`, `syncFromProject`, `listServers`, and the access-scope
  resolvers remain untested (pre-existing gap, not introduced by these slices).

## Next Candidates

- **project-environment module: essentially complete.** Optional polish: split
  the 385-line controller, and add tests for the untested access-scope resolvers.
- **Move to the next module (逐模块).** Per the cross-module goal, the next
  candidates are in other modules: `ResourceControlService` (binding/query/
  connection/action/inventory/metric boundaries), then site / monitoring /
  log-center / ops-governance god services.
- Keep every split tied to the existing project/environment resource-control
  contract. Do not add new product behavior without TODO/roadmap evidence.
