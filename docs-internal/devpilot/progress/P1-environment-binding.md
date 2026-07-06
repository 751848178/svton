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

- Continue splitting `ResourceControlService` by verified behavior boundary:
  binding validation/write orchestration, query run orchestration, connection
  probe orchestration, action execution/approval orchestration, inventory sync,
  and resource metric summaries.
- Keep every split tied to the existing project/environment resource-control
  contract. Do not add new product behavior without TODO/roadmap evidence.
