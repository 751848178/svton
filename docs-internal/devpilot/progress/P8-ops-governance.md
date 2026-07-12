# P8. Security and Operations Governance Progress

## Goal

P8 covers Devpilot's control-plane governance for approvals, access policies,
audits, Server executor job/lease/queue lifecycle, execution supervisor
visibility, server-agent readiness, and safe operations handoff.

## Current Status

- Roadmap status: approval gating, command policies, live execution leases,
  execution jobs, queue/retry/cancel/stale recovery, remote cleanup metadata,
  audit visibility, server-agent dispatcher boundary, runtime health, and
  task-pull readiness skeleton plus read-only log-follow job sample hints,
  default-off task-pull claim/ack/terminal writeback boundaries, minimal log
  collection finish sync, non-log business-run finish sync, a claimed task
  payload envelope, terminal command-plan fallback, terminal result fallback,
  ack cancellation hints, ack progress writeback, supervisor progress
  visibility, a claimed task lifecycle envelope, and task-pull lifecycle
  contract discovery with claim-field alignment, the CLI task-pull once runner,
  a bounded CLI task-pull poll runner, optional CLI heartbeat writeback,
  CLI graceful stop, CLI command-step cancellation, CLI once signal wiring, CLI
  abortable poll sleep, CLI command-step force kill, CLI in-step ack renewal,
  CLI timeout terminal summaries, CLI optional timeout semantics, CLI final ack
  cancellation handling, configurable CLI ack renewal intervals, a CLI
  foreground runtime profile summary for runner/heartbeat/pid-file operability,
  and a local CLI terminal runtime proof across claim, command execution,
  ack/progress, and finish payload writeback are present in the current control
  plane.
- Remaining product/runtime gaps from the S003 source-backed backlog are now
  closed through S004-S008 proof/verification slices. Background
  process-manager integration for foreground agents remains an
  operator/deployment risk outside the current repo-owned task-pull runtime
  scope. Post-S008 final gate S009 passed and Devpilot is deliverable with the
  documented residual deployment/operator risks.
- Recent verified contract slice: F128 repaired execution-governance scope type
  exports and `useExecutionGovernance(scope)` parameter contract.
- Current source-backed structure result: F150 split worker/queue, remote
  orphan, execution audit, and agent supervisor snapshot domains into focused
  `.types.ts` files; `supervisor.ts` remains the top-level
  `ServerExecutionSupervisorSnapshot` entry and is now 29 lines.
- Current source-backed view result: F151 split the read-only supervisor panel
  into focused summary, worker process, agent readiness, queue coordination,
  remote orphan, execution audit, owner sample, and format utility files;
  `supervisor-panel.tsx` is now the 38-line composition entry.

## F150. Execution Governance Supervisor Type Structure Slice

Purpose: continue P8 execution governance structure work from the source-backed
over-limit supervisor DTO surface. This slice must preserve the exported
`ServerExecutionSupervisorSnapshot` contract and every nested field while moving
focused snapshot shapes into dedicated `.types.ts` files.

| Task   | Status | Description                                                                                          | Evidence                                                                                                                                                                                                                                             |
| ------ | ------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F150.1 | done   | Build a source-backed map of `supervisor.ts`, its consumers, nested data domains, and tests.         | CodeGraph CLI exists but is not initialized; manual graph confirmed only `use-execution-governance.ts` and `SupervisorPanel` import `ServerExecutionSupervisorSnapshot`, and `supervisor-panel.tsx` indexed access stays behind that top-level type. |
| F150.2 | done   | Split worker/queue, remote orphan, audit, and agent supervisor type domains into focused type files. | `supervisor.ts` now imports focused worker, remote-orphan, audit, agent-readiness, agent, and common type files; every touched source file is under 200 lines and the exported top-level interface name is unchanged.                                |
| F150.3 | done   | Sync TODO/progress docs and run targeted Web verification plus hygiene checks.                       | Touched Prettier, touched ESLint, Web build, Web type-check, source line-count, diff check, conflict-marker scan, and trailing-whitespace scan passed; key logs are under `/tmp/codex-tool-runs/svton/f150-*`.                                       |

## F151. Execution Governance Supervisor Panel View Slice

Purpose: continue P8 execution governance structure work by splitting the
remaining source-backed over-limit supervisor view. `supervisor-panel.tsx` is
1141 lines and renders summary metrics, worker process, agent readiness,
worker owners, queue coordination, remote orphan governance, execution audit
visibility, agent jobs, and agent fleet sections.

| Task   | Status | Description                                                                                                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ------ | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F151.1 | done   | Build a source-backed map of `SupervisorPanel`, section boundaries, labels, helpers, and validation targets. | CodeGraph CLI exists but is not initialized; manual graph confirmed `SupervisorPanel` renders summary metrics, worker process, agent readiness, worker owners, queue coordination, remote orphan governance, execution audit visibility, agent jobs, runtime health, agent fleet, and owner samples.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| F151.2 | done   | Extract the smallest confirmed read-only section components while preserving labels, cards, and type access. | `supervisor-panel.tsx` now composes focused child components; agent/worker/orphan/audit labels and status readers moved into pure format utils; `ServerExecutionSupervisorSnapshot`, hook state, UI labels, status badges, and read-only field access are preserved.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| F151.3 | done   | Sync TODO/progress docs and run targeted Web verification plus hygiene checks.                               | Prettier, execution-governance ESLint, Web build, Web type-check, source line-count, diff check, conflict-marker scan, and trailing-whitespace scan passed. Key logs: `/tmp/codex-tool-runs/svton/f151-prettier-20260703-175737.log`, `/tmp/codex-tool-runs/svton/f151-eslint-execution-governance-20260703-175839.log`, `/tmp/codex-tool-runs/svton/f151-web-build-20260703-175808.log`, `/tmp/codex-tool-runs/svton/f151-web-type-check-20260703-175826.log`, `/tmp/codex-tool-runs/svton/f151-final-line-count-source-20260703-180112.log`, `/tmp/codex-tool-runs/svton/f151-final-diff-check-20260703-180112.log`, `/tmp/codex-tool-runs/svton/f151-final-conflict-marker-scan-20260703-180112.log`, `/tmp/codex-tool-runs/svton/f151-final-trailing-whitespace-scan-20260703-180112.log`. |

## F185. API Contract Baseline Repair For Approval/Resource Scopes

Purpose: keep P8 verification usable by repairing the current API type-check
baseline instead of carrying the same unrelated errors through every slice. The
source-backed error set is limited to operation approval list filters,
resource-control scoped query DTOs, and resource-pool read authorization
contracts. This slice preserves existing execution, allocation, and live
resource behavior; it only realigns DTO/query/controller contracts with the
project/environment access-control model.

| Task   | Status | Description                                                                        | Evidence                                                                                                                                                                                                                                  |
| ------ | ------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F185.1 | done   | Confirm the current type-check baseline and build a manual graph of affected code. | API type-check log shows only operation-approval/resource-control/resource-pool TS errors; CodeGraph CLI is present but uninitialized.                                                                                                    |
| F185.2 | done   | Repair DTO/query/controller contracts without widening runtime mutation behavior.  | Operation approval filters now include `action/targetType`; resource-control services reuse query builders and focused scope DTOs; resource-pool read routes enforce read policy and user allocations stay team-scoped.                   |
| F185.3 | done   | Run focused Jest, API type-check, and hygiene checks, then sync docs.              | Focused Jest passed: `/tmp/codex-tool-runs/svton/f185-focused-jest-final2-20260704-154230.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f185-api-type-check-final2-20260704-154230.log`; diff/conflict/trailing checks passed. |

## F186. Resource Pool Access Delegate Split

Purpose: continue P8 access-governance structure work after F185. Source
inspection shows `ResourcePoolController` now owns route handling plus resource
pool read filtering, pool detail read assertions, project allocation read
assertions, and self-service allocation/release write assertions. The controller
is at the 200-line ceiling and mixes HTTP orchestration with access request
assembly. This slice extracts a focused access service, preserves every
resource-pool API behavior, and keeps allocation/release runtime semantics
unchanged.

| Task   | Status | Description                                                                  | Evidence                                                                                                                                                                                                                                                                                                                                        |
| ------ | ------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F186.1 | done   | Build a source-backed map of resource-pool routes, access checks, and tests. | Manual graph confirmed controller access calls and module wiring; CodeGraph CLI is present but uninitialized.                                                                                                                                                                                                                                   |
| F186.2 | done   | Extract resource-pool access request assembly into a focused service.        | `ResourcePoolAccessService` now owns pool read filtering, pool/project-allocation read assertions, and allocate/release self-service write assertions; controller is a 144-line route orchestration entry.                                                                                                                                      |
| F186.3 | done   | Run focused Jest, API type-check/build, and hygiene checks, then sync docs.  | Focused Jest passed: `/tmp/codex-tool-runs/svton/f186-resource-pool-jest-final-20260704-155030.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f186-api-type-check-final-20260704-155030.log`; API build passed: `/tmp/codex-tool-runs/svton/f186-api-build-final-20260704-155030.log`; Prettier/diff/conflict/trailing checks passed. |

## F187. Resource Pool Response Mapping Split

Purpose: continue the resource-pool governance cleanup after F186. Source
inspection shows `ResourcePoolService` still mixes persistence orchestration,
allocation lifecycle, provisioning/deprovisioning, local record shape
definitions, and response mapping. This slice extracts only the response mapping
and record types into focused files, preserving all pool CRUD, allocation,
release, encryption, and provisioning behavior.

| Task   | Status | Description                                                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | ------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F187.1 | done   | Build a source-backed map of resource-pool service response mapping seams.  | Manual graph confirmed `formatPoolResponse()` plus detail/project/user allocation maps are pure mapping seams; CodeGraph CLI is present but uninitialized.                                                                                                                                                                                                                                                                                                                        |
| F187.2 | done   | Extract resource-pool record types and response mapping into focused files. | `resource-pool.types.ts` now owns `ResourcePoolRecord`/`ResourceAllocationRecord`; `resource-pool-response.utils.ts` owns pool/detail/project/user response mapping; `ResourcePoolService` delegates output mapping while preserving CRUD, allocation, release, encryption, and provisioning behavior.                                                                                                                                                                            |
| F187.3 | done   | Run focused Jest, API type-check/build, and hygiene checks, then sync docs. | Focused Jest passed: `/tmp/codex-tool-runs/svton/f187-resource-pool-jest-final-20260704-160120.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f187-api-type-check-final-20260704-160120.log`; API build passed: `/tmp/codex-tool-runs/svton/f187-api-build-final-20260704-160120.log`; focused Prettier, diff check, conflict marker scan, and trailing whitespace scan passed; `ResourcePoolService` remains 425 lines and needs later lifecycle/orchestration splits. |

## F188. Resource Pool Allocation Lifecycle Split

Purpose: continue the resource-pool governance cleanup from F187. Source
inspection shows allocation/release lifecycle orchestration, provisioning
execution, credential encryption, capacity transitions, and pool read/update
paths still live in `ResourcePoolService`. This slice extracts allocation
lifecycle orchestration and provider-style provisioning execution into focused
services while preserving the existing resource-pool API contract and transaction
semantics.

| Task   | Status | Description                                                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------ | ------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F188.1 | done   | Build a source-backed map of allocation/release lifecycle seams.            | Manual graph confirmed controller delegates only to `ResourcePoolService.allocateResource/releaseResource`; lifecycle code spans pool lookup, capacity validation, provisioning, allocation credential encryption, and release transaction; CodeGraph CLI is present but uninitialized.                                                                                                                                                                                         |
| F188.2 | done   | Extract allocation lifecycle and provisioning execution into focused files. | `ResourcePoolAllocationLifecycleService` now owns pool lookup, active/full validation, allocation credential encryption, allocation transaction, release deprovisioning, and release transaction; `ResourcePoolProvisioningService` owns generated resource names, endpoint parsing, mock credential materialization, and deprovision logging; `ResourcePoolAccessService` owns allocation access-scope lookup; `ResourcePoolService` is a 197-line CRUD/read/delegation entry. |
| F188.3 | done   | Run focused Jest, API type-check/build, and hygiene checks, then sync docs. | Focused Jest passed: `/tmp/codex-tool-runs/svton/f188-resource-pool-jest-20260704-1617.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f188-api-type-check-20260704-1617.log`; API build passed: `/tmp/codex-tool-runs/svton/f188-api-build-20260704-1617.log`; focused Prettier check passed; line-count confirmed service/access/lifecycle/provisioning files are all under 200 lines.                                                                               |

## F189. Resource Pool Repository Boundary Split

Purpose: continue the resource-pool governance cleanup from F188. Source
inspection shows `ResourcePoolService`, `ResourcePoolAccessService`, and
`ResourcePoolAllocationLifecycleService` still directly encode Prisma
`resourcePool`, `resourceAllocation`, and project scope query shapes. This slice
extracts a focused repository boundary so services own business orchestration and
policy input assembly while persistence details are isolated.

| Task   | Status | Description                                                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F189.1 | done   | Build a source-backed map of resource-pool persistence seams.               | Manual graph confirmed Prisma calls in `ResourcePoolService`, `ResourcePoolAccessService`, and `ResourcePoolAllocationLifecycleService`; no existing API `*.repository.ts` files were found; CodeGraph CLI is present but uninitialized.                                                                                                                                                                     |
| F189.2 | done   | Extract resource-pool persistence into a focused repository.                | `ResourcePoolRepository` now owns resource-pool CRUD/read queries, allocation transaction writes, release transaction writes, project/allocation access-scope lookups, and allocation list queries; `ResourcePoolService`, `ResourcePoolAccessService`, and `ResourcePoolAllocationLifecycleService` now depend on repository methods instead of Prisma shapes.                                              |
| F189.3 | done   | Run focused Jest, API type-check/build, and hygiene checks, then sync docs. | Focused Jest passed: `/tmp/codex-tool-runs/svton/f189-resource-pool-jest-20260704-1612.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f189-api-type-check-20260704-1612.log`; API build passed: `/tmp/codex-tool-runs/svton/f189-api-build-20260704-1612.log`; focused Prettier write passed; line-count confirmed service/access/lifecycle/provisioning/repository files are all under 200 lines. |

## F190. Execution Governance Job View Split

Purpose: return to the P8 execution-governance frontend map after the
resource-pool backend cleanup. Source inspection shows `job-list.tsx` (202
lines) mixes section shell, status metrics, table skeleton, row details, and row
actions; `job-summaries.tsx` (207 lines) mixes execution target, Agent dispatch,
remote execution, and cleanup line summaries. This slice extracts focused view
components without changing data hooks, API calls, filters, table columns, or
button behavior.

| Task   | Status | Description                                                         | Evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F190.1 | done   | Build a source-backed map of job list and summary view seams.       | Manual graph confirmed `JobList` is consumed by execution-governance page/content, `job-list.tsx` owns row details/actions, and `job-summaries.tsx` owns four summary shapes; CodeGraph CLI is present but uninitialized.                                                                                                                                                                  |
| F190.2 | done   | Extract job row and Agent dispatch summary into focused components. | `JobTableRow` now owns job row status/server/action/timing/button rendering; `AgentDispatchSummary` now lives in `job-agent-dispatch-summary.component.tsx` and is re-exported from `job-summaries.tsx`; `job-list.tsx` is a 128-line section/table orchestration entry and `job-summaries.tsx` is a 116-line execution-target/remote-cleanup summary file.                                |
| F190.3 | done   | Run focused Web verification and hygiene checks, then sync docs.    | Web type-check passed: `/tmp/codex-tool-runs/svton/f190-web-type-check-20260704-1627.log`; Web build passed: `/tmp/codex-tool-runs/svton/f190-web-build-20260704-1627.log` with existing unrelated `MISSING_MESSAGE` warnings for `nav.*`/`common.login` zh keys; focused Prettier write passed; line-count confirmed touched execution-governance job view files are all under 200 lines. |

## F191. Server Command Policy Structure Split

Purpose: continue the P8 execution/security governance cleanup on the API side.
Source inspection shows `server-command-policy.service.ts` (731 lines) still
mixes built-in command allowlist constants, dangerous command rules, template
CRUD, template persistence/query matching, binding validation, and execution
policy evaluation. This slice extracts focused rule constants and template
service/repository boundaries while keeping command policy decisions, template
API behavior, and `ServerCommandPolicyService` consumers unchanged.

| Task   | Status | Description                                                                  | Evidence                                                                                                                                                                                                                                                                                                                                                                |
| ------ | ------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F191.1 | done   | Build a source-backed map of command policy responsibilities and consumers.  | CodeGraph CLI is present but uninitialized; manual graph confirmed template controller and server-executor consumers depend on `ServerCommandPolicyService`, while the 731-line file mixed built-in rules, template CRUD/persistence, binding validation, and execution policy evaluation.                                                                              |
| F191.2 | done   | Extract built-in rule constants and template persistence/service boundaries. | Built-in command rules now live in focused domain constants; `ServerCommandPolicyTemplateRepository` owns Prisma reads/writes; `ServerCommandPolicyTemplateService` owns template CRUD/validation; `ServerCommandPolicyTemplateMatcherService` owns runtime template scope/pattern matching; `ServerCommandPolicyService` is a 179-line public facade/evaluator.        |
| F191.3 | done   | Run focused API verification and hygiene checks, then sync docs.             | Focused Jest passed: `/tmp/codex-tool-runs/svton/f191-command-policy-jest-20260704-1708.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f191-api-type-check-20260704-1709.log`; API build passed: `/tmp/codex-tool-runs/svton/f191-api-build-20260704-1710.log`; Prettier/diff/conflict/trailing hygiene passed; touched source files are all under 200 lines. |

## F192. Server Agent Adapter Boundary Split

Purpose: continue P8 server-executor governance by shrinking the default-off
Server agent transport boundary. Source inspection shows
`adapters/server-agent.adapter.ts` (500 lines) mixes the adapter public contract,
dry-run/live blocked result assembly, dispatch envelope/plan building,
correlation/header/config reads, dispatcher response parsing, and JSON/redaction
helpers. This slice extracts focused adapter helpers while keeping
`ServerAgentServerExecutorAdapter` public behavior, dispatcher HTTP contract,
correlation/idempotency evidence, and default-off live safety gates unchanged.

| Task   | Status | Description                                                         | Evidence                                                                                                                                                                                                                                                                                                                                               |
| ------ | ------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F192.1 | done   | Build a source-backed map of Server agent adapter responsibilities. | CodeGraph CLI is present but uninitialized; manual graph confirmed `ServerAgentServerExecutorAdapter` is consumed by module DI and server-executor service tests, while the 500-line adapter mixed execute branch orchestration, result assembly, dispatch plan/envelope shaping, config/header reads, dispatcher parsing, and JSON/redaction helpers. |
| F192.2 | done   | Extract dispatch plan/envelope, config/header, and parser helpers.  | `server-agent.adapter.ts` is now a 178-line execution-flow adapter; dispatch plan/envelope/correlation, config/header/default-off gates, dispatcher response/error parsing, and result assembly now live in focused helper files, preserving constructor, `supports()`, `execute()` result shape, default-off gates, and HTTP dispatcher contract.     |
| F192.3 | done   | Run focused adapter/API verification and hygiene checks.            | Focused Jest passed: `/tmp/codex-tool-runs/svton/f192-server-agent-adapter-jest-20260704-1735.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f192-api-type-check-20260704-1736.log`; API build passed: `/tmp/codex-tool-runs/svton/f192-api-build-20260704-1736.log`; Prettier and line-count checks passed for touched adapter files.       |

## F193. SSH Live Adapter Boundary Split

Purpose: continue P8 server-executor governance by shrinking the default-off
SSH live transport boundary. Source inspection shows `adapters/ssh-live.adapter.ts`
(628 lines) mixes the adapter public contract, live result assembly, remote
wrapper script generation, PID marker parsing, SSH transport execution, runtime
observer metadata, stale remote cleanup, and timeout/config helpers. This slice
extracts focused helpers while keeping SSH live support, confirmation/default-off
gates, remote PID cleanup metadata, and `cleanupRemoteExecutionSession()` behavior
unchanged.

Source-backed maps:

- Business logic: `supports()` remains the default-off SSH live gate; `execute()`
  builds the command plan, blocks missing confirmation/config/server/key-auth
  cases, runs the remote wrapper through SSH, and converts cancelled/completed
  transport results into `ServerExecutionResult`; `cleanupRemoteExecutionSession()`
  validates stale SSH session metadata and kills the remote process tree.
- Organization: `ssh-live.adapter.ts` is the public adapter boundary; result,
  completed-result, script, config, runner, runtime-observer, transport, json, and
  shared type helpers now own one responsibility each.
- Capability map: live SSH support, confirmation/default-off gates, key-auth-only
  protection, remote PID capture, cancellation cleanup, runtime observer
  metadata, and stale remote cleanup stay available with no product-surface
  expansion.
- Data flow: `ServerExecutionInput` -> command plan -> credentials -> SSH wrapped
  script -> PID/control marker parsing -> observer metadata/result detail ->
  `ServerExecutionResult`; stale recovery flows from saved remote session metadata
  -> decrypted SSH credentials -> remote kill command -> cleanup audit result.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                     | Evidence                                                                                                                                                                                                                                                                                                                                                                    |
| ------ | ------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F193.1 | done   | Build a source-backed map of SSH live adapter responsibilities. | CodeGraph CLI is present but uninitialized; manual graph is focused on `ssh-live.adapter.ts`, SSH adapter specs, server-executor cleanup consumers, and the maps above.                                                                                                                                                                                                     |
| F193.2 | done   | Extract SSH live result, script, config, and runner helpers.    | `ssh-live.adapter.ts` is 198 lines; helpers own result assembly, script/control markers, config, transport/runner, observer, json, and shared result types while preserving constructor, `supports()`, `execute()`, `cleanupRemoteExecutionSession()`, remote observer metadata, and remote kill command semantics.                                                         |
| F193.3 | done   | Run focused SSH adapter/API verification and hygiene checks.    | Passed: `/tmp/codex-tool-runs/svton/f193-ssh-live-adapter-jest-20260704-1749.log`, `/tmp/codex-tool-runs/svton/f193-api-type-check-20260704-1749.log`, `/tmp/codex-tool-runs/svton/f193-api-build-20260704-1749.log`, `/tmp/codex-tool-runs/svton/f193-prettier-write-20260704-1748.log`; final hygiene: `/tmp/codex-tool-runs/svton/f193-final-hygiene-20260704-1657.log`. |

## F194. Server Executor Supervisor Snapshot Service Split

Purpose: continue P8 server-executor governance by extracting the supervisor
snapshot read-model from the over-limit `server-executor.service.ts` (5845 lines
at slice start). Source inspection confirmed `getSupervisorSnapshot(teamId)` and
~14 `summarize*` helpers (worker locks, execution-audit visibility, worker
inventory, queue-coordination/remote-orphan preflight, agent readiness/runtime
health/fleet/blocked-reasons/lifecycle-preflight/task-pull-readiness) plus the
inline 24-query Prisma block and snapshot record types all lived in the monolith.
This slice preserves the public `getSupervisorSnapshot()` contract on
`ServerExecutorService` (now a one-line delegate) and every HTTP/test behavior.

Source-backed maps:

- Business logic: `ServerExecutionJobController` calls
  `ServerExecutorService.getSupervisorSnapshot(teamId)`, which delegates to
  `ServerExecutorSupervisorService.buildSnapshot(teamId, host)`; the host is the
  executor service itself (structural typing, no circular DI).
- Organization: `server-executor.service.ts` stays the execution/lease/agent
  domain owner and exposes config/capability readers the supervisor needs;
  `server-executor-supervisor.service.ts` is the read-model assembly entry;
  focused summary services own one read domain each (worker, inventory,
  queue-coordination, remote-orphan, agent-readiness, agent-fleet,
  agent-blocked-reasons, agent-lifecycle, agent-task-pull); pure readers and
  builders live in `*.utils.ts`/`*.types.ts`.
- Capability map: snapshot read, lease expiry, worker inventory, queue
  coordination preflight, remote-orphan governance preflight, execution-audit
  visibility, agent readiness/runtime-health/fleet/blocked-reasons,
  lifecycle-preflight, and task-pull-readiness stay available with no
  product-surface expansion.
- Data flow: HTTP `GET .../supervisor` → delegate → supervisor orchestrator →
  query service (jobs/leases/servers/audit) → focused summary services →
  assembled `ServerExecutionSupervisorSnapshot`; the host executor supplies
  worker identity, queue/agent config, dispatcher config, and agent
  capability/runtime reads.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                                                                       | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------ | ------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F194.1 | done   | Build a source-backed map of supervisor snapshot domains, summarize closures, shared helpers, and consumers.      | CodeGraph CLI is present but uninitialized; manual graph confirmed `getSupervisorSnapshot` is consumed only by `ServerExecutionJobController`, the ~14 `summarize*` helpers were snapshot-only, and the shared `readServerAgentCapability`/`readServerAgentRuntime`/`readServerAgentRuntimeHealth`/`readServerAgentDispatcherConfig`/config readers are also used by `resolveTarget`/`readServerAgentTaskPullContract`.                                                                                                                                                                                                |
| F194.2 | done   | Extract snapshot read-model into focused supervisor services/utils while preserving the public snapshot contract. | `server-executor-supervisor.service.ts` (assembly), `*-query.service.ts` (jobs/agent-jobs/leases/servers+audit), `*-worker-summary`/`*-inventory-summary`/`*-queue-coordination-summary`/`*-remote-orphan-summary`/`*-agent-readiness-summary`/`*-agent-fleet-summary`/`*-agent-blocked-reasons-summary`/`*-agent-lifecycle-summary`/`*-agent-task-pull-summary` services, plus `*.utils.ts`/`*.types.ts` readers/builders; `ServerExecutorService.getSupervisorSnapshot()` is a one-line delegate and all touched/new source files are under 200 lines. `server-executor.service.ts` dropped from 5845 to 4088 lines. |
| F194.3 | done   | Run focused Jest, API type-check/build, and hygiene checks, then sync docs.                                       | Focused server-executor Jest passed (47 tests, 5 suites): `/tmp/codex-tool-runs/svton/f194-jest-final2-20260704.log`; API type-check passed (0 errors): `/tmp/codex-tool-runs/svton/f194-api-type-check-final3-20260704.log`; API build passed: `/tmp/codex-tool-runs/svton/f194-api-build-final-20260704.log`; Prettier check, diff check, conflict-marker scan, and trailing-whitespace scan all clean.                                                                                                                                                                                                              |

## F195. Server Agent Capability Service Split

Purpose: continue P8 server-executor governance by decoupling the shared
agent-capability reads from the over-limit `server-executor.service.ts` (4088
lines at F194 close). Source inspection confirmed
`readServerAgentCapability`, `readServerAgentRuntime`, `readServerAgentRuntimeHealth`,
`readServerAgentDispatcherConfig`, and the heartbeat/dispatcher config readers were
duplicated as methods on `ServerExecutorService` and (via the supervisor host
interface) re-exposed to the supervisor snapshot. This slice extracts them into a
shared `ServerAgentCapabilityService` so `resolveTarget`,
`readServerAgentTaskPullContract`, `recordServerAgentHeartbeat`, and the supervisor
host all read through one boundary, removing the duplication and shrinking the
monolith.

Source-backed maps:

- Business logic: `resolveTarget` reads capability + runtime eligibility to choose
  `server_agent` vs `ssh` transport; `readServerAgentTaskPullContract` reads
  capability + runtime + heartbeat-required to assemble the read-only contract;
  `recordServerAgentHeartbeat` reads heartbeat-enabled for authorization;
  `getSupervisorSnapshot` (via the supervisor host) reads dispatcher config and
  heartbeat config for the agent readiness/fleet/lifecycle/task-pull summaries.
- Organization: `server-agent-capability.service.ts` owns capability/runtime/runtime-health reads (delegating to the existing pure utils) plus heartbeat/dispatcher config reads from `ConfigService`; `server-executor.service.ts` keeps execution/lease/heartbeat/task-pull orchestration and delegates capability reads to the new service; the supervisor host interface now exposes a `capability` accessor instead of individual methods.
- Capability map: capability read, runtime read, runtime-health read, dispatcher config read, heartbeat config reads, and target-runtime-eligibility stay available with no product-surface expansion.
- Data flow: `resolveTarget`/`readServerAgentTaskPullContract`/`recordServerAgentHeartbeat` -> `agentCapabilityService.*`; supervisor snapshot -> `host.capability.*`.
- Page structure: no Web page or interaction surface changes in this backend structure slice.

| Task   | Status | Description                                                                           | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F195.1 | done   | Build a source-backed map of agent-capability reads, config readers, and all callers. | CodeGraph CLI is present but uninitialized; manual graph confirmed the capability/runtime/dispatcher-config reads and heartbeat config readers were called by `resolveTarget`, `readServerAgentTaskPullContract`, `recordServerAgentHeartbeat` (auth), `normalizeServerAgentHeartbeatTtlSeconds`, and the supervisor snapshot host interface.                                                                                                                                                                                                                                                                                                                                |
| F195.2 | done   | Extract shared `ServerAgentCapabilityService` and rewire all callers.                 | `server-agent-capability.service.ts` (148 lines) owns `readCapability`/`readRuntime`/`readRuntimeHealth`/`isTargetRuntimeEligible`/`readDispatcherConfig`/`heartbeatEnabled`/`heartbeatTokenConfigured`/`heartbeatRequiredForTargetSelection`/`heartbeatDefaultTtlSeconds`; `ServerExecutorService` injects it, exposes a `capability` accessor, and `resolveTarget`/`readServerAgentTaskPullContract`/`recordServerAgentHeartbeat`/`normalizeServerAgentHeartbeatTtlSeconds` call through it; the supervisor host interface exposes `capability` and readiness/agent-summary callers use `host.capability.*`. `server-executor.service.ts` dropped from 4088 to 3974 lines. |
| F195.3 | done   | Run focused Jest, API type-check/build, and hygiene checks, then sync docs.           | Focused server-executor Jest passed (47 tests, 5 suites): `/tmp/codex-tool-runs/svton/f195-final-jest-20260704.log`; API type-check passed (0 errors): `/tmp/codex-tool-runs/svton/f195-final-tc-20260704.log`; API build passed: `/tmp/codex-tool-runs/svton/f195-final-build-20260704.log`; Prettier check, diff check, conflict-marker scan, and trailing-whitespace scan all clean.                                                                                                                                                                                                                                                                                      |

## F196. Server Executor JSON Reader Utility Split

Purpose: continue P8 server-executor governance by moving the remaining
stateless JSON/snapshot reader helpers out of the over-limit
`server-executor.service.ts` (3974 lines at F195 close). Source inspection
confirmed the bottom helper group reads record/string/number/boolean/date/list
values and clones Prisma JSON values for job metadata, remote execution
metadata, dispatch audit details, task-pull snapshots, and business-run sync
payloads. This slice extracts only those pure helpers into a focused
`*.utils.ts`, preserving execution orchestration, job lifecycle, queue/lease
behavior, adapter behavior, agent heartbeat/task-pull contracts, supervisor
snapshot, HTTP routes, and Web UI behavior.

Source-backed maps:

- Business logic: queue/job/adapter/business-run flows continue to call the same
  parsing semantics; only the stateless reader location changes.
- Organization: `server-executor.service.ts` keeps orchestration and persistence
  decisions; `server-executor-json.utils.ts` owns pure record, scalar, array,
  date, and JSON-value helpers.
- Capability map: job metadata hydration, remote execution cleanup metadata,
  dispatch audit summaries, task-pull snapshot rehydration, and business-run
  sync payload writes stay available with no product-surface expansion.
- Data flow: Prisma JSON/metadata/result payloads -> focused reader utilities ->
  existing service orchestration and write paths.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                                                | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | ------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F196.1 | done   | Build a source-backed map of JSON/snapshot reader helpers and all current service callers. | CodeGraph CLI is present but uninitialized; manual graph confirmed the helper group is pure and is called by job metadata creation/enqueue/retry, stale remote cleanup metadata, dispatch audit/correlation summaries, task-pull input snapshot rehydration, and business-run sync.                                                                                                                                                                                                                   |
| F196.2 | done   | Extract focused JSON reader utilities and replace internal method calls.                   | `server-executor-json.utils.ts` owns the record guard, required/optional scalar readers, array reader, and JSON value clone helper; `ServerExecutorService` imports those pure helpers and no longer carries the bottom reader block. The `dryRun` default, required-string error text, positive integer parsing, and JSON clone behavior are preserved.                                                                                                                                              |
| F196.3 | done   | Run focused API verification and hygiene checks, then sync docs.                           | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f196-server-executor-jest-20260704-201854.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f196-api-type-check-final-20260704-202017.log`; API build passed: `/tmp/codex-tool-runs/svton/f196-api-build-20260704-201913.log`; Prettier check, line-count, diff check, conflict-marker scan, and trailing-whitespace scan passed. `server-executor.service.ts` is 3914 lines and `server-executor-json.utils.ts` is 56 lines. |

## F197. Server Agent Auth And Task-Pull Config Service Split

Purpose: continue P8 server-executor governance by moving server-agent
heartbeat/task-pull authorization and task-pull config reads out of the
over-limit `server-executor.service.ts` (3914 lines at F196 close). Source
inspection confirmed this region owns header/token reading, constant-time token
comparison, heartbeat/task-pull authorization guards, task-pull enabled flags,
poll interval normalization, and heartbeat ttl/status normalization. This slice
extracts only that focused auth/config/normalization boundary, preserving
heartbeat persistence, task-pull readiness-only contract shape, supervisor
snapshot flags, queue/lease behavior, adapter behavior, HTTP routes, and Web UI
behavior.

Source-backed maps:

- Business logic: heartbeat still requires enabled heartbeat config and a valid
  heartbeat token; task-pull contract still requires the contract flag and the
  task-pull token with heartbeat-token fallback.
- Organization: `ServerExecutorService` keeps persistence/readiness assembly and
  supervisor host delegates; `ServerAgentAuthService` owns agent HTTP auth,
  task-pull config, token/header parsing, and heartbeat value normalization.
- Capability map: heartbeat registration, task-pull readiness contract flags,
  supervisor task-pull enabled flags, and poll interval recommendation stay
  available with no product-surface expansion.
- Data flow: HTTP headers + config -> auth service guard/config helpers ->
  existing heartbeat write or readiness-only contract assembly.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                                        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------ | ------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F197.1 | done   | Build a source-backed map of server-agent auth/config helpers and current callers. | CodeGraph CLI is present but uninitialized; manual graph confirmed callers in heartbeat route authorization+ttl/status normalization, task-pull contract authorization+enabled/poll config, and supervisor snapshot host task-pull enabled flags.                                                                                                                                                               |
| F197.2 | done   | Extract focused auth/config service and replace internal helper calls.             | `ServerAgentAuthService` owns heartbeat/task-pull authorization, header/token parsing, constant-time comparison, task-pull enabled flags, poll interval normalization, and heartbeat ttl/status normalization; `ServerExecutorService` delegates these paths while preserving supervisor host methods. `server-executor.service.ts` is 3801 lines and `server-agent-auth.service.ts` is 139 lines.              |
| F197.3 | done   | Run focused API verification and hygiene checks, then sync docs.                   | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f197-server-executor-jest-20260704-202655.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f197-api-type-check-final-20260704-202756.log`; API build passed: `/tmp/codex-tool-runs/svton/f197-api-build-final-20260704-202815.log`; Prettier check, line-count, diff check, conflict-marker scan, and trailing-whitespace scan passed. |

## F198. Server Executor Runtime Config Service Split

Purpose: continue P8 server-executor governance by moving queue/lease/runtime
config reads out of the over-limit `server-executor.service.ts` (3801 lines at
F197 close). Source inspection confirmed this region owns lease ttl, queue
worker interval/batch/retry config, queue lock ttl/heartbeat, cancellation poll,
stale remote cleanup gate, agent-target gate, and recovery batch size. This
slice extracts only those `ServerExecutorService` runtime config readers into a
focused service, preserving queue/lease behavior, agent routing, remote cleanup
gate, supervisor snapshot host methods, HTTP routes, and Web UI behavior.

Source-backed maps:

- Business logic: queue worker scheduling, retry delays, lock expiry/heartbeat,
  cancellation polling, stale remote cleanup, and agent target selection keep
  the same env keys, defaults, bounds, and call sites.
- Organization: `ServerExecutorService` keeps execution/lease/job orchestration
  and supervisor host delegates; `ServerExecutorRuntimeConfigService` owns
  runtime config reads and lock-expiry calculation for this service.
- Capability map: queue worker observability, queue coordination preflight,
  remote-orphan governance, cancellation polling, and agent target gating stay
  available with no product-surface expansion.
- Data flow: env config -> runtime config service -> existing executor
  orchestration and supervisor snapshot delegate methods.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                                               | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------ | ------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F198.1 | done   | Build a source-backed map of runtime config helpers and current callers.                  | CodeGraph CLI is present but uninitialized; manual graph confirmed callers for queue worker interval/batch/retry, lease ttl, queue lock ttl/heartbeat, cancel poll, stale remote cleanup, agent target routing, and supervisor snapshot config fields.                                                                                                                                                                                                                                                                   |
| F198.2 | done   | Extract focused runtime config service and replace internal helper bodies with delegates. | `ServerExecutorRuntimeConfigService` owns the runtime env reads and lock-expiry calculation for `ServerExecutorService`; executor methods keep the supervisor host contract while delegating to the focused service. `server-executor.service.ts` is 3752 lines and `server-executor-runtime-config.service.ts` is 109 lines.                                                                                                                                                                                            |
| F198.3 | done   | Run focused API verification and hygiene checks, then sync docs.                          | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f198-server-executor-jest-20260704-204043.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f198-api-type-check-final-20260704-204142.log`; API build passed: `/tmp/codex-tool-runs/svton/f198-api-build-final-20260704-204201.log`; Prettier check, line-count, diff check, conflict-marker scan, and trailing-whitespace scan passed. `server-executor.service.ts` is 3752 lines and `server-executor-runtime-config.service.ts` is 109 lines. |

## F199. Server Executor Input Snapshot Utility Split

Purpose: continue P8 server-executor governance by moving execution input
snapshot build/rehydrate helpers out of the over-limit
`server-executor.service.ts` (3752 lines at F198 close). Source inspection
confirmed this region owns input snapshot construction, retry/queue
rehydration, target/agentRef/credentialRef snapshot validation, and command step
snapshot validation. This slice extracts only those stateless snapshot helpers
into a focused `*.utils.ts`, preserving retry behavior, queue claim/recover,
inputSnapshot shape, policy/concurrency/adapter execution, HTTP routes, and Web
UI behavior.

Source-backed maps:

- Business logic: created/enqueued jobs keep writing the same inputSnapshot
  fields; retry and queue paths keep rehydrating the same target, steps,
  warnings, metadata, confirmation, and dry-run semantics.
- Organization: `ServerExecutorService` keeps job lifecycle orchestration;
  `server-executor-input-snapshot.utils.ts` owns pure snapshot
  build/validation/rehydration.
- Capability map: queued execution, retry, stale recovery cleanup, dispatch
  audit source snapshots, and adapter execution stay available with no
  product-surface expansion.
- Data flow: `ServerExecutionInput` -> inputSnapshot JSON -> retry/queue/stale
  rehydrate -> existing policy/concurrency/adapter execution path.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                 |
| ------ | ------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F199.1 | done   | Build a source-backed map of input snapshot helpers and current callers.    | CodeGraph CLI is present but uninitialized; manual graph confirmed callers in retryJob, processNextQueuedJob, recoverStaleRunningJob, cleanupStaleRemoteExecution, create/enqueue job, and dispatch audit source snapshot paths.                                                                                                                                                         |
| F199.2 | done   | Extract focused input snapshot utilities and replace internal helper calls. | `server-executor-input-snapshot.utils.ts` now owns inputSnapshot build/rehydrate plus target, agentRef, credentialRef, and command step validation; `ServerExecutorService` calls the focused pure utilities and keeps job lifecycle orchestration. `server-executor.service.ts` is 3591 lines and the new utility is 178 lines.                                                         |
| F199.3 | done   | Run focused API verification and hygiene checks, then sync docs.            | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f199-server-executor-jest-20260704-205234.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f199-api-type-check-20260704-205243.log`; API build passed: `/tmp/codex-tool-runs/svton/f199-api-build-20260704-205252.log`; focused Prettier write/check path was package-relative after the first path-form retry. |

## F200. Server Executor Job Metadata Reader Utility Split

Purpose: continue P8 server-executor governance by moving remaining
job/result metadata readers out of the over-limit `server-executor.service.ts`
(3591 lines at F199 close). Source inspection confirmed this region only reads
and normalizes persisted remoteExecution sessions, Server agent dispatch
correlation/dispatcher response summaries, and audit project/environment scope.
This slice extracts those stateless readers into a focused `*.utils.ts`, while
keeping audit writes, remote cleanup, queue/retry lifecycle, policy,
concurrency, adapters, HTTP routes, and Web UI behavior unchanged.

Source-backed maps:

- Business logic: stale remote cleanup still reads the same persisted
  `metadata.remoteExecution.session`; execution audits and Server agent dispatch
  audits keep the same project/environment scope and summarized correlation
  metadata.
- Organization: `ServerExecutorService` keeps persistence, audit-event writes,
  queue/retry/stale cleanup orchestration; `server-executor-job-metadata.utils.ts`
  owns pure job/result metadata readers.
- Capability map: remote stale cleanup, execution audit visibility, Server
  agent dispatch audit visibility, queue processing, retry, and adapter
  execution stay available with no product-surface expansion.
- Data flow: job/result metadata JSON -> focused readers -> existing
  stale-cleanup/audit write paths -> execution-governance read surfaces.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                        | Evidence                                                                                                                                                                                                                                                                                                                                  |
| ------ | ------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F200.1 | done   | Build a source-backed map of job metadata readers and callers.     | CodeGraph CLI is present but uninitialized; manual graph confirmed callers in stale remote cleanup, execution job audit writes, and Server agent dispatch audit writes.                                                                                                                                                                   |
| F200.2 | done   | Extract focused job metadata utilities and replace internal calls. | `server-executor-job-metadata.utils.ts` now owns remoteExecution session rehydrate, Server agent dispatch correlation, dispatcher response summaries, and audit project/environment scope reads; `ServerExecutorService` keeps persistence and audit writes. `server-executor.service.ts` is 3470 lines and the new utility is 138 lines. |
| F200.3 | done   | Run focused API verification and hygiene checks, then sync docs.   | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f200-server-executor-jest-20260704-205907.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f200-api-type-check-20260704-205922.log`; API build passed: `/tmp/codex-tool-runs/svton/f200-api-build-20260704-205922.log`.                                          |

## F201. Server Executor Remote Execution Metadata Service Split

Purpose: continue P8 server-executor governance by moving remote execution
metadata persistence out of the over-limit `server-executor.service.ts` (3470
lines at F200 close). Source inspection confirmed this region writes
`metadata.remoteExecution.session` / `cleanup` for running jobs and
`metadata.remoteExecution.staleCleanup` for failed stale-recovery jobs. This
slice extracts only those Prisma metadata writes and runtime-observer assembly
into a focused service, preserving stale cleanup execution, queue/retry/job
lifecycle, policy/concurrency, adapter execution, HTTP routes, and Web UI
behavior.

Source-backed maps:

- Business logic: SSH runtime observer still records remote session/cleanup
  metadata while a job is running; stale recovery still writes stale cleanup
  metadata only for failed jobs.
- Organization: `ServerExecutorService` keeps execution orchestration and SSH
  cleanup calls; `ServerExecutorRemoteExecutionMetadataService` owns remote
  execution metadata persistence and observer construction.
- Capability map: remote process tracking, stale remote cleanup evidence,
  retry/recovery, queue processing, and execution-governance observability stay
  available with no product-surface expansion.
- Data flow: adapter runtime observer event -> metadata service -> Prisma
  `ServerExecutionJob.metadata.remoteExecution`; stale cleanup result ->
  metadata service -> failed job staleCleanup field.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                             | Evidence                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F201.1 | done   | Build a source-backed map of remote execution metadata writers/callers. | CodeGraph CLI is present but uninitialized; manual graph confirmed callers from `execute()` runtime observer wiring and stale recovery cleanup metadata write paths.                                                                                                                                                                                      |
| F201.2 | done   | Extract focused remote execution metadata service and rewire callers.   | `ServerExecutorRemoteExecutionMetadataService` now owns runtime observer construction plus running-job remoteExecution session/cleanup metadata writes and failed-job staleCleanup writes; `ServerExecutorService` keeps stale cleanup execution and lifecycle orchestration. `server-executor.service.ts` is 3398 lines and the new service is 87 lines. |
| F201.3 | done   | Run focused API verification and hygiene checks, then sync docs.        | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f201-server-executor-jest-20260704-210513.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f201-api-type-check-20260704-210526.log`; API build passed: `/tmp/codex-tool-runs/svton/f201-api-build-20260704-210526.log`.                                                          |

## F202. Server Executor Queued/Cancelled Result Utility Split

Purpose: continue P8 server-executor governance by moving queued/cancelled
execution result envelope construction out of the over-limit
`server-executor.service.ts` (3398 lines at F201 close). Source inspection
confirmed `buildQueuedResult`, `buildCancelledResult`, and target metadata
construction are pure commandPlan/result/log builders. This slice extracts only
those builders into a focused `*.utils.ts`, preserving queue creation,
cancellation checks, job lifecycle, policy/concurrency, adapters, HTTP routes,
and Web UI behavior.

Source-backed maps:

- Business logic: queueExecution still returns the same queued result envelope;
  cancellation paths still return the same cancelled commandPlan/log/result
  payloads and warning text.
- Organization: `ServerExecutorService` keeps orchestration, persistence, and
  lifecycle decisions; `server-executor-result.utils.ts` owns pure
  queued/cancelled result and target metadata builders.
- Capability map: queued execution, cancellation before/after policy and lease,
  policy/concurrency result builders, and execution-governance visibility stay
  available with no product-surface expansion.
- Data flow: `ServerExecutionInput` + queued job timestamps or cancellation
  state -> focused result builders -> existing job finish/business sync paths.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                            | Evidence                                                                                                                                                                                                                                                                                                                                       |
| ------ | ------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F202.1 | done   | Build a source-backed map of queued/cancelled result builders/callers. | CodeGraph CLI is present but uninitialized; manual graph confirmed callers from `queueExecution()` and cancellation branches before policy, before adapter execution, and after live lease acquisition.                                                                                                                                        |
| F202.2 | done   | Extract focused result utilities and replace internal builder calls.   | `server-executor-result.utils.ts` now owns queued/cancelled result envelope construction and shared target metadata building; `ServerExecutorService` keeps queue creation, cancellation checks, lifecycle finish, policy/concurrency, and adapter orchestration. `server-executor.service.ts` is 3291 lines and the new utility is 120 lines. |
| F202.3 | done   | Run focused API verification and hygiene checks, then sync docs.       | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f202-server-executor-jest-20260704-211610.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f202-api-type-check-20260704-211622.log`; API build passed: `/tmp/codex-tool-runs/svton/f202-api-build-20260704-211623.log`.                                               |

## F203. Server Executor Policy/Concurrency Blocked Result Utility Split

Purpose: continue P8 server-executor governance by moving policy-blocked and
live-concurrency-blocked result/commandPlan envelope construction out of the
over-limit `server-executor.service.ts` (3291 lines at F202 close). Source
inspection confirmed the builder methods only assemble blocked results from
`ServerExecutionInput`, command policy output, and live lease conflict data.
This slice extracts those builders into a focused `*.utils.ts`, preserving
policy evaluation, live lease acquisition/release, blocked lease persistence,
queue/job lifecycle, adapter execution, HTTP routes, and Web UI behavior.

Source-backed maps:

- Business logic: command policy blocking keeps the same blocked status, mode,
  warning/error text, commandPlan/result shape, policy payload, and target
  metadata; live concurrency blocking keeps the same lease warning text,
  blocked lease metadata, and result envelope.
- Organization: `ServerExecutorService` keeps policy evaluation, live lease
  acquisition/release, DB job/lease lifecycle, business sync, and adapter
  orchestration; `server-executor-blocked-result.utils.ts` owns pure blocked
  result and commandPlan builders.
- Capability map: command-policy blocking, one-live-execution-per-server
  blocking, queued execution, cancellation, adapter execution, and execution
  governance visibility remain available with no product-surface expansion.
- Data flow: policy result or lease conflict data + `ServerExecutionInput` ->
  focused blocked result builders -> existing job finish/business sync/audit
  paths.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                                  | Evidence                                                                                                                                                                                                                                                                                            |
| ------ | ------ | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F203.1 | done   | Build a source-backed map of policy/concurrency blocked builders/callers.    | CodeGraph CLI is present but uninitialized; manual graph confirmed callers from `execute()` policy blocked branch, `acquireLiveLease()` JobQueuePort blocked branch, and prisma unique-conflict fallback branch.                                                                                    |
| F203.2 | done   | Extract focused blocked result utilities and replace internal builder calls. | `server-executor-blocked-result.utils.ts` now owns policy/concurrency blocked result and commandPlan envelope construction; `ServerExecutorService` keeps policy/lease orchestration, persistence, queue lifecycle, adapters, and business-run sync. Service is 3153 lines; new utils is 149 lines. |
| F203.3 | done   | Run focused API verification and hygiene checks, then sync docs.             | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f203-server-executor-jest-20260704-213000.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f203-api-type-check-20260704-213000.log`; API build passed: `/tmp/codex-tool-runs/svton/f203-api-build-20260704-213000.log`.    |

## F204. Server Agent Task-Pull Contract Builder Split

Purpose: continue P8 server-executor governance by moving the read-only Server
agent task-pull contract response assembly out of the over-limit
`server-executor.service.ts` (3153 lines at F203 close). Source inspection
confirmed `readServerAgentTaskPullContract()` should keep authorization,
server lookup, job counts, runtime/capability reads, and no-claim/no-ack
boundaries, while the contract/readiness JSON envelope can be built as a pure
utility.

Source-backed maps:

- Business logic: task-pull contract remains readiness-only; it still does not
  claim jobs, ack jobs, execute lifecycle work, or open long connections.
- Organization: `ServerExecutorService` keeps auth, Prisma reads, capability
  and runtime reads, and poll interval config; the new utility owns response
  envelope assembly, blockers, next steps, gates, and next queued job sample.
- Capability map: Server agent heartbeat, task-pull contract visibility,
  queue pressure, blocked/stale/failed job readiness, and supervisor visibility
  remain available with no product-surface expansion.
- Data flow: headers/dto authorization + server/job/runtime query results ->
  focused contract builder -> existing controller/API response.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                          | Evidence                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F204.1 | done   | Build a source-backed map of task-pull contract builders/callers.    | CodeGraph CLI is present but uninitialized; manual graph confirmed `readServerAgentTaskPullContract()` callers are covered by `server-executor.service.spec.ts` contract tests and that the method mixed Prisma reads with response assembly.                                                                                                                                                |
| F204.2 | done   | Extract focused task-pull contract builder without behavior changes. | `server-agent-task-pull-contract.utils.ts`, `server-agent-task-pull-gates.utils.ts`, and `server-agent-task-pull-readiness.utils.ts` now own read-only contract/readiness/gate/sample assembly; `ServerExecutorService` keeps auth, server lookup, queue count queries, runtime/capability reads, and task-pull poll interval config. Service is 2980 lines; new utils are 119/72/132 lines. |
| F204.3 | done   | Run focused API verification and hygiene checks, then sync docs.     | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f204-server-executor-jest-retry-20260704-215739.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f204-api-type-check-retry-20260704-215739.log`; API build passed: `/tmp/codex-tool-runs/svton/f204-api-build-retry-20260704-215739.log`.                                                                           |

## F205. Server Executor Failure Payload Utility Split

Purpose: continue P8 server-executor governance by moving repeated
business-run failure payload construction out of the over-limit
`server-executor.service.ts` (2980 lines at F204 close). Source inspection
confirmed the failure sync methods for deployment, site sync, resource action,
service operation, backup, and log collection repeat the same
`execution_exception` result and error-log shape. This slice extracts only that
pure payload construction, preserving all Prisma writes, linked site/backup
follow-up updates, business-run routing, queue/job lifecycle, adapters, HTTP
routes, and Web UI behavior.

Source-backed maps:

- Business logic: business-run failure sync still writes failed status, same
  message fallback, same `execution_exception` result fields, same optional
  error logs, and the same follow-up site/backup state updates.
- Organization: `ServerExecutorService` keeps business-run routing and
  persistence; `server-executor-failure-result.utils.ts` owns pure error
  message/log/result payload construction.
- Capability map: deployment, site sync, resource action, service operation,
  backup, log collection, queue failure handling, and execution governance
  visibility remain available with no product-surface expansion.
- Data flow: execution exception + `ServerExecutionInput` + job id -> focused
  failure payload builder -> existing business-run `updateMany()` paths.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                         | Evidence                                                                                                                                                                                                                                                                                                                               |
| ------ | ------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F205.1 | done   | Build a source-backed map of business-run failure payload callers.  | CodeGraph CLI is present but uninitialized; manual graph confirmed callers from `failExecutionJob`, `syncDeploymentRunAfterFailure`, `syncSiteRunAfterFailure`, `syncResourceActionRunAfterFailure`, `syncServiceOperationRunAfterFailure`, `syncBackupRunAfterFailure`, and `syncLogCollectionRunAfterFailure`.                       |
| F205.2 | done   | Extract focused failure payload utilities without behavior changes. | `server-executor-failure-result.utils.ts` now owns exception message normalization, error logs, and `execution_exception` result construction; `ServerExecutorService` keeps all Prisma writes, linked Site/Backup follow-up updates, business-run routing, and adapter/job lifecycle. Service is 2936 lines; new utility is 24 lines. |
| F205.3 | done   | Run focused API verification and hygiene checks, then sync docs.    | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f205-server-executor-jest-20260704-220905.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f205-api-type-check-20260704-220905.log`; API build passed: `/tmp/codex-tool-runs/svton/f205-api-build-20260704-220905.log`.                                       |

## F206. Server Executor Job Attempt Metadata Utility Split

Purpose: continue P8 server-executor governance by moving retry/attempt
metadata and queued input snapshot construction out of the over-limit
`server-executor.service.ts` (2936 lines at F205 close). Source inspection
confirmed `createExecutionJob()` and `enqueueExecutionJob()` still build
retryOfId, retryAttempt, maxAttempts, queue metadata, and queued retry input
snapshots inline. This slice extracts only those pure job metadata builders,
preserving Prisma create calls, lock timestamps, queue worker lifecycle, retry
routing, adapters, HTTP routes, and Web UI behavior.

Source-backed maps:

- Business logic: inline and queued execution jobs keep the same retry attempt,
  maxAttempts, retryOfId, queueMode, autoRetry, sourceMetadata, and input
  snapshot semantics.
- Organization: `ServerExecutorService` keeps persistence, lock ownership,
  queue claim/retry/recovery orchestration, and job include selection;
  `server-executor-job-attempt.utils.ts` owns pure attempt/metadata/snapshot
  builders.
- Capability map: inline execution, queued execution, manual retry, auto retry,
  stale recovery retry, cancellation, and execution governance visibility
  remain available with no product-surface expansion.
- Data flow: `ServerExecutionInput` + queue options -> focused job attempt
  builders -> existing Prisma `serverExecutionJob.create()` paths.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                              | Evidence                                                                                                                                                                                                                                                                                                                                           |
| ------ | ------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F206.1 | done   | Build a source-backed map of job attempt metadata callers.               | CodeGraph CLI is present but uninitialized; manual graph confirmed callers from `createExecutionJob()` inline create and `enqueueExecutionJob()` queued/manual retry/auto retry/stale recovery create paths.                                                                                                                                       |
| F206.2 | done   | Extract focused job attempt metadata utilities without behavior changes. | `server-executor-job-attempt.utils.ts` now owns retryOfId/retryAttempt/maxAttempts, inline/queued queue metadata, and queued retry input snapshot construction; `ServerExecutorService` keeps Prisma writes, lock timestamps, queue lifecycle, retry routing, adapters, and job include selection. Service is 2920 lines; new utility is 95 lines. |
| F206.3 | done   | Run focused API verification and hygiene checks, then sync docs.         | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f206-server-executor-jest-20260704-221551.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f206-api-type-check-20260704-221551.log`; API build passed: `/tmp/codex-tool-runs/svton/f206-api-build-20260704-221551.log`.                                                   |

## F207. Server Executor Job Include Projection Utility Split

Purpose: continue P8 server-executor governance by moving the shared Prisma job
include projection out of the over-limit `server-executor.service.ts` (2920
lines at F206 close). Source inspection confirmed `jobInclude()` is a pure
read-model projection reused by job listing, cancellation lookup, retry lookup,
and queued job creation include paths.

Maps:

- Business logic: existing job queries still read the same actor, server,
  retry, deployment, site, resource, service-operation, backup, and log
  collection relations.
- Organization: `ServerExecutorService` keeps query timing and lifecycle
  orchestration; the focused projection utility owns only the Prisma include
  shape.
- Function map: `listJobs()`, `cancelJob()`, `retryJob()`, and
  `enqueueExecutionJob()` call the shared include projection through the service
  import.
- Data flow: Prisma `serverExecutionJob` query -> shared include projection ->
  unchanged job records consumed by existing execution governance flows.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                              | Evidence                                                                                                                                                                                                                                                                                         |
| ------ | ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F207.1 | done   | Build a source-backed map of job include projection callers.             | CodeGraph CLI is present but uninitialized; manual graph confirmed callers from `listJobs()`, `cancelJob()`, `retryJob()`, and `enqueueExecutionJob()` include selections.                                                                                                                       |
| F207.2 | done   | Extract focused job include projection utility without behavior changes. | `server-executor-job-include.utils.ts` now owns only the Prisma include object; `ServerExecutorService` keeps query orchestration, cancellation, retry, queue creation, and job lifecycle. Service is 2879 lines; new utility is 43 lines.                                                       |
| F207.3 | done   | Run focused API verification and hygiene checks, then sync docs.         | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f207-server-executor-jest-20260704-222416.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f207-api-type-check-20260704-222416.log`; API build passed: `/tmp/codex-tool-runs/svton/f207-api-build-20260704-222416.log`. |

## F208. Server Executor Cancellation Token Service Split

Purpose: continue P8 server-executor governance by moving persisted
cancellation polling and token lifecycle construction out of the over-limit
`server-executor.service.ts` (2879 lines at F207 close). Source inspection
confirmed `createCancellationToken()` owns callback registration, warn-once
poll error handling, the polling timer, persisted cancel lookup, and token stop
cleanup, while `runExecutionWithJob()` and `cancelJob()` only need the token
contract and running-token map.

Maps:

- Business logic: cancellation still flows from `cancelJob()` to the running
  token, persisted job cancel state still polls `serverExecutionJob`, and
  adapter execution still observes the same `ServerExecutionCancellationToken`
  contract.
- Organization: `ServerExecutorService` keeps running-token map ownership,
  execution lifecycle, and cancellation requests; the focused cancellation
  token service owns token creation and persisted cancel polling.
- Function map: `runExecutionWithJob()` creates and stores a token;
  cancellation checkpoints call `checkPersistedCancellation()`; `cancelJob()`
  calls `token.cancel()` for running jobs; teardown calls `token.stop()`.
- Data flow: job id + poll interval + logger -> cancellation token service ->
  persisted cancel lookup -> callback notification to adapter execution.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                          | Evidence                                                                                                                                                                                                                                                                                             |
| ------ | ------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F208.1 | done   | Build a source-backed map of cancellation token callers.             | CodeGraph CLI is present but uninitialized; manual graph confirmed callers from `runExecutionWithJob()` token creation/checkpoints, `cancelJob()` running-token cancel request, `onModuleDestroy()` stop, and final execution teardown.                                                              |
| F208.2 | done   | Extract focused cancellation token service without behavior changes. | `server-executor-cancellation-token.service.ts` now owns token state, persisted cancel polling, warn-once poll error logging, timer cleanup, and callback notification; `ServerExecutorService` keeps lifecycle orchestration and running-token map. Service is 2819 lines; new service is 92 lines. |
| F208.3 | done   | Run focused API verification and hygiene checks, then sync docs.     | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f208-server-executor-jest-20260704-223231.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f208-api-type-check-20260704-223231.log`; API build passed: `/tmp/codex-tool-runs/svton/f208-api-build-20260704-223231.log`.     |

## F209. Server Executor Live Lease Service Split

Purpose: continue P8 server-executor governance by moving server-level live
lease acquisition/release/expiry out of the over-limit
`server-executor.service.ts` (2819 lines at F208 close). Source inspection
confirmed `acquireLiveLease()`, `releaseLiveLease()`, `expireStaleLeases()`,
`liveLeaseActiveKey()`, and the unique-constraint fallback form one cohesive
lease responsibility around distributed locks, `JobQueuePort`, and Prisma
fallback persistence.

Maps:

- Business logic: live SSH execution still tries a server-level lease before
  adapter execution, returns the same concurrency-blocked result when occupied,
  releases the lease after terminal execution status, and expires stale running
  leases before acquisition or explicit team cleanup.
- Organization: `ServerExecutorService` keeps execution orchestration and
  result/failure routing; the focused live lease service owns distributed lock
  acquire/release, active key construction, `JobQueuePort` lease calls, Prisma
  fallback writes, and unique-constraint fallback handling.
- Function map: `runExecutionWithJob()` calls acquire/release through the
  service delegation; `listLeases()` and `expireStaleLeasesForTeam()` keep the
  public API surface while delegating stale lease expiry.
- Data flow: `ServerExecutionInput` + lease TTL -> live lease service -> lock
  handle/DB lease or concurrency-blocked result -> unchanged execution
  lifecycle.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                      | Evidence                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F209.1 | done   | Build a source-backed map of live lease callers.                 | CodeGraph CLI is present but uninitialized; manual graph confirmed callers from `runExecutionWithJob()` acquire/release paths, `queueExecution()` stale-expire preflight, and `expireStaleLeasesForTeam()` cleanup.                                                                                                                                                        |
| F209.2 | done   | Extract focused live lease service without behavior changes.     | `server-executor-live-lease.service.ts` now owns distributed lock acquire/release, `JobQueuePort` lease calls, Prisma fallback writes, blocked result construction, stale lease expiry, and unique-constraint fallback; `server-executor-live-lease.utils.ts` owns pure active-key/input builders. Service is 2646 lines; new service is 184 lines; new utils is 87 lines. |
| F209.3 | done   | Run focused API verification and hygiene checks, then sync docs. | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f209-server-executor-jest-20260704-224534.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f209-api-type-check-20260704-224534.log`; API build passed: `/tmp/codex-tool-runs/svton/f209-api-build-20260704-224534.log`.                                                                           |

## F210. Server Executor Job Lock Heartbeat Service Split

Purpose: continue P8 server-executor governance by moving running job lock
heartbeat ownership out of the over-limit `server-executor.service.ts` (2646
lines at F209 close). Source inspection confirmed `startJobHeartbeat()` and
`extendJobLock()` form a focused responsibility around queue lock extension,
worker ownership, lock expiry calculation, and heartbeat timer cleanup.

Maps:

- Business logic: running jobs still extend their lock before adapter execution
  and on the configured interval, then clear the timer during execution
  teardown.
- Organization: `ServerExecutorService` keeps execution lifecycle and result
  routing; the focused heartbeat service owns job lock extension through
  `JobQueuePort` or Prisma fallback plus timer creation/cleanup.
- Function map: `runExecutionWithJob()` starts/stops the heartbeat; the service
  calls `JobQueuePort.extendJobLock()` when available or updates
  `serverExecutionJob` lock fields through Prisma.
- Data flow: job id + worker id + heartbeat interval + lock expiry builder ->
  heartbeat service -> job queue or Prisma lock extension -> unchanged running
  job lifecycle.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                          | Evidence                                                                                                                                                                                                                                                                                         |
| ------ | ------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F210.1 | done   | Build a source-backed map of job lock heartbeat callers.             | CodeGraph CLI is present but uninitialized; manual graph confirmed callers from `runExecutionWithJob()` heartbeat start/teardown and `extendJobLock()` JobQueuePort/Prisma fallback branches.                                                                                                    |
| F210.2 | done   | Extract focused job lock heartbeat service without behavior changes. | `server-executor-job-heartbeat.service.ts` now owns heartbeat timer setup/cleanup and job lock extension through `JobQueuePort` or Prisma fallback; `ServerExecutorService` keeps execution lifecycle orchestration. Service is 2636 lines; new service is 56 lines.                             |
| F210.3 | done   | Run focused API verification and hygiene checks, then sync docs.     | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f210-server-executor-jest-20260704-225242.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f210-api-type-check-20260704-225242.log`; API build passed: `/tmp/codex-tool-runs/svton/f210-api-build-20260704-225242.log`. |

## F211. Server Executor Site TLS Follow-up Service Split

Purpose: continue P8 server-executor governance by moving Site TLS probe/renew
metadata refresh and renewal follow-up probe queueing out of the over-limit
`server-executor.service.ts` (2636 lines at F210 close). Source inspection
confirmed the focused boundary is `refreshSiteTlsMetadataAfterProbe()`,
`refreshSiteTlsMetadataAfterRenew()`, `queueSiteTlsProbeAfterRenewal()`,
`siteTlsProbeWarnings()`, and `isSafeProbeHostname()`.

Maps:

- Business logic: Site sync completion still updates the `siteSyncRun`; TLS
  probe/renew modes still refresh Site TLS metadata, and successful non-dry-run
  renewals still enqueue a follow-up TLS probe.
- Organization: `ServerExecutorService` keeps linked business-run routing and
  execution queue orchestration; the focused Site TLS follow-up service owns TLS
  metadata extraction/merge, follow-up `siteSyncRun` creation, probe command
  shaping, and failure recording.
- Function map: `syncSiteRunAfterExecution()` calls the focused service for
  probe metadata refresh, renewal metadata refresh, and renewal follow-up probe
  queueing.
- Data flow: Site sync result + metadata -> Site TLS follow-up service -> Site
  TLS JSON update and optional queued TLS probe job -> unchanged Site run sync
  lifecycle.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                          | Evidence                                                                                                                                                                                                                                                                                                                       |
| ------ | ------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F211.1 | done   | Build a source-backed map of Site TLS follow-up callers.             | CodeGraph CLI is present but uninitialized; manual graph confirmed callers from `syncSiteRunAfterExecution()` TLS probe and renewal branches.                                                                                                                                                                                  |
| F211.2 | done   | Extract focused Site TLS follow-up service without behavior changes. | `server-executor-site-tls-follow-up.service.ts` now owns TLS metadata refresh delegation, `server-executor-site-tls-probe-queue.service.ts` owns renewal follow-up probe queueing, and `server-executor-site-tls-follow-up.utils.ts` owns probe warnings/input shaping. Service is 2374 lines; new files are 113/181/99 lines. |
| F211.3 | done   | Run focused API verification and hygiene checks, then sync docs.     | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f211-server-executor-jest-rerun-20260704-230644.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f211-api-type-check-rerun-20260704-230645.log`; API build passed: `/tmp/codex-tool-runs/svton/f211-api-build-rerun-20260704-230645.log`.             |

## F212. Server Executor Resource Action Run Sync Service Split

Purpose: continue P8 server-executor governance by moving resource-action
linked run writeback and Docker stats metric snapshot persistence out of the
over-limit `server-executor.service.ts` (2374 lines at F211 close). Source
inspection confirmed the focused boundary is
`syncResourceActionRunAfterExecution()`,
`persistDockerMetricSnapshotsFromActionRun()`, and
`syncResourceActionRunAfterFailure()`.

Maps:

- Business logic: resource action completion still updates
  `resourceActionRun`; completed non-dry-run `docker.container.stats` actions
  still persist `resourceMetricSnapshot` rows once; failure still writes the
  same failed result payload.
- Organization: `ServerExecutorService` keeps linked business-run routing and
  approval consumption; the focused resource-action sync service owns
  `resourceActionRun` writeback and Docker stats metric persistence.
- Function map: `syncLinkedBusinessRunAfterExecution()` and
  `syncLinkedBusinessRunAfterFailure()` call the resource-action branch, which
  delegates to the focused service.
- Data flow: Server execution result + metadata resourceActionRunId -> focused
  service -> `resourceActionRun` update -> optional Docker stats parse ->
  `resourceMetricSnapshot.createMany()`.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                                | Evidence                                                                                                                                                                                                                                                                                                           |
| ------ | ------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F212.1 | done   | Build a source-backed map of resource action run sync callers.             | CodeGraph CLI is present but uninitialized; manual graph confirmed callers from `syncLinkedBusinessRunAfterExecution()` / `syncLinkedBusinessRunAfterFailure()` resource_action branches and the focused metric snapshot spec.                                                                                     |
| F212.2 | done   | Extract focused resource action run sync service without behavior changes. | `server-executor-resource-action-run-sync.service.ts` now owns resource action success/failure writeback and Docker stats metric snapshot persistence; `ServerExecutorService` keeps linked-run routing and approval consumption. Service is 2272 lines; new service is 151 lines.                                 |
| F212.3 | done   | Run focused API verification and hygiene checks, then sync docs.           | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f212-server-executor-jest-rerun-20260704-231443.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f212-api-type-check-rerun-20260704-231443.log`; API build passed: `/tmp/codex-tool-runs/svton/f212-api-build-rerun-20260704-231443.log`. |

## F213. Server Executor Deployment Run Sync Service Split

Purpose: continue P8 server-executor governance by moving deployment linked
run writeback out of the over-limit `server-executor.service.ts` (2272 lines at
F212 close). Source inspection confirmed the focused boundary is
`syncDeploymentRunAfterExecution()` and `syncDeploymentRunAfterFailure()`.

Maps:

- Business logic: deployment run completion still writes the server execution
  job id, status, command plan, logs, result, error, and finished timestamp;
  failure still writes the same failed payload and failure logs.
- Organization: `ServerExecutorService` keeps linked business-run routing and
  approval consumption; the focused deployment run sync service owns
  `deploymentRun` success/failure writeback.
- Function map: `syncLinkedBusinessRunAfterExecution()` and
  `syncLinkedBusinessRunAfterFailure()` call the deployment branch, which
  delegates to the focused service.
- Data flow: Server execution result or execution failure + metadata
  deploymentRunId -> focused service -> `deploymentRun.updateMany()`.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                           | Evidence                                                                                                                                                                                                                                                                                         |
| ------ | ------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F213.1 | done   | Build a source-backed map of deployment run sync callers.             | CodeGraph CLI is present but uninitialized; manual graph confirmed callers from `syncLinkedBusinessRunAfterExecution()` / `syncLinkedBusinessRunAfterFailure()` deployment branches.                                                                                                             |
| F213.2 | done   | Extract focused deployment run sync service without behavior changes. | `server-executor-deployment-run-sync.service.ts` now owns deployment success/failure writeback; `ServerExecutorService` keeps linked-run routing and approval consumption. Service is 2254 lines; new service is 69 lines.                                                                       |
| F213.3 | done   | Run focused API verification and hygiene checks, then sync docs.      | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f213-server-executor-jest-20260704-232047.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f213-api-type-check-20260704-232047.log`; API build passed: `/tmp/codex-tool-runs/svton/f213-api-build-20260704-232047.log`. |

## F214. Server Executor Site Run Sync Service Split

Purpose: continue P8 server-executor governance by moving Site linked run
writeback and TLS follow-up delegation out of the over-limit
`server-executor.service.ts` (2254 lines at F213 close). Source inspection
confirmed the focused boundary is `syncSiteRunAfterExecution()` and
`syncSiteRunAfterFailure()`.

Maps:

- Business logic: Site sync run completion/failure still updates
  `siteSyncRun`; sync/rollback still update Site status, last sync timestamp,
  and sync error; TLS probe/renewal still delegate to the existing Site TLS
  follow-up service.
- Organization: `ServerExecutorService` keeps linked business-run routing,
  approval consumption, and queue orchestration callback ownership; the focused
  Site run sync service owns SiteSyncRun writeback, Site status updates, and
  Site TLS follow-up delegation.
- Function map: `syncLinkedBusinessRunAfterExecution()` and
  `syncLinkedBusinessRunAfterFailure()` call the `site_sync` branch, which
  delegates to the focused service.
- Data flow: Server execution result or execution failure + metadata
  `siteSyncRunId/siteId/mode` -> focused service -> `siteSyncRun.updateMany()`
  -> optional `site.updateMany()` -> optional TLS follow-up/probe queue.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                      | Evidence                                                                                                                                                                                                                                                                                         |
| ------ | ------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F214.1 | done   | Build a source-backed map of Site run sync callers.              | CodeGraph CLI is present but uninitialized; manual graph confirmed callers from `syncLinkedBusinessRunAfterExecution()` / `syncLinkedBusinessRunAfterFailure()` site_sync branches and the existing Site TLS follow-up spec coverage.                                                            |
| F214.2 | done   | Extract focused Site run sync service without behavior changes.  | `server-executor-site-run-sync.service.ts` now owns SiteSyncRun success/failure writeback, Site status updates, and Site TLS follow-up delegation; `ServerExecutorService` keeps linked-run routing and approval consumption. Service is 2159 lines; new service is 178 lines.                   |
| F214.3 | done   | Run focused API verification and hygiene checks, then sync docs. | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f214-server-executor-jest-20260704-232856.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f214-api-type-check-20260704-232905.log`; API build passed: `/tmp/codex-tool-runs/svton/f214-api-build-20260704-232914.log`. |

## F215. Server Executor Service Operation Run Sync Service Split

Purpose: continue P8 server-executor governance by moving service-operation
linked run writeback out of the over-limit `server-executor.service.ts` (2159
lines at F214 close). Source inspection confirmed the focused boundary is
`syncServiceOperationRunAfterExecution()` and
`syncServiceOperationRunAfterFailure()`.

Maps:

- Business logic: service operation run completion/failure still updates
  `applicationServiceOperationRun`; metadata continues to accept both
  `applicationServiceOperationRunId` and legacy `operationRunId`.
- Organization: `ServerExecutorService` keeps linked business-run routing and
  approval consumption; the focused service-operation run sync service owns
  ApplicationServiceOperationRun success/failure writeback.
- Function map: `syncLinkedBusinessRunAfterExecution()` and
  `syncLinkedBusinessRunAfterFailure()` call the `service_operation` branch,
  which delegates to the focused service.
- Data flow: Server execution result or execution failure + metadata
  `applicationServiceOperationRunId/operationRunId` -> focused service ->
  `applicationServiceOperationRun.updateMany()`.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                                  | Evidence                                                                                                                                                                                                                                                                                         |
| ------ | ------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F215.1 | done   | Build a source-backed map of service-operation run sync callers.             | CodeGraph CLI is present but uninitialized; manual graph confirmed callers from `syncLinkedBusinessRunAfterExecution()` / `syncLinkedBusinessRunAfterFailure()` service_operation branches.                                                                                                      |
| F215.2 | done   | Extract focused service-operation run sync service without behavior changes. | `server-executor-service-operation-run-sync.service.ts` now owns ApplicationServiceOperationRun success/failure writeback and metadata id fallback; `ServerExecutorService` keeps linked-run routing and approval consumption. Service is 2134 lines; new service is 80 lines.                   |
| F215.3 | done   | Run focused API verification and hygiene checks, then sync docs.             | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f215-server-executor-jest-20260704-233503.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f215-api-type-check-20260704-233512.log`; API build passed: `/tmp/codex-tool-runs/svton/f215-api-build-20260704-233521.log`. |

## F216. Server Executor Backup Run Sync Service Split

Purpose: continue P8 server-executor governance by moving backup linked run
writeback and BackupPlan last-run status updates out of the over-limit
`server-executor.service.ts` (2134 lines at F215 close). Source inspection
confirmed the focused boundary is `syncBackupRunAfterExecution()` and
`syncBackupRunAfterFailure()`.

Maps:

- Business logic: backup run completion/failure still updates `backupRun`;
  when the run update matches and metadata carries `backupPlanId`, the matching
  BackupPlan still receives `lastRunAt` and `lastStatus`.
- Organization: `ServerExecutorService` keeps linked business-run routing; the
  focused backup run sync service owns BackupRun writeback and BackupPlan
  last-run status updates.
- Function map: `syncLinkedBusinessRunAfterExecution()` and
  `syncLinkedBusinessRunAfterFailure()` call the `backup_run` branch, which
  delegates to the focused service.
- Data flow: Server execution result or execution failure + metadata
  `backupRunId/backupPlanId` -> focused service -> `backupRun.updateMany()` ->
  optional `backupPlan.updateMany()`.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                       | Evidence                                                                                                                                                                                                                                                                                         |
| ------ | ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F216.1 | done   | Build a source-backed map of backup run sync callers.             | CodeGraph CLI is present but uninitialized; manual graph confirmed callers from `syncLinkedBusinessRunAfterExecution()` / `syncLinkedBusinessRunAfterFailure()` backup_run branches.                                                                                                             |
| F216.2 | done   | Extract focused backup run sync service without behavior changes. | `server-executor-backup-run-sync.service.ts` now owns BackupRun success/failure writeback and BackupPlan last-run status updates; `ServerExecutorService` keeps linked-run routing. Service is 2083 lines; new service is 106 lines.                                                             |
| F216.3 | done   | Run focused API verification and hygiene checks, then sync docs.  | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f216-server-executor-jest-20260704-234042.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f216-api-type-check-20260704-234051.log`; API build passed: `/tmp/codex-tool-runs/svton/f216-api-build-20260704-234101.log`. |

## F217. Server Executor Log Collection Run Sync Service Split

Purpose: continue P8 server-executor governance by moving log-collection linked
run writeback and completed-run ingestion delegation out of the over-limit
`server-executor.service.ts` (2083 lines at F216 close). Source inspection
confirmed the focused boundary is `syncLogCollectionRunAfterExecution()` and
`syncLogCollectionRunAfterFailure()`.

Maps:

- Business logic: log collection run completion/failure still updates
  `logCollectionRun`; completed runs still delegate ingestion to the existing
  `LogCollectionIngestionService`.
- Organization: `ServerExecutorService` keeps linked business-run routing; the
  focused log-collection run sync service owns LogCollectionRun writeback and
  completed-run ingestion delegation.
- Function map: `syncLinkedBusinessRunAfterExecution()` and
  `syncLinkedBusinessRunAfterFailure()` call the `log_collection` branch,
  which delegates to the focused service.
- Data flow: Server execution result or execution failure + metadata
  `logCollectionRunId` -> focused service -> `logCollectionRun.updateMany()` ->
  optional completed-run ingestion.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                               | Evidence                                                                                                                                                                                                                                                                                         |
| ------ | ------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F217.1 | done   | Build a source-backed map of log-collection run sync callers.             | CodeGraph CLI is present but uninitialized; manual graph confirmed callers from `syncLinkedBusinessRunAfterExecution()` / `syncLinkedBusinessRunAfterFailure()` log_collection branches and the existing `LogCollectionIngestionService` completed-run contract.                                 |
| F217.2 | done   | Extract focused log-collection run sync service without behavior changes. | `server-executor-log-collection-run-sync.service.ts` now owns LogCollectionRun success/failure writeback and completed-run ingestion delegation; `ServerExecutorService` keeps linked-run routing. Service is 2060 lines; new service is 82 lines.                                               |
| F217.3 | done   | Run focused API verification and hygiene checks, then sync docs.          | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f217-server-executor-jest-20260704-234602.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f217-api-type-check-20260704-234611.log`; API build passed: `/tmp/codex-tool-runs/svton/f217-api-build-20260704-234621.log`. |

## F218. Server Executor Audit Service Split

Purpose: continue P8 server-executor governance by moving server execution job
audit assembly and Server agent dispatch audit assembly out of the over-limit
`server-executor.service.ts` (2060 lines at F217 close). Source inspection
confirmed the focused boundary is `writeServerExecutionJobAudit()` and
`writeServerAgentDispatchAudit()`.

Maps:

- Business logic: execution governance audit events still write the same
  category/action/target/risk/status metadata; Server agent dispatch audit still
  writes only for `server_agent` transport and `server-agent` executor adapter.
- Organization: `ServerExecutorService` keeps job lifecycle orchestration and
  call timing; the focused audit service owns audit scope extraction, metadata
  shaping, and dispatch audit failure logging.
- Function map: cancel/retry/process/recover paths and Server agent dispatch
  completion call the focused audit service instead of inline audit builders.
- Data flow: job/input/result + optional audit metadata -> focused service ->
  `AuditEventService.create()` with project/environment/server scope.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                      | Evidence                                                                                                                                                                                                                                                                                         |
| ------ | ------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F218.1 | done   | Build a source-backed map of audit write callers.                | CodeGraph CLI is present but uninitialized; manual graph confirmed server execution job audit callers from cancel/retry/process/recover paths and the Server agent dispatch audit caller after adapter execution completion.                                                                     |
| F218.2 | done   | Extract focused audit service without behavior changes.          | `server-executor-audit.service.ts` now owns server execution job audit scope extraction, metadata shaping, and Server agent dispatch audit fallback logging; `ServerExecutorService` keeps lifecycle orchestration and call timing. Service is 1931 lines; new service is 163 lines.             |
| F218.3 | done   | Run focused API verification and hygiene checks, then sync docs. | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f218-server-executor-jest-20260704-235412.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f218-api-type-check-20260704-235423.log`; API build passed: `/tmp/codex-tool-runs/svton/f218-api-build-20260704-235423.log`. |

## F219. Server Executor Job Lifecycle Write Service Split

Purpose: continue P8 server-executor governance by moving inline job creation,
queued job creation, job completion writes, and failed-job writes out of the
over-limit `server-executor.service.ts` (1931 lines at F218 close). Source
inspection confirmed the focused boundary is `createExecutionJob()`,
`enqueueExecutionJob()`, `finishExecutionJob()`, and `failExecutionJob()`.

Maps:

- Business logic: inline execution still creates a running job; queued
  execution/retry/recovery still creates queued jobs with the same attempt,
  snapshot, metadata, and availability semantics; terminal completion/failure
  still clears locks and heartbeat fields exactly as before.
- Organization: `ServerExecutorService` keeps execution orchestration,
  adapter dispatch, queue claim, auto-retry, and stale recovery strategy; the
  focused lifecycle write service owns job create/enqueue/finish/fail
  persistence writes and `JobQueuePort.completeJob()` fallback selection.
- Function map: `execute()`, `queueExecution()`, retry, auto-retry, stale
  recovery, adapter success, blocked/cancelled paths, and adapter failure call
  the focused lifecycle write service instead of inline Prisma writes.
- Data flow: execution input/result/error + worker id/runtime config/job queue
  port -> focused lifecycle write service -> `serverExecutionJob` create/update
  or `JobQueuePort.completeJob()`.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                                  | Evidence                                                                                                                                                                                                                                                                                                           |
| ------ | ------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F219.1 | done   | Build a source-backed map of job lifecycle write callers.                    | CodeGraph CLI is present but uninitialized; manual graph confirmed create/enqueue callers from `execute()`, `queueExecution()`, retry, auto-retry, and stale recovery paths, plus finish/fail callers from adapter success, blocked/cancelled, and failure paths.                                                  |
| F219.2 | done   | Extract focused job lifecycle write service without behavior changes.        | `server-executor-job-lifecycle-write.service.ts` now owns inline job create, queued job create, job completion writes, and failed-job writes; `ServerExecutorService` keeps execution orchestration, queue claim, retry, recovery, and adapter dispatch strategy. Service is 1816 lines; new service is 157 lines. |
| F219.3 | done   | Run focused API verification and hygiene checks, then sync docs and handoff. | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f219-server-executor-jest-20260705-000933.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f219-api-type-check-20260705-000945.log`; API build passed: `/tmp/codex-tool-runs/svton/f219-api-build-20260705-000945.log`.                   |

## F220. Server Executor Queue Claim Service Split

Purpose: continue P8 server-executor governance by moving the queued-job claim
implementation out of the over-limit `server-executor.service.ts` (1816 lines
at F219 close). Source inspection confirmed the focused boundary is
`claimNextQueuedJob()`: the `JobQueuePort.claimNextDueJob()` delegation and
the Prisma fallback that atomically marks the next due queued job as running.

Maps:

- Business logic: processing the next queued job still recovers stale running
  jobs first, claims one due queued job, rehydrates input, executes it, and
  enqueues auto-retry when needed; F220 only moves the claim operation.
- Organization: `ServerExecutorService` keeps queue processing orchestration,
  recovery, execution, audit, and auto-retry decisions; the focused queue claim
  service owns port delegation and Prisma fallback lock acquisition.
- Function map: `processNextQueuedJob()` calls the focused queue claim service;
  `processDueQueuedJobs()` and public queue APIs remain unchanged.
- Data flow: optional team id + worker id/runtime lock expiry + optional
  `JobQueuePort` -> focused claim service -> claimed `serverExecutionJob` or
  `null`.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                      | Evidence                                                                                                                                                                                                                                                                                         |
| ------ | ------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F220.1 | done   | Build a source-backed map of queue claim callers and fallback.   | CodeGraph CLI is present but uninitialized; manual graph confirmed `processNextQueuedJob()` is the only queued-job claim caller and the claim implementation chooses `JobQueuePort.claimNextDueJob()` before Prisma fallback.                                                                    |
| F220.2 | done   | Extract focused queue claim service without behavior changes.    | `server-executor-queue-claim.service.ts` now owns port delegation and Prisma fallback lock acquisition; `ServerExecutorService` keeps queue processing orchestration, stale recovery, execution, audit, and auto-retry decisions. Service is 1780 lines; new service is 55 lines.                |
| F220.3 | done   | Run focused API verification and hygiene checks, then sync docs. | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f220-server-executor-jest-20260705-002226.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f220-api-type-check-20260705-002239.log`; API build passed: `/tmp/codex-tool-runs/svton/f220-api-build-20260705-002239.log`. |

## F221. Server Executor Queue Worker Service Split

Purpose: continue P8 server-executor governance by moving queue worker timer
state and batch loop orchestration out of the over-limit
`server-executor.service.ts` (1780 lines at F220 close). Source inspection
confirmed the focused boundary is `onModuleInit()` queue worker startup,
`onModuleDestroy()` timer cleanup, `getProcessingQueue()`, and
`processDueQueuedJobs()`.

Maps:

- Business logic: queue worker enablement, interval, batch size, one-active
  processing guard, and error logging remain unchanged; actual queued-job
  processing still calls `processNextQueuedJob()`.
- Organization: `ServerExecutorService` keeps queue job processing,
  recovery, execution, audit, and auto-retry decisions; the focused queue
  worker service owns timer lifecycle, `processingQueue` state, and the batch
  loop shell.
- Function map: module init starts the focused worker service, module destroy
  stops it before cancelling running tokens, and status reads call the worker
  service processing flag.
- Data flow: runtime config reads + worker id + `processNextQueuedJob`
  callback -> focused queue worker service -> repeated processed/not-processed
  loop.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                      | Evidence                                                                                                                                                                                                                                                                                          |
| ------ | ------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F221.1 | done   | Build a source-backed map of queue worker timer and batch loop.  | CodeGraph CLI is present but uninitialized; manual graph confirmed module lifecycle starts/stops the queue worker, `getProcessingQueue()` reads the processing flag, and the batch loop repeatedly calls `processNextQueuedJob()`.                                                                |
| F221.2 | done   | Extract focused queue worker service without behavior changes.   | `server-executor-queue-worker.service.ts` now owns timer lifecycle, processing flag, batch loop, and queue worker error logging; `ServerExecutorService` keeps actual queue job processing, recovery, execution, audit, and auto-retry decisions. Service is 1757 lines; new service is 66 lines. |
| F221.3 | done   | Run focused API verification and hygiene checks, then sync docs. | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f221-server-executor-jest-20260705-002804.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f221-api-type-check-20260705-002816.log`; API build passed: `/tmp/codex-tool-runs/svton/f221-api-build-20260705-002816.log`.  |

## F222. Server Executor Stale Remote Cleanup Service Split

Scope: continue P8 execution-governance structure convergence after F221.
Current source confirms `recoverStaleRunningJob()` still owns stale recovery
state transitions, retry enqueueing, and stale remote cleanup execution. This
slice only moves cleanup gating, persisted session extraction, SSH cleanup
fallback construction, and stale cleanup metadata write into a focused service.

- Business logic map: stale job recovery marks an expired running job failed,
  optionally delegates remote cleanup, then enqueues retry when attempts remain.
- Organization map: `ServerExecutorService` remains the stale recovery
  orchestrator; `ServerExecutorStaleRemoteCleanupService` owns cleanup
  execution details behind one `cleanup(job)` entry.
- Function map: cleanup reads the existing runtime gate, extracts the persisted
  `metadata.remoteExecution.session`, rehydrates the original execution input,
  calls the SSH live adapter, falls back to a failed cleanup record, and writes
  stale cleanup metadata.
- Data flow: `ServerExecutionJob.metadata.remoteExecution.session` +
  `inputSnapshot` -> focused cleanup service -> SSH cleanup result/fallback ->
  `remoteExecution.staleCleanup` metadata.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F222.1 | done   | Build a source-backed map of stale remote cleanup callers and data flow. | CodeGraph CLI is present but uninitialized; manual graph confirmed the only cleanup caller is `recoverStaleRunningJob()`, tests already cover disabled cleanup and persisted stale cleanup results, and related helpers are `readRemoteExecutionSessionSnapshot()`, `rehydrateServerExecutionInput()`, `SshLiveServerExecutorAdapter.cleanupRemoteExecutionSession()`, and `recordStaleRemoteCleanupMetadata()`. |
| F222.2 | done   | Extract focused stale remote cleanup service without behavior changes.   | `server-executor-stale-remote-cleanup.service.ts` now owns stale cleanup gating, persisted session extraction, SSH cleanup/fallback result assembly, and stale cleanup metadata writes; `ServerExecutorService` delegates from stale recovery and keeps state transitions/retry decisions. Service is 1710 lines; new service is 72 lines.                                                                       |
| F222.3 | done   | Run focused API verification and hygiene checks, then sync docs.         | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f222-server-executor-jest-20260705-003601.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f222-api-type-check-20260705-003601.log`; API build passed: `/tmp/codex-tool-runs/svton/f222-api-build-20260705-003601.log`.                                                                                                                 |

## F223. Server Executor Linked Business Run Sync Service Split

Scope: continue P8 execution-governance structure convergence after F222.
Current source confirms `runExecutionWithJob()` repeatedly delegates completed,
blocked, cancelled, and failed execution outcomes into linked business-run sync
helpers. This slice only moves business-run sync dispatch and approval
consumption behind a focused service.

- Business logic map: job execution still finishes/fails the
  `ServerExecutionJob`, then syncs the linked deployment, site, resource
  action, service operation, backup, or log collection run according to
  `metadata.businessRunSync`.
- Organization map: `ServerExecutorService` remains the execution orchestrator;
  `ServerExecutorLinkedBusinessRunSyncService` owns post-execution/failure
  business-run dispatch and approval consumption.
- Function map: execution result/failure + metadata -> focused sync service ->
  existing per-domain sync services -> optional operation approval consume.
- Data flow: `ServerExecutionInput.metadata.businessRunSync` and domain run ids
  route to the existing domain-specific update service; site sync keeps the
  existing `queueExecution()` callback for follow-up work.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                                  | Evidence                                                                                                                                                                                                                                                                                                                           |
| ------ | ------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F223.1 | done   | Build a source-backed map of linked business-run sync callers and data flow. | CodeGraph CLI is present but uninitialized; manual graph confirmed callers are the success/blocked/cancelled/failure exits in `runExecutionWithJob()`, and dispatch targets are the existing deployment/site/resource-action/service-operation/backup/log-collection sync services plus operation approval consumption.            |
| F223.2 | done   | Extract focused linked business-run sync service without behavior changes.   | `server-executor-linked-business-run-sync.service.ts` now owns linked business-run dispatch, site follow-up queue callback wiring, and operation approval consumption; `ServerExecutorService` delegates post-execution/failure sync and keeps execution lifecycle orchestration. Service is 1408 lines; new service is 189 lines. |
| F223.3 | done   | Run focused API verification and hygiene checks, then sync docs.             | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f223-server-executor-jest-3-20260705-004643.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f223-api-type-check-3-20260705-004643.log`; API build passed: `/tmp/codex-tool-runs/svton/f223-api-build-3-20260705-004643.log`.                             |

## F224. Server Executor Job Cancellation Service Split

Scope: continue P8 execution-governance structure convergence after F223.
Current source confirms `cancelJob()` still lives in the over-limit executor
service and combines job lookup, cancellable-state validation, running-token
signal, cancellation persistence, and audit writes. This slice only moves the
user-facing job cancellation request path behind a focused service.

- Business logic map: queued/blocked jobs are immediately marked cancelled;
  running jobs record `cancelRequestedAt`, keep status running, and signal the
  in-memory cancellation token when present.
- Organization map: `ServerExecutorService` keeps execution lifecycle and token
  ownership; `ServerExecutorJobCancellationService` owns cancellation API
  validation, persistence, and audit event writes.
- Function map: controller -> `ServerExecutorService.cancelJob()` delegate ->
  focused cancellation service -> Prisma update + optional token signal +
  execution audit.
- Data flow: job id/team id/user id -> current `ServerExecutionJob` record ->
  cancellation update -> included job response + audit metadata.
- Page structure: no Web page or interaction surface changes in this backend
  structure slice.

| Task   | Status | Description                                                          | Evidence                                                                                                                                                                                                                                                                                                                                                                           |
| ------ | ------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F224.1 | done   | Build a source-backed map of job cancellation callers and data flow. | CodeGraph CLI is present but uninitialized; manual graph confirmed the HTTP controller calls `cancelJob()`, running cancellation tokens are owned by `ServerExecutorService`, and existing tests cover running-job cancellation audit events.                                                                                                                                      |
| F224.2 | done   | Extract focused job cancellation service without behavior changes.   | `server-executor-job-cancellation.service.ts` now owns cancellation job lookup, cancellable-state validation, running-job cancel request persistence/token signal, queued/blocked cancellation persistence, and cancellation audit writes; `ServerExecutorService` delegates cancel requests and keeps token lifecycle ownership. Service is 1331 lines; new service is 126 lines. |
| F224.3 | done   | Run focused API verification and hygiene checks, then sync docs.     | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f224-server-executor-jest-20260705-005357.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f224-api-type-check-20260705-005357.log`; API build passed: `/tmp/codex-tool-runs/svton/f224-api-build-20260705-005357.log`.                                                                                   |

## F225. Server Executor Job Retry Service Split

Purpose: P8 执行治理结构收敛（接 F224）；当前源码确认 `server-executor.service.ts`（1331 行）仍在类内持有 `retryJob()` 的 job lookup、retryable-state validation、input snapshot rehydrate、queued/inline retry 分支和 retry audit writes。本轮只把用户重试 job 的 API 路径抽到 focused `*.service.ts`，保持 retry 状态集合、maxAttempts 计算、inputSnapshot 重建、queued retry enqueue、inline execute、audit action keys、HTTP route 与 Web UI 行为不变。

Assumption: F225 只处理 Server Executor manual job retry request boundary；不改变 auto-retry/recovery、queue worker、job schema、server-agent dispatch、cancellation token、linked business-run sync 或页面交互。

- Business logic map: failed/blocked/cancelled jobs can be retried; queued retry enqueues a new job from the persisted input snapshot, while inline retry executes the rehydrated input immediately and writes the matching audit action.
- Organization map: `ServerExecutorService` remains the execution orchestrator and inline execution owner; `ServerExecutorJobRetryService` owns retry API validation, input rehydration, queued/inline retry branching, and retry audit writes.
- Function map: controller -> `ServerExecutorService.retryJob()` delegate -> focused retry service -> lifecycle enqueue or inline execute callback -> execution audit.
- Data flow: job id/team id/user id/dto -> current `ServerExecutionJob` input snapshot -> rehydrated retry input -> queued job or inline execution result -> audit metadata.
- Page structure: no Web page or interaction surface changes in this backend structure slice.

| Task   | Status | Description                                               | Evidence                                                                                                                                                                                                                                                                                                       |
| ------ | ------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F225.1 | done   | Build a source-backed map of job retry callers and flow.  | CodeGraph CLI is present but uninitialized; manual graph confirmed the HTTP job controller calls `retryJob()`, existing retry audit coverage exercises queued retry, and inline retry must stay behind the main service execute callback.                                                                      |
| F225.2 | done   | Extract focused job retry service without behavior drift. | `server-executor-job-retry.service.ts` now owns manual retry lookup, retryable-state validation, input rehydrate, queued/inline branch, and retry audit writes; `ServerExecutorService` delegates retry requests and keeps execution orchestration ownership. Service is 1266 lines; new service is 133 lines. |
| F225.3 | done   | Run focused API verification and hygiene checks.          | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f225-server-executor-jest-20260705-010205.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f225-api-type-check-20260705-010215.log`; API build passed: `/tmp/codex-tool-runs/svton/f225-api-build-20260705-010225.log`.               |

## F226. Server Executor Queued Job Processing Service Split

Purpose: P8 执行治理结构收敛（接 F225）；当前源码确认 `server-executor.service.ts`（1266 行）仍在类内持有 `processNextQueuedJob()` 的 stale recovery trigger、queued job claim、input snapshot rehydrate、execution callback、auto-retry enqueue 和 manual process audit。本轮只把已领取 queued job 的处理编排抽到 focused `*.service.ts`，保持 claim service、queue worker service、stale recovery 实现、runExecutionWithJob 执行语义、auto-retry 条件、audit action keys、HTTP route 与 Web UI 行为不变。

Assumption: F226 只处理 Server Executor queued job processing boundary；不改变 queue claim ordering/locking、recover stale running job persistence、job schema、retry delay env、cancellation token、server-agent dispatch、linked business-run sync 或页面交互。

- Business logic map: processing first triggers stale running recovery, claims one due queued job, rehydrates the saved input snapshot, executes through the main service job runner, optionally enqueues auto retry for failed/blocked results, and writes manual process audit only when an actor is supplied.
- Organization map: `ServerExecutorService` remains the execution orchestrator and stale recovery owner; `ServerExecutorQueuedJobProcessingService` should own queue processing orchestration, auto-retry eligibility/enqueue, and manual processing audit while reusing queue claim and lifecycle write services.
- Function map: worker/controller -> `ServerExecutorService.processNextQueuedJob()` delegate -> focused queued processing service -> stale recovery callback -> queue claim service -> runExecutionWithJob callback -> lifecycle enqueue/audit.
- Data flow: optional team/actor -> recovery pass -> claimed `ServerExecutionJob` input snapshot -> rehydrated `ServerExecutionInput` -> execution result -> optional retry job -> process result summary/audit metadata.
- Page structure: no Web page or interaction surface changes in this backend structure slice.

| Task   | Status | Description                                                      | Evidence                                                                                                                                                                                                                                                                                                                                                 |
| ------ | ------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F226.1 | done   | Build a source-backed map of queued job processing callers/flow. | CodeGraph CLI is present but uninitialized; manual graph confirmed `processNextQueuedJob()` is used by the queue worker callback and public/manual processing path, while claim and worker loop are already focused services and stale recovery remains a separate owner boundary.                                                                       |
| F226.2 | done   | Extract focused queued job processing service without drift.     | `server-executor-queued-job-processing.service.ts` now owns recover-before-claim orchestration, claimed job input rehydrate, run callback invocation, auto-retry enqueue, and optional manual process audit; `ServerExecutorService` delegates processing and keeps execution/stale recovery ownership. Service is 1195 lines; new service is 120 lines. |
| F226.3 | done   | Run focused API verification and hygiene checks.                 | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f226-server-executor-jest-20260705-010954.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f226-api-type-check-20260705-011005.log`; API build passed: `/tmp/codex-tool-runs/svton/f226-api-build-20260705-011015.log`.                                                         |

## F227. Server Executor Stale Running Job Recovery Service Split

Purpose: P8 执行治理结构收敛（接 F226）；当前源码确认 `server-executor.service.ts`（1195 行）仍在类内持有 `recoverStaleRunningJobs()` 和 `recoverStaleRunningJob()` 的 stale job query、compare-and-mark-failed、remote cleanup、auto retry enqueue、recovery summary aggregation 和 recovery audit。本轮只把 stale running job recovery 抽到 focused `*.service.ts`，保持 stale 判定字段、updateMany 竞争保护、remote cleanup service、retry delay、audit action keys、queue worker/manual recovery 入口、HTTP route 与 Web UI 行为不变。

Assumption: F227 只处理 Server Executor stale running recovery boundary；不改变 queue processing、queue claim ordering/locking、remote cleanup strategy、job schema、server-agent dispatch、cancellation token、linked business-run sync 或页面交互。

- Business logic map: recovery scans running jobs whose lock expired, marks each still-stale job failed with recovery metadata, runs best-effort remote cleanup, optionally enqueues auto retry when attempts remain, aggregates retry ids and cleanup counts, and writes recovery audit.
- Organization map: `ServerExecutorService` remains execution/worker orchestration owner; `ServerExecutorStaleRunningJobRecoveryService` should own stale job query, recovery mutation, remote cleanup dispatch, retry enqueue, summary aggregation, and recovery audit.
- Function map: queue processor/manual recovery -> `ServerExecutorService.recoverStaleRunningJobs()` delegate -> focused recovery service -> Prisma stale query/updateMany -> stale remote cleanup service -> lifecycle enqueue/audit.
- Data flow: optional team/actor -> stale running job rows -> compare-and-mark-failed result -> remote cleanup result -> optional retry job -> recovery summary and audit metadata.
- Page structure: no Web page or interaction surface changes in this backend structure slice.

| Task   | Status | Description                                                   | Evidence                                                                                                                                                                                                                                                                                                                                      |
| ------ | ------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F227.1 | done   | Build a source-backed map of stale running recovery flow.     | CodeGraph CLI is present but uninitialized; manual graph confirmed stale recovery is called by queued job processing and public/manual recovery paths, while remote cleanup already has a focused service and should stay as a dependency rather than being folded into recovery.                                                             |
| F227.2 | done   | Extract focused stale running recovery service without drift. | `server-executor-stale-running-job-recovery.service.ts` now owns stale query, compare-and-mark-failed, remote cleanup dispatch, retry enqueue, summary aggregation, and recovery audit; `ServerExecutorService` delegates stale recovery and keeps execution/worker orchestration ownership. Service is 1084 lines; new service is 158 lines. |
| F227.3 | done   | Run focused API verification and hygiene checks.              | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f227-server-executor-jest-20260705-011605.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f227-api-type-check-20260705-011614.log`; API build passed: `/tmp/codex-tool-runs/svton/f227-api-build-20260705-011625.log`.                                              |

## F228. Server Executor Execution Runtime Support Service Split

Purpose: P8 执行治理结构收敛（接 F227）；当前源码确认 `server-executor.service.ts`（1084 行）仍在类内持有 `runExecutionWithJob()` 的运行时支撑 wrappers：adapter resolution、live lease acquire/release、stale lease expiry delegation、job heartbeat start/extend。本轮只把这些支撑能力抽到 focused `*.service.ts`，保持 adapter 列表与选择顺序、live lease acquire/release 语义、heartbeat interval/lock expiry、runtime config、job lifecycle、queue worker、HTTP route 与 Web UI 行为不变。

Assumption: F228 只处理 Server Executor execution runtime support boundary；不改变 `runExecutionWithJob()` 的执行阶段顺序、policy/cancellation/linked business-run sync、adapter implementation、lease persistence、heartbeat persistence 或页面交互。

- Business logic map: execution resolves the first supporting adapter, acquires an optional live lease for guarded live SSH work, releases that lease with final status, exposes stale lease expiry, and maintains job lock heartbeat while the job is running.
- Organization map: `ServerExecutorService` remains the execution orchestration owner; `ServerExecutorExecutionRuntimeService` should own adapter selection plus live lease and heartbeat wrapper calls over existing focused services.
- Function map: `runExecutionWithJob()` -> runtime support service -> adapter list/live lease service/job heartbeat service; supervisor/manual endpoints still reach public lease expiry through the main service delegate.
- Data flow: guarded execution input -> adapter or not-found error; guarded input -> live lease acquire result -> leased metadata/result -> release status; job id -> heartbeat extend/start stop callback.
- Page structure: no Web page or interaction surface changes in this backend structure slice.

| Task   | Status | Description                                                      | Evidence                                                                                                                                                                                                                                                                                                    |
| ------ | ------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F228.1 | done   | Build a source-backed map of execution runtime support flow.     | CodeGraph CLI is present but uninitialized; manual graph confirmed `runExecutionWithJob()` uses adapter resolution, live lease acquire/release, and heartbeat wrappers, while lease and heartbeat persistence already live in focused services.                                                             |
| F228.2 | done   | Extract focused execution runtime support service without drift. | `server-executor-execution-runtime.service.ts` now owns adapter resolution, acquire/release/expire live lease delegation, and job heartbeat start/extend wrappers; `ServerExecutorService` delegates runtime support while keeping execution orchestration. Service is 1071 lines; new service is 72 lines. |
| F228.3 | done   | Run focused API verification and hygiene checks.                 | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f228-server-executor-jest-20260705-012520.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f228-api-type-check-20260705-012532.log`; API build passed: `/tmp/codex-tool-runs/svton/f228-api-build-20260705-012532.log`.            |

## F229. Server Agent Runtime Endpoint Service Split

Purpose: P8 执行治理结构收敛（接 F228）；当前源码确认 `server-executor.service.ts`（1071 行）仍在类内持有 server-agent runtime endpoint 编排：`recordServerAgentHeartbeat()` 的 heartbeat token 校验、Server 查询、devpilotAgent runtime 写入，以及 `readServerAgentTaskPullContract()` 的 contract token 校验、server-agent queue 计数、runtime/capability 读取和 readiness-only contract 构建。本轮只把这些端点编排抽到 focused `*.service.ts`，保持 heartbeat 写入字段、TTL/status/capabilities normalization、task-pull contract 默认关闭、readiness-only 边界、queue 计数条件、HTTP route 与 Web UI 行为不变。

Assumption: F229 只处理 Server Agent runtime endpoint boundary；不实现 task claim/ack/lifecycle execution/long connection，不改变 server-agent dispatch、target selection、queue worker、supervisor snapshot schema、job schema 或页面交互。

- Business logic map: server-agent heartbeat authenticates an agent token, stores a redacted runtime heartbeat under `services.devpilotAgent`, and returns the current runtime; task-pull contract authenticates the contract token, reads server-agent queue pressure, then returns a readiness-only contract without claiming work.
- Organization map: `ServerExecutorService` remains the execution orchestration owner; `ServerAgentRuntimeEndpointService` should own heartbeat and task-pull contract endpoint orchestration while reusing `ServerAgentAuthService`, `ServerAgentCapabilityService`, and existing task-pull contract builders.
- Function map: `ServerAgentController` -> `ServerExecutorService` delegate -> runtime endpoint service -> Prisma server/job reads + auth/capability services + contract utils.
- Data flow: headers + heartbeat DTO -> auth -> server services JSON -> devpilotAgent runtime -> response; headers + task-pull DTO -> auth -> server-agent job counts/next queued job -> readiness-only contract response.
- Page structure: no Web page or interaction surface changes in this backend structure slice.

| Task   | Status | Description                                                      | Evidence                                                                                                                                                                                                                                                                                                                                               |
| ------ | ------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F229.1 | done   | Build a source-backed map of server-agent runtime endpoint flow. | CodeGraph CLI is present but uninitialized; manual graph confirmed `ServerAgentController` calls `recordServerAgentHeartbeat()` and `readServerAgentTaskPullContract()`, existing tests cover heartbeat write/token failure and task-pull contract default-off/read-only behavior.                                                                     |
| F229.2 | done   | Extract focused runtime endpoint service without behavior drift. | `server-agent-runtime-endpoint.service.ts` now owns heartbeat persistence and readiness-only task-pull contract assembly; `server-agent-task-pull-query.service.ts` owns the agent queue pressure snapshot query; `ServerExecutorService` keeps public delegates and execution orchestration. Service is 880 lines; new services are 176 and 86 lines. |
| F229.3 | done   | Run focused API verification and hygiene checks.                 | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f229-server-executor-jest-20260705-013246.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f229-api-type-check-20260705-013300.log`; API build passed: `/tmp/codex-tool-runs/svton/f229-api-build-20260705-013300.log`.                                                       |

## F230. Server Executor Target Resolution Service Split

Purpose: P8 执行治理结构收敛（接 F229）；当前源码确认 `server-executor.service.ts`（880 行）仍在类内持有跨 deployment/backup/resource/site/log 等业务模块共用的 `resolveTarget()`：Server 查询、SSH credential target 组装、默认关闭的 server-agent target opt-in、heartbeat-required runtime eligibility 门禁和 SSH fallback。本轮只把 target resolution 编排抽到 focused `*.service.ts`，保持 public `ServerExecutorService.resolveTarget()` API、默认 SSH 行为、`SERVER_EXECUTOR_AGENT_TARGET_ENABLED`、`SERVER_EXECUTOR_AGENT_HEARTBEAT_REQUIRED`、credentialRef/agentRef shape、NotFound 行为、HTTP route 与 Web UI 行为不变。

Assumption: F230 只处理 Server Executor target resolution boundary；不改变 server-agent adapter/dispatcher、task-pull contract、queue worker、job lifecycle、resource/deployment/site/log callers、Prisma schema 或页面交互。

- Business logic map: callers request a target by team/server id; missing server id returns `transport=none`; missing server throws NotFound; existing server always carries redacted SSH credentialRef; server-agent transport is selected only when opt-in and capability/runtime gates pass, otherwise it falls back to SSH.
- Organization map: `ServerExecutorService` remains the public orchestration facade; `ServerExecutorTargetResolutionService` should own target lookup and transport-selection rules while reusing `ServerAgentCapabilityService`.
- Function map: deployment/backup/resource/site/log callers -> `ServerExecutorService.resolveTarget()` delegate -> target resolution service -> Prisma server read + capability/runtime gate -> target object.
- Data flow: team/server id -> server row -> base credential target -> optional agentRef/runtime gate -> `none`/`server_agent`/`ssh` target.
- Page structure: no Web page or interaction surface changes in this backend structure slice.

| Task   | Status | Description                                              | Evidence                                                                                                                                                                                                                                                                                                               |
| ------ | ------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F230.1 | done   | Build a source-backed map of target resolution callers.  | CodeGraph CLI is present but uninitialized; manual graph confirmed `resolveTarget()` is called by deployment, backup, resource-control, log-center, application, resource-request, site, and server-executor tests, while F70/F82 coverage already asserts default SSH, opt-in agent, and heartbeat-required fallback. |
| F230.2 | done   | Extract focused target resolution service without drift. | `server-executor-target-resolution.service.ts` now owns Server lookup, base credential target assembly, agent capability/runtime gate, and SSH fallback; `ServerExecutorService` keeps the public `resolveTarget()` delegate. Service is 828 lines; new service is 96 lines.                                           |
| F230.3 | done   | Run focused API verification and hygiene checks.         | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f230-server-executor-jest-20260705-013739.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f230-api-type-check-20260705-013755.log`; API build passed: `/tmp/codex-tool-runs/svton/f230-api-build-20260705-013755.log`.                       |

## F231. Server Executor Execution Read Query Service Split

Purpose: P8 执行治理结构收敛（接 F230）；当前源码确认 `server-executor.service.ts`（828 行）仍在类内持有 execution-governance job/lease read query 编排：`listLeases()` 先过期当前 team stale leases，再按 status/server/operation/adapter filters 查询最近 100 条 lease；`expireStaleLeasesForTeam()` 包装 stale lease expiry count；`listJobs()` 按 status/server/operation/adapter/queueMode filters 查询最近 100 条 job 并复用既有 include。本轮只把这些只读/过期查询入口抽到 focused `*.service.ts`，保持 public `ServerExecutorService` API、controller access-policy filtering、query filters、ordering、limit、include shape、stale expiry semantics、HTTP route 与 Web UI 行为不变。

Assumption: F231 只处理 Server Executor job/lease read query boundary；不改变 job lifecycle、lease acquire/release、queue worker、supervisor snapshot、controller-level access filtering、Prisma schema 或页面交互。

- Business logic map: execution-governance controllers call public job/lease list delegates, the lease list first expires stale leases for the team, then both list APIs return bounded recent rows for controller-level readability filtering.
- Organization map: `ServerExecutorService` remains the public orchestration facade; `ServerExecutorReadQueryService` should own job/lease read filters and bounded Prisma reads while using the existing stale lease expiry callback.
- Function map: lease/job controllers -> `ServerExecutorService.listLeases()`/`listJobs()` delegates -> read query service -> Prisma lease/job reads; team-admin stale expiry route -> delegate -> read query service -> runtime stale lease expiry callback.
- Data flow: query DTO -> Prisma where filters -> ordered/take 100 result rows -> controller access-policy filter -> Web execution-governance lists.
- Page structure: no Web page or interaction surface changes in this backend structure slice.

| Task   | Status | Description                                                 | Evidence                                                                                                                                                                                                                                                                                         |
| ------ | ------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F231.1 | done   | Build a source-backed map of job/lease read query callers.  | CodeGraph CLI is present but uninitialized; manual graph confirmed `listLeases()`/`expireStaleLeasesForTeam()` are called by `ServerExecutionLeaseController`, `listJobs()` is called by `ServerExecutionJobController`, and controllers keep access-policy filtering.                           |
| F231.2 | done   | Extract focused execution read query service without drift. | `server-executor-read-query.service.ts` now owns lease/job where filters, order/take/include choices, stale lease expiry count wrapper, and calls the existing stale lease expiry callback; `ServerExecutorService` keeps public delegates. Service is 804 lines; new service is 58 lines.       |
| F231.3 | done   | Run focused API verification and hygiene checks.            | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f231-server-executor-jest-20260705-014205.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f231-api-type-check-20260705-014219.log`; API build passed: `/tmp/codex-tool-runs/svton/f231-api-build-20260705-014219.log`. |

## F232. Server Executor Running Cancellation Registry Service Split

Purpose: P8 执行治理结构收敛（接 F231）；当前源码确认 `server-executor.service.ts`（804 行）仍在类内持有运行中取消 token 注册表：`runningCancellations` Map、`getRunningCancellations()` 计数、`onModuleDestroy()` cancel/stop/clear、`cancelJob()` 运行中 token signal callback，以及 `runExecutionWithJob()` register/unregister。本轮只把运行中 token registry lifecycle 抽到 focused `*.service.ts`，保持 cancellation token 创建/轮询、job cancellation persistence/audit、queue worker、runExecution 执行阶段顺序、HTTP route 与 Web UI 行为不变。

Assumption: F232 只处理 Server Executor running cancellation registry boundary；不改变 persisted cancellation polling、job cancellation state validation、job lifecycle、retry/queue/recovery、Prisma schema 或页面交互。

- Business logic map: execution creates a persisted-aware cancellation token per job, registers it by job id while running, allows cancelJob to signal the running token, bulk-cancels/stops tokens during module destroy, and unregisters each token in execution teardown.
- Organization map: `ServerExecutorService` remains the execution orchestration facade and token creator; `ServerExecutorRunningCancellationService` owns the in-memory job-id-to-token registry plus bulk cleanup.
- Function map: `runExecutionWithJob()` -> create token -> registry register/unregister; cancel route -> job cancellation service -> registry cancel by job id; module destroy -> queue worker stop -> registry cancelAndStopAll; supervisor count -> registry running count.
- Data flow: job id + mutable token -> in-memory registry -> cancel signal/stop cleanup; running count -> supervisor execution governance snapshot.
- Page structure: no Web page or interaction surface changes in this backend structure slice.

| Task   | Status | Description                                                          | Evidence                                                                                                                                                                                                                                                                                                           |
| ------ | ------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F232.1 | done   | Build a source-backed map of running cancellation registry callers.  | CodeGraph CLI is present but uninitialized; manual graph confirmed callers from `runExecutionWithJob()` register/unregister, `cancelJob()` callback signal, `onModuleDestroy()` bulk cancel/stop, and `getRunningCancellations()` supervisor count.                                                                |
| F232.2 | done   | Extract focused running cancellation registry service without drift. | `server-executor-running-cancellation.service.ts` now owns the in-memory job-id-to-token registry, running count, running cancel signal, unregister, and module-destroy bulk cancel/stop; `ServerExecutorService` keeps token creation and execution orchestration. Service is 796 lines; new service is 35 lines. |
| F232.3 | done   | Run focused API verification and hygiene checks.                     | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f232-server-executor-jest-20260705-014825.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f232-api-type-check-20260705-014838.log`; API build passed: `/tmp/codex-tool-runs/svton/f232-api-build-20260705-014839.log`.                   |

## F233. Server Executor Supervisor Type Duplicate Cleanup

Purpose: P8 执行治理结构收敛（接 F232）；当前源码确认 `server-executor.service.ts` 顶部仍残留 `WorkerLock*`、execution audit、server-agent readiness/runtime/preflight 等 supervisor snapshot type aliases，而同名/同职责类型已经由 `server-executor-supervisor.types.ts` 作为 focused type entry 提供并被 supervisor services/utils 引用。本轮只清理主 execution orchestration service 内的重复类型和随之无用的 Prisma type import，保持 execution runtime、supervisor query/build、HTTP route 与 Web UI 行为不变。

Assumption: F233 只处理 Server Executor supervisor type duplication boundary；不改变 supervisor snapshot shape、query include/filter、agent readiness calculation、runtime health、queue/lease/job behavior、Prisma schema 或页面交互。

- Business logic map: execution-governance supervisor snapshot continues to read jobs, leases, agent runtime, worker owners, remote orphan risk, and audit visibility from the existing supervisor services; this slice only removes duplicate local type declarations from the public execution facade.
- Organization map: `ServerExecutorService` remains the execution orchestration facade; `server-executor-supervisor.types.ts` remains the single type entry for supervisor snapshot nested record/preflight shapes.
- Function map: `getSupervisorSnapshot()` still delegates to `ServerExecutorSupervisorService.buildSnapshot(teamId, this)`; downstream supervisor services/utils keep importing types from `server-executor-supervisor.types.ts`.
- Data flow: Prisma query rows -> supervisor query/summary services -> supervisor snapshot DTO shape -> Web execution-governance page; no data transformation changes in this cleanup slice.
- Page structure: no Web page or interaction surface changes in this backend type-ownership cleanup slice.

| Task   | Status | Description                                              | Evidence                                                                                                                                                                                                                                                                                         |
| ------ | ------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F233.1 | done   | Build a source-backed map of duplicate supervisor types. | CodeGraph CLI is present but uninitialized; manual graph confirmed duplicate local type aliases in `server-executor.service.ts`, while supervisor services/utils import the canonical exported types from `server-executor-supervisor.types.ts`.                                                 |
| F233.2 | done   | Remove duplicate local types without behavior drift.     | Removed duplicate supervisor/agent snapshot local type aliases and the now-unused Prisma type import from `server-executor.service.ts`; canonical exported types remain in `server-executor-supervisor.types.ts`. Service is 649 lines.                                                          |
| F233.3 | done   | Run focused API verification and hygiene checks.         | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f233-server-executor-jest-20260705-015243.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f233-api-type-check-20260705-015256.log`; API build passed: `/tmp/codex-tool-runs/svton/f233-api-build-20260705-015257.log`. |

## F234. Server Executor Job Runner Service Split

Purpose: P8 执行治理结构收敛（接 F233）；当前源码确认 `server-executor.service.ts`（649 行）仍在类内持有 `runExecutionWithJob()` 的单 job 执行运行编排：token create/register/unregister、heartbeat start/stop、metadata tracking、persisted cancellation checkpoints、policy block、adapter execution、live lease acquire/release、job finish/fail、linked business-run sync 和 agent dispatch audit。本轮只把“已创建 job 的执行运行器”抽到 focused `*.service.ts`，保持 inline/queued job creation、queue worker、retry、lease/cancellation semantics、execution stage order、HTTP route 与 Web UI 行为不变。

Assumption: F234 只处理 Server Executor single-job runner boundary；不改变 command policy rules、adapter selection order、live lease persistence、cancellation polling interval source、job lifecycle writes、linked business-run sync targets、audit action keys、Prisma schema 或页面交互。

- Business logic map: inline/queued execution still creates or claims a `ServerExecutionJob`, then a runner executes the job through cancellation checks, policy evaluation, adapter execution, lease cleanup, lifecycle writes, linked run sync, and audit emission.
- Organization map: `ServerExecutorService` remains the public facade for inline/queued/supervisor APIs; `ServerExecutorJobRunnerService` owns single-job execution flow and depends on focused cancellation/runtime/lifecycle/sync/audit services; `ServerExecutorJobCompletionService` owns common finish/cancel completion writes and linked-run sync.
- Function map: `execute()` and queued processing -> job runner -> token service/running registry/runtime service/command policy/job completion service/audit; public controller methods remain delegated through `ServerExecutorService`.
- Data flow: execution input + job record -> tracked input metadata + cancellation token + runtime observer -> policy/lease/adapter result -> job lifecycle result + linked business sync + audit visibility.
- Page structure: no Web page or interaction surface changes in this backend execution-flow structure slice.

| Task   | Status | Description                                             | Evidence                                                                                                                                                                                                                                                                                                                                                          |
| ------ | ------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F234.1 | done   | Build a source-backed map of single-job execution flow. | CodeGraph CLI is present but uninitialized; manual graph confirmed `execute()` and queued processing both route into `runExecutionWithJob()`, whose flow owns token/heartbeat/policy/lease/job lifecycle/sync/audit stages.                                                                                                                                       |
| F234.2 | done   | Extract focused job runner service without drift.       | `server-executor-job-runner.service.ts` now owns token/heartbeat/policy/lease/adapter execution flow, while `server-executor-job-completion.service.ts` owns finish/cancel completion writes and linked-run sync. `ServerExecutorService` keeps inline/queued public facade delegates. Service is 475 lines; runner is 186 lines; completion service is 63 lines. |
| F234.3 | done   | Run focused API verification and hygiene checks.        | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f234-server-executor-jest-20260705-020114.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f234-api-type-check-20260705-020127.log`; API build passed: `/tmp/codex-tool-runs/svton/f234-api-build-20260705-020127.log`.                                                                  |

## F235. Server Executor Linked Business Sync Wiring Factory Split

Purpose: P8 执行治理结构收敛（接 F234）；当前源码确认 `server-executor.service.ts`（475 行）仍在 constructor 中直接组装 linked business-run sync 子服务：deployment/site/resource-action/service-operation/backup/log-collection sync、Site TLS follow-up/probe queue，以及 queued Site follow-up callback。本轮只把这段 business-run sync wiring 抽到 focused `*.service.ts` factory，保持 `ServerExecutorLinkedBusinessRunSyncService` 分派逻辑、各 domain sync service 行为、queued Site follow-up callback、job runner、HTTP route 与 Web UI 行为不变。

Assumption: F235 只处理 linked business-run sync wiring boundary；不改变 metadata.businessRunSync routing、operation approval consume、Site TLS follow-up planning、log collection ingestion、queue execution semantics、Prisma schema 或页面交互。

- Business logic map: execution results still sync linked deployment/site/resource-action/service-operation/backup/log-collection runs, and Site sync can still enqueue follow-up probe/renew execution through the existing queue callback.
- Organization map: `ServerExecutorService` remains the public execution facade; `ServerExecutorLinkedBusinessRunSyncFactoryService` owns construction of linked business-run sync collaborators; `ServerExecutorLinkedBusinessRunSyncService` keeps business routing and persistence semantics.
- Function map: constructor -> linked sync factory -> domain sync services + Site TLS follow-up/probe queue + linked business-run sync service; job runner still calls linked sync through the same `linkedBusinessRunSyncService` field.
- Data flow: execution input/result/job id -> linked business-run sync service -> domain sync service -> Prisma/domain side effects; factory only wires dependencies and does not transform data.
- Page structure: no Web page or interaction surface changes in this backend wiring structure slice.

| Task   | Status | Description                                               | Evidence                                                                                                                                                                                                                                                                                                                                |
| ------ | ------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F235.1 | done   | Build a source-backed map of linked business sync wiring. | CodeGraph CLI is present but uninitialized; manual graph confirmed the domain sync services and Site TLS follow-up queue are instantiated only in `server-executor.service.ts` constructor and passed into `ServerExecutorLinkedBusinessRunSyncService`.                                                                                |
| F235.2 | done   | Extract focused linked business sync wiring factory.      | `server-executor-linked-business-run-sync-factory.service.ts` now owns construction of deployment/site/resource-action/service-operation/backup/log-collection sync services plus Site TLS follow-up/probe queue wiring. `ServerExecutorService` keeps the public facade and queue callback. Service is 443 lines; factory is 55 lines. |
| F235.3 | done   | Run focused API verification and hygiene checks.          | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f235-server-executor-jest-20260705-020732.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f235-api-type-check-20260705-020746.log`; API build passed: `/tmp/codex-tool-runs/svton/f235-api-build-20260705-020746.log`.                                        |

## F236. Server Executor Queue Governance Wiring Factory Split

Purpose: P8 执行治理结构收敛（接 F235）；当前源码确认 `server-executor.service.ts`（443 行）仍在 constructor 中直接组装 queue/retry/recovery/worker 服务：job retry、queue claim、stale remote cleanup、stale running recovery、queued job processing 和 queue worker。本轮只把这段 queue governance wiring 抽到 focused `*.service.ts` factory，保持 retry rules、claim ordering/lock expiry、stale recovery/remote cleanup、manual process audit、queue worker loop、job runner callback、HTTP route 与 Web UI 行为不变。

Assumption: F236 只处理 Server Executor queue governance wiring boundary；不改变 queue job selection、lock/heartbeat TTL source、auto retry delay, stale recovery writes, remote cleanup behavior, queue worker enabled/batch/interval config, Prisma schema 或页面交互。

- Business logic map: queued execution still enqueues jobs, claims due jobs, recovers stale running jobs before processing, runs the claimed job through the job runner, optionally queues auto retry, and exposes worker state to execution governance.
- Organization map: `ServerExecutorService` remains the public execution facade; `ServerExecutorQueueGovernanceFactoryService` owns construction of queue/retry/recovery/worker collaborators; focused queue services keep their existing execution rules.
- Function map: constructor -> queue governance factory -> retry/claim/stale cleanup/stale recovery/queued processing/queue worker services; public `retryJob()`, `processNextQueuedJob()`, and `recoverStaleRunningJobs()` still delegate through `ServerExecutorService` fields.
- Data flow: queued job input -> lifecycle writer -> queue claim/recovery -> job runner result -> auto retry/audit -> worker state/supervisor snapshot; factory only wires collaborators and does not transform queued job data.
- Page structure: no Web page or interaction surface changes in this backend wiring structure slice.

| Task   | Status | Description                                           | Evidence                                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | ------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F236.1 | done   | Build a source-backed map of queue governance wiring. | CodeGraph CLI is present but uninitialized; manual graph confirmed retry, claim, stale recovery, queued processing, and queue worker services are instantiated only in `server-executor.service.ts` constructor and reached by public delegates/worker callbacks.                                                                                                                                     |
| F236.2 | done   | Extract focused queue governance wiring factory.      | `server-executor-queue-governance-factory.service.ts` now owns construction of job retry, queue claim, stale remote cleanup, stale running recovery, queued job processing, and queue worker services. `ServerExecutorService` keeps public delegates/callbacks. Service is 424 lines; factory is 115 lines.                                                                                          |
| F236.3 | done   | Run focused API verification and hygiene checks.      | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f236-server-executor-jest-20260705-021437.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f236-api-type-check-20260705-021437.log`; API build passed: `/tmp/codex-tool-runs/svton/f236-api-build-20260705-021437.log`; focused diff check, conflict-marker scan, trailing-whitespace scan, and symbol-boundary scan passed. |

## F237. Server Executor Supervisor Host View Service Split

Purpose: P8 执行治理结构收敛（接 F236）；当前源码确认
`server-executor.service.ts`（424 行）仍直接实现
`ServerExecutorSupervisorHost` 所需的 worker/config/task-pull 视图方法，并把
runtime config 读取细节暴露在 public facade 上。本轮只把 supervisor snapshot 的
host view 抽到 focused `*.service.ts`，保持 supervisor snapshot shape、queue
worker/lease/retry/cancellation 配置值、agent target/task-pull flags、HTTP route 与
Web UI 行为不变。

Assumption: F237 只处理 Server Executor supervisor host view boundary；不改变
queue worker loop、lease expiry、job runner cancellation polling、target resolution、
task-pull auth gates、Prisma schema 或页面交互。

- Business logic map: execution-governance snapshot still reads the same worker id,
  queue worker state, running cancellation count, runtime config seconds, stale
  lease expiry, agent capability, and task-pull flags before rendering queue and
  agent governance.
- Organization map: `ServerExecutorService` remains the execution facade;
  `ServerExecutorSupervisorHostService` owns the supervisor-only host adapter over
  queue worker, cancellation registry, runtime config, agent auth, and lease expiry.
- Function map: `getSupervisorSnapshot()` -> supervisor service ->
  supervisor host service -> queue/runtime/auth/capability collaborators; constructor
  callbacks read runtime config service directly.
- Data flow: runtime config/env values + worker/cancellation state + auth flags ->
  host view -> supervisor snapshot builder -> Web execution-governance panels.
- Page structure: no Web page or interaction surface changes in this backend
  host-view structure slice.

| Task   | Status | Description                                           | Evidence                                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | ------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F237.1 | done   | Build a source-backed map of supervisor host callers. | CodeGraph CLI is present but uninitialized; manual graph confirmed `ServerExecutorSupervisorHost` methods are consumed by supervisor snapshot builder, agent readiness summary, and supervisor service task-pull fields; external specs do not call these facade config helpers directly.                                                                                                             |
| F237.2 | done   | Extract focused supervisor host view service.         | `server-executor-supervisor-host.service.ts` now owns the supervisor-only host adapter over worker state, running cancellation count, runtime config, task-pull flags, agent capability, and stale lease expiry. `ServerExecutorService` passes that host to supervisor snapshots and uses runtime config callbacks directly. Service is 364 lines; host service is 96 lines.                         |
| F237.3 | done   | Run focused API verification and hygiene checks.      | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f237-server-executor-jest-20260705-022055.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f237-api-type-check-20260705-022055.log`; API build passed: `/tmp/codex-tool-runs/svton/f237-api-build-20260705-022055.log`; focused diff check, conflict-marker scan, trailing-whitespace scan, and symbol-boundary scan passed. |

## F238. Server Executor Execution Core Wiring Factory Split

Purpose: P8 执行治理结构收敛（接 F237）；当前源码确认
`server-executor.service.ts`（364 行）仍在 constructor 中直接组装 single-job
execution core：cancellation token、running cancellation registry、live lease、
job heartbeat、job lifecycle writer、execution runtime、job completion、job runner、
job cancellation 和 adapter list。本轮只把这段 execution core wiring 抽到
focused `*.service.ts` factory，保持 inline/queued job creation、adapter order、
lease/heartbeat TTL、cancellation polling、job lifecycle writes、linked business
sync、audit、HTTP route 与 Web UI 行为不变。

Assumption: F238 只处理 Server Executor execution core wiring boundary；不改变
command policy、adapter execution、lease expiry、queue governance、retry/recovery、
supervisor snapshot shape、Prisma schema 或页面交互。

- Business logic map: inline and queued execution still create or claim jobs,
  execute through the same adapters with the same lease/heartbeat/cancellation
  services, then finish/cancel/fail through the same lifecycle and linked-run sync.
- Organization map: `ServerExecutorService` remains the public execution facade;
  `ServerExecutorExecutionCoreFactoryService` owns construction of single-job
  execution collaborators; focused execution services keep their existing rules.
- Function map: constructor -> execution core factory -> cancellation/live
  lease/heartbeat/lifecycle/runtime/completion/runner/cancellation services;
  public `execute()`, `queueExecution()`, `cancelJob()`, queue governance callbacks,
  and supervisor host use the returned core services.
- Data flow: execution input -> lifecycle writer -> job runner -> runtime
  lease/heartbeat/adapters -> completion/lifecycle/audit/linked sync; factory only
  wires dependencies and does not transform execution data.
- Page structure: no Web page or interaction surface changes in this backend
  wiring structure slice.

| Task   | Status | Description                                         | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------ | ------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F238.1 | done   | Build a source-backed map of execution core wiring. | CodeGraph CLI is present but uninitialized; manual graph confirmed cancellation token, running cancellation registry, live lease, heartbeat, lifecycle writer, execution runtime, completion, runner, job cancellation, and adapter list are wired in `server-executor.service.ts` constructor and consumed by public delegates/queue governance/supervisor host.                                                                   |
| F238.2 | done   | Extract focused execution core wiring factory.      | `server-executor-execution-core-factory.service.ts` now owns construction of cancellation token, running cancellation registry, live lease, heartbeat, lifecycle writer, execution runtime, completion, runner, job cancellation, and adapter list. `ServerExecutorService` keeps public delegates and uses the returned core services for inline/queued/cancel/queue/supervisor paths. Service is 327 lines; factory is 122 lines. |
| F238.3 | done   | Run focused API verification and hygiene checks.    | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f238-server-executor-jest-20260705-022755.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f238-api-type-check-20260705-022755.log`; API build passed: `/tmp/codex-tool-runs/svton/f238-api-build-20260705-022755.log`; focused diff check, conflict-marker scan, trailing-whitespace scan, and symbol-boundary scan passed.                               |

## F239. Server Executor Facade Wiring Factory Split

Purpose: P8 execution-governance structure convergence (after F238); current
source confirms `server-executor.service.ts` (327 lines) still directly wires
the remaining facade collaborators: linked business sync, audit, execution core,
queue governance, agent runtime endpoint, target resolution, read queries, and
supervisor host. This slice only moves that constructor collaborator assembly
into a focused wiring factory, keeping public facade methods, queue behavior,
agent runtime/task-pull contracts, target resolution, supervisor snapshot shape,
HTTP routes, and Web UI behavior unchanged.

Assumption: F239 only changes Server Executor constructor wiring. It does not
change command policy, adapter execution, queue/retry/recovery rules,
agent-auth gates, target-selection semantics, Prisma schema, or page
interactions.

- Business logic map: public execution APIs still delegate to the same focused
  execution, queue, read, target, agent runtime, and supervisor services.
- Organization map: `ServerExecutorService` remains the public facade;
  `ServerExecutorWiringFactoryService` owns construction of facade
  collaborators by composing existing focused factories and services.
- Function map: constructor -> wiring factory -> linked sync/audit/execution
  core/queue governance/read-target-agent-supervisor services; public methods
  remain one-hop delegates.
- Data flow: execution input, queued job state, heartbeat/task-pull requests,
  read queries, and supervisor snapshot requests still flow through the same
  downstream services; the factory only wires dependencies.
- Page structure: no Web page or interaction surface changes in this backend
  wiring structure slice.

| Task   | Status | Description                                      | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------ | ------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F239.1 | done   | Build a source-backed map of facade wiring.      | CodeGraph CLI is present but uninitialized; manual graph confirmed the remaining constructor collaborators are assembled in `server-executor.service.ts` and consumed only by public facade delegates, queue callbacks, and supervisor snapshot reads.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| F239.2 | done   | Extract focused facade wiring factory.           | `server-executor-wiring-factory.service.ts` now owns facade collaborator assembly by composing linked business sync, audit, execution core, queue governance, agent runtime endpoint, target resolution, read query, and supervisor host services. `server-executor-submission.service.ts` owns execute/queue/cancel submission delegates, and `server-executor.service.ts` is a 196-line public facade.                                                                                                                                                                                                                                                                           |
| F239.3 | done   | Run focused API verification and hygiene checks. | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f239-server-executor-jest-20260705-023558.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f239-api-type-check-20260705-023558.log`; API build passed: `/tmp/codex-tool-runs/svton/f239-api-build-20260705-023558.log`; line-count, diff check, conflict-marker scan, and trailing-whitespace scan passed: `/tmp/codex-tool-runs/svton/f239-line-count-final-20260705-023647.log`, `/tmp/codex-tool-runs/svton/f239-diff-check-20260705-023638.log`, `/tmp/codex-tool-runs/svton/f239-conflict-scan-20260705-023638.log`, `/tmp/codex-tool-runs/svton/f239-trailing-whitespace-scan-20260705-023638.log`. |

## F240. DB Job Queue Repository Boundary Split

Purpose: P8 execution-governance structure convergence (after F239); current
source confirms `server-executor/queue/db-job-queue.ts` is 242 lines and mixes
queued-job persistence primitives with live-lease persistence primitives plus
config reads and unique-constraint handling. This slice only splits the current
Prisma-backed queue adapter into focused repository boundaries while preserving
the `JobQueuePort` contract, DB compare-and-set semantics, lease conflict
behavior, worker id ownership, env defaults, HTTP routes, and Web UI behavior.

Assumption: F240 keeps the current DB queue implementation. The existing port
already documents the BullMQ replacement seam; replacing queue technology is a
separate product/infrastructure decision and is not needed for this structure
slice.

- Business logic map: queue worker still claims due jobs, extends locks,
  completes jobs, recovers stale running jobs, and acquires/releases/cleans
  live execution leases through `JOB_QUEUE_PORT`.
- Organization map: `DbJobQueue` remains the Nest provider implementing
  `JobQueuePort`; focused repositories own serverExecutionJob persistence and
  serverExecutionLease persistence.
- Function map: `ServerExecutorQueueModule` -> `DbJobQueue` -> queued-job
  repository or live-lease repository; server-executor services continue to
  consume only `JobQueuePort`.
- Data flow: queued job rows -> compare-and-set running lock -> claimed job DTO;
  lock heartbeat/completion/recovery update rows; live lease acquire handles DB
  unique conflict and returns blocking lease details.
- Page structure: no Web page or interaction surface changes in this backend
  persistence structure slice.

| Task   | Status | Description                                      | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------ | ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F240.1 | done   | Build a source-backed map of DB queue duties.    | CodeGraph CLI is present but uninitialized; manual graph confirmed `DbJobQueue` is bound in `ServerExecutorQueueModule` as `JOB_QUEUE_PORT`, its callers go through `JobQueuePort`, and the file mixes queued job persistence, lease persistence, config reads, and unique-constraint handling.                                                                                                                                                                                                                                                                                                                                                                    |
| F240.2 | done   | Extract focused DB queue repository boundaries.  | `DbJobQueue` remains the Nest provider and `JobQueuePort` facade. Queued job claim/heartbeat/completion/recovery persistence now lives in `db-queued-job.repository.ts`; live lease acquire/release/expire persistence and unique-constraint handling now live in `db-live-lease.repository.ts`. `db-job-queue.ts` is 67 lines, queued repository is 156 lines, and live-lease repository is 90 lines.                                                                                                                                                                                                                                                             |
| F240.3 | done   | Run focused API verification and hygiene checks. | Focused DB queue Jest passed: `/tmp/codex-tool-runs/svton/f240-db-job-queue-jest-20260705-024238.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f240-api-type-check-20260705-024238.log`; API build passed: `/tmp/codex-tool-runs/svton/f240-api-build-20260705-024238.log`; line-count, diff check, conflict-marker scan, and trailing-whitespace scan passed: `/tmp/codex-tool-runs/svton/f240-line-count-20260705-024312.log`, `/tmp/codex-tool-runs/svton/f240-diff-check-20260705-024312.log`, `/tmp/codex-tool-runs/svton/f240-conflict-scan-20260705-024312.log`, `/tmp/codex-tool-runs/svton/f240-trailing-whitespace-scan-20260705-024312.log`. |

## F280. Operation Approval Repository Boundary Split

Purpose: continue P8 approval-governance structure convergence after F240. Current
source confirms `operation-approval.service.ts` is 413 lines and mixes approval
request/review/consume business rules with Prisma include/create/update shapes.
This slice only extracts the persistence, include projection, approval-match rule,
and shared record shape boundaries while preserving approval
list/reuse/review/resolve/consume behavior, access policy assertions, audit
payloads, HTTP routes, and Web UI behavior.

Assumption: F280 is a structure slice for operation approval only; it does not
change RBAC policy decisions, approval status transitions, audit semantics,
Prisma schema, queue behavior, or page interactions.

- Business logic map: requesters can still create or reuse pending approvals,
  reviewers approve/reject pending approvals, execution resolves only approved
  unconsumed matching approvals, and consume marks approved approvals used.
- Organization map: `OperationApprovalService` remains the public approval
  business facade; a focused repository owns Prisma include/read/write shapes and
  shared approval record types.
- Function map: controller/server-executor callers -> service -> access policy
  checks + repository reads/writes + match service + audit writer.
- Data flow: approval input -> access assertion -> repository persistence ->
  approval record -> audit payload; resolve/consume read/update the same approval
  rows through the repository boundary.
- Page structure: no Web page or interaction surface changes in this backend
  repository-boundary slice.

| Task   | Status | Description                                          | Allowed Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Read-only Files                                                                                                                                                                                                                          | Forbidden Scope                                                                                                    | Acceptance                                                                                                                                                                              | Verification                                                                                                          | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | ------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F280.1 | done   | Build a source-backed map of approval service seams. | `docs-internal/devpilot/progress/P8-ops-governance.md`, `docs-internal/todos/2026-06-25-existing-project-onboarding.md`                                                                                                                                                                                                                                                                                                                                                                                                          | `apps/devpilot-api/src/operation-approval/operation-approval.service.ts`, `apps/devpilot-api/src/operation-approval/operation-approval.controller.spec.ts`, `apps/devpilot-api/src/operation-approval/operation-approval.module.ts`      | No schema, controller route, policy, audit, Web, queue, or server-executor behavior changes.                       | Map confirms a single-module repository-boundary slice with no cross-module write need.                                                                                                 | Bounded source reads and scoped line-count scan only.                                                                 | Manual graph confirmed `OperationApprovalService` is only provided/exported in the operation-approval module, consumed by its controller/module exports, and directly owns Prisma list/reuse/create/review/resolve/consume shapes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| F280.2 | done   | Extract focused repository and shared record types.  | `apps/devpilot-api/src/operation-approval/operation-approval.service.ts`, `apps/devpilot-api/src/operation-approval/operation-approval.repository.ts`, `apps/devpilot-api/src/operation-approval/operation-approval.types.ts`, `apps/devpilot-api/src/operation-approval/operation-approval-match.service.ts`, `apps/devpilot-api/src/operation-approval/operation-approval-includes.constants.ts`, `apps/devpilot-api/src/operation-approval/operation-approval.module.ts`, `apps/devpilot-api/src/operation-approval/index.ts` | `apps/devpilot-api/src/operation-approval/operation-approval.controller.ts`, `apps/devpilot-api/src/operation-approval/dto/operation-approval.dto.ts`, `apps/devpilot-api/src/operation-approval/operation-approval-list-query.utils.ts` | No DTO/API shape, access-policy rule, audit-event contract, Prisma schema, queue, server-executor, or Web changes. | Service no longer injects `PrismaService` or owns Prisma include/create/update shapes; new source files stay under 200 lines; public methods preserve existing signatures and behavior. | Focused operation-approval Jest plus API type-check/build; source line-count check.                                   | `OperationApprovalRepository` owns list/reuse/create/review/consume Prisma access; `OPERATION_APPROVAL_INCLUDE` owns shared projections; `OperationApprovalMatchService` owns approval/input match assertions; `OperationApprovalService` is a 198-line facade. New files: repository 125, includes 79, types 51, match service 44 lines.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| F280.3 | done   | Run focused verification and sync docs.              | `docs-internal/devpilot/progress/P8-ops-governance.md`, `docs-internal/todos/2026-06-25-existing-project-onboarding.md`, `docs-internal/devpilot/progress/INDEX.md`, `docs-internal/devpilot/roadmap/05-phases.md`, `docs-internal/devpilot/refactor-architecture.md`, `/tmp/codex-tool-runs/svton/` logs.                                                                                                                                                                                                                       | Touched source files and focused verification logs.                                                                                                                                                                                      | No broad unrelated doc rewrites or historical session replay.                                                      | Progress/TODO evidence records changed files, verification commands, line counts, and any residual risks.                                                                               | Focused Jest, API type-check/build as needed, line-count, diff check, conflict-marker scan, trailing-whitespace scan. | Docs Prettier write/check passed: `/tmp/codex-tool-runs/svton/f280-prettier-write-docs-20260710-170059.log`, `/tmp/codex-tool-runs/svton/f280-prettier-check-after-write-20260710-170124.log`; focused operation-approval Jest passed: `/tmp/codex-tool-runs/svton/f280-operation-approval-jest-20260710-170045.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f280-api-type-check-20260710-170124.log`; API build passed: `/tmp/codex-tool-runs/svton/f280-api-build-20260710-170144.log`; line-count, diff check, conflict-marker scan, and trailing-whitespace scan passed: `/tmp/codex-tool-runs/svton/f280-line-count-20260710-170144.log`, `/tmp/codex-tool-runs/svton/f280-diff-check-20260710-170144.log`, `/tmp/codex-tool-runs/svton/f280-conflict-scan-20260710-170207.log`, `/tmp/codex-tool-runs/svton/f280-trailing-whitespace-scan-20260710-170207.log`. |

## F281. Operation Approval Rule Requirement Evaluation

Purpose: when a high-risk operation creates an approval request, attach a
source-backed requirement explanation based on existing control access policy
rules. This slice keeps existing blocked-run behavior and approval APIs stable,
and only enriches the approval record metadata returned by `createPending`.

| Task   | Status | Description                                                                                        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F281.1 | done   | Map the current approval creation flow, reusable rule source, and smallest compatible return path. | Manual graph confirmed `createPending()` is called by resource/action, service operation, deployment, and site live paths after those callers already decide an approval is required. The reusable rule source is `ControlAccessPolicy` scope/principal/action/risk matching; there is no separate operation approval rule model.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| F281.2 | done   | Add focused rule requirement evaluation and metadata enrichment without changing caller contracts. | `OperationApprovalRequirementService` now evaluates approval requirements from existing `ControlAccessPolicy` scope/category/action/risk rules, records resource type (`targetType`), operation type (`action`), environment, requester role, default/admin reviewer rule, owner bypass, extra allowed roles/users, and matched policies under `metadata.approvalRequirement`. `OperationApprovalAuditService` keeps the public facade under 200 lines while preserving the existing audit payload.                                                                                                                                                                                                                                                                                                                                                                          |
| F281.3 | done   | Run focused API verification and sync TODO/progress evidence.                                      | Focused operation-approval Jest passed: `/tmp/codex-tool-runs/svton/f281-operation-approval-jest-20260710-175310.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f281-api-type-check-20260710-175324.log`; API build passed: `/tmp/codex-tool-runs/svton/f281-api-build-20260710-175335.log`; final Prettier, diff check, conflict scan, and trailing-whitespace scan passed: `/tmp/codex-tool-runs/svton/f281-final-prettier-check2-20260710-175600.log`, `/tmp/codex-tool-runs/svton/f281-final-diff-check2-20260710-175600.log`, `/tmp/codex-tool-runs/svton/f281-final-conflict-scan2-20260710-175600.log`, `/tmp/codex-tool-runs/svton/f281-final-trailing-whitespace-scan2-20260710-175600.log`; line-count confirmed touched operation-approval files remain ≤200 lines (service 187, requirement service 130, requirement repository 66, audit service 41). |

## F282. Control Access Policy Repository Boundary Split

Purpose: continue P8 access-governance structure convergence after F281. Current
source confirms `control-access-policy.service.ts` is 465 lines and mixes policy
CRUD orchestration, Prisma include/read/write shapes, membership lookup,
candidate policy loading, binding existence checks, matcher helpers, and audit
payload construction. This slice only extracts the Prisma-backed repository
boundary while preserving policy list/create/update/delete behavior, allow/deny
matching semantics, owner/default role fallback, audit payloads, HTTP routes,
DTOs, and Web UI behavior.

Assumption: F282 is a backend structure slice for control-access-policy only; it
does not change RBAC decisions, policy priority/order, policy matching, Prisma
schema, controller routes, operation-approval integration, or page interactions.

- Business logic map: policy CRUD still validates bindings and principals,
  writes audit events, and access checks still resolve membership, load
  candidate policies, then apply deny/allow/default-role decisions.
- Organization map: `ControlAccessPolicyService` remains the public facade; a
  focused repository owns Prisma policy reads/writes, membership lookup, and
  binding existence reads.
- Function map: controller and downstream modules -> service -> repository
  persistence/read helpers + policy matcher + audit event writer.
- Data flow: DTO/input -> service validation -> repository persistence or
  candidate policy reads -> service matching decision -> audit/response.
- Page structure: no Web page or interaction surface changes in this backend
  repository-boundary slice.

| Task   | Status | Description                                                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F282.1 | done   | Build a source-backed map of access-policy service seams.     | Routing: focused slice + noisy-tools verification; no multi-agent needed because the change is confined to P8 `control-access-policy` backend files and docs. Manual graph confirmed `ControlAccessPolicyService` owned CRUD, policy matching, membership/binding reads, audit writes, and public access-check methods; controller and downstream modules consume the service facade.                                                                                                                                                                                                                                                                                                                                                                            |
| F282.2 | done   | Extract focused repository while preserving service behavior. | `ControlAccessPolicyRepository` now owns Prisma list/create/update/delete, membership lookup, binding existence reads, and candidate policy loading; `ControlAccessPolicyCrudService` owns CRUD orchestration and validation; `ControlAccessPolicyAccessService` owns deny/allow/default-role decisions; `ControlAccessPolicyAuditService` owns audit payload writes; `ControlAccessPolicyService` remains a 101-line public facade. Non-spec control-access-policy source files are all ≤200 lines (repository 199, CRUD 178, access 106, facade 101).                                                                                                                                                                                                          |
| F282.3 | done   | Run focused verification and sync docs.                       | Focused control-access-policy Jest passed: `/tmp/codex-tool-runs/svton/f282-control-access-policy-jest-rerun-20260710.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f282-api-type-check-rerun-20260710.log`; API build passed: `/tmp/codex-tool-runs/svton/f282-api-build-rerun-20260710.log`; Prettier, line-count, diff check, conflict-marker scan, and trailing-whitespace scan passed: `/tmp/codex-tool-runs/svton/f282-final-prettier-check-20260710.log`, `/tmp/codex-tool-runs/svton/f282-line-count-rerun-20260710.log`, `/tmp/codex-tool-runs/svton/f282-final-diff-check-20260710.log`, `/tmp/codex-tool-runs/svton/f282-final-conflict-scan-20260710.log`, `/tmp/codex-tool-runs/svton/f282-final-trailing-whitespace-scan-20260710.log`. |

## F286. Server-agent Task-pull Log Follow Sample

Purpose: improve the default-off, read-only server-agent task-pull contract
without implementing claim/ack/lifecycle runtime. The contract now exposes a
safe log-follow hint for the next queued `server_agent` log collection job so
agent/runtime operators can distinguish log follow demand from generic execution
demand.

| Task   | Status | Description                                                        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | ------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F286.1 | done   | Map the task-pull contract sample path and queued job metadata.    | Manual graph confirmed `ServerAgentController.taskPullContract()` delegates to `ServerAgentRuntimeEndpointService.readTaskPullContract()`, which reads `ServerAgentTaskPullQueryService.readQueueSnapshot()` and serializes `nextQueuedJob` through `buildServerAgentTaskPullSample()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| F286.2 | done   | Add a whitelisted log-follow sample object without changing queue. | `ServerAgentTaskPullQueryService` selects `inputSnapshot`, and `buildServerAgentTaskPullSample()` now emits optional `logFollow` for `log.collect.*` agent-follow jobs. The sample remains readiness-only and does not expose the full snapshot, command plan, token, Secret, log content, claim, ack, or lifecycle payload.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| F286.3 | done   | Run focused API verification and sync docs.                        | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f286-server-executor-jest-20260710-203342.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f286-api-type-check-20260710-203358.log`; API build passed: `/tmp/codex-tool-runs/svton/f286-api-build-20260710-203429.log`; final Prettier/diff/conflict/trailing checks passed: `/tmp/codex-tool-runs/svton/f286-final-prettier-check-rerun-20260710-204729.log`, `/tmp/codex-tool-runs/svton/f286-final-diff-check-rerun-20260710-204729.log`, `/tmp/codex-tool-runs/svton/f286-final-conflict-scan-clean2-20260710-204815.log`, `/tmp/codex-tool-runs/svton/f286-final-trailing-whitespace-scan-clean2-20260710-204816.log`; touched production line-count is 87/120/108. |

## F287. Server-agent Task-pull Claim Boundary

Purpose: move P8 server-agent task-pull governance from visibility-only
readiness to a default-off claim boundary. The new claim path is still gated by
task-pull auth/config and only marks matching ready `server_agent` jobs running;
ack/completion, lifecycle execution, dispatcher execution, long connection,
result writeback, and log content writeback remain out of scope.

| Task   | Status | Description                                                        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------ | ------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F287.1 | done   | Map task-pull claim endpoint, auth, queue claim, and sample flow.  | Routing: focused slice + noisy-tools verification; manual graph confirmed `ServerAgentController.taskPullClaim()` delegates through `ServerExecutorService` and `ServerAgentRuntimeEndpointService` to `ServerAgentTaskPullClaimService`, with queue mutation isolated in `ServerAgentTaskPullQueryService.claimNextReadyJob()`.                                                                                                                                            |
| F287.2 | done   | Add the default-off server-agent claim endpoint and safe envelope. | `POST /server-agent/task-pull/claim` now uses the task-pull token and `SERVER_EXECUTOR_AGENT_TASK_PULL_ENABLED`; claim filters `teamId/serverId/transport=server_agent/status=queued/queueMode=queued/availableAt<=now`, sets running lock fields, and returns only a safe job sample plus optional `logFollow` hint. Contract/supervisor readiness now report claim support when task-pull is enabled, while ack/lifecycle stay unsupported.                               |
| F287.3 | done   | Run focused API verification and sync docs.                        | Final focused claim/server-executor Jest passed: `/tmp/codex-tool-runs/svton/f287-final-jest-20260710-214926.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f287-final-api-type-check-20260710-214926.log`; API build passed: `/tmp/codex-tool-runs/svton/f287-final-api-build-20260710-214926.log`; touched production line-count passed: `/tmp/codex-tool-runs/svton/f287-line-count-20260710-214854.log` (43/118/121/125/129/130/150/157/171/182/183/193/193). |

## F288. Server-agent Task-pull Ack Boundary

Purpose: move P8 server-agent task-pull governance one step beyond claim by
adding a default-off ack boundary. The new endpoint confirms that a claimed
running `server_agent` job still belongs to the requesting server/agent lock
owner and renews lock heartbeat state only; completion/failure, lifecycle
execution, result/log writeback, dispatcher execution, and long connection stay
out of scope.

| Task   | Status | Description                                                      | Evidence                                                                                                                                                                                                                                                                                                                                                            |
| ------ | ------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F288.1 | done   | Map task-pull ack endpoint, auth, running lock, and response.    | Routing: focused slice + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed ack should only renew the matching claimed running job lock and safe response.                                                                                                                                                                          |
| F288.2 | done   | Add the default-off server-agent ack endpoint and safe envelope. | Added `POST /server-agent/task-pull/ack`, `ServerAgentTaskPullAckService`, `ServerAgentTaskPullAckDto`, and shared lock-owner utility; ack renews lock heartbeat state and keeps terminal lifecycle/log/result writeback out of scope.                                                                                                                              |
| F288.3 | done   | Run focused API verification and sync docs.                      | Focused ack/server-executor Jest passed: `/tmp/codex-tool-runs/svton/f288-final-jest-20260710-221447.log`; API type-check/build passed: `/tmp/codex-tool-runs/svton/f288-api-type-check-20260710-221447.log`, `/tmp/codex-tool-runs/svton/f288-api-build-20260710-221447.log`; line-count passed: `/tmp/codex-tool-runs/svton/f288-line-count-20260710-221447.log`. |

## F289. Server-agent Task-pull Terminal Writeback Boundary

Purpose: move P8 server-agent task-pull governance one step beyond ack by adding
a default-off terminal writeback boundary. The new endpoint confirms that a
claimed running `server_agent` job still belongs to the requesting
server/agent lock owner, writes the agent-reported terminal status/log/result
payload, and releases the lock; adapter/dispatcher execution, long connection,
automatic retry, and broader business-run sync remain follow-ups.

| Task   | Status | Description                                                             | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F289.1 | done   | Map task-pull finish endpoint, auth, running lock, and writeback.       | Routing: focused slice + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed finish should only write a matching claimed running `server_agent` job for the same `teamId/serverId/jobId/lockOwner`, then release lock fields.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| F289.2 | done   | Add the default-off server-agent finish endpoint and writeback service. | Added `POST /server-agent/task-pull/finish`, `ServerAgentTaskPullFinishDto`, and `ServerAgentTaskPullFinishService`; finish accepts only `completed`/`failed`/`cancelled`, writes optional commandPlan/logs/result/error, clears lock heartbeat fields, and keeps adapter/dispatcher execution and auto-retry out of scope. Contract, claim, ack, and supervisor metadata now advertise terminal writeback support while keeping lifecycle execution false.                                                                                                                                                                                                                                                                                    |
| F289.3 | done   | Run focused API verification and sync docs.                             | Focused finish/ack/claim/server-executor Jest passed: `/tmp/codex-tool-runs/svton/f289-final-jest-20260710-222358.log`; API type-check/build passed: `/tmp/codex-tool-runs/svton/f289-final-api-type-check-20260710-222433.log`, `/tmp/codex-tool-runs/svton/f289-final-api-build-20260710-222433.log`; line-count passed: `/tmp/codex-tool-runs/svton/f289-final-line-count-20260710-222358.log`; final hygiene passed: `/tmp/codex-tool-runs/svton/f289-final-prettier-check-20260710-222358.log`, `/tmp/codex-tool-runs/svton/f289-final-diff-check-20260710-222358.diff`, `/tmp/codex-tool-runs/svton/f289-final-conflict-scan-20260710-222433.log`, `/tmp/codex-tool-runs/svton/f289-final-trailing-whitespace-scan-20260710-222433.log`. |

## F290. Server-agent Task-pull Log Collection Finish Sync

Purpose: add one governed linked-run writeback after terminal finish. The
default-off finish path now syncs only `businessRunSync=log_collection`
snapshots that carry a `logCollectionRunId`, preserving the existing
team/server/agent lock-owner guard and leaving long connection runtime,
adapter/dispatcher execution, auto-retry, and broader business-run sync out of
scope.

| Task   | Status | Description                                                           | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F290.1 | done   | Map finish to log collection linked-run sync and governance boundary. | Routing: focused slice + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed finish should delegate linked-run sync only after the claimed running job writeback succeeds, and only through the log collection sync service.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| F290.2 | done   | Add focused sync service and finish response metadata.                | Added `ServerAgentTaskPullFinishSyncService`; finish now reports `linkedRunSync`, can sync terminal logs/result/error into `LogCollectionRun` for log collection snapshots, and attempts completed-run ingestion only after a matched run update, while every non-log business run remains a no-op.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| F290.3 | done   | Run focused API verification and sync docs.                           | Post-format focused task-pull/server-executor Jest passed: `/tmp/codex-tool-runs/svton/f290-post-format-jest-20260710-223644.log`; post-format API type-check passed: `/tmp/codex-tool-runs/svton/f290-post-format-api-type-check-20260710-223644.log`; API build passed: `/tmp/codex-tool-runs/svton/f290-api-build-20260710-223226.log`; final Prettier/line-count/hygiene passed: `/tmp/codex-tool-runs/svton/f290-prettier-check-20260710-223614.log`, `/tmp/codex-tool-runs/svton/f290-line-count-rerun-20260710-223625.log`, `/tmp/codex-tool-runs/svton/f290-diff-check-20260710-223614.log`, `/tmp/codex-tool-runs/svton/f290-conflict-scan-20260710-223614.log`, `/tmp/codex-tool-runs/svton/f290-trailing-whitespace-scan-20260710-223614.log`. |

## F291. Server-agent Task-pull Non-log Business-run Finish Sync

Purpose: complete the smallest non-log linked-run terminal sync after F290. The
default-off finish path now reuses the existing linked business-run sync boundary
for `deployment`, `site_sync`, `resource_action`, `service_operation`, and
`backup_run` metadata after a claimed running `server_agent` job writes terminal
status/log/result/error. Log collection keeps its dedicated ingestion metadata;
long connection runtime, adapter/dispatcher execution, auto-retry, and broader
runtime orchestration remain follow-ups.

| Task   | Status | Description                                                       | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F291.1 | done   | Map finish sync to existing non-log linked business-run sync.     | Routing: long-goal focused slice + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed `ServerAgentTaskPullFinishService` writes terminal job state, then delegates `linkedRunSync` to `ServerAgentTaskPullFinishSyncService`, which can reuse `ServerExecutorLinkedBusinessRunSyncService` for supported non-log `businessRunSync` metadata while preserving the log-collection special path.                                                                                                                                                                                                                                                                                                                                                    |
| F291.2 | done   | Sync non-log business runs without changing finish runtime scope. | `ServerAgentTaskPullFinishSyncService` now no-ops unsupported metadata before snapshot rehydration, keeps `log_collection` on `ServerExecutorLogCollectionRunSyncService`, and delegates `deployment`/`site_sync`/`resource_action`/`service_operation`/`backup_run` to `ServerExecutorLinkedBusinessRunSyncService.syncAfterExecution()`, including existing linked approval consumption only when a linked run actually syncs.                                                                                                                                                                                                                                                                                                                                                 |
| F291.3 | done   | Run focused API verification and sync docs.                       | Focused task-pull/server-executor Jest passed: `/tmp/codex-tool-runs/svton/f291-focused-jest-pass-20260711-002112.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f291-api-type-check-20260711-002134.log`; API build passed: `/tmp/codex-tool-runs/svton/f291-api-build-20260711-002146.log`; final Prettier/line-count/diff/conflict/trailing checks passed: `/tmp/codex-tool-runs/svton/f291-final-doc-prettier-check2-20260711-002527.log`, `/tmp/codex-tool-runs/svton/f291-final-line-count-20260711-002352.log`, `/tmp/codex-tool-runs/svton/f291-final-doc-diff-check2-20260711-002528.log`, `/tmp/codex-tool-runs/svton/f291-final-conflict-scan2-20260711-002540.log`, `/tmp/codex-tool-runs/svton/f291-final-trailing-whitespace-scan2-20260711-002540.log`. |

## F292. Server-agent Task-pull Claimed Task Payload

Purpose: after F291 completed terminal linked-run sync, expose the smallest
agent-facing execution payload on successful claim. F292 only adds a
white-listed task envelope derived from the claimed job input snapshot so the
agent can see operation, target, command steps, warnings, and safe correlation
metadata. It does not enable lifecycle execution, long connection runtime,
adapter dispatch, auto-retry, or raw input snapshot exposure.

| Task   | Status | Description                                                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------ | ------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F292.1 | done   | Map claim response to a sanitized task payload boundary.     | Routing: long-goal focused slice + noisy-tools verification; CodeGraph is uninitialized, so manual graphing was limited to task-pull claim, job sample, input snapshot rehydration, server-agent dispatch envelope utilities, and focused specs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| F292.2 | done   | Return claimed task payload without expanding runtime scope. | `POST /server-agent/task-pull/claim` now returns `task` with operation/adapter, dryRun, redacted target, command steps, warnings, safe correlation, and whitelisted metadata. The job sample still omits `inputSnapshot`, claim metadata still reports `lifecycleExecutionSupported=false`, and contract/gates now expose `claimedTaskPayloadSupported`.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| F292.3 | done   | Run focused API verification and sync docs.                  | Focused task-pull/server-executor Jest passed: `/tmp/codex-tool-runs/svton/f292-final-focused-jest-20260711-003612.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f292-final-api-type-check-20260711-003626.log`; API build passed: `/tmp/codex-tool-runs/svton/f292-final-api-build-20260711-003626.log`; final Prettier/line-count/diff/conflict/trailing checks passed: `/tmp/codex-tool-runs/svton/f292-final-prettier-check-20260711-003923.log`, `/tmp/codex-tool-runs/svton/f292-line-count-20260711-003822.log`, `/tmp/codex-tool-runs/svton/f292-final-diff-check-20260711-003924.log`, `/tmp/codex-tool-runs/svton/f292-final-conflict-scan-20260711-003924.log`, `/tmp/codex-tool-runs/svton/f292-final-trailing-whitespace-scan-20260711-003924.log`. |

## F293. Server-agent Task-pull Terminal Command-plan Fallback

Purpose: after F292 exposed the claimed task payload, persist the smallest
terminal execution summary when an agent finishes a claimed task without
resending a full `commandPlan`. F293 only derives a sanitized terminal
command-plan fallback from the claimed job snapshot and finish status. It does
not enable long connection runtime, server-side adapter dispatch, auto-retry,
or arbitrary agent metadata persistence.

| Task   | Status | Description                                                     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F293.1 | done   | Map finish writeback to claimed snapshot command-plan fallback. | Routing: focused P8 task-pull slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to finish service, finish sync, claimed task payload utils, Prisma job commandPlan field, and focused finish/payload specs.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| F293.2 | done   | Persist fallback terminal command-plan summary on finish.       | `ServerAgentTaskPullFinishService` now reads the matching claimed job before terminal writeback, derives `agent_task_pull_terminal_summary` from the claimed task payload when `dto.commandPlan` is omitted, writes it to `ServerExecutionJob.commandPlan`, and passes the same fallback to linked-run finish sync while preserving the lock-checked `updateMany` terminal state write.                                                                                                                                                                                                                                                                                                                                        |
| F293.3 | done   | Run focused API verification and sync docs.                     | Focused task-pull Jest passed: `/tmp/codex-tool-runs/svton/f293-focused-jest-after-format-20260711-121909.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f293-api-type-check-20260711-121926.log`; API build passed: `/tmp/codex-tool-runs/svton/f293-api-build-20260711-121926.log`; final Prettier/line-count/diff/conflict/trailing checks passed: `/tmp/codex-tool-runs/svton/f293-prettier-check-20260711-122102.log`, `/tmp/codex-tool-runs/svton/f293-line-count-20260711-122102.log`, `/tmp/codex-tool-runs/svton/f293-diff-check-20260711-122102.log`, `/tmp/codex-tool-runs/svton/f293-conflict-scan-20260711-122102.log`, `/tmp/codex-tool-runs/svton/f293-trailing-whitespace-scan-20260711-122112.log`. |

## F294. Server-agent Task-pull Terminal Result Fallback

Purpose: after F293 made the terminal command plan traceable, persist a minimal
terminal outcome when an agent finishes a claimed task without sending explicit
`logs` or `result`. F294 only derives default job-level logs/result from the
finish status and job id, then passes the same outcome to linked-run sync. It
does not enable long connection runtime, server-side adapter dispatch,
auto-retry, or arbitrary agent metadata persistence.

| Task   | Status | Description                                             | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F294.1 | done   | Map finish writeback to job-level logs/result fallback. | Routing: focused P8 task-pull slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to finish service, finish sync outcome fallback, Prisma job logs/result fields, and focused finish specs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| F294.2 | done   | Persist fallback terminal logs/result on finish.        | `ServerAgentTaskPullFinishService` now builds a terminal outcome before writeback. When the agent omits `logs` or `result`, it writes a minimal status/job-id fallback to `ServerExecutionJob.logs/result` and passes the same outcome to linked-run finish sync while preserving supplied agent logs/result and lock-checked terminal state writes.                                                                                                                                                                                                                                                                                                                                                                                                           |
| F294.3 | done   | Run focused API verification and sync docs.             | Focused task-pull Jest passed: `/tmp/codex-tool-runs/svton/f294-focused-jest-after-line-fix-20260711-122623.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f294-api-type-check-20260711-122644.log`; API build passed: `/tmp/codex-tool-runs/svton/f294-api-build-20260711-122644.log`; final Prettier/line-count/diff/conflict/trailing checks passed: `/tmp/codex-tool-runs/svton/f294-final-prettier-check-20260711-122816.log`, `/tmp/codex-tool-runs/svton/f294-final-line-count-20260711-122816.log`, `/tmp/codex-tool-runs/svton/f294-final-diff-check-20260711-122816.log`, `/tmp/codex-tool-runs/svton/f294-final-conflict-scan-20260711-122816.log`, `/tmp/codex-tool-runs/svton/f294-final-trailing-whitespace-scan-20260711-122828.log`. |

## F295. Server-agent Task-pull Ack Cancellation Hint

Purpose: after F294 completed terminal outcome fallback, expose the smallest
runtime cancellation signal through the existing ack heartbeat. F295 only
returns a whitelisted `cancellation` hint when a claimed running job has
`cancelRequestedAt`; it does not mutate job terminal state, force finish,
implement long connection runtime, or add server-side adapter dispatch.

| Task   | Status | Description                                          | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F295.1 | done   | Map running cancellation request to ack hint.        | Routing: focused P8 task-pull slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to running cancellation write, ack lock renewal, task-pull contract metadata, and focused ack specs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| F295.2 | done   | Return cancellation hint from ack without finishing. | `ServerAgentTaskPullAckService` now selects `cancelRequestedAt`/`error` after lock renewal and returns a whitelisted `cancellation` hint with `shouldStop=true` and `finishStatus=cancelled` when cancellation was requested. The ack path still only renews heartbeat/lock fields and does not mutate terminal status. Contract/gates expose `ackCancellationHintSupported`.                                                                                                                                                                                                                                                                                                                                                                                |
| F295.3 | done   | Run focused API verification and sync docs.          | Focused task-pull Jest passed: `/tmp/codex-tool-runs/svton/f295-focused-jest-after-format-20260711-123309.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f295-api-type-check-20260711-123323.log`; API build passed: `/tmp/codex-tool-runs/svton/f295-api-build-20260711-123323.log`; final Prettier/line-count/diff/conflict/trailing checks passed: `/tmp/codex-tool-runs/svton/f295-final-prettier-check-20260711-123451.log`, `/tmp/codex-tool-runs/svton/f295-final-line-count-20260711-123451.log`, `/tmp/codex-tool-runs/svton/f295-final-diff-check-20260711-123451.log`, `/tmp/codex-tool-runs/svton/f295-final-conflict-scan-20260711-123451.log`, `/tmp/codex-tool-runs/svton/f295-final-trailing-whitespace-scan-20260711-123507.log`. |

## F296. Server-agent Task-pull Ack Progress Writeback

Purpose: after F295 exposed cancellation hints through ack, let a claimed
server agent report lightweight in-flight progress through the same ack
heartbeat. F296 only persists a controlled `metadata.taskPullProgress` snapshot
while preserving existing job metadata; it does not mutate terminal status,
append logs/results, execute lifecycle work, enable long connections, or add
server-side adapter dispatch.

| Task   | Status | Description                                    | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------ | ------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F296.1 | done   | Map ack progress writeback to job metadata.    | Routing: focused P8 task-pull slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to ack lock renewal, metadata merge patterns, contract/gates, and focused ack specs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| F296.2 | done   | Persist controlled progress after ack renewal. | `ServerAgentTaskPullAckService` now accepts optional ack `progress`, merges it into `metadata.taskPullProgress` while preserving existing metadata under the claimed running job lock, and returns a recorded progress result. Contract/gates expose `ackProgressWritebackSupported`; ack still does not mutate terminal status or write logs/results.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| F296.3 | done   | Run focused API verification and sync docs.    | Focused task-pull Jest passed: `/tmp/codex-tool-runs/svton/f296-focused-jest-20260711-ack-progress.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f296-api-type-check-20260711-ack-progress.log`; API build passed: `/tmp/codex-tool-runs/svton/f296-api-build-20260711-ack-progress.log`; final Prettier/line-count/diff/conflict/trailing checks passed: `/tmp/codex-tool-runs/svton/f296-final-prettier-check-20260711-ack-progress.log`, `/tmp/codex-tool-runs/svton/f296-final-line-count-20260711-ack-progress.log`, `/tmp/codex-tool-runs/svton/f296-final-diff-check-20260711-ack-progress.log`, `/tmp/codex-tool-runs/svton/f296-final-conflict-scan-20260711-ack-progress.log`, `/tmp/codex-tool-runs/svton/f296-final-trailing-whitespace-scan-20260711-ack-progress.log`. |

## F297. Server-agent Task-pull Progress Visibility

Purpose: after F296 persists controlled ack progress, expose that progress in
the execution-governance supervisor read-model so operators can see whether a
running server-agent task is advancing. F297 only reads and serializes the
existing `metadata.taskPullProgress` snapshot and surfaces the related
task-pull capability flags; it does not add a new write path, mutate terminal
state, append logs/results, enable long connections, or execute lifecycle work.

| Task   | Status | Description                                     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F297.1 | done   | Map task-pull progress visibility boundary.     | Routing: focused P8 task-pull visibility slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to supervisor agent fleet query/serializer, task-pull gates, Web agent fleet types, and focused specs.                                                                                                                                                                                                                                                                                                                                                                                    |
| F297.2 | done   | Expose running progress in supervisor views.    | Agent fleet queries now select job metadata, the supervisor serializer whitelists `taskPullProgress` into `updatedAt/agentId/runnerId/stepKey/message/percent`, supervisor task-pull gates expose cancellation/progress capability flags, and the execution-governance Agent fleet panel renders the latest running progress per server.                                                                                                                                                                                                                                                                                                     |
| F297.3 | done   | Run focused API/Web verification and sync docs. | Focused API Jest passed: `/tmp/codex-tool-runs/svton/f297-focused-api-jest-20260711-progress-visibility.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f297-api-type-check-20260711-progress-visibility.log`; API build passed after moving stale generated `dist` aside: `/tmp/codex-tool-runs/svton/f297-api-build-clean-dist-20260711-progress-visibility.log`; Web build passed: `/tmp/codex-tool-runs/svton/f297-web-build-20260711-progress-visibility.log`; Web type-check passed after Web build regenerated `.next/types`: `/tmp/codex-tool-runs/svton/f297-web-type-check-after-build-20260711-progress-visibility.log`. |

## F298. Server-agent Claimed Task Lifecycle Envelope

Purpose: after F297 made running progress visible, make each claimed task
payload self-describing enough for an external agent runner to execute the
terminal command steps and report status through the existing ack/progress/finish
protocol. F298 only adds a whitelisted `lifecycle` envelope to the claimed task
payload; it does not add a new write path, mutate terminal state, execute
server-side adapters, enable long connections, auto-retry, or change queue
worker ownership.

| Task   | Status | Description                                    | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------ | ------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F298.1 | done   | Map claimed task lifecycle envelope boundary.  | Routing: focused P8 task-pull payload slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to claimed task payload, claim metadata, ack/finish endpoints, and focused payload/claim specs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| F298.2 | done   | Add lifecycle protocol hints to claimed tasks. | Claimed task payloads now include a sanitized `lifecycle` envelope with ack endpoint, progress writeback support, cancellation hint support, finish endpoint/statuses, fallback support, and explicit boundaries: agent executes command steps, no server-side adapter dispatch, no long connection runtime, and no auto-retry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| F298.3 | done   | Run focused API verification and sync docs.    | Focused payload/claim/ack/finish Jest passed: `/tmp/codex-tool-runs/svton/f298-focused-api-jest-20260711-lifecycle-envelope.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f298-api-type-check-20260711-lifecycle-envelope.log`; API build passed: `/tmp/codex-tool-runs/svton/f298-api-build-20260711-lifecycle-envelope.log`; final Prettier/line-count/diff/conflict/trailing checks passed: `/tmp/codex-tool-runs/svton/f298-final-prettier-check-20260711-lifecycle-envelope.log`, `/tmp/codex-tool-runs/svton/f298-final-line-count-20260711-lifecycle-envelope.log`, `/tmp/codex-tool-runs/svton/f298-final-diff-check-20260711-lifecycle-envelope.log`, `/tmp/codex-tool-runs/svton/f298-final-conflict-scan-20260711-lifecycle-envelope.log`, `/tmp/codex-tool-runs/svton/f298-final-trailing-whitespace-scan-20260711-lifecycle-envelope.log`. |

## F299. Server-agent Task-pull Lifecycle Contract Discovery

Purpose: after F298 made each claimed task payload self-describing, expose the
same lifecycle envelope capability in the read-only task-pull contract and
supervisor readiness gates so an external agent can discover the protocol before
claiming work. F299 only publishes contract/readiness discovery fields; it does
not implement a runner, execute command steps, enable long connections, add new
terminal write paths, or change queue ownership.

| Task   | Status | Description                                      | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------ | ------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F299.1 | done   | Map lifecycle contract discovery boundary.       | Routing: focused P8 task-pull contract discovery slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to task-pull contract utils, readiness gates, supervisor readiness builder, claimed task payload lifecycle envelope, and focused specs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| F299.2 | done   | Expose lifecycle envelope in contract/readiness. | Task-pull contract and readiness gates now expose `claimedTaskLifecycleEnvelopeSupported` plus lifecycle envelope discovery (`server-agent-claimed-task-lifecycle.v0`, ack/progress/cancellation/finish endpoints, fallback support, and explicit boundaries) while keeping `lifecycleExecutionSupported: false` and `longConnectionSupported: false`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| F299.3 | done   | Run focused API verification and sync docs.      | Prettier write passed: `/tmp/codex-tool-runs/svton/f299-prettier-write-20260711-lifecycle-discovery.log` and `/tmp/codex-tool-runs/svton/f299-docs-prettier-write-20260711-lifecycle-discovery.log`; focused contract/payload/claim Jest passed: `/tmp/codex-tool-runs/svton/f299-focused-api-jest-20260711-lifecycle-discovery.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f299-api-type-check-20260711-lifecycle-discovery.log`; API build passed: `/tmp/codex-tool-runs/svton/f299-api-build-20260711-lifecycle-discovery.log`; line-count, diff, conflict, and trailing-whitespace checks passed: `/tmp/codex-tool-runs/svton/f299-line-count-20260711-lifecycle-discovery.log`, `/tmp/codex-tool-runs/svton/f299-diff-check-20260711-lifecycle-discovery.log`, `/tmp/codex-tool-runs/svton/f299-conflict-scan-20260711-lifecycle-discovery.log`, `/tmp/codex-tool-runs/svton/f299-trailing-whitespace-scan-20260711-lifecycle-discovery.log`. |

## F300. Server-agent Task-pull Lifecycle Claim-field Alignment

Purpose: while mapping the next agent runner slice, current source showed a
protocol mismatch: claim responses return the executable payload under
`task.lifecycle`, but F299 discovery advertised `job.lifecycle`. F300 fixes that
agent-facing coordinate before any runner consumes it. This slice only aligns
contract/readiness discovery, tests, and docs; it does not add a runner, execute
command steps, enable long connections, or change claim/ack/finish write paths.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | ------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F300.1 | done   | Map claim response field mismatch.          | Routing: focused P8 task-pull protocol alignment slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing confirmed `ServerAgentTaskPullClaimService` returns `task: buildServerAgentClaimedTaskPayload(...)`, while discovery/spec/docs advertised `job.lifecycle`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| F300.2 | done   | Align discovery with actual claim payload.  | Lifecycle discovery and focused contract specs now advertise `claimResponseField: "task.lifecycle"`, matching the actual claim response payload location and preserving the existing claim/ack/finish write paths.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| F300.3 | done   | Run focused API verification and sync docs. | Prettier write passed: `/tmp/codex-tool-runs/svton/f300-prettier-write-20260711-claim-field-alignment.log` and `/tmp/codex-tool-runs/svton/f300-docs-prettier-write-20260711-claim-field-alignment.log`; focused contract/payload/claim Jest passed: `/tmp/codex-tool-runs/svton/f300-focused-api-jest-20260711-claim-field-alignment.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f300-api-type-check-20260711-claim-field-alignment.log`; API build passed: `/tmp/codex-tool-runs/svton/f300-api-build-20260711-claim-field-alignment.log`; line-count, diff, conflict, and trailing-whitespace checks passed: `/tmp/codex-tool-runs/svton/f300-line-count-20260711-claim-field-alignment.log`, `/tmp/codex-tool-runs/svton/f300-diff-check-20260711-claim-field-alignment.log`, `/tmp/codex-tool-runs/svton/f300-conflict-scan-20260711-claim-field-alignment.log`, `/tmp/codex-tool-runs/svton/f300-trailing-whitespace-scan-20260711-claim-field-alignment.log`. |

## F301. CLI Server-agent Task-pull Once Runner

Purpose: after F300 aligned lifecycle discovery with the actual claim payload,
add the first agent-side executable surface in `@svton/cli`: a bounded
`svton agent task-pull once` command. The command reads the contract by default;
only explicit `--execute` claims one task, ack/progresses it, runs command steps
sequentially, and finishes the job with terminal logs/result. F301 does not add
a daemon, long connection, polling loop, API schema change, or new server-side
write path.

| Task   | Status | Description                                | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------ | ------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F301.1 | done   | Map CLI runner boundary and API contract.  | Routing: focused P8 task-pull runner slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing scoped to CLI commander entry, CLI exec utilities, task-pull contract/claim/ack/finish DTOs, and claimed task payload.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| F301.2 | done   | Add opt-in once runner command.            | Added `svton agent task-pull once`: default mode reads the contract only; explicit `--execute` validates `task.lifecycle`, claims one task, sends ack/progress, runs command steps sequentially through a focused executor, and finishes with terminal logs/result. CLI code is split into command/client/types/executor/runner files, and README documents the command.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| F301.3 | done   | Run focused CLI/API verification and docs. | Prettier passed: `/tmp/codex-tool-runs/svton/f301-prettier-write-20260711-cli-task-pull-once.log`, `/tmp/codex-tool-runs/svton/f301-prettier-register-split-20260711-cli-task-pull-once.log`, `/tmp/codex-tool-runs/svton/f301-docs-prettier-final-20260711-cli-task-pull-once.log`; CLI focused Jest passed: `/tmp/codex-tool-runs/svton/f301-cli-jest-final-20260711-cli-task-pull-once.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f301-cli-type-check-final-20260711-cli-task-pull-once.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f301-cli-build-final-20260711-cli-task-pull-once.log`; focused API Jest passed: `/tmp/codex-tool-runs/svton/f301-focused-api-jest-20260711-cli-task-pull-once.log`; final line-count, diff, conflict, and trailing-whitespace checks passed: `/tmp/codex-tool-runs/svton/f301-line-count-register-split-20260711-cli-task-pull-once.log`, `/tmp/codex-tool-runs/svton/f301-diff-check-final-20260711-cli-task-pull-once.log`, `/tmp/codex-tool-runs/svton/f301-conflict-scan-final-20260711-cli-task-pull-once.log`, `/tmp/codex-tool-runs/svton/f301-trailing-whitespace-scan-final-20260711-cli-task-pull-once.log`. |

## F302. CLI Server-agent Task-pull Bounded Poll Runner

Purpose: after F301 added a one-shot agent task-pull runner, add the next
bounded runtime surface in `@svton/cli`: `svton agent task-pull run` can execute
multiple poll iterations with explicit iteration/idle bounds while reusing the
existing contract, claim, ack/progress, command-step execution, and finish
protocol. F302 does not add a daemon, long connection, server API schema change,
server-side scheduler change, heartbeat writeback, or multi-instance
coordination.

| Task   | Status | Description                                | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F302.1 | done   | Map CLI polling boundary and source files. | Routing: focused CLI task-pull runtime slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing scoped to F301 CLI command/config/client/runner/test files and server-agent task-pull contract/claim/ack/finish boundaries.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| F302.2 | done   | Add bounded `task-pull run` command.       | Added `svton agent task-pull run`: it always executes claimed tasks, reuses the F301 once runner per iteration, supports `--interval-ms`, `--max-iterations`, `--idle-limit`, and `--forever`, and refuses an unbounded loop unless `--forever` is explicit. Production CLI files remain ≤200 lines.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| F302.3 | done   | Run focused CLI/API verification and docs. | Prettier passed: `/tmp/codex-tool-runs/svton/f302-prettier-code-20260711-cli-task-pull-loop.log`, `/tmp/codex-tool-runs/svton/f302-docs-prettier-20260711-cli-task-pull-loop.log`; CLI focused Jest passed: `/tmp/codex-tool-runs/svton/f302-cli-jest-20260711-cli-task-pull-loop.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f302-cli-type-check-20260711-cli-task-pull-loop.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f302-cli-build-20260711-cli-task-pull-loop.log`; focused API Jest passed: `/tmp/codex-tool-runs/svton/f302-focused-api-jest-20260711-cli-task-pull-loop.log`; final line-count, diff, conflict, and trailing-whitespace checks passed: `/tmp/codex-tool-runs/svton/f302-line-count-20260711-cli-task-pull-loop.log`, `/tmp/codex-tool-runs/svton/f302-diff-check-20260711-cli-task-pull-loop.log`, `/tmp/codex-tool-runs/svton/f302-conflict-scan-20260711-cli-task-pull-loop.log`, `/tmp/codex-tool-runs/svton/f302-trailing-whitespace-scan-20260711-cli-task-pull-loop.log`. |

## F303. CLI Server-agent Task-pull Heartbeat Writeback

Purpose: after F302 added a bounded CLI polling loop, connect that loop to the
existing server-agent heartbeat endpoint so a running CLI agent can refresh
`Server.services.devpilotAgent` while polling. F303 only adds optional CLI
heartbeat writeback around `svton agent task-pull run`; it does not add a
daemon, long connection, server API schema change, database migration,
server-side scheduler change, or multi-instance coordination.

| Task   | Status | Description                                | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F303.1 | done   | Map CLI heartbeat writeback boundary.      | Routing: focused CLI task-pull heartbeat slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing scoped to existing `/server-agent/heartbeat`, F302 CLI loop, CLI command/config files, and focused tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| F303.2 | done   | Add optional heartbeat client and wiring.  | Added optional heartbeat writeback for `svton agent task-pull run`: when `--heartbeat-token` or `DEVPILOT_AGENT_HEARTBEAT_TOKEN` is configured, the loop posts heartbeat before poll iterations with agent/runner/capability/status/hostname/version/ttl fields; config parsing now lives in a focused file and production CLI files remain ≤200 lines.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| F303.3 | done   | Run focused CLI/API verification and docs. | Prettier passed: `/tmp/codex-tool-runs/svton/f303-prettier-code-20260711-cli-heartbeat.log`; CLI focused Jest passed: `/tmp/codex-tool-runs/svton/f303-cli-jest-20260711-cli-heartbeat.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f303-cli-type-check-20260711-cli-heartbeat.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f303-cli-build-20260711-cli-heartbeat.log`; focused API Jest passed: `/tmp/codex-tool-runs/svton/f303-focused-api-jest-20260711-cli-heartbeat.log`; final line-count, diff, conflict, and trailing-whitespace checks passed: `/tmp/codex-tool-runs/svton/f303-line-count-20260711-cli-heartbeat.log`, `/tmp/codex-tool-runs/svton/f303-diff-check-20260711-cli-heartbeat.log`, `/tmp/codex-tool-runs/svton/f303-conflict-scan-20260711-cli-heartbeat.log`, `/tmp/codex-tool-runs/svton/f303-trailing-whitespace-scan-20260711-cli-heartbeat.log`. |

## F304. CLI Server-agent Task-pull Graceful Stop

Purpose: after F303 connected the bounded CLI polling loop to heartbeat
writeback, add a graceful stop boundary so `svton agent task-pull run` can
observe process stop signals and exit at the polling boundary with a structured
summary. F304 does not add a daemon, background supervisor, long connection,
server API schema change, database migration, or multi-instance coordination.

| Task   | Status | Description                            | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | ------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F304.1 | done   | Map CLI loop stop boundary.            | Routing: focused CLI task-pull graceful-stop slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing scoped to F303 CLI loop/command/test files and signal-free existing task-pull behavior.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| F304.2 | done   | Add signal-aware loop stop wiring.     | `task-pull run` now installs temporary SIGINT/SIGTERM handlers, passes an `AbortSignal` into the loop, cleans handlers after completion, and exits with `stoppedReason: "signal"` at a poll boundary; production CLI files remain ≤200 lines.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| F304.3 | done   | Run focused CLI verification and docs. | Prettier passed: `/tmp/codex-tool-runs/svton/f304-prettier-code-20260711-cli-graceful-stop.log`; CLI focused Jest passed: `/tmp/codex-tool-runs/svton/f304-cli-jest-20260711-cli-graceful-stop.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f304-cli-type-check-20260711-cli-graceful-stop.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f304-cli-build-20260711-cli-graceful-stop.log`; focused API Jest passed: `/tmp/codex-tool-runs/svton/f304-focused-api-jest-20260711-cli-graceful-stop.log`; CLI lint was attempted and remains blocked by the existing `packages/cli/.eslintrc.js` reference to missing `@typescript-eslint/recommended`: `/tmp/codex-tool-runs/svton/f304-cli-lint-20260711-cli-graceful-stop.log`; final line-count, diff, conflict, and trailing-whitespace checks passed: `/tmp/codex-tool-runs/svton/f304-line-count-20260711-cli-graceful-stop.log`, `/tmp/codex-tool-runs/svton/f304-diff-check-20260711-cli-graceful-stop.log`, `/tmp/codex-tool-runs/svton/f304-conflict-scan-20260711-cli-graceful-stop.log`, `/tmp/codex-tool-runs/svton/f304-trailing-whitespace-scan-20260711-cli-graceful-stop.log`. |

## F305. CLI Server-agent Task-pull Command-step Cancellation

Purpose: after F304 made `svton agent task-pull run` observe process stop
signals at loop boundaries, propagate the same stop signal into an in-flight
command step so the foreground runtime can terminate its child process and
finish the claimed task as cancelled. F305 does not add a daemon, long
connection, server API schema change, database migration, or multi-instance
coordination.

| Task   | Status | Description                                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F305.1 | done   | Map CLI command-step cancellation boundary.   | Routing: focused CLI task-pull foreground-runtime slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to F304 CLI loop/once runner/executor/test files and no service API.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| F305.2 | done   | Propagate stop signal into command execution. | `task-pull run` now passes its stop signal through the loop and once runner into command-step execution; an aborted signal terminates the current child process with SIGTERM, records `cancelled: true`, and finishes the claimed task as `cancelled`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| F305.3 | done   | Run focused CLI/API verification and docs.    | Prettier passed: `/tmp/codex-tool-runs/svton/f305-prettier-20260711-cli-command-cancel.log`, `/tmp/codex-tool-runs/svton/f305-final-docs-prettier-20260711-cli-command-cancel.log`; CLI focused Jest passed: `/tmp/codex-tool-runs/svton/f305-cli-jest-20260711-cli-command-cancel.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f305-cli-type-check-20260711-cli-command-cancel.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f305-cli-build-20260711-cli-command-cancel.log`; focused API Jest passed: `/tmp/codex-tool-runs/svton/f305-focused-api-jest-20260711-cli-command-cancel.log`; CLI lint was attempted and remains blocked by the existing `packages/cli/.eslintrc.js` reference to missing `@typescript-eslint/recommended`: `/tmp/codex-tool-runs/svton/f305-cli-lint-20260711-cli-command-cancel.log`; final line-count, diff, conflict, and trailing-whitespace checks passed: `/tmp/codex-tool-runs/svton/f305-line-count-20260711-cli-command-cancel.log`, `/tmp/codex-tool-runs/svton/f305-diff-check-20260711-cli-command-cancel.log`, `/tmp/codex-tool-runs/svton/f305-conflict-scan-20260711-cli-command-cancel.log`, `/tmp/codex-tool-runs/svton/f305-trailing-whitespace-scan-20260711-cli-command-cancel.log`. |

## F306. CLI Server-agent Task-pull Once Signal Wiring

Purpose: after F305 made the once runner and executor signal-aware, wire the
same SIGINT/SIGTERM stop controller into the `svton agent task-pull once`
command entry so one-shot execution can finish a claimed task as cancelled
instead of relying on process exit. F306 does not add a daemon, long connection,
server API schema change, database migration, or multi-instance coordination.

| Task   | Status | Description                                | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F306.1 | done   | Map one-shot command signal wiring gap.    | Routing: focused CLI task-pull one-shot runtime slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to the CLI command entry, stop controller, runner, and tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| F306.2 | done   | Wire stop signal into task-pull once.      | `task-pull once` now creates the same temporary SIGINT/SIGTERM stop controller as `task-pull run`, passes its signal into `runAgentTaskPullOnce()`, logs the structured summary, and always cleans up handlers after completion.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| F306.3 | done   | Run focused CLI/API verification and docs. | Prettier passed: `/tmp/codex-tool-runs/svton/f306-prettier-20260711-cli-once-signal.log`, `/tmp/codex-tool-runs/svton/f306-prettier-test-fix-20260711-cli-once-signal.log`, `/tmp/codex-tool-runs/svton/f306-docs-prettier-20260711-cli-once-signal.log`; CLI focused Jest passed after a test type fix: `/tmp/codex-tool-runs/svton/f306-cli-jest-rerun-20260711-cli-once-signal.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f306-cli-type-check-20260711-cli-once-signal.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f306-cli-build-20260711-cli-once-signal.log`; focused API Jest passed: `/tmp/codex-tool-runs/svton/f306-focused-api-jest-20260711-cli-once-signal.log`; CLI lint was attempted and remains blocked by the existing `packages/cli/.eslintrc.js` reference to missing `@typescript-eslint/recommended`: `/tmp/codex-tool-runs/svton/f306-cli-lint-20260711-cli-once-signal.log`; final line-count, diff, conflict, and trailing-whitespace checks passed: `/tmp/codex-tool-runs/svton/f306-line-count-20260711-cli-once-signal.log`, `/tmp/codex-tool-runs/svton/f306-diff-check-20260711-cli-once-signal.log`, `/tmp/codex-tool-runs/svton/f306-conflict-scan-20260711-cli-once-signal.log`, `/tmp/codex-tool-runs/svton/f306-trailing-whitespace-scan-20260711-cli-once-signal.log`. |

## F307. CLI Server-agent Task-pull Abortable Poll Sleep

Purpose: after F306 made both `task-pull once` and in-flight command execution
signal-aware, make the bounded `task-pull run` polling interval itself
abortable so SIGINT/SIGTERM can stop the foreground runtime during idle sleep
instead of waiting for the configured interval to elapse. F307 does not add a
daemon, long connection, server API schema change, database migration, or
multi-instance coordination.

| Task   | Status | Description                                | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F307.1 | done   | Map loop interval stop boundary.           | Routing: focused CLI task-pull loop responsiveness slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to the loop runner, signal flow, and focused loop tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| F307.2 | done   | Make poll interval sleep abortable.        | `task-pull run` now passes the existing stop signal into interval sleep; the default delay clears its timer and resolves immediately when the signal aborts, so the loop can return `stoppedReason: "signal"` without waiting for the full `--interval-ms`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| F307.3 | done   | Run focused CLI/API verification and docs. | Prettier passed: `/tmp/codex-tool-runs/svton/f307-prettier-20260711-cli-abortable-sleep.log`, `/tmp/codex-tool-runs/svton/f307-docs-prettier-20260711-cli-abortable-sleep.log`; CLI loop Jest passed: `/tmp/codex-tool-runs/svton/f307-cli-loop-jest-20260711-cli-abortable-sleep.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f307-cli-type-check-20260711-cli-abortable-sleep.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f307-cli-build-20260711-cli-abortable-sleep.log`; focused API Jest passed: `/tmp/codex-tool-runs/svton/f307-focused-api-jest-20260711-cli-abortable-sleep.log`; CLI lint was attempted and remains blocked by the existing `packages/cli/.eslintrc.js` reference to missing `@typescript-eslint/recommended`: `/tmp/codex-tool-runs/svton/f307-cli-lint-20260711-cli-abortable-sleep.log`; final line-count, diff, conflict, and trailing-whitespace checks passed: `/tmp/codex-tool-runs/svton/f307-line-count-20260711-cli-abortable-sleep.log`, `/tmp/codex-tool-runs/svton/f307-diff-check-20260711-cli-abortable-sleep.log`, `/tmp/codex-tool-runs/svton/f307-conflict-scan-20260711-cli-abortable-sleep.log`, `/tmp/codex-tool-runs/svton/f307-trailing-whitespace-scan-20260711-cli-abortable-sleep.log`. |

## F308. CLI Server-agent Task-pull Command-step Force Kill

Purpose: after F307 made loop idle sleep abortable, harden command-step
cancellation so a command that ignores SIGTERM does not keep the foreground
agent runner hanging forever. F308 adds a local CLI fallback from graceful
SIGTERM to force kill for cancelled/timed-out command steps; it does not add a
daemon, long connection, server API schema change, database migration, or
multi-instance coordination.

| Task   | Status | Description                                | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------ | ------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F308.1 | done   | Map command-step termination fallback.     | Routing: focused CLI executor cancellation-hardening slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to `agent-task-pull-executor.ts`, focused executor tests, and the existing task-pull once/loop/signal tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| F308.2 | done   | Add SIGKILL fallback after SIGTERM.        | `executeAgentTaskPullStep()` now starts command steps in a local process group on non-Windows platforms and routes abort/timeout through a single termination path: send SIGTERM first, then send SIGKILL after a bounded grace window when the process ignores graceful termination. The runner result surface remains unchanged except for a test-only configurable force-kill grace window.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| F308.3 | done   | Run focused CLI/API verification and docs. | Prettier passed after formatting touched docs: `/tmp/codex-tool-runs/svton/f308-final-prettier-write-20260711-cli-force-kill.log`, `/tmp/codex-tool-runs/svton/f308-final-prettier-check4-20260711-cli-force-kill.log`; focused CLI executor Jest passed: `/tmp/codex-tool-runs/svton/f308-cli-executor-jest-20260711-cli-force-kill.log`; focused CLI task-pull Jest passed: `/tmp/codex-tool-runs/svton/f308-cli-focused-jest-20260711-cli-force-kill.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f308-cli-tsc-20260711-cli-force-kill.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f308-cli-build-20260711-cli-force-kill.log`; focused API task-pull Jest passed: `/tmp/codex-tool-runs/svton/f308-api-task-pull-jest-20260711-cli-force-kill.log`; line-count, diff check, and combined conflict/trailing-whitespace scan passed: `/tmp/codex-tool-runs/svton/f308-line-count-final-20260711-cli-force-kill.log`, `/tmp/codex-tool-runs/svton/f308-diff-check4-20260711-cli-force-kill.log`, `/tmp/codex-tool-runs/svton/f308-final-marker-whitespace-scan2-20260711-cli-force-kill.log`; CLI lint was attempted and remains blocked by the existing `packages/cli/.eslintrc.js` reference to missing `@typescript-eslint/recommended`: `/tmp/codex-tool-runs/svton/f308-cli-lint-20260711-cli-force-kill.log`. |

## F309. CLI Server-agent Task-pull In-step Ack Renewal

Purpose: after F308 made stubborn command-step cancellation bounded, keep the
claimed job lock fresh while a long command step is running. The server ack
endpoint already renews lock heartbeat state; F309 only adds a local CLI renewal
loop around the currently executing command step so long-running steps do not
silently lose their claimed lock. It does not add daemonization, long
connection, server API schema changes, database migrations, or multi-instance
coordination.

| Task   | Status | Description                                | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------ | ------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F309.1 | done   | Map in-step ack renewal boundary.          | Routing: focused CLI task-pull runner renewal slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to `agent-task-pull-runner.ts`, client/types, focused CLI tests, and the server ack contract that renews lock heartbeat state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| F309.2 | done   | Add bounded ack renewal during step run.   | `runAgentTaskPullOnce()` now wraps each executing command step with a linked abort signal and a bounded renewal timer. The timer reuses the existing ack endpoint with current step progress; cancellation returned by renewal ack aborts the running step and finishes the task as cancelled with the server-provided reason. Pure command-plan/result builders were extracted so the runner remains under the 200-line ceiling.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| F309.3 | done   | Run focused CLI/API verification and docs. | Final Prettier passed after formatting touched docs: `/tmp/codex-tool-runs/svton/f309-final-prettier-write-20260711-ack-renewal.log`, `/tmp/codex-tool-runs/svton/f309-final-prettier-check2-20260711-ack-renewal.log`; focused CLI once Jest passed: `/tmp/codex-tool-runs/svton/f309-cli-once-jest3-20260711-ack-renewal.log`; focused CLI task-pull Jest passed: `/tmp/codex-tool-runs/svton/f309-cli-focused-jest2-20260711-ack-renewal.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f309-cli-type-check2-20260711-ack-renewal.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f309-cli-build2-20260711-ack-renewal.log`; focused API task-pull Jest passed: `/tmp/codex-tool-runs/svton/f309-api-task-pull-jest-20260711-ack-renewal.log`; line-count, diff check, and combined conflict/trailing-whitespace scan passed: `/tmp/codex-tool-runs/svton/f309-line-count-final2-20260711-ack-renewal.log`, `/tmp/codex-tool-runs/svton/f309-diff-check2-20260711-ack-renewal.log`, `/tmp/codex-tool-runs/svton/f309-marker-whitespace-scan2-20260711-ack-renewal.log`; CLI lint was attempted and remains blocked by the existing `packages/cli/.eslintrc.js` reference to missing `@typescript-eslint/recommended`: `/tmp/codex-tool-runs/svton/f309-cli-lint-20260711-ack-renewal.log`. |

## F310. CLI Server-agent Task-pull Timeout Terminal Summary

Purpose: after F309 kept long command steps alive through ack renewal, make
step timeout outcomes explicit in the CLI terminal summary. The executor already
returns `timedOut`; F310 only maps that result to a timeout-specific finish
reason and log message so operators can distinguish a timeout from a generic
nonzero command failure. It does not change executor process control, server API
schema, database state, daemonization, long connections, or multi-instance
coordination.

| Task   | Status | Description                                | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------ | ------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F310.1 | done   | Map timeout result propagation.            | Routing: focused CLI task-pull terminal-summary slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to runner/executor/result utils and focused CLI tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| F310.2 | done   | Add timeout-specific finish reason/logs.   | `runAgentTaskPullOnce()` now maps `timedOut` step results to `step_timeout:<key>` before the generic nonzero-exit failure path; terminal logs now say `step <key> timed out` while preserving the existing result step payload. No server DTO/schema, executor process-control, daemon, long-connection, or multi-instance behavior changed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| F310.3 | done   | Run focused CLI/API verification and docs. | Final Prettier passed after formatting touched docs: `/tmp/codex-tool-runs/svton/f310-final-prettier-write-20260711-timeout-summary.log`, `/tmp/codex-tool-runs/svton/f310-final-prettier-check2-20260711-timeout-summary.log`; focused CLI once Jest passed: `/tmp/codex-tool-runs/svton/f310-cli-once-jest-20260711-timeout-summary.log`; focused CLI task-pull Jest passed: `/tmp/codex-tool-runs/svton/f310-cli-focused-jest-20260711-timeout-summary.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f310-cli-type-check-20260711-timeout-summary.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f310-cli-build-20260711-timeout-summary.log`; focused API task-pull Jest passed: `/tmp/codex-tool-runs/svton/f310-api-task-pull-jest-20260711-timeout-summary.log`; line-count, diff check, and combined conflict/trailing-whitespace scan passed: `/tmp/codex-tool-runs/svton/f310-line-count-final2-20260711-timeout-summary.log`, `/tmp/codex-tool-runs/svton/f310-diff-check2-20260711-timeout-summary.log`, `/tmp/codex-tool-runs/svton/f310-marker-whitespace-scan2-20260711-timeout-summary.log`; CLI lint was attempted and remains blocked by the existing `packages/cli/.eslintrc.js` reference to missing `@typescript-eslint/recommended`: `/tmp/codex-tool-runs/svton/f310-cli-lint-20260711-timeout-summary.log`. |

## F311. CLI Server-agent Task-pull Optional Timeout Semantics

Purpose: after F310 made timeout terminal summaries explicit, align timeout
handling with the existing optional-step contract. The runner already lets
`required: false` steps continue after a nonzero exit; F311 makes timed-out
optional steps follow the same best-effort semantics while still logging the
timeout and preserving required-step timeout failure behavior. It does not
change executor process control, server API schema, database state,
daemonization, long connections, or multi-instance coordination.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------ | ------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F311.1 | done   | Map optional timeout vs required semantics. | Routing: focused CLI task-pull optional-timeout slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to runner/result utils and focused CLI tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| F311.2 | done   | Let optional timed-out steps continue.      | `runAgentTaskPullOnce()` now only fails timeout results when the step is required. Optional timed-out steps continue to later command steps while preserving timeout logs and result metadata; required-step timeout still finishes failed with `step_timeout:<key>`. No executor process-control, server DTO/schema, daemon, long-connection, or multi-instance behavior changed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| F311.3 | done   | Run focused CLI/API verification and docs.  | Prettier passed: `/tmp/codex-tool-runs/svton/f311-final-prettier-check2-20260711-optional-timeout.log`; focused CLI once Jest passed: `/tmp/codex-tool-runs/svton/f311-cli-once-jest2-20260711-optional-timeout.log`; focused CLI task-pull Jest passed: `/tmp/codex-tool-runs/svton/f311-cli-focused-jest-20260711-optional-timeout.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f311-cli-type-check-20260711-optional-timeout.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f311-cli-build-20260711-optional-timeout.log`; focused API task-pull Jest passed: `/tmp/codex-tool-runs/svton/f311-api-task-pull-jest-20260711-optional-timeout.log`; line-count passed: `/tmp/codex-tool-runs/svton/f311-line-count-final2-20260711-optional-timeout.log`; diff/check hygiene passed: `/tmp/codex-tool-runs/svton/f311-diff-check2-20260711-optional-timeout.log`, `/tmp/codex-tool-runs/svton/f311-marker-whitespace-scan2-20260711-optional-timeout.log`; CLI lint was attempted and remains blocked by the existing `packages/cli/.eslintrc.js` reference to missing `@typescript-eslint/recommended`: `/tmp/codex-tool-runs/svton/f311-cli-lint-20260711-optional-timeout.log`. |

## F312. CLI Server-agent Task-pull Final Ack Cancellation Boundary

Purpose: close the last CLI cancellation gap after F311. The runner already
honors cancellation from the pre-step ack and in-step ack renewal, but the final
100% ack after all command steps currently ignores `cancellation.shouldStop`.
F312 makes that final ack boundary cancellation-aware before finish writeback,
without changing executor process control, server API schema, database state,
daemonization, long connections, or multi-instance coordination.

| Task   | Status | Description                                           | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F312.1 | done   | Map final ack cancellation vs completion.             | Routing: focused CLI task-pull final-ack cancellation slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to runner/result utils and focused CLI tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| F312.2 | done   | Honor final ack cancellation before finish writeback. | `runAgentTaskPullOnce()` now reads the final 100% ack response and returns a `cancelled` execution result when `cancellation.shouldStop` is present, preserving the server cancellation reason before finish writeback. No executor process-control, server DTO/schema, daemon, long-connection, or multi-instance behavior changed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| F312.3 | done   | Run focused CLI/API verification and docs.            | Final Prettier passed: `/tmp/codex-tool-runs/svton/f312-final-prettier-write-20260711-final-ack-cancellation.log`, `/tmp/codex-tool-runs/svton/f312-final-prettier-check-20260711-final-ack-cancellation.log`; focused CLI once Jest passed: `/tmp/codex-tool-runs/svton/f312-cli-once-jest-20260711-final-ack-cancellation.log`; focused CLI task-pull Jest passed: `/tmp/codex-tool-runs/svton/f312-cli-focused-jest-20260711-final-ack-cancellation.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f312-cli-type-check-20260711-final-ack-cancellation.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f312-cli-build-20260711-final-ack-cancellation.log`; focused API task-pull Jest passed: `/tmp/codex-tool-runs/svton/f312-api-task-pull-jest-20260711-final-ack-cancellation.log`; line-count and hygiene passed: `/tmp/codex-tool-runs/svton/f312-line-count-final-20260711-final-ack-cancellation.log`, `/tmp/codex-tool-runs/svton/f312-diff-check-final-20260711-final-ack-cancellation.log`, `/tmp/codex-tool-runs/svton/f312-marker-whitespace-scan-final-20260711-final-ack-cancellation.log`; CLI lint was attempted and remains blocked by the existing `packages/cli/.eslintrc.js` reference to missing `@typescript-eslint/recommended`: `/tmp/codex-tool-runs/svton/f312-cli-lint-20260711-final-ack-cancellation.log`. |

## F313. CLI Server-agent Task-pull Configurable Ack Renewal Interval

Purpose: after F312 closed the final ack cancellation boundary, make the
foreground CLI runner configurable for different server lock TTLs. The CLI
already renews ack during long command steps, but the renewal interval is only
available through test deps; F313 exposes an option/env config path and passes
it into once/run execution while keeping the default behavior unchanged. It does
not change executor process control, server API schema, database state,
daemonization, long connections, or multi-instance coordination.

| Task   | Status | Description                                            | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | ------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F313.1 | done   | Map CLI ack-renewal config and line-count constraints. | Routing: focused CLI task-pull ack-renewal-config slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to CLI config/command/loop runner and focused tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| F313.2 | done   | Expose ack renewal interval option/env wiring.         | Added `--ack-renewal-interval-ms` and `DEVPILOT_AGENT_TASK_PULL_ACK_RENEWAL_INTERVAL_MS` config for `svton agent task-pull once/run`, wired the parsed interval into once execution and loop iterations, and extracted pure task-pull config readers into `agent-task-pull-config.utils.ts` so production CLI files stay under 200 lines. Defaults remain unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| F313.3 | done   | Run focused CLI/API verification and docs.             | Final Prettier passed: `/tmp/codex-tool-runs/svton/f313-final-prettier-write-20260711-ack-renewal-config.log`, `/tmp/codex-tool-runs/svton/f313-final-prettier-check-20260711-ack-renewal-config.log`; focused CLI once Jest passed: `/tmp/codex-tool-runs/svton/f313-cli-once-jest-20260711-ack-renewal-config.log`; focused CLI loop Jest passed: `/tmp/codex-tool-runs/svton/f313-cli-loop-jest-20260711-ack-renewal-config.log`; focused CLI task-pull Jest passed: `/tmp/codex-tool-runs/svton/f313-cli-focused-jest-20260711-ack-renewal-config.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f313-cli-type-check-20260711-ack-renewal-config.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f313-cli-build-20260711-ack-renewal-config.log`; focused API task-pull Jest passed: `/tmp/codex-tool-runs/svton/f313-api-task-pull-jest-20260711-ack-renewal-config.log`; line-count and hygiene passed: `/tmp/codex-tool-runs/svton/f313-line-count-final-20260711-ack-renewal-config.log`, `/tmp/codex-tool-runs/svton/f313-diff-check-final-20260711-ack-renewal-config.log`, `/tmp/codex-tool-runs/svton/f313-marker-whitespace-scan-final-20260711-ack-renewal-config.log`; CLI lint was attempted and remains blocked by the existing `packages/cli/.eslintrc.js` reference to missing `@typescript-eslint/recommended`: `/tmp/codex-tool-runs/svton/f313-cli-lint-20260711-ack-renewal-config.log`. |

## F314. CLI Server-agent Task-pull Configurable Force-kill Grace

Purpose: after F313 made ack renewal cadence configurable, expose the local
command termination grace window that already exists in the executor. The CLI
currently force-kills a command step after SIGTERM when the child ignores
graceful termination, but `forceKillGraceMs` is only injectable in tests; F314
adds option/env config for once/run while preserving the default grace period.
It does not change executor process-control semantics, server API schema,
database state, daemonization, long connections, or multi-instance
coordination.

| Task   | Status | Description                                                    | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------ | ------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F314.1 | done   | Map CLI force-kill grace config and existing executor support. | Routing: focused CLI task-pull force-kill-grace slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to CLI config/command/runner/executor and focused tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| F314.2 | done   | Expose force-kill grace option/env wiring.                     | Added `--force-kill-grace-ms` and `DEVPILOT_AGENT_TASK_PULL_FORCE_KILL_GRACE_MS` config for `svton agent task-pull once/run`, wired the parsed value through once execution and loop iterations into the existing executor force-kill grace option, and preserved default behavior when unset.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| F314.3 | done   | Run focused CLI/API verification and docs.                     | Focused CLI once Jest passed after fixing a loop-runner deps typing regression: `/tmp/codex-tool-runs/svton/f314-cli-once-jest2-20260711-force-kill-grace.log`; focused CLI loop Jest passed: `/tmp/codex-tool-runs/svton/f314-cli-loop-jest2-20260711-force-kill-grace.log`; focused CLI task-pull Jest passed: `/tmp/codex-tool-runs/svton/f314-cli-focused-jest-20260711-force-kill-grace.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f314-cli-type-check2-20260711-force-kill-grace.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f314-cli-build-20260711-force-kill-grace.log`; focused API task-pull Jest passed: `/tmp/codex-tool-runs/svton/f314-api-task-pull-jest-20260711-force-kill-grace.log`; CLI lint was attempted and remains blocked by the existing `packages/cli/.eslintrc.js` reference to missing `@typescript-eslint/recommended`: `/tmp/codex-tool-runs/svton/f314-cli-lint-20260711-force-kill-grace.log`. |

Final F314 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f314-final-prettier-write-20260711-force-kill-grace.log`,
`/tmp/codex-tool-runs/svton/f314-final-prettier-check-20260711-force-kill-grace.log`);
production CLI line-count passed with no file over 200 lines
(`/tmp/codex-tool-runs/svton/f314-line-count-final-20260711-force-kill-grace.log`);
diff whitespace check and marker/trailing-whitespace scan passed
(`/tmp/codex-tool-runs/svton/f314-diff-check-final-20260711-force-kill-grace.log`,
`/tmp/codex-tool-runs/svton/f314-marker-whitespace-scan-final-20260711-force-kill-grace.log`).

## F315. CLI Server-agent Task-pull Command Cwd Boundary

Purpose: continue the CLI terminal runtime hardening after F314 by constraining
command-step working directories before spawning shell commands. The claimed
task payload can include per-step `cwd`, and the CLI also accepts a global
`--cwd`; F315 treats the global cwd as the execution base, resolves relative
step cwd values under that base, and rejects step cwd values that escape it.
It does not change the server task payload schema, command execution semantics,
daemonization, long connections, or multi-instance coordination.

| Task   | Status | Description                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F315.1 | done   | Map CLI command cwd flow and boundary choice.            | Routing: focused CLI task-pull cwd-boundary slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to task-pull payload, config, runner, executor, and focused tests.                                                                                                                                                                                                                                       |
| F315.2 | done   | Normalize command cwd and fail escaped step cwd safely.  | Added a focused cwd resolver for CLI task-pull command steps. The executor now resolves global `--cwd` as the execution base, runs relative step cwd inside that base, and returns a failed step result with `step_cwd_outside_execution_base` instead of spawning when a step cwd escapes the base.                                                                                                                                                           |
| F315.3 | done   | Run focused CLI/API verification and sync progress docs. | CLI focused Jest passed after fixing a macOS realpath assertion: `/tmp/codex-tool-runs/svton/f315-cli-focused-jest2-20260711-cwd-boundary.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f315-cli-type-check-20260711-cwd-boundary.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f315-cli-build-20260711-cwd-boundary.log`; focused API task-pull Jest passed: `/tmp/codex-tool-runs/svton/f315-api-task-pull-jest-20260711-cwd-boundary.log`. |

Final F315 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f315-docs-prettier-write-final2-20260711-cwd-boundary.log`,
`/tmp/codex-tool-runs/svton/f315-final-prettier-check2-20260711-cwd-boundary.log`);
production CLI line-count passed with no file over 200 lines
(`/tmp/codex-tool-runs/svton/f315-line-count-final-20260711-cwd-boundary.log`);
diff whitespace check and marker/trailing-whitespace scan passed
(`/tmp/codex-tool-runs/svton/f315-diff-check-final2-20260711-cwd-boundary.log`,
`/tmp/codex-tool-runs/svton/f315-marker-whitespace-scan-final2-20260711-cwd-boundary.log`);
CLI lint was attempted and remains blocked by the existing
`packages/cli/.eslintrc.js` reference to missing `@typescript-eslint/recommended`
(`/tmp/codex-tool-runs/svton/f315-cli-lint-20260711-cwd-boundary.log`).

## F316. CLI Server-agent Task-pull Output Truncation Visibility

Purpose: continue CLI terminal runtime hardening after F315 by making bounded
command output explicit. The executor already caps captured stdout/stderr to a
fixed local limit, but that truncation is silent in the finish payload; F316
keeps the existing cap and command execution semantics while surfacing
`stdoutTruncated`/`stderrTruncated` on affected step results and logs. It does
not change the server API schema, raise output limits, add streaming, enable
daemonization, or implement long connections.

| Task   | Status | Description                                                    | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F316.1 | done   | Map CLI bounded output capture and finish writeback.           | Routing: focused CLI task-pull output-visibility slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to executor output capture, result logs, and focused tests.                                                                                                                                                                                                                    |
| F316.2 | done   | Surface stdout/stderr truncation flags without raising limits. | Extracted bounded output capture into `agent-task-pull-output.utils.ts`; the executor now keeps the existing 16KB stdout/stderr cap while marking `stdoutTruncated`/`stderrTruncated`, and finish logs copy true flags for operator visibility.                                                                                                                                                                                           |
| F316.3 | done   | Run focused CLI/API verification and sync progress docs.       | CLI focused Jest passed: `/tmp/codex-tool-runs/svton/f316-cli-focused-jest-20260711-output-truncation.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f316-cli-type-check-20260711-output-truncation.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f316-cli-build-20260711-output-truncation.log`; focused API task-pull Jest passed: `/tmp/codex-tool-runs/svton/f316-api-task-pull-jest-20260711-output-truncation.log`. |

Final F316 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f316-final-prettier-write-20260711-output-truncation.log`,
`/tmp/codex-tool-runs/svton/f316-final-prettier-check-20260711-output-truncation.log`);
production CLI line-count passed with no file over 200 lines
(`/tmp/codex-tool-runs/svton/f316-line-count-final-20260711-output-truncation.log`);
diff whitespace check and marker/trailing-whitespace scan passed
(`/tmp/codex-tool-runs/svton/f316-diff-check-final-20260711-output-truncation.log`,
`/tmp/codex-tool-runs/svton/f316-marker-whitespace-scan-final-20260711-output-truncation.log`);
CLI lint was attempted and remains blocked by the existing
`packages/cli/.eslintrc.js` reference to missing `@typescript-eslint/recommended`
(`/tmp/codex-tool-runs/svton/f316-cli-lint-20260711-output-truncation.log`).

## F317. CLI Server-agent Task-pull Dry-run Command Skip

Purpose: continue CLI terminal runtime safety after F316 by honoring the
claimed task payload's existing `dryRun` flag. The server already includes
`dryRun` in claimed task payloads, but the CLI task type/runner does not read it
and therefore can execute command steps for dry-run jobs. F317 adds CLI-side
dry-run recognition, reports skipped command-step results through the existing
finish payload, and keeps server API schema, database state, long connections,
daemonization, and multi-instance coordination unchanged.

| Task   | Status | Description                                                | Evidence                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | ------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F317.1 | done   | Map claimed task dryRun payload and CLI runner gap.        | Routing: focused CLI task-pull dry-run-skip slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to payload dryRun, CLI task type, runner, result logs, and focused tests.                                                                                                                                                                                       |
| F317.2 | done   | Skip command execution for dry-run tasks and write result. | Added CLI task `dryRun` typing and a dry-run result builder; dry-run claimed tasks now skip local shell execution, emit per-step `dryRunSkipped` results/logs, include `dryRun: true` in commandPlan, send the existing final ack, and finish through the current payload shape. Runner lifecycle/identity helpers were extracted so production files stay under 200 lines.                                           |
| F317.3 | done   | Run focused CLI/API verification and sync progress docs.   | CLI focused Jest passed: `/tmp/codex-tool-runs/svton/f317-cli-focused-jest-20260711-dry-run-skip.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f317-cli-type-check-20260711-dry-run-skip.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f317-cli-build-20260711-dry-run-skip.log`; focused API task-pull Jest passed: `/tmp/codex-tool-runs/svton/f317-api-task-pull-jest-20260711-dry-run-skip.log`. |

Final F317 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f317-final-prettier-write-20260711-dry-run-skip.log`,
`/tmp/codex-tool-runs/svton/f317-final-prettier-check-20260711-dry-run-skip.log`);
production CLI line-count passed with no file over 200 lines
(`/tmp/codex-tool-runs/svton/f317-line-count-final-20260711-dry-run-skip.log`);
diff whitespace check and marker/trailing-whitespace scan passed
(`/tmp/codex-tool-runs/svton/f317-diff-check-final-20260711-dry-run-skip.log`,
`/tmp/codex-tool-runs/svton/f317-marker-whitespace-scan-final-20260711-dry-run-skip.log`);
CLI lint was attempted and remains blocked by the existing
`packages/cli/.eslintrc.js` reference to missing `@typescript-eslint/recommended`
(`/tmp/codex-tool-runs/svton/f317-cli-lint-20260711-dry-run-skip.log`).

## F318. CLI Server-agent Task-pull Spawn Error Writeback

Purpose: continue CLI terminal runtime hardening after F317 by keeping local
spawn failures inside the existing task-pull finish path. The executor
currently rejects on child process spawn errors, which can bypass
`finish:failed` and leave a claimed task running; for example, a step cwd can
resolve inside the execution base but still fail because the directory does not
exist. F318 converts local spawn errors into failed step results so the runner
can finish through the current payload shape. It does not change command
execution semantics, service API schema, database state, long connections,
daemonization, or multi-instance coordination.

| Task   | Status | Description                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | ------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F318.1 | done   | Map executor spawn error path and finish writeback gap.  | Routing: focused CLI task-pull spawn-error-writeback slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to executor error handling, runner finish behavior, and focused tests.                                                                                                                                                                             |
| F318.2 | done   | Convert spawn errors to failed step results.             | `executeAgentTaskPullStep()` now converts child process spawn errors into failed step results with `spawn_error:<code>` stderr, allowing required steps to finish `failed` through the existing runner writeback path while preserving optional-step continuation semantics.                                                                                                                                      |
| F318.3 | done   | Run focused CLI/API verification and sync progress docs. | CLI focused Jest passed: `/tmp/codex-tool-runs/svton/f318-cli-focused-jest-20260711-spawn-error.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f318-cli-type-check-20260711-spawn-error.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f318-cli-build-20260711-spawn-error.log`; focused API task-pull Jest passed: `/tmp/codex-tool-runs/svton/f318-api-task-pull-jest-20260711-spawn-error.log`. |

Final F318 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f318-final-prettier-write-20260711-spawn-error.log`,
`/tmp/codex-tool-runs/svton/f318-final-prettier-check-20260711-spawn-error.log`);
production CLI line-count passed with no file over 200 lines
(`/tmp/codex-tool-runs/svton/f318-line-count-final-20260711-spawn-error.log`);
diff whitespace check and marker/trailing-whitespace scan passed
(`/tmp/codex-tool-runs/svton/f318-diff-check-final-20260711-spawn-error.log`,
`/tmp/codex-tool-runs/svton/f318-marker-whitespace-scan-final-20260711-spawn-error.log`);
CLI lint was attempted and remains blocked by the existing
`packages/cli/.eslintrc.js` reference to missing
`@typescript-eslint/recommended`
(`/tmp/codex-tool-runs/svton/f318-cli-lint-20260711-spawn-error.log`).

## F319. CLI Server-agent Task-pull Loop Heartbeat Failure Summary

Purpose: continue CLI terminal runtime hardening after F318 by keeping
configured heartbeat failures observable inside the `task-pull run` loop
summary. The loop currently awaits `heartbeatClient.heartbeat()` before each
poll; if that request fails, the command rejects without a structured stop
reason. F319 records heartbeat failure as a bounded loop stop result so
operators can distinguish heartbeat connectivity/auth failure from signal,
idle-limit, and max-iteration exits. It does not change the server heartbeat
API, task claim/ack/finish payloads, long connections, daemonization, or
multi-instance coordination.

| Task   | Status | Description                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | ------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F319.1 | done   | Map loop heartbeat failure path and existing stop model. | Routing: focused CLI task-pull loop heartbeat-failure slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to loop runner/config/tests.                                                                                                                                                                                                                                  |
| F319.2 | done   | Return a structured loop summary when heartbeat fails.   | `runAgentTaskPullLoop()` now catches configured heartbeat write failures before polling and returns `stoppedReason: "heartbeat_failed"` with `heartbeatError`, without claiming a task.                                                                                                                                                                                                                                       |
| F319.3 | done   | Run focused CLI verification and sync progress docs.     | CLI loop Jest passed: `/tmp/codex-tool-runs/svton/f319-cli-loop-jest-20260711-heartbeat-failure.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f319-cli-type-check-20260711-heartbeat-failure.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f319-cli-build-20260711-heartbeat-failure.log`; line-count precheck passed: `/tmp/codex-tool-runs/svton/f319-line-count-precheck-20260711-heartbeat-failure.log`. |

Final F319 hygiene evidence: expanded task-pull Jest passed
(`/tmp/codex-tool-runs/svton/f319-cli-task-pull-jest-20260711-heartbeat-failure.log`);
Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f319-final-prettier-write-20260711-heartbeat-failure.log`,
`/tmp/codex-tool-runs/svton/f319-final-prettier-check-20260711-heartbeat-failure.log`);
production CLI line-count passed with no file over 200 lines
(`/tmp/codex-tool-runs/svton/f319-line-count-final-20260711-heartbeat-failure.log`);
diff whitespace check and marker/trailing-whitespace scan passed
(`/tmp/codex-tool-runs/svton/f319-diff-check-final-20260711-heartbeat-failure.log`,
`/tmp/codex-tool-runs/svton/f319-marker-whitespace-scan-final-20260711-heartbeat-failure.log`);
CLI lint was attempted and remains blocked by the existing
`packages/cli/.eslintrc.js` reference to missing
`@typescript-eslint/recommended`
(`/tmp/codex-tool-runs/svton/f319-cli-lint-20260711-heartbeat-failure.log`).

## F320. CLI Server-agent Task-pull Loop Heartbeat Rejection Guard

Purpose: continue CLI terminal runtime hardening after F319 by honoring the
typed heartbeat response contract. The server heartbeat success path returns
`accepted: true`, and the CLI response type exposes `accepted?: boolean`; the
loop currently treats any non-throwing heartbeat response as successful. F320
will stop the loop with the existing structured heartbeat failure summary when
a configured heartbeat response explicitly reports `accepted: false`, before
claiming work. It does not change the server heartbeat API, task
claim/ack/finish payloads, long connections, daemonization, or multi-instance
coordination.

| Task   | Status | Description                                                     | Evidence                                                                                                                                                                                                                                                                                                          |
| ------ | ------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F320.1 | done   | Map heartbeat response contract and current loop success check. | Routing: focused CLI task-pull heartbeat rejection guard + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to heartbeat response type, server success shape, loop runner, and tests.                                                                            |
| F320.2 | done   | Treat explicit heartbeat rejection as structured loop stop.     | `runAgentTaskPullLoop()` now treats `accepted: false` heartbeat responses as `stoppedReason: "heartbeat_failed"` with `heartbeatError: "heartbeat rejected"` before polling or claiming work.                                                                                                                     |
| F320.3 | done   | Run focused CLI verification and sync progress docs.            | CLI loop Jest passed: `/tmp/codex-tool-runs/svton/f320-cli-loop-jest-20260711-heartbeat-rejection.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f320-cli-type-check-20260711-heartbeat-rejection.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f320-cli-build-20260711-heartbeat-rejection.log`. |

Final F320 hygiene evidence: expanded task-pull Jest passed
(`/tmp/codex-tool-runs/svton/f320-cli-task-pull-jest-20260711-heartbeat-rejection.log`);
Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f320-final-prettier-write-20260711-heartbeat-rejection.log`,
`/tmp/codex-tool-runs/svton/f320-final-prettier-check-20260711-heartbeat-rejection.log`);
production CLI line-count passed with no file over 200 lines
(`/tmp/codex-tool-runs/svton/f320-line-count-final-20260711-heartbeat-rejection.log`);
diff whitespace check and marker/trailing-whitespace scan passed
(`/tmp/codex-tool-runs/svton/f320-diff-check-final-20260711-heartbeat-rejection.log`,
`/tmp/codex-tool-runs/svton/f320-marker-whitespace-scan-final-20260711-heartbeat-rejection.log`);
CLI lint was attempted and remains blocked by the existing
`packages/cli/.eslintrc.js` reference to missing
`@typescript-eslint/recommended`
(`/tmp/codex-tool-runs/svton/f320-cli-lint-20260711-heartbeat-rejection.log`).

## F321. CLI Server-agent Task-pull Step Ack Rejection Guard

Purpose: continue CLI terminal runtime hardening after F320 by honoring the
task-pull ack response contract before local command execution. The server ack
path can return `acked: false` with a reason such as lock mismatch, and the CLI
response type exposes `acked?: boolean`; the runner currently checks only
cancellation hints and can still execute a command after a rejected step ack.
F321 stops command execution when the pre-step ack is explicitly rejected and
returns a structured cancelled result through the existing finish path. It does
not change the server ack API, claim/finish payload schemas, long connections,
daemonization, or multi-instance coordination.

| Task   | Status | Description                                          | Evidence                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F321.1 | done   | Map ack rejection contract and runner execution gap. | Routing: focused CLI task-pull step ack rejection guard + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to ack response type, server ack shape, runner, and tests.                                                                                                                                                                                        |
| F321.2 | done   | Prevent local command execution after rejected ack.  | `runAgentTaskPullOnce()` now treats explicit pre-step `acked: false` responses as cancelled with the server reason, skips local command execution, and keeps the existing finish writeback attempt; `AgentTaskPullRunSummary` moved to `agent-task-pull-types.ts`, and ack rejection parsing lives in `agent-task-pull-ack.utils.ts` to keep runner line count at 200.                                        |
| F321.3 | done   | Run focused CLI verification and sync progress docs. | CLI once Jest passed: `/tmp/codex-tool-runs/svton/f321-cli-once-jest-20260711-ack-rejection.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f321-cli-type-check-20260711-ack-rejection.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f321-cli-build-20260711-ack-rejection.log`; line-count precheck passed: `/tmp/codex-tool-runs/svton/f321-line-count-precheck-20260711-ack-rejection.log`. |

Final F321 hygiene evidence: expanded task-pull Jest passed
(`/tmp/codex-tool-runs/svton/f321-cli-task-pull-jest-20260711-ack-rejection.log`);
Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f321-final-prettier-write-20260711-ack-rejection.log`,
`/tmp/codex-tool-runs/svton/f321-final-prettier-check-20260711-ack-rejection.log`);
production CLI line-count passed with no file over 200 lines
(`/tmp/codex-tool-runs/svton/f321-line-count-final-20260711-ack-rejection.log`);
diff whitespace check and marker/trailing-whitespace scan passed
(`/tmp/codex-tool-runs/svton/f321-diff-check-final-20260711-ack-rejection.log`,
`/tmp/codex-tool-runs/svton/f321-marker-whitespace-scan-final-20260711-ack-rejection.log`);
CLI lint was attempted and remains blocked by the existing
`packages/cli/.eslintrc.js` reference to missing
`@typescript-eslint/recommended`
(`/tmp/codex-tool-runs/svton/f321-cli-lint-20260711-ack-rejection.log`).

## F322. CLI Server-agent Task-pull Finish Writeback Helper Extraction

Purpose: keep the CLI task-pull once runner below the production file-size
ceiling before adding more terminal writeback behavior. F321 left
`agent-task-pull-runner.ts` exactly at 200 lines with finish payload assembly
still inlined in the orchestration path. F322 extracts the existing finish
payload/writeback boundary into a focused helper so runner remains responsible
for claim/execute/summary orchestration only. It is behavior-preserving and
does not change server finish APIs, payload schemas, daemonization, loop
heartbeats, or multi-instance coordination.

| Task   | Status | Description                                             | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | ------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F322.1 | done   | Map current finish writeback boundary and line ceiling. | CodeGraph is installed but uninitialized, so manual graphing was scoped to runner, types, result utils, and task-pull tests; `agent-task-pull-runner.ts` started exactly at 200 lines.                                                                                                                                                                                                                                            |
| F322.2 | done   | Extract finish payload/writeback helper.                | `agent-task-pull-finish.utils.ts` now owns existing finish payload construction/writeback, and `runAgentTaskPullOnce()` delegates the finish call while keeping claim/execute/summary orchestration in the runner.                                                                                                                                                                                                                |
| F322.3 | done   | Run focused CLI verification and sync progress docs.    | CLI once/helper Jest passed: `/tmp/codex-tool-runs/svton/f322-cli-once-jest-20260711-finish-helper.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f322-cli-type-check-20260711-finish-helper.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f322-cli-build-20260711-finish-helper.log`; line-count passed with runner at 194 lines: `/tmp/codex-tool-runs/svton/f322-line-count-final-20260711-finish-helper.log`. |

Final F322 hygiene evidence: expanded task-pull Jest passed
(`/tmp/codex-tool-runs/svton/f322-cli-task-pull-jest-20260711-finish-helper.log`);
Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f322-final-prettier-write-20260711-finish-helper.log`,
`/tmp/codex-tool-runs/svton/f322-final-prettier-check-20260711-finish-helper.log`);
diff whitespace check and marker/trailing-whitespace scan passed
(`/tmp/codex-tool-runs/svton/f322-diff-check-final-20260711-finish-helper.log`,
`/tmp/codex-tool-runs/svton/f322-marker-whitespace-scan-final-20260711-finish-helper.log`);
CLI lint was attempted and remains blocked by the existing
`packages/cli/.eslintrc.js` reference to missing
`@typescript-eslint/recommended`
(`/tmp/codex-tool-runs/svton/f322-cli-lint-20260711-finish-helper.log`).

## F323. CLI Server-agent Task-pull Finish Response Summary

Purpose: make CLI task-pull finish writeback outcomes visible after F322
extracted the finish helper boundary. The server finish endpoint returns
`accepted`, `finished`, and `reason`; `finished: false` can indicate a lock
mismatch after local execution, but the CLI currently treats the response as
`unknown` and drops it from once/loop summaries. F323 preserves the local
execution status while adding finish writeback metadata to the summary. It does
not change the server finish API, finish payload schema, command execution,
loop heartbeat behavior, daemonization, or multi-instance coordination.

| Task   | Status | Description                                          | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F323.1 | done   | Map finish response shape and CLI summary gap.       | CodeGraph is installed but uninitialized, so manual graphing was scoped to server finish response, CLI finish helper, runner, loop summary, and tests; server finish returns `accepted`, `finished`, and `reason`, while CLI previously typed the response as `unknown`.                                                                                                                                                                  |
| F323.2 | done   | Surface finish writeback metadata in CLI summaries.  | `AgentTaskPullFinishResponse` now types finish responses, `finishAgentTaskPullExecution()` converts rejected writeback outcomes into summary metadata, and `runAgentTaskPullOnce()` exposes `finishAccepted`, `finishFinished`, and `finishReason` without changing local execution status.                                                                                                                                               |
| F323.3 | done   | Run focused CLI verification and sync progress docs. | CLI once/helper Jest passed: `/tmp/codex-tool-runs/svton/f323-cli-once-jest-20260711-finish-response.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f323-cli-type-check-20260711-finish-response.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f323-cli-build-20260711-finish-response.log`; line-count passed with runner at 200 lines: `/tmp/codex-tool-runs/svton/f323-line-count-final-20260711-finish-response.log`. |

Final F323 hygiene evidence: expanded task-pull Jest passed
(`/tmp/codex-tool-runs/svton/f323-cli-task-pull-jest-20260711-finish-response.log`);
Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f323-final-prettier-write-20260711-finish-response.log`,
`/tmp/codex-tool-runs/svton/f323-final-prettier-check-20260711-finish-response.log`);
diff whitespace check and marker/trailing-whitespace scan passed
(`/tmp/codex-tool-runs/svton/f323-diff-check-final-20260711-finish-response.log`,
`/tmp/codex-tool-runs/svton/f323-marker-whitespace-scan-final-20260711-finish-response.log`);
CLI lint was attempted and remains blocked by the existing
`packages/cli/.eslintrc.js` reference to missing
`@typescript-eslint/recommended`
(`/tmp/codex-tool-runs/svton/f323-cli-lint-20260711-finish-response.log`).

## F324. CLI Server-agent Task-pull Once Summary Builder Extraction

Purpose: keep the CLI task-pull once runner below the production file-size
ceiling before adding more terminal runtime behavior. F323 made finish response
metadata visible but left `agent-task-pull-runner.ts` exactly at 200 lines with
executed-run summary assembly still in the orchestration path. F324 extracts
the existing executed summary builder into a focused pure utility so the runner
continues to own claim/execute/finish orchestration only. It is
behavior-preserving and does not change command execution, finish payloads,
HTTP response contracts, loop heartbeat behavior, daemonization, or
multi-instance coordination.

| Task   | Status | Description                                          | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F324.1 | done   | Map once summary assembly and runner line ceiling.   | CodeGraph is installed but uninitialized, so manual graphing was scoped to runner, summary shape, finish metadata, and task-pull tests; `agent-task-pull-runner.ts` started this slice exactly at 200 lines.                                                                                                                                                                                                                              |
| F324.2 | done   | Extract executed-run summary builder.                | `agent-task-pull-summary.utils.ts` now owns executed-run summary assembly, and `finishAgentTaskPullExecution()` returns the completed run summary after writeback metadata normalization; runner keeps claim/execute/finish orchestration only.                                                                                                                                                                                           |
| F324.3 | done   | Run focused CLI verification and sync progress docs. | CLI once/helper Jest passed: `/tmp/codex-tool-runs/svton/f324-cli-once-jest-20260711-summary-builder.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f324-cli-type-check-20260711-summary-builder.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f324-cli-build-20260711-summary-builder.log`; line-count passed with runner at 186 lines: `/tmp/codex-tool-runs/svton/f324-line-count-final-20260711-summary-builder.log`. |

Final F324 hygiene evidence: expanded task-pull Jest passed
(`/tmp/codex-tool-runs/svton/f324-cli-task-pull-jest-20260711-summary-builder.log`);
Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f324-prettier-write-20260711-summary-builder.log`,
`/tmp/codex-tool-runs/svton/f324-final-prettier-check-20260711-summary-builder.log`);
diff whitespace check and marker/trailing-whitespace scan passed
(`/tmp/codex-tool-runs/svton/f324-diff-check-final-20260711-summary-builder.log`,
`/tmp/codex-tool-runs/svton/f324-marker-whitespace-scan-final-20260711-summary-builder.log`);
CLI lint was attempted and remains blocked by the existing
`packages/cli/.eslintrc.js` reference to missing
`@typescript-eslint/recommended`
(`/tmp/codex-tool-runs/svton/f324-cli-lint-20260711-summary-builder.log`).

## F325. CLI Server-agent Task-pull Loop Finish Writeback Failure Stop

Purpose: make long-running CLI task-pull loops stop when terminal writeback is
not accepted or not finished. F323 surfaced finish writeback metadata on each
once run, and F324 moved summary assembly out of the once runner. The loop still
continues polling after a run reports `finishFinished: false`, which can hide a
lost job lock or failed terminal writeback in daemon-like operation. F325 stops
the loop with a structured `finish_writeback_failed` reason while preserving
the local command execution status. It does not change server finish APIs,
finish payload schemas, command execution, heartbeat writeback, daemonization,
or multi-instance coordination.

| Task   | Status | Description                                                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------ | ------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F325.1 | done   | Map loop handling for finish writeback metadata.             | CodeGraph is installed but uninitialized, so manual graphing was scoped to loop runner, once summary metadata, and loop tests; the loop previously continued polling even when a run reported failed terminal writeback metadata.                                                                                                                                                                                                           |
| F325.2 | done   | Stop loop on finish writeback failure with explicit summary. | `runAgentTaskPullLoop()` now stops with `stoppedReason: "finish_writeback_failed"` and `finishWritebackError` when a run reports `finishAccepted: false` or `finishFinished: false`, while preserving the once run's local execution status.                                                                                                                                                                                                |
| F325.3 | done   | Run focused CLI verification and sync progress docs.         | CLI loop Jest passed: `/tmp/codex-tool-runs/svton/f325-cli-loop-jest-20260711-loop-finish-stop.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f325-cli-type-check-20260711-loop-finish-stop.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f325-cli-build-20260711-loop-finish-stop.log`; line-count passed with loop runner at 190 lines: `/tmp/codex-tool-runs/svton/f325-line-count-final-20260711-loop-finish-stop.log`. |

Final F325 hygiene evidence: expanded task-pull Jest passed
(`/tmp/codex-tool-runs/svton/f325-cli-task-pull-jest-20260711-loop-finish-stop.log`);
Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f325-final-prettier-write-20260711-loop-finish-stop.log`,
`/tmp/codex-tool-runs/svton/f325-final-prettier-check-20260711-loop-finish-stop.log`);
diff whitespace check and marker/trailing-whitespace scan passed
(`/tmp/codex-tool-runs/svton/f325-diff-check-final-20260711-loop-finish-stop.log`,
`/tmp/codex-tool-runs/svton/f325-marker-whitespace-scan-final-20260711-loop-finish-stop.log`);
CLI lint was attempted and remains blocked by the existing
`packages/cli/.eslintrc.js` reference to missing
`@typescript-eslint/recommended`
(`/tmp/codex-tool-runs/svton/f325-cli-lint-20260711-loop-finish-stop.log`).

## F326. CLI Server-agent Task-pull Run Failure Exit Surface

Purpose: make long-running CLI task-pull runs expose failure stop reasons as a
process failure signal for supervisors and scripts. F325 made the loop stop with
structured `heartbeat_failed` and `finish_writeback_failed` reasons, but the
`agent task-pull run` command still only prints the JSON summary and exits
successfully. F326 keeps the loop contract unchanged and only maps failure stop
reasons at the command boundary. It does not add daemonization, multi-instance
coordination, new server APIs, or retry policy.

| Task   | Status | Description                                             | Evidence                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------ | ------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F326.1 | done   | Map command handling for loop failure stop reasons.     | CodeGraph is installed but uninitialized, so manual graphing was scoped to `agent-task-pull.ts`, loop summary shape, and command tests; `agent task-pull run` previously logged failure summaries without setting a process failure signal.                                                                                                                                                                         |
| F326.2 | done   | Surface failure stop reasons through CLI run exit code. | `runAgentTaskPullRunCommand()` now logs the loop summary and maps `heartbeat_failed` / `finish_writeback_failed` to `process.exitCode = 1`, while normal stop reasons such as `idle_limit` keep the default success exit.                                                                                                                                                                                           |
| F326.3 | done   | Run focused CLI verification and sync progress docs.    | CLI command Jest passed: `/tmp/codex-tool-runs/svton/f326-cli-command-jest-20260711-run-exit-surface.log`; CLI loop Jest passed: `/tmp/codex-tool-runs/svton/f326-cli-loop-jest-20260711-run-exit-surface.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f326-cli-type-check-20260711-run-exit-surface.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f326-cli-build-20260711-run-exit-surface.log`. |

Final F326 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f326-final-prettier-write-20260711-run-exit-surface.log`,
`/tmp/codex-tool-runs/svton/f326-final-prettier-check-20260711-run-exit-surface.log`);
diff whitespace check and marker/trailing-whitespace scan passed
(`/tmp/codex-tool-runs/svton/f326-diff-check-final-20260711-run-exit-surface.log`,
`/tmp/codex-tool-runs/svton/f326-marker-whitespace-scan-final-20260711-run-exit-surface.log`);
line-count check passed with `agent-task-pull.ts` at 148 lines
(`/tmp/codex-tool-runs/svton/f326-line-count-final-20260711-run-exit-surface.log`);
CLI lint was attempted and remains blocked by the existing
`packages/cli/.eslintrc.js` reference to missing
`@typescript-eslint/recommended`
(`/tmp/codex-tool-runs/svton/f326-cli-lint-20260711-run-exit-surface.log`).

## F327. CLI Server-agent Task-pull Once Failure Exit Surface

Purpose: make one-shot CLI task-pull execution expose local execution and finish
writeback failures as a process failure signal for scripts and supervisors. F326
covered the long-running `run` command, but `agent task-pull once --execute`
still only logs the JSON summary when command execution fails, is cancelled, or
the finish writeback is rejected/not finished. F327 keeps the once runner,
finish payload, server APIs, and loop behavior unchanged; it only maps failure
summaries at the command boundary.

| Task   | Status | Description                                               | Evidence                                                                                                                                                                                                                                                                                                          |
| ------ | ------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F327.1 | done   | Map once command handling for failure summaries.          | CodeGraph is installed but uninitialized, so manual graphing was scoped to `agent-task-pull.ts`, once summary shape, and command tests; `agent task-pull once --execute` previously logged failed/cancelled/writeback-failed summaries without setting a process failure signal.                                  |
| F327.2 | done   | Surface failed/cancelled/writeback-failed once summaries. | `runAgentTaskPullOnceCommand()` now maps executed `failed` / `cancelled` summaries and `finishAccepted: false` / `finishFinished: false` writeback metadata to `process.exitCode = 1`, while `contract_only`, `no_task`, and completed once summaries keep the default success exit.                              |
| F327.3 | done   | Run focused CLI verification and sync progress docs.      | CLI command Jest passed: `/tmp/codex-tool-runs/svton/f327-cli-command-jest-20260711-once-exit-surface.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f327-cli-type-check-20260711-once-exit-surface.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f327-cli-build-20260711-once-exit-surface.log`. |

Final F327 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f327-final-prettier-write-20260711-once-exit-surface.log`,
`/tmp/codex-tool-runs/svton/f327-final-prettier-check-20260711-once-exit-surface.log`);
diff whitespace check and marker/trailing-whitespace scan passed
(`/tmp/codex-tool-runs/svton/f327-diff-check-final-20260711-once-exit-surface.log`,
`/tmp/codex-tool-runs/svton/f327-marker-whitespace-scan-final-20260711-once-exit-surface.log`);
line-count check passed with `agent-task-pull.ts` at 162 lines
(`/tmp/codex-tool-runs/svton/f327-line-count-final-20260711-once-exit-surface.log`);
CLI lint was attempted and remains blocked by the existing
`packages/cli/.eslintrc.js` reference to missing
`@typescript-eslint/recommended`
(`/tmp/codex-tool-runs/svton/f327-cli-lint-20260711-once-exit-surface.log`).

## F328. CLI Server-agent Task-pull Loop Poll Failure Summary

Purpose: make long-running CLI task-pull loops return a structured summary when
the poll/claim/ack/finish execution path throws before producing a once summary.
F326/F327 mapped known failure summaries to process exit signals, but a contract
or claim request failure inside `runAgentTaskPullOnce()` still rejects the loop
without a loop summary. F328 keeps server APIs, once runner behavior, retry
policy, daemonization, and multi-instance coordination unchanged; it only adds a
`poll_failed` loop stop reason and keeps it mapped to nonzero CLI exit.

| Task   | Status | Description                                          | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------ | ------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F328.1 | done   | Map loop handling for poll-path exceptions.          | CodeGraph is installed but uninitialized, so manual graphing was scoped to loop runner, command mapping, and loop/command tests; poll-path exceptions previously rejected the loop before a loop summary could be logged.                                                                                                                                                                                                           |
| F328.2 | done   | Return structured `poll_failed` loop summaries.      | `runAgentTaskPullLoop()` now catches once-run poll/claim/ack/finish-path exceptions and returns `stoppedReason: "poll_failed"` with `pollError`, while preserving existing heartbeat, finish-writeback, idle, signal, and max-iteration summaries.                                                                                                                                                                                  |
| F328.3 | done   | Run focused CLI verification and sync progress docs. | CLI loop Jest passed: `/tmp/codex-tool-runs/svton/f328-cli-loop-jest-20260711-poll-failure-summary.log`; CLI command Jest passed: `/tmp/codex-tool-runs/svton/f328-cli-command-jest-20260711-poll-failure-summary.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f328-cli-type-check-20260711-poll-failure-summary.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f328-cli-build-20260711-poll-failure-summary.log`. |

Final F328 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f328-final-prettier-write-20260711-poll-failure-summary.log`,
`/tmp/codex-tool-runs/svton/f328-final-prettier-check-20260711-poll-failure-summary.log`);
diff whitespace check and marker/trailing-whitespace scan passed
(`/tmp/codex-tool-runs/svton/f328-diff-check-final-20260711-poll-failure-summary.log`,
`/tmp/codex-tool-runs/svton/f328-marker-whitespace-scan-final-20260711-poll-failure-summary.log`);
line-count check passed with loop runner at 193 lines and command at 163 lines
(`/tmp/codex-tool-runs/svton/f328-line-count-final-20260711-poll-failure-summary.log`);
CLI lint was attempted and remains blocked by the existing
`packages/cli/.eslintrc.js` reference to missing
`@typescript-eslint/recommended`
(`/tmp/codex-tool-runs/svton/f328-cli-lint-20260711-poll-failure-summary.log`).

## F329. Server-agent Task-pull Disabled Claim Surface

Purpose: make `POST /server-agent/task-pull/claim` match the default-off
contract/readiness surface when task-pull is disabled. The contract already
reports `task_pull_disabled`, while claim currently routes through the enabled
auth gate before returning any task-pull response. F329 keeps token
authentication, ack/finish behavior, task payload schema, CLI behavior,
daemonization, and multi-instance coordination unchanged; it only lets a
valid-token claim request observe a structured no-claim result without touching
the queue while `SERVER_EXECUTOR_AGENT_TASK_PULL_ENABLED` is false.

| Task   | Status | Description                                           | Evidence                                                                                                                                                                                                                                                                                                                         |
| ------ | ------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F329.1 | done   | Map disabled claim behavior and boundary.             | CodeGraph is installed but uninitialized, so manual graphing was scoped to task-pull auth, contract/readiness gates, claim service, and claim tests; disabled claim currently fails in auth before a no-claim body.                                                                                                              |
| F329.2 | done   | Return structured disabled no-claim without mutation. | `ServerAgentTaskPullClaimService` now validates the task-pull token separately from the enabled gate, returns `claimed: false` / `reason: "task_pull_disabled"` for valid-token disabled claims, and skips `claimNextReadyJob()` / queue mutation.                                                                               |
| F329.3 | done   | Run focused API verification and sync progress docs.  | Focused claim Jest passed: `/tmp/codex-tool-runs/svton/f329-api-claim-jest-20260711-disabled-claim-surface.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f329-api-type-check-20260711-disabled-claim-surface.log`; API build passed: `/tmp/codex-tool-runs/svton/f329-api-build-20260711-disabled-claim-surface.log`. |

Final F329 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f329-prettier-write-20260711-disabled-claim-surface.log`,
`/tmp/codex-tool-runs/svton/f329-prettier-check-20260711-disabled-claim-surface.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
check passed
(`/tmp/codex-tool-runs/svton/f329-diff-check-20260711-disabled-claim-surface.log`,
`/tmp/codex-tool-runs/svton/f329-marker-scan-20260711-disabled-claim-surface.log`,
`/tmp/codex-tool-runs/svton/f329-trailing-whitespace-scan-20260711-disabled-claim-surface.log`,
`/tmp/codex-tool-runs/svton/f329-line-count-20260711-disabled-claim-surface.log`).

## F330. CLI Task-pull Disabled Claim Loop Stop

Purpose: make `svton agent task-pull run` consume the F329 disabled claim
surface without treating it as ordinary empty-queue idleness. F329 lets the API
return `claimed: false` / `reason: "task_pull_disabled"` for valid-token
disabled claims; the loop runner should stop immediately with a structured
`task_pull_disabled` summary instead of continuing until `idle_limit` or
`max_iterations`. F330 keeps the once runner, API contract, daemonization,
multi-instance coordination, and process failure mapping unchanged.

| Task   | Status | Description                                          | Evidence                                                                                                                                                                                                                                                                                                                                    |
| ------ | ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F330.1 | done   | Map disabled claim handling in the CLI loop runner.  | Routing: focused CLI loop slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to F329 claim response, once runner `no_task` summaries, loop stop reasons, command mapping, and tests.                                                                                                 |
| F330.2 | done   | Stop loops on `task_pull_disabled` no-task runs.     | `runAgentTaskPullLoop()` now returns `stoppedReason: "task_pull_disabled"` when the latest no-task run carries `reason: "task_pull_disabled"`, while keeping it out of nonzero failure stop reasons.                                                                                                                                        |
| F330.3 | done   | Run focused CLI verification and sync progress docs. | Focused CLI loop/command Jest passed: `/tmp/codex-tool-runs/svton/f330-cli-jest-20260711-disabled-claim-loop-stop.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f330-cli-type-check-20260711-disabled-claim-loop-stop.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f330-cli-build-20260711-disabled-claim-loop-stop.log`. |

Final F330 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f330-prettier-write-20260711-disabled-claim-loop-stop.log`,
`/tmp/codex-tool-runs/svton/f330-prettier-check-20260711-disabled-claim-loop-stop.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
check passed
(`/tmp/codex-tool-runs/svton/f330-diff-check-20260711-disabled-claim-loop-stop.log`,
`/tmp/codex-tool-runs/svton/f330-marker-scan-20260711-disabled-claim-loop-stop.log`,
`/tmp/codex-tool-runs/svton/f330-trailing-whitespace-scan-20260711-disabled-claim-loop-stop.log`,
`/tmp/codex-tool-runs/svton/f330-line-count-20260711-disabled-claim-loop-stop.log`).

## F331. CLI Task-pull Run Default Runner Identity

Purpose: make long-running `svton agent task-pull run` advertise a stable
per-process runner identity even when the operator omits `--runner` /
`DEVPILOT_AGENT_RUNNER_ID`. The server can already include `runnerId` in
heartbeat, claim, ack, and finish, and its lock owner falls back to
`agentId:serverId` when runner id is missing. F331 keeps `once`, API schemas,
server lock-owner rules, daemonization, and full multi-instance scheduling out
of scope; it only gives bounded/forever loop runs a deterministic CLI runner id
so concurrent local runners are distinguishable in task-pull locks and
heartbeat visibility.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                               |
| ------ | ------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F331.1 | done   | Map runner identity flow for CLI loop runs. | Routing: focused CLI config slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to CLI config, heartbeat config, task-pull HTTP payloads, and server lock-owner fallback rules.                                                                                  |
| F331.2 | done   | Generate a loop-only default runner id.     | `task-pull run` keeps explicit `--runner` / `DEVPILOT_AGENT_RUNNER_ID`, otherwise uses `cli-<sanitized-host>-<pid>`; `task-pull once` remains optional/no generated runner and heartbeat inherits the loop runner id.                                                                                                  |
| F331.3 | done   | Run focused CLI verification and sync docs. | Focused CLI loop/command Jest passed: `/tmp/codex-tool-runs/svton/f331-cli-jest-20260711-default-runner-id.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f331-cli-type-check-20260711-default-runner-id.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f331-cli-build-20260711-default-runner-id.log`. |

Final F331 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f331-prettier-write-20260711-default-runner-id.log`,
`/tmp/codex-tool-runs/svton/f331-prettier-check-20260711-default-runner-id.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
check passed
(`/tmp/codex-tool-runs/svton/f331-diff-check-20260711-default-runner-id.log`,
`/tmp/codex-tool-runs/svton/f331-marker-scan-20260711-default-runner-id.log`,
`/tmp/codex-tool-runs/svton/f331-trailing-whitespace-scan-20260711-default-runner-id.log`,
`/tmp/codex-tool-runs/svton/f331-line-count-20260711-default-runner-id.log`).

## F332. CLI Task-pull Run Runner Identity Summary

Purpose: make `svton agent task-pull run` logs expose the runner identity that
F331 now guarantees for loop runs. The loop config has a runner id, and claim /
heartbeat payloads carry it, but the command-level loop summary logged to
operators still omits it. F332 keeps the loop runner core summary, API schemas,
execution behavior, daemonization, and multi-instance scheduling unchanged; it
only includes `runnerId` in the logged command summary when present.

| Task   | Status | Description                                      | Evidence                                                                                                                                                                                                                                                                                                      |
| ------ | ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F332.1 | done   | Map command summary logging and runner identity. | Routing: focused CLI command observability slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to CLI command logging, loop config, loop summary tests, and README.                                                                                     |
| F332.2 | done   | Include `runnerId` in logged run summaries.      | `runAgentTaskPullRunCommand()` now logs the configured/generated `runnerId` with the loop summary; loop runner return shape, failure exit mapping, once behavior, and API payloads remain unchanged.                                                                                                          |
| F332.3 | done   | Run focused CLI verification and sync docs.      | Focused CLI command/loop Jest passed: `/tmp/codex-tool-runs/svton/f332-cli-jest-20260711-runner-summary.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f332-cli-type-check-20260711-runner-summary.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f332-cli-build-20260711-runner-summary.log`. |

Final F332 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f332-prettier-write-20260711-runner-summary.log`,
`/tmp/codex-tool-runs/svton/f332-prettier-check-20260711-runner-summary.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
check passed
(`/tmp/codex-tool-runs/svton/f332-diff-check-20260711-runner-summary.log`,
`/tmp/codex-tool-runs/svton/f332-marker-scan-20260711-runner-summary.log`,
`/tmp/codex-tool-runs/svton/f332-trailing-whitespace-scan-20260711-runner-summary.log`,
`/tmp/codex-tool-runs/svton/f332-line-count-20260711-runner-summary.log`).

## F333. CLI Task-pull Run PID File Lifecycle

Purpose: add the smallest daemon/readiness precursor for
`svton agent task-pull run`: an opt-in `--pid-file` lifecycle that writes the
current CLI process id before the loop starts and removes it during command
cleanup. F333 keeps the loop runner core, API schemas, process supervision,
background daemonization, and multi-instance scheduling unchanged; it only gives
external supervisors and scripts a stable local process handle for the
foreground runner.

| Task   | Status | Description                                    | Evidence                                                                                                                                                                                                                                                                                    |
| ------ | ------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F333.1 | done   | Map run command cleanup and PID-file boundary. | Routing: focused CLI command lifecycle slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to command options, run command cleanup, config types, and command tests.                                                                  |
| F333.2 | done   | Add opt-in `--pid-file` install and cleanup.   | `task-pull run --pid-file <path>` now writes the current process id before the loop starts and cleans it during command cleanup, while once/API/loop execution semantics remain unchanged.                                                                                                  |
| F333.3 | done   | Run focused CLI verification and sync docs.    | Focused CLI command/loop Jest passed: `/tmp/codex-tool-runs/svton/f333-cli-jest-20260711-pid-file.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f333-cli-type-check-20260711-pid-file.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f333-cli-build-20260711-pid-file.log`. |

Final F333 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f333-prettier-write-20260711-pid-file.log`,
`/tmp/codex-tool-runs/svton/f333-prettier-check-20260711-pid-file.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
check passed
(`/tmp/codex-tool-runs/svton/f333-diff-check-20260711-pid-file.log`,
`/tmp/codex-tool-runs/svton/f333-marker-scan-20260711-pid-file.log`,
`/tmp/codex-tool-runs/svton/f333-trailing-whitespace-scan-20260711-pid-file.log`,
`/tmp/codex-tool-runs/svton/f333-line-count-20260711-pid-file.log`).

## F334. CLI Task-pull Run PID File Live-owner Guard

Purpose: make the opt-in `svton agent task-pull run --pid-file <path>` lifecycle
safe for local supervisor use by refusing to overwrite an existing pid file
whose owner process is still alive, while still replacing stale pid files. F334
keeps foreground runner execution, loop polling, API schemas, background
daemonization, and multi-instance scheduling unchanged.

| Task   | Status | Description                                   | Evidence                                                                                                                                                                                                                                                                                                                                       |
| ------ | ------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F334.1 | done   | Map pid-file ownership and liveness boundary. | Routing: focused CLI pid-file lifecycle slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to pid-file util, run command injection, command tests, and README.                                                                                                                          |
| F334.2 | done   | Refuse live-owner pid-file overwrites.        | `installAgentTaskPullPidFile()` now refuses to overwrite an existing pid file when its parsed owner pid is still live, still replaces stale/non-live pid files, and preserves existing own-value cleanup semantics.                                                                                                                            |
| F334.3 | done   | Run focused CLI verification and sync docs.   | Focused pid-file/command Jest passed: `/tmp/codex-tool-runs/svton/f334-cli-jest-final-20260711-pid-file-live-guard.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f334-cli-type-check-final-20260711-pid-file-live-guard.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f334-cli-build-final-20260711-pid-file-live-guard.log`. |

Final F334 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f334-prettier-write-20260711-pid-file-live-guard.log`,
`/tmp/codex-tool-runs/svton/f334-prettier-check-20260711-pid-file-live-guard.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
check passed
(`/tmp/codex-tool-runs/svton/f334-diff-check-20260711-pid-file-live-guard.log`,
`/tmp/codex-tool-runs/svton/f334-marker-scan-20260711-pid-file-live-guard.log`,
`/tmp/codex-tool-runs/svton/f334-trailing-whitespace-scan-20260711-pid-file-live-guard.log`,
`/tmp/codex-tool-runs/svton/f334-line-count-20260711-pid-file-live-guard.log`).

## F335. CLI Task-pull Run PID File Install Failure Cleanup

Purpose: close the command-layer cleanup gap after the F334 live-owner guard:
when `svton agent task-pull run --pid-file <path>` fails before the polling loop
because the pid-file install rejects, the command must not start the loop and
must still clean up the stop controller it already created. F335 keeps pid-file
ownership rules, loop execution, API schemas, background daemonization, and
multi-instance scheduling unchanged.

| Task   | Status | Description                                      | Evidence                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F335.1 | done   | Map pid-file install failure cleanup boundary.   | Routing: focused CLI command lifecycle slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to `runAgentTaskPullRunCommand()`, pid-file injection, command tests, and README/docs.                                                                                                                                               |
| F335.2 | done   | Ensure stop cleanup when pid-file install fails. | `runAgentTaskPullRunCommand()` now installs the pid file inside the existing `try/finally`, so pid-file install failures skip the polling loop but still clean up the stop controller.                                                                                                                                                                                                |
| F335.3 | done   | Run focused CLI verification and sync docs.      | Focused command/pid-file Jest passed: `/tmp/codex-tool-runs/svton/f335-cli-jest-final-20260711-pid-file-install-failure-cleanup.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f335-cli-type-check-final-20260711-pid-file-install-failure-cleanup.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f335-cli-build-final-20260711-pid-file-install-failure-cleanup.log`. |

Final F335 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f335-prettier-docs-final-write-20260711-pid-file-install-failure-cleanup.log`,
`/tmp/codex-tool-runs/svton/f335-prettier-check-final-20260711-pid-file-install-failure-cleanup.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
check passed
(`/tmp/codex-tool-runs/svton/f335-diff-check-final-20260711-pid-file-install-failure-cleanup.log`,
`/tmp/codex-tool-runs/svton/f335-marker-scan-final-20260711-pid-file-install-failure-cleanup.log`,
`/tmp/codex-tool-runs/svton/f335-trailing-whitespace-scan-final-20260711-pid-file-install-failure-cleanup.log`,
`/tmp/codex-tool-runs/svton/f335-line-count-20260711-pid-file-install-failure-cleanup.log`).

## F336. CLI Task-pull Run PID File Install Failure Exit Surface

Purpose: make the F334/F335 pid-file install failure path supervisor-friendly:
when `svton agent task-pull run --pid-file <path>` cannot install the pid file,
the command should log a concise startup error, set a nonzero exit code, skip
the polling loop, and still clean up the stop controller instead of surfacing as
an unhandled action rejection. F336 keeps pid-file ownership rules, loop
execution, API schemas, background daemonization, and multi-instance scheduling
unchanged.

| Task   | Status | Description                                   | Evidence                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F336.1 | done   | Map pid-file install failure exit surface.    | Routing: focused CLI command lifecycle slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to `runAgentTaskPullRunCommand()`, command tests, and CLI entry error behavior.                                                                                                                                             |
| F336.2 | done   | Convert pid-file install rejection to exit 1. | `runAgentTaskPullRunCommand()` now logs a concise startup error, sets exit code 1, skips polling, and still runs stop cleanup when pid-file install fails.                                                                                                                                                                                                                   |
| F336.3 | done   | Run focused CLI verification and sync docs.   | Focused command/pid-file Jest passed: `/tmp/codex-tool-runs/svton/f336-cli-jest-final-20260711-pid-file-install-exit-surface.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f336-cli-type-check-final-20260711-pid-file-install-exit-surface.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f336-cli-build-final-20260711-pid-file-install-exit-surface.log`. |

Final F336 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f336-prettier-docs-final-write-20260711-pid-file-install-exit-surface.log`,
`/tmp/codex-tool-runs/svton/f336-prettier-check-final-docs-20260711-pid-file-install-exit-surface.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
check passed
(`/tmp/codex-tool-runs/svton/f336-diff-check-final-docs-20260711-pid-file-install-exit-surface.log`,
`/tmp/codex-tool-runs/svton/f336-marker-scan-final-docs-20260711-pid-file-install-exit-surface.log`,
`/tmp/codex-tool-runs/svton/f336-trailing-whitespace-scan-final-docs-20260711-pid-file-install-exit-surface.log`,
`/tmp/codex-tool-runs/svton/f336-line-count-20260711-pid-file-install-exit-surface.log`).

## F337. CLI Task-pull Run Startup Boundary Extraction

Purpose: keep `svton agent task-pull run` ready for the next supervisor-facing
slices by moving the startup pid-file install/error/exit handling out of the
near-limit command entry file and into a focused startup service. F337 preserves
the F333-F336 pid-file lifecycle, live-owner guard, install-failure cleanup,
install-failure exit surface, loop execution, API schemas, background
daemonization, and multi-instance scheduling.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F337.1 | done   | Map run startup and command entry boundary. | Routing: focused CLI structure slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to `runAgentTaskPullRunCommand()`, pid-file install, startup error handling, and command tests.                                                                                                                  |
| F337.2 | done   | Extract startup pid-file/error handling.    | `prepareAgentTaskPullRunStartup()` now owns pid-file install, startup error logging, exit-code mapping, and loop gating; `runAgentTaskPullRunCommand()` remains the command orchestration entry and preserves F336 behavior.                                                                                                                              |
| F337.3 | done   | Run focused CLI verification and sync docs. | Focused command/startup/pid-file Jest passed: `/tmp/codex-tool-runs/svton/f337-cli-jest-final-20260711-run-startup-boundary.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f337-cli-type-check-final-20260711-run-startup-boundary.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f337-cli-build-final-20260711-run-startup-boundary.log`. |

Final F337 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f337-prettier-docs-final-write-20260711-run-startup-boundary.log`,
`/tmp/codex-tool-runs/svton/f337-prettier-check-final-docs-20260711-run-startup-boundary.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
check passed
(`/tmp/codex-tool-runs/svton/f337-diff-check-final-docs-20260711-run-startup-boundary.log`,
`/tmp/codex-tool-runs/svton/f337-marker-scan-final-docs-20260711-run-startup-boundary.log`,
`/tmp/codex-tool-runs/svton/f337-trailing-whitespace-scan-final-docs-20260711-run-startup-boundary.log`,
`/tmp/codex-tool-runs/svton/f337-line-count-20260711-run-startup-boundary.log`).

## F338. CLI Task-pull Run Startup Failure Summary

Purpose: make startup failures observable through the same structured loop
summary channel used by normal `svton agent task-pull run` stops. When pid-file
startup fails before polling, the command should still log the startup error
and exit 1, but should also emit a zero-iteration `startup_failed` loop summary
so supervisors can parse a consistent status envelope. F338 keeps pid-file
ownership rules, loop execution, API schemas, background daemonization, and
multi-instance scheduling unchanged.

| Task   | Status | Description                                  | Evidence                                                                                                                                                                                                                                                                                                                                                           |
| ------ | ------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F338.1 | done   | Map startup failure summary boundary.        | Routing: focused CLI observability slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to startup service result, loop summary type, command logging, and tests.                                                                                                                                             |
| F338.2 | done   | Emit structured startup_failed loop summary. | Startup failures now emit a zero-iteration loop summary with `stoppedReason: "startup_failed"`, `startupError`, and the command runner id while preserving the F336 error log, exit code 1, no-loop behavior, and cleanup.                                                                                                                                         |
| F338.3 | done   | Run focused CLI verification and sync docs.  | Focused command/startup/pid-file Jest passed: `/tmp/codex-tool-runs/svton/f338-cli-jest-final-20260711-startup-failure-summary.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f338-cli-type-check-final-20260711-startup-failure-summary.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f338-cli-build-final-20260711-startup-failure-summary.log`. |

Final F338 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f338-prettier-write-final-20260711-startup-failure-summary.log`,
`/tmp/codex-tool-runs/svton/f338-prettier-check-final-20260711-startup-failure-summary.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
check passed
(`/tmp/codex-tool-runs/svton/f338-diff-check-final-20260711-startup-failure-summary.log`,
`/tmp/codex-tool-runs/svton/f338-marker-scan-final-20260711-startup-failure-summary.log`,
`/tmp/codex-tool-runs/svton/f338-trailing-whitespace-scan-final-20260711-startup-failure-summary.log`,
`/tmp/codex-tool-runs/svton/f338-line-count-final-20260711-startup-failure-summary.log`).

## F339. CLI Task-pull Loop Summary Type Boundary

Purpose: keep the task-pull loop runner structurally ready for additional
observability and supervisor-facing slices by moving its public loop summary
contract into a focused `.types.ts` file. F339 preserves the F338
`startup_failed` summary, all existing stopped reasons, loop execution,
command logging, API schemas, background daemonization, and multi-instance
scheduling.

| Task   | Status | Description                                   | Evidence                                                                                                                                                                                                                                                                                                                                            |
| ------ | ------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F339.1 | done   | Map loop summary type/import boundary.        | Routing: focused CLI type-boundary slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to loop summary imports, loop runner, command logging, and focused tests.                                                                                                                              |
| F339.2 | done   | Extract loop summary contract to `.types.ts`. | `AgentTaskPullLoopSummary` and stopped-reason typing now live in `agent-task-pull-loop-summary.types.ts`; loop runner behavior and command summary output are unchanged.                                                                                                                                                                            |
| F339.3 | done   | Run focused CLI verification and sync docs.   | Focused command/startup/pid-file Jest passed: `/tmp/codex-tool-runs/svton/f339-cli-jest-final-20260711-loop-summary-types.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f339-cli-type-check-final-20260711-loop-summary-types.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f339-cli-build-final-20260711-loop-summary-types.log`. |

Final F339 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f339-prettier-write-20260711-loop-summary-types.log`,
`/tmp/codex-tool-runs/svton/f339-prettier-check-20260711-loop-summary-types.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
check passed
(`/tmp/codex-tool-runs/svton/f339-diff-check-20260711-loop-summary-types.log`,
`/tmp/codex-tool-runs/svton/f339-marker-scan-20260711-loop-summary-types.log`,
`/tmp/codex-tool-runs/svton/f339-trailing-whitespace-scan-20260711-loop-summary-types.log`,
`/tmp/codex-tool-runs/svton/f339-line-count-20260711-loop-summary-types.log`).

## F340. CLI Task-pull Command Result Policy Boundary

Purpose: keep the `agent task-pull` command entry focused on command
orchestration by moving summary logging and process-exit policy into a focused
command result service. F340 preserves once/run execution, the F338
`startup_failed` summary, all existing failure exit rules, pid-file behavior,
loop execution, API schemas, background daemonization, and multi-instance
scheduling.

| Task   | Status | Description                                  | Evidence                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F340.1 | done   | Map command result logging/exit boundaries.  | Routing: focused CLI command-result boundary slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing was scoped to command summary logging, failure exit predicates, and command tests.                                                                                                                               |
| F340.2 | done   | Extract summary logging and exit predicates. | Summary logging, once failure detection, loop failure stop detection, and default exit-code setting now live in `agent-task-pull-command-result.service.ts`; command behavior is unchanged.                                                                                                                                                                  |
| F340.3 | done   | Run focused CLI verification and sync docs.  | Focused command/startup/pid-file Jest passed: `/tmp/codex-tool-runs/svton/f340-cli-jest-final-20260711-command-result-policy.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f340-cli-type-check-final-20260711-command-result-policy.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f340-cli-build-final-20260711-command-result-policy.log`. |

Final F340 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f340-prettier-write-20260711-command-result-policy.log`,
`/tmp/codex-tool-runs/svton/f340-prettier-check-20260711-command-result-policy.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
check passed
(`/tmp/codex-tool-runs/svton/f340-diff-check-20260711-command-result-policy.log`,
`/tmp/codex-tool-runs/svton/f340-marker-scan-20260711-command-result-policy.log`,
`/tmp/codex-tool-runs/svton/f340-trailing-whitespace-scan-20260711-command-result-policy.log`,
`/tmp/codex-tool-runs/svton/f340-line-count-20260711-command-result-policy.log`).

## F341. CLI Task-pull Loop Summary Builder Boundary

Purpose: keep the `agent task-pull run` command entry focused on command
orchestration by moving loop summary construction and runner-id enrichment into
the command result service. F341 preserves the F338 `startup_failed` summary,
the F340 logging/exit policy boundary, pid-file behavior, loop execution, API
schemas, background daemonization, and multi-instance scheduling.

| Task   | Status | Description                                           | Evidence                                                                                                                                                                                                                                                                                                                                                                 |
| ------ | ------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F341.1 | done   | Map loop summary construction/enrichment boundaries.  | Routing: focused CLI loop-summary builder slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing stays within the command run entry, command result service, and command tests.                                                                                                                                                  |
| F341.2 | done   | Extract startup failure summary and runner-id helper. | Startup failure loop-summary construction and runner-id enrichment now live in `agent-task-pull-command-result.service.ts`; command behavior is unchanged.                                                                                                                                                                                                               |
| F341.3 | done   | Run focused CLI verification and sync docs.           | Focused command/result-service/startup/pid-file Jest passed: `/tmp/codex-tool-runs/svton/f341-cli-jest-final-20260711-loop-summary-builder.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f341-cli-type-check-final-20260711-loop-summary-builder.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f341-cli-build-final-20260711-loop-summary-builder.log`. |

Final F341 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f341-prettier-write-20260711-loop-summary-builder.log`,
`/tmp/codex-tool-runs/svton/f341-prettier-check-final-20260711-loop-summary-builder.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
check passed
(`/tmp/codex-tool-runs/svton/f341-diff-check-final-20260711-loop-summary-builder.log`,
`/tmp/codex-tool-runs/svton/f341-marker-scan-final-20260711-loop-summary-builder.log`,
`/tmp/codex-tool-runs/svton/f341-trailing-whitespace-scan-final-20260711-loop-summary-builder.log`,
`/tmp/codex-tool-runs/svton/f341-line-count-final-20260711-loop-summary-builder.log`).

## F342. CLI Task-pull Summary Emission Boundary

Purpose: keep the `agent task-pull` command entry focused on execution
orchestration by moving summary emission and process-exit mapping into the
command result service. F342 preserves once/run execution, the F338
`startup_failed` summary, F341 runner-id enrichment, pid-file behavior, loop
execution, API schemas, background daemonization, and multi-instance
scheduling.

| Task   | Status | Description                                    | Evidence                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F342.1 | done   | Map command summary emission and exit mapping. | Routing: focused CLI summary-emission slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing stays within the command entry, command result service, and command tests.                                                                                                                                              |
| F342.2 | done   | Extract once/run summary emission helpers.     | Summary logging plus nonzero-exit decisions now live in `agent-task-pull-command-result.service.ts`; command behavior and dependency-injected tests are unchanged.                                                                                                                                                                                           |
| F342.3 | done   | Run focused CLI verification and sync docs.    | Focused command/result-service/startup/pid-file Jest passed: `/tmp/codex-tool-runs/svton/f342-cli-jest-final-20260711-summary-emission.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f342-cli-type-check-final-20260711-summary-emission.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f342-cli-build-final-20260711-summary-emission.log`. |

Final F342 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f342-prettier-write-20260711-summary-emission.log`,
`/tmp/codex-tool-runs/svton/f342-prettier-check-final-20260711-summary-emission.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
check passed
(`/tmp/codex-tool-runs/svton/f342-diff-check-final-20260711-summary-emission.log`,
`/tmp/codex-tool-runs/svton/f342-marker-scan-final-20260711-summary-emission.log`,
`/tmp/codex-tool-runs/svton/f342-trailing-whitespace-scan-final-20260711-summary-emission.log`,
`/tmp/codex-tool-runs/svton/f342-line-count-final-20260711-summary-emission.log`).

## F343. CLI Task-pull Command Registration Boundary

Purpose: keep the `agent task-pull` execution entry focused on once/run
orchestration by moving Commander command registration into a focused CLI
controller. F343 preserves once/run execution, option names, the F338
`startup_failed` summary, F341 runner-id enrichment, F342 result emission,
pid-file behavior, loop execution, API schemas, background daemonization, and
multi-instance scheduling.

| Task   | Status | Description                                     | Evidence                                                                                                                                                                                                                                                                                                                                                                            |
| ------ | ------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F343.1 | done   | Map task-pull command registration boundaries.  | Routing: focused CLI registration boundary slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing stays within registration, command execution, and command tests.                                                                                                                                                                          |
| F343.2 | done   | Extract Commander registration into controller. | `agent task-pull once/run` Commander registration now lives in `agent-task-pull-command.controller.ts`; execution command behavior is unchanged.                                                                                                                                                                                                                                    |
| F343.3 | done   | Run focused CLI verification and sync docs.     | Focused command/controller/result-service/startup/pid-file Jest passed: `/tmp/codex-tool-runs/svton/f343-cli-jest-final-20260711-command-registration.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f343-cli-type-check-final-20260711-command-registration.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f343-cli-build-final-20260711-command-registration.log`. |

Final F343 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f343-prettier-write-20260711-command-registration.log`,
`/tmp/codex-tool-runs/svton/f343-prettier-check-final-20260711-command-registration.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
check passed
(`/tmp/codex-tool-runs/svton/f343-diff-check-final-20260711-command-registration.log`,
`/tmp/codex-tool-runs/svton/f343-marker-scan-final-20260711-command-registration.log`,
`/tmp/codex-tool-runs/svton/f343-trailing-whitespace-scan-final-20260711-command-registration.log`,
`/tmp/codex-tool-runs/svton/f343-line-count-final-20260711-command-registration.log`).

## F344. CLI Task-pull Once Command Execution Boundary

Purpose: keep the remaining `agent task-pull` execution entry focused by moving
the `once` command orchestration into a focused CLI service. F344 preserves
once/run execution, option names, the F342 result emission policy, the F343
registration boundary, pid-file behavior, loop execution, API schemas,
background daemonization, and multi-instance scheduling.

| Task   | Status | Description                                    | Evidence                                                                                                                                                                                                                                                                                                                                                                                    |
| ------ | ------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F344.1 | done   | Map once command execution and callers.        | Routing: focused CLI once-command boundary slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing stays within once/run execution, controller imports, and command tests.                                                                                                                                                                           |
| F344.2 | done   | Extract once execution into a focused service. | `agentTaskPullOnce()` and `runAgentTaskPullOnceCommand()` now live in `agent-task-pull-once-command.service.ts`; the existing public re-export and command behavior are unchanged.                                                                                                                                                                                                          |
| F344.3 | done   | Run focused CLI verification and sync docs.    | Focused command/service/controller/result-service/startup/pid-file Jest passed: `/tmp/codex-tool-runs/svton/f344-cli-jest-final-20260711-once-command-service.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f344-cli-type-check-final-20260711-once-command-service.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f344-cli-build-final-20260711-once-command-service.log`. |

Final F344 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f344-prettier-write-20260711-once-command-service.log`,
`/tmp/codex-tool-runs/svton/f344-prettier-check-final-20260711-once-command-service.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
check passed
(`/tmp/codex-tool-runs/svton/f344-diff-check-final-20260711-once-command-service.log`,
`/tmp/codex-tool-runs/svton/f344-marker-scan-final-20260711-once-command-service.log`,
`/tmp/codex-tool-runs/svton/f344-trailing-whitespace-scan-final-20260711-once-command-service.log`,
`/tmp/codex-tool-runs/svton/f344-line-count-final-20260711-once-command-service.log`).

## F345. CLI Task-pull Run Command Execution Boundary

Purpose: keep the `agent task-pull` command module as a thin public boundary by
moving the remaining `run` command orchestration into a focused CLI service.
F345 preserves once/run execution, option names, the F338 `startup_failed`
summary, F341 runner-id enrichment, F342 result emission, F343 registration,
F344 once service boundary, pid-file behavior, loop execution, API schemas,
background daemonization, and multi-instance scheduling.

| Task   | Status | Description                                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                 |
| ------ | ------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F345.1 | done   | Map run command execution and callers.        | Routing: focused CLI run-command boundary slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing stays within run execution, controller imports, and command tests.                                                                                                                                                                              |
| F345.2 | done   | Extract run execution into a focused service. | `agentTaskPullRun()` and `runAgentTaskPullRunCommand()` now live in `agent-task-pull-run-command.service.ts`; the existing public re-export and command behavior are unchanged.                                                                                                                                                                                                          |
| F345.3 | done   | Run focused CLI verification and sync docs.   | Focused command/service/controller/result-service/startup/pid-file Jest passed: `/tmp/codex-tool-runs/svton/f345-cli-jest-final-20260711-run-command-service.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f345-cli-type-check-final-20260711-run-command-service.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f345-cli-build-final-20260711-run-command-service.log`. |

Final F345 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f345-prettier-write-20260711-run-command-service.log`,
`/tmp/codex-tool-runs/svton/f345-prettier-check-final-20260711-run-command-service.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
check passed
(`/tmp/codex-tool-runs/svton/f345-diff-check-final-20260711-run-command-service.log`,
`/tmp/codex-tool-runs/svton/f345-marker-scan-final-20260711-run-command-service.log`,
`/tmp/codex-tool-runs/svton/f345-trailing-whitespace-scan-final-20260711-run-command-service.log`,
`/tmp/codex-tool-runs/svton/f345-line-count-final-20260711-run-command-service.log`).

## F346. CLI Task-pull Shared Option Registration Boundary

Purpose: keep the task-pull Commander controller focused on command shape by
moving shared once/run option registration into a focused CLI service. F346
preserves once/run execution, option names and order, F343 registration, F344
once service, F345 run service, pid-file behavior, loop execution, API schemas,
background daemonization, and multi-instance scheduling.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F346.1 | done   | Map duplicated task-pull command options.   | Routing: focused CLI shared-option registration slice + noisy-tools verification; CodeGraph is installed but uninitialized, so manual graphing stays within controller options and controller tests.                                                                                                                                                                      |
| F346.2 | done   | Extract shared option registration service. | Common once/run option registration now lives in `agent-task-pull-command-options.service.ts`; command option names, order, and action wiring are unchanged.                                                                                                                                                                                                              |
| F346.3 | done   | Run focused CLI verification and sync docs. | Focused command/controller/options/result-service/startup/pid-file Jest passed: `/tmp/codex-tool-runs/svton/f346-cli-jest-final-20260711-shared-options.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f346-cli-type-check-final-20260711-shared-options.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f346-cli-build-final-20260711-shared-options.log`. |

Final F346 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f346-prettier-write-20260711-shared-options.log`,
`/tmp/codex-tool-runs/svton/f346-prettier-check-final-20260711-shared-options.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
check passed
(`/tmp/codex-tool-runs/svton/f346-diff-check-final-20260711-shared-options.log`,
`/tmp/codex-tool-runs/svton/f346-marker-scan-final-20260711-shared-options.log`,
`/tmp/codex-tool-runs/svton/f346-trailing-whitespace-scan-final-20260711-shared-options.log`,
`/tmp/codex-tool-runs/svton/f346-line-count-final-20260711-shared-options.log`).

## F347. CLI Task-pull Config Test Boundary

Purpose: keep the CLI task-pull verification surface maintainable after the
F341-F346 command boundary splits. Current source-backed scan shows task-pull
runtime files are under the production 200-line ceiling, while
`agent-task-pull.test.ts` still combines config parsing, command wrappers, run
PID behavior, once execution, step control, output, timeout, cancellation, and
finish writeback scenarios in a 1105-line spec. F347 only moves config parsing
coverage into a focused test file and preserves runtime code, command behavior,
API schemas, and test assertions.

| Task   | Status | Description                                          | Evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F347.1 | done   | Map oversized CLI task-pull test responsibilities.   | Routing: focused CLI test-boundary slice + noisy-tools verification; source scan confirmed task-pull production files remain under the production line ceiling, while config parsing assertions lived inside the oversized once/loop behavior specs.                                                                                                                                       |
| F347.2 | done   | Extract config parsing coverage into a focused spec. | Once config fallback/capability assertions and loop-bound/heartbeat/default-runner config assertions now live in `agent-task-pull-config.test.ts`; runtime code and assertion bodies are behavior-preserving.                                                                                                                                                                              |
| F347.3 | done   | Run focused CLI verification and sync docs.          | Focused task-pull Jest passed: `/tmp/codex-tool-runs/svton/f347-cli-jest-20260711-config-test.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f347-cli-type-check-20260711-config-test.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f347-cli-build-20260711-config-test.log`; new config spec is 130 lines, while remaining behavior specs are still oversized follow-ups. |

Final F347 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f347-prettier-write-20260711-config-test.log`,
`/tmp/codex-tool-runs/svton/f347-prettier-docs-final-write-20260711-config-test.log`,
`/tmp/codex-tool-runs/svton/f347-prettier-check-final2-20260711-config-test.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
check passed
(`/tmp/codex-tool-runs/svton/f347-diff-check-final2-20260711-config-test.log`,
`/tmp/codex-tool-runs/svton/f347-marker-scan-final2-20260711-config-test.log`,
`/tmp/codex-tool-runs/svton/f347-trailing-whitespace-scan-final2-20260711-config-test.log`,
`/tmp/codex-tool-runs/svton/f347-line-count-final-20260711-config-test.log`).

## F348. CLI Task-pull Command Wrapper Test Boundary

Purpose: continue making the CLI task-pull verification surface navigable after
F347. Current source-backed map shows `agent-task-pull.test.ts` still mixes
command wrapper / exit-code / pid-file startup assertions with once-runner
execution flow scenarios. F348 only moves command wrapper coverage into focused
spec files and preserves runtime code, public re-exports, command behavior, API
schemas, and assertion intent.

| Task   | Status | Description                                      | Evidence                                                                                                                                                                                                                                                                                                                                                                                 |
| ------ | ------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F348.1 | done   | Map command wrapper tests and once-runner tests. | Routing: focused CLI command-wrapper test-boundary slice + noisy-tools verification; source map confirmed the first eight `agent-task-pull.test.ts` cases covered command wrapper signal wiring, exit-code policy, PID-file startup, and run-loop wrapper failures, while the rest covers once-runner execution flow.                                                                    |
| F348.2 | done   | Extract once/run command wrapper coverage.       | Once command wrapper coverage now lives in `agent-task-pull-once-command.service.test.ts`; run command wrapper/PID/startup coverage now lives in `agent-task-pull-run-command.service.test.ts`; `agent-task-pull.test.ts` is down from 1052 to 704 lines and now starts at the once-runner contract/execution behavior.                                                                  |
| F348.3 | done   | Run focused CLI verification and sync docs.      | Focused task-pull Jest passed: `/tmp/codex-tool-runs/svton/f348-cli-jest-20260711-command-test.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f348-cli-type-check-20260711-command-test.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f348-cli-build-20260711-command-test.log`; line-count log: `/tmp/codex-tool-runs/svton/f348-line-count-20260711-command-test.log`. |

Final F348 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f348-prettier-write-20260711-command-test.log`,
`/tmp/codex-tool-runs/svton/f348-prettier-docs-final-write-20260711-command-test.log`,
`/tmp/codex-tool-runs/svton/f348-prettier-check-final-20260711-command-test.log`);
diff whitespace check, marker scan, and trailing-whitespace scan passed
(`/tmp/codex-tool-runs/svton/f348-diff-check-final-20260711-command-test.log`,
`/tmp/codex-tool-runs/svton/f348-marker-scan-final-20260711-command-test.log`,
`/tmp/codex-tool-runs/svton/f348-trailing-whitespace-scan-final-20260711-command-test.log`).

## F349. CLI Task-pull Once Command-step Test Boundary

Purpose: continue making the CLI once-runner verification surface navigable
after F348. Current source-backed map shows `agent-task-pull.test.ts` still
mixes claim/ack lifecycle, command-step result handling, timeout handling, and
signal cancellation in one 704-line spec. F349 only moves command-step result
coverage into a focused once-runner spec and preserves runtime code, public
re-exports, command behavior, API schemas, and assertion intent.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F349.1 | done   | Map once-runner command-step result tests.  | Routing: focused CLI once-runner command-step test-boundary slice + noisy-tools verification; source map confirmed `agent-task-pull.test.ts` grouped command-step result handling with claim/ack lifecycle, timeout, and cancellation tests.                                                                                                                                                                 |
| F349.2 | done   | Extract command-step result coverage.       | Required-step failure, cwd escape, output truncation, dry-run skip, and spawn-error coverage now live in `agent-task-pull-once-command-step.test.ts`; `agent-task-pull.test.ts` is down from 704 to 458 lines and now focuses on claim/ack lifecycle, timeout, cancellation, and raw child-process abort behavior.                                                                                           |
| F349.3 | done   | Run focused CLI verification and sync docs. | Focused task-pull Jest passed: `/tmp/codex-tool-runs/svton/f349-cli-jest-20260711-command-step-test.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f349-cli-type-check-20260711-command-step-test.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f349-cli-build-20260711-command-step-test.log`; line-count log: `/tmp/codex-tool-runs/svton/f349-line-count-20260711-command-step-test.log`. |

Final F349 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f349-prettier-write-20260711-command-step-test.log`,
`/tmp/codex-tool-runs/svton/f349-prettier-docs-final-write-20260711-command-step-test.log`,
`/tmp/codex-tool-runs/svton/f349-prettier-check-final-20260711-command-step-test.log`);
diff whitespace check, marker scan, and trailing-whitespace scan passed
(`/tmp/codex-tool-runs/svton/f349-diff-check-final-20260711-command-step-test.log`,
`/tmp/codex-tool-runs/svton/f349-marker-scan-final-20260711-command-step-test.log`,
`/tmp/codex-tool-runs/svton/f349-trailing-whitespace-scan-final-20260711-command-step-test.log`).

## F350. CLI Task-pull Once Timeout/Cancellation Test Boundary

Purpose: continue making the CLI once-runner verification surface navigable
after F349. Current source-backed map shows `agent-task-pull.test.ts` now
focuses on claim/ack lifecycle plus timeout, cancellation, and raw
child-process abort scenarios. F350 only moves timeout/cancellation coverage
into a focused once-runner spec and preserves runtime code, public re-exports,
command behavior, API schemas, and assertion intent.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F350.1 | done   | Map once-runner timeout/cancellation tests. | Routing: focused CLI once-runner timeout/cancellation test-boundary slice + noisy-tools verification; source map confirmed `agent-task-pull.test.ts` grouped timeout, optional-timeout continuation, final ack cancellation, stop-signal cancellation, and raw child-process abort with claim/ack lifecycle tests.                                                                                                                           |
| F350.2 | done   | Extract timeout/cancellation coverage.      | Timeout, optional timeout, final ack cancellation, stop-signal cancellation, and child-process abort coverage now live in `agent-task-pull-once-timeout-cancellation.test.ts`; `agent-task-pull.test.ts` is down from 458 to 248 lines and now focuses on once-runner contract/claim/ack lifecycle behavior.                                                                                                                                 |
| F350.3 | done   | Run focused CLI verification and sync docs. | Focused task-pull Jest passed: `/tmp/codex-tool-runs/svton/f350-cli-jest-20260711-timeout-cancellation-test.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f350-cli-type-check-20260711-timeout-cancellation-test.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f350-cli-build-20260711-timeout-cancellation-test.log`; line-count log: `/tmp/codex-tool-runs/svton/f350-line-count-20260711-timeout-cancellation-test.log`. |

Final F350 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f350-prettier-write-20260711-timeout-cancellation-test.log`,
`/tmp/codex-tool-runs/svton/f350-prettier-docs-final-write-20260711-timeout-cancellation-test.log`,
`/tmp/codex-tool-runs/svton/f350-prettier-check-final-20260711-timeout-cancellation-test.log`);
diff whitespace check, marker scan, and trailing-whitespace scan passed
(`/tmp/codex-tool-runs/svton/f350-diff-check-final-20260711-timeout-cancellation-test.log`,
`/tmp/codex-tool-runs/svton/f350-marker-scan-final-20260711-timeout-cancellation-test.log`,
`/tmp/codex-tool-runs/svton/f350-trailing-whitespace-scan-final-20260711-timeout-cancellation-test.log`).

## F351. CLI Task-pull Once Lifecycle Test Naming Boundary

Purpose: finish the once-runner test-boundary cleanup after F350. Current
source-backed map shows `agent-task-pull.test.ts` now only covers once-runner
contract, claim, ack renewal, ack cancellation, and ack rejection lifecycle
behavior, while command wrapper, command-step results, and timeout/cancellation
coverage are already focused elsewhere. F351 only renames the remaining generic
spec into a focused lifecycle spec and preserves runtime code, public
re-exports, command behavior, API schemas, and assertion intent.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------ | ------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F351.1 | done   | Map remaining once lifecycle coverage.      | Routing: focused CLI once-lifecycle test naming slice + noisy-tools verification; source map confirmed the remaining generic `agent-task-pull.test.ts` only covered once-runner contract, claim, ack renewal, ack cancellation, and ack rejection lifecycle behavior.                                                                                                                                                |
| F351.2 | done   | Rename generic once spec to lifecycle spec. | Remaining once lifecycle coverage now lives in `agent-task-pull-once-lifecycle.test.ts`; the generic `agent-task-pull.test.ts` file was removed so command wrapper, command-step, timeout/cancellation, config, loop, and lifecycle coverage each have focused spec names.                                                                                                                                           |
| F351.3 | done   | Run focused CLI verification and sync docs. | Focused task-pull Jest passed: `/tmp/codex-tool-runs/svton/f351-cli-jest-20260711-once-lifecycle-test.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f351-cli-type-check-20260711-once-lifecycle-test.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f351-cli-build-20260711-once-lifecycle-test.log`; line-count log: `/tmp/codex-tool-runs/svton/f351-line-count-20260711-once-lifecycle-test.log`. |

Final F351 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f351-prettier-write-20260711-once-lifecycle-test.log`,
`/tmp/codex-tool-runs/svton/f351-prettier-docs-final-write-20260711-once-lifecycle-test.log`,
`/tmp/codex-tool-runs/svton/f351-prettier-check-final-20260711-once-lifecycle-test.log`);
diff whitespace check, marker scan, and trailing-whitespace scan passed
(`/tmp/codex-tool-runs/svton/f351-diff-check-final-20260711-once-lifecycle-test.log`,
`/tmp/codex-tool-runs/svton/f351-marker-scan-final-20260711-once-lifecycle-test.log`,
`/tmp/codex-tool-runs/svton/f351-trailing-whitespace-scan-final-20260711-once-lifecycle-test.log`).

## F352. CLI Task-pull Loop Heartbeat Test Boundary

Purpose: continue the CLI task-pull test-boundary cleanup after F351. Current
source-backed map shows `agent-task-pull-loop.test.ts` still mixes core loop
iteration/finish/error behavior with heartbeat pre-poll writeback behavior.
F352 only extracts heartbeat loop coverage into a focused spec and preserves
runtime code, public re-exports, command behavior, API schemas, and assertion
intent.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                         |
| ------ | ------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F352.1 | done   | Map loop heartbeat coverage.                | Routing: focused CLI loop heartbeat test-boundary slice + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed `agent-task-pull-loop.test.ts` mixed core loop behavior with three heartbeat pre-poll cases.                                                                                        |
| F352.2 | done   | Extract heartbeat loop coverage.            | Heartbeat success/failure/rejection coverage now lives in `agent-task-pull-loop-heartbeat.test.ts`; shared loop fixtures live in `agent-task-pull-loop.test-utils.ts`, and `agent-task-pull-loop.test.ts` now focuses on core loop, finish, polling error, ack interval, force-kill, idle, disabled, and stop-boundary behavior. |
| F352.3 | done   | Run focused CLI verification and sync docs. | Focused task-pull Jest passed: `/tmp/codex-tool-runs/svton/f352-cli-jest-20260711-loop-heartbeat-test.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f352-cli-type-check-20260711-loop-heartbeat-test.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f352-cli-build-20260711-loop-heartbeat-test.log`.            |

Final F352 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f352-prettier-write-20260711-loop-heartbeat-test.log`,
`/tmp/codex-tool-runs/svton/f352-prettier-check-final-20260711-loop-heartbeat-test.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
scan passed
(`/tmp/codex-tool-runs/svton/f352-diff-check-final-20260711-loop-heartbeat-test.log`,
`/tmp/codex-tool-runs/svton/f352-marker-scan-final-20260711-loop-heartbeat-test.log`,
`/tmp/codex-tool-runs/svton/f352-trailing-whitespace-scan-final-20260711-loop-heartbeat-test.log`,
`/tmp/codex-tool-runs/svton/f352-line-count-20260711-loop-heartbeat-test.log`).

## F353. CLI Task-pull Loop Stop-Boundary Test Boundary

Purpose: continue the CLI task-pull loop test-boundary cleanup after F352.
Current source-backed map shows `agent-task-pull-loop.test.ts` now focuses on
core loop execution plus idle/disabled/signal stop-boundary behavior. F353 only
extracts idle-limit, disabled-claim, and signal-stop coverage into a focused
loop stop spec and preserves runtime code, public re-exports, command behavior,
API schemas, and assertion intent.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                  |
| ------ | ------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F353.1 | done   | Map loop stop-boundary coverage.            | Routing: focused CLI loop stop-boundary test slice + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed `agent-task-pull-loop.test.ts` mixed core loop execution with idle-limit, disabled-claim, already-aborted, next-boundary signal, and default-delay wake coverage. |
| F353.2 | done   | Extract loop stop-boundary coverage.        | Stop-boundary coverage now lives in `agent-task-pull-loop-stop.test.ts`; `agent-task-pull-loop.test.ts` is down to 181 lines and now focuses on core loop execution, finish writeback stop, polling errors, ack interval, and force-kill command options.                                                 |
| F353.3 | done   | Run focused CLI verification and sync docs. | Focused task-pull Jest passed: `/tmp/codex-tool-runs/svton/f353-cli-jest-20260711-loop-stop-test.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f353-cli-type-check-20260711-loop-stop-test.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f353-cli-build-20260711-loop-stop-test.log`.    |

Final F353 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f353-prettier-write-20260711-loop-stop-test.log`,
`/tmp/codex-tool-runs/svton/f353-prettier-check-final-20260711-loop-stop-test.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
scan passed
(`/tmp/codex-tool-runs/svton/f353-diff-check-final-20260711-loop-stop-test.log`,
`/tmp/codex-tool-runs/svton/f353-marker-scan-final-20260711-loop-stop-test.log`,
`/tmp/codex-tool-runs/svton/f353-trailing-whitespace-scan-final-20260711-loop-stop-test.log`,
`/tmp/codex-tool-runs/svton/f353-line-count-20260711-loop-stop-test.log`).

## F354. CLI Task-pull Once Command-Step Guard Test Boundary

Purpose: continue the CLI task-pull test-boundary cleanup after F353. Current
source-backed map shows `agent-task-pull-once-command-step.test.ts` still mixes
normal command-step result handling with local execution guard cases for cwd
escape and spawn failure. F354 only extracts those guard cases into a focused
spec and shared fixture, preserving runtime code, public re-exports, command
behavior, API schemas, and assertion intent.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                          |
| ------ | ------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F354.1 | done   | Map once command-step guard coverage.       | Routing: focused CLI once command-step guard test slice + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed `agent-task-pull-once-command-step.test.ts` mixed normal command-step result handling with cwd escape and spawn-error guard cases.                                                   |
| F354.2 | done   | Extract once command-step guard coverage.   | Cwd escape and spawn-error coverage now live in `agent-task-pull-once-command-step-guard.test.ts`; shared fixtures live in `agent-task-pull-once-command-step.test-utils.ts`, and `agent-task-pull-once-command-step.test.ts` is down to 146 lines.                                                                               |
| F354.3 | done   | Run focused CLI verification and sync docs. | Focused task-pull Jest passed: `/tmp/codex-tool-runs/svton/f354-cli-jest-20260711-command-step-guard-test.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f354-cli-type-check-20260711-command-step-guard-test.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f354-cli-build-20260711-command-step-guard-test.log`. |

Final F354 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f354-prettier-write-20260711-command-step-guard-test.log`,
`/tmp/codex-tool-runs/svton/f354-prettier-check-final-20260711-command-step-guard-test.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
scan passed
(`/tmp/codex-tool-runs/svton/f354-diff-check-final-20260711-command-step-guard-test.log`,
`/tmp/codex-tool-runs/svton/f354-marker-scan-final-20260711-command-step-guard-test.log`,
`/tmp/codex-tool-runs/svton/f354-trailing-whitespace-scan-final-20260711-command-step-guard-test.log`,
`/tmp/codex-tool-runs/svton/f354-line-count-20260711-command-step-guard-test.log`).

## F355. CLI Task-pull Once Timeout Semantics Test Boundary

Purpose: continue the CLI task-pull test-boundary cleanup after F354. Current
source-backed map shows `agent-task-pull-once-timeout-cancellation.test.ts`
mixes required/optional timeout semantics with final-ack cancellation,
stop-signal cancellation, and raw child-process abort coverage. F355 only
extracts required and optional timeout semantics into a focused spec and shared
fixture, preserving runtime code, public re-exports, command behavior, API
schemas, and assertion intent.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                       |
| ------ | ------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F355.1 | done   | Map once timeout semantics coverage.        | Routing: focused CLI once timeout semantics test slice + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed `agent-task-pull-once-timeout-cancellation.test.ts` mixed required/optional timeout semantics with cancellation and raw child-process abort coverage.                              |
| F355.2 | done   | Extract once timeout semantics coverage.    | Required timeout and optional timeout continuation coverage now live in `agent-task-pull-once-timeout-semantics.test.ts`; shared fixtures live in `agent-task-pull-once-timeout-cancellation.test-utils.ts`, and cancellation coverage remains in the original spec.                                                           |
| F355.3 | done   | Run focused CLI verification and sync docs. | Focused task-pull Jest passed: `/tmp/codex-tool-runs/svton/f355-cli-jest-20260711-timeout-semantics-test.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f355-cli-type-check-20260711-timeout-semantics-test.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f355-cli-build-20260711-timeout-semantics-test.log`. |

Final F355 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f355-prettier-write-20260711-timeout-semantics-test.log`,
`/tmp/codex-tool-runs/svton/f355-prettier-check-final-20260711-timeout-semantics-test.log`);
diff whitespace check, marker scan, trailing-whitespace scan, and line-count
scan passed
(`/tmp/codex-tool-runs/svton/f355-diff-check-final-20260711-timeout-semantics-test.log`,
`/tmp/codex-tool-runs/svton/f355-marker-scan-final-20260711-timeout-semantics-test.log`,
`/tmp/codex-tool-runs/svton/f355-trailing-whitespace-scan-final-20260711-timeout-semantics-test.log`,
`/tmp/codex-tool-runs/svton/f355-line-count-20260711-timeout-semantics-test.log`).

## F356. CLI Task-pull Run Command PID-file Test Boundary

Purpose: continue the CLI task-pull test-boundary cleanup after F355. Current
source-backed map shows `agent-task-pull-run-command.service.test.ts` still
mixes run loop exit-code behavior with pid-file install/cleanup and startup
failure behavior. F356 only extracts pid-file lifecycle and install-failure
coverage into a focused run-command pid-file spec, preserving runtime code,
public re-exports, command behavior, API schemas, and assertion intent.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                                |
| ------ | ------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F356.1 | done   | Map run command pid-file coverage.          | Routing: focused CLI run command pid-file test slice + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed `agent-task-pull-run-command.service.test.ts` mixed generic loop exit-code assertions with pid-file install/cleanup and install-failure startup behavior.                                     |
| F356.2 | done   | Extract run command pid-file coverage.      | PID-file install/cleanup and pid-file install-failure startup coverage now lives in `agent-task-pull-run-command-pid-file.service.test.ts`; `agent-task-pull-run-command.service.test.ts` is down to 129 lines and focuses on failure/success/poll-failure exit-code mapping.                                                           |
| F356.3 | done   | Run focused CLI verification and sync docs. | Focused task-pull Jest passed: `/tmp/codex-tool-runs/svton/f356-cli-jest-20260711-run-command-pid-file-test.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f356-cli-type-check-20260711-run-command-pid-file-test.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f356-cli-build-20260711-run-command-pid-file-test.log`. |

Final F356 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f356-prettier-write-20260711-run-command-pid-file-test.log`,
`/tmp/codex-tool-runs/svton/f356-prettier-check-final-20260711-run-command-pid-file-test.log`),
diff check passed
(`/tmp/codex-tool-runs/svton/f356-diff-check-final-20260711-run-command-pid-file-test.log`),
conflict marker and trailing whitespace scans passed
(`/tmp/codex-tool-runs/svton/f356-marker-scan-final-20260711-run-command-pid-file-test.log`,
`/tmp/codex-tool-runs/svton/f356-trailing-whitespace-scan-final-20260711-run-command-pid-file-test.log`),
and touched CLI run-command test files remain under 200 lines
(`/tmp/codex-tool-runs/svton/f356-line-count-20260711-run-command-pid-file-test.log`).

## F357. CLI Task-pull Once Ack-renewal Test Boundary

Purpose: continue the CLI task-pull test-boundary cleanup after F356. Current
source inspection shows `agent-task-pull-once-lifecycle.test.ts` is 248 lines
and mixes base contract/claim/finish lifecycle assertions with ack-renewal
progress and cancellation behavior plus step-ack rejection coverage. F357 only
extracts the ack-renewal progress/cancellation coverage into a focused once
ack-renewal spec and keeps runtime code unchanged.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                    |
| ------ | ------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F357.1 | done   | Map once ack-renewal lifecycle coverage.    | Routing: focused CLI once ack-renewal test-boundary slice + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed `agent-task-pull-once-lifecycle.test.ts` mixed base contract/claim/finish lifecycle assertions with ack-renewal progress/cancellation and step-ack rejection coverage.       |
| F357.2 | done   | Extract once ack-renewal coverage.          | Ack-renewal progress and cancellation coverage now lives in `agent-task-pull-once-ack-renewal.test.ts`; shared lifecycle fixtures live in `agent-task-pull-once-lifecycle.test-utils.ts`; `agent-task-pull-once-lifecycle.test.ts` is down to 114 lines and focuses on base lifecycle plus step-ack rejection.              |
| F357.3 | done   | Run focused CLI verification and sync docs. | Focused task-pull Jest passed: `/tmp/codex-tool-runs/svton/f357-cli-jest-20260711-once-ack-renewal-test.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f357-cli-type-check-20260711-once-ack-renewal-test.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f357-cli-build-20260711-once-ack-renewal-test.log`. |

Final F357 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f357-prettier-write-20260711-once-ack-renewal-test.log`,
`/tmp/codex-tool-runs/svton/f357-prettier-check-final-20260711-once-ack-renewal-test.log`),
diff check passed
(`/tmp/codex-tool-runs/svton/f357-diff-check-final-20260711-once-ack-renewal-test.log`),
conflict marker and trailing whitespace scans passed
(`/tmp/codex-tool-runs/svton/f357-marker-scan-final-20260711-once-ack-renewal-test.log`,
`/tmp/codex-tool-runs/svton/f357-trailing-whitespace-scan-final-20260711-once-ack-renewal-test.log`),
and touched CLI once lifecycle test files remain under 200 lines
(`/tmp/codex-tool-runs/svton/f357-line-count-20260711-once-ack-renewal-test.log`).

## F358. CLI Task-pull Loop Execution Option Test Boundary

Purpose: continue the CLI task-pull test-boundary cleanup after F357. Current
source inspection shows `agent-task-pull-loop.test.ts` mixes core loop
iteration/finish/poll-failure assertions with execution-option propagation for
ack renewal interval and force-kill grace. F358 only extracts loop execution
option propagation coverage into a focused spec and keeps runtime code
unchanged.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                                      |
| ------ | ------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F358.1 | done   | Map loop execution option coverage.         | Routing: focused CLI loop execution-option test-boundary slice + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed `agent-task-pull-loop.test.ts` mixed core loop iteration/finish/poll-failure assertions with ack-renewal interval and force-kill grace propagation.                                       |
| F358.2 | done   | Extract loop execution option coverage.     | Ack-renewal interval and force-kill grace propagation coverage now lives in `agent-task-pull-loop-execution-options.test.ts`; `agent-task-pull-loop.test.ts` is down to 127 lines and focuses on core loop iteration, finish writeback stop, and poll failure summaries.                                                                      |
| F358.3 | done   | Run focused CLI verification and sync docs. | Focused task-pull Jest passed: `/tmp/codex-tool-runs/svton/f358-cli-jest-20260712-loop-execution-options-test.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f358-cli-type-check-20260712-loop-execution-options-test.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f358-cli-build-20260712-loop-execution-options-test.log`. |

Final F358 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f358-prettier-write-20260712-loop-execution-options-test.log`,
`/tmp/codex-tool-runs/svton/f358-prettier-check-final-20260712-loop-execution-options-test.log`),
diff check passed
(`/tmp/codex-tool-runs/svton/f358-diff-check-final-20260712-loop-execution-options-test.log`),
conflict marker and trailing whitespace scans passed
(`/tmp/codex-tool-runs/svton/f358-marker-scan-final-20260712-loop-execution-options-test.log`,
`/tmp/codex-tool-runs/svton/f358-trailing-whitespace-scan-final-20260712-loop-execution-options-test.log`),
and touched CLI loop test files remain under 200 lines
(`/tmp/codex-tool-runs/svton/f358-line-count-20260712-loop-execution-options-test.log`).

## F359. CLI Task-pull Once Command-step Result Payload Test Boundary

Purpose: continue the CLI task-pull test-boundary cleanup after F358. Current
source inspection shows `agent-task-pull-once-command-step.test.ts` mixes
required step failure coverage with finish payload/result detail assertions for
output truncation flags and dry-run skipped steps. F359 only extracts the
result-payload coverage into a focused once command-step result spec and keeps
runtime code unchanged.

| Task   | Status | Description                                        | Evidence                                                                                                                                                                                                                                                                                                                             |
| ------ | ------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F359.1 | done   | Map once command-step result payload coverage.     | Routing: focused CLI once command-step result-payload test-boundary slice + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed `agent-task-pull-once-command-step.test.ts` mixed required step failure coverage with output truncation and dry-run result-payload assertions.                        |
| F359.2 | done   | Extract once command-step result payload coverage. | Output truncation and dry-run skipped result-payload coverage now lives in `agent-task-pull-once-command-step-result.test.ts`; `agent-task-pull-once-command-step.test.ts` is down to 33 lines and focuses on required step failure behavior.                                                                                        |
| F359.3 | done   | Run focused CLI verification and sync docs.        | Focused task-pull Jest passed: `/tmp/codex-tool-runs/svton/f359-cli-jest-20260712-command-step-result-test.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f359-cli-type-check-20260712-command-step-result-test.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f359-cli-build-20260712-command-step-result-test.log`. |

Final F359 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f359-prettier-write-20260712-command-step-result-test.log`,
`/tmp/codex-tool-runs/svton/f359-prettier-check-final-20260712-command-step-result-test.log`),
diff check passed
(`/tmp/codex-tool-runs/svton/f359-diff-check-final-20260712-command-step-result-test.log`),
conflict marker and trailing whitespace scans passed
(`/tmp/codex-tool-runs/svton/f359-marker-scan-final-20260712-command-step-result-test.log`,
`/tmp/codex-tool-runs/svton/f359-trailing-whitespace-scan-final-20260712-command-step-result-test.log`),
and touched CLI once command-step test files remain under 200 lines
(`/tmp/codex-tool-runs/svton/f359-line-count-20260712-command-step-result-test.log`).

## F360. CLI Task-pull Loop Signal-stop Test Boundary

Purpose: continue the CLI task-pull test-boundary cleanup after F359. Current
source inspection shows `agent-task-pull-loop-stop.test.ts` mixes idle/disabled
stop behavior with signal-abort stop and interval wake-up behavior. F360 only
extracts the signal stop coverage into a focused loop signal-stop spec and keeps
runtime code unchanged.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                    |
| ------ | ------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F360.1 | done   | Map loop signal-stop coverage.              | Routing: focused CLI loop signal-stop test-boundary slice + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed `agent-task-pull-loop-stop.test.ts` mixed idle/disabled stop behavior with signal-abort stop and interval wake-up behavior.                                                  |
| F360.2 | done   | Extract loop signal-stop coverage.          | Pre-poll signal stop, next-boundary signal stop, and interval wake-up coverage now lives in `agent-task-pull-loop-signal-stop.test.ts`; `agent-task-pull-loop-stop.test.ts` is down to 53 lines and focuses on idle-limit and task-pull-disabled stops.                                                                     |
| F360.3 | done   | Run focused CLI verification and sync docs. | Focused task-pull Jest passed: `/tmp/codex-tool-runs/svton/f360-cli-jest-20260712-loop-signal-stop-test.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f360-cli-type-check-20260712-loop-signal-stop-test.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f360-cli-build-20260712-loop-signal-stop-test.log`. |

Final F360 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f360-prettier-write-20260712-loop-signal-stop-test.log`,
`/tmp/codex-tool-runs/svton/f360-prettier-check-final-20260712-loop-signal-stop-test.log`),
diff check passed
(`/tmp/codex-tool-runs/svton/f360-diff-check-final-20260712-loop-signal-stop-test.log`),
conflict marker and trailing whitespace scans passed
(`/tmp/codex-tool-runs/svton/f360-marker-scan-final-20260712-loop-signal-stop-test.log`,
`/tmp/codex-tool-runs/svton/f360-trailing-whitespace-scan-final-20260712-loop-signal-stop-test.log`),
and touched CLI loop stop test files remain under 200 lines
(`/tmp/codex-tool-runs/svton/f360-line-count-20260712-loop-signal-stop-test.log`).

## F361. CLI Task-pull Executor Cwd Test Boundary

Purpose: continue the CLI task-pull test-boundary cleanup after F360. Current
source inspection shows `agent-task-pull-executor.test.ts` mixes cwd boundary
coverage with output truncation, spawn failure, and force-kill cancellation
behavior. F361 only extracts cwd boundary coverage into a focused executor cwd
spec and keeps runtime code unchanged.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                        |
| ------ | ------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F361.1 | done   | Map executor cwd coverage.                  | Routing: focused CLI executor test-boundary slice + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed `agent-task-pull-executor.test.ts` mixes cwd boundary coverage with other executor behavior.                                                                                             |
| F361.2 | done   | Extract executor cwd coverage.              | Relative cwd execution and cwd escape coverage now lives in `agent-task-pull-executor-cwd.test.ts`; `agent-task-pull-executor.test.ts` is down to 78 lines and focuses on output truncation, spawn failure, and force-kill cancellation.                                                                                        |
| F361.3 | done   | Run focused CLI verification and sync docs. | Focused task-pull Jest passed: `/tmp/codex-tool-runs/svton/f361-cli-task-pull-jest-final-20260712-executor-cwd-test.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f361-cli-type-check-20260712-executor-cwd-test.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f361-cli-build-20260712-executor-cwd-test.log`. |

Final F361 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f361-prettier-write-final-20260712-executor-cwd-test.log`,
`/tmp/codex-tool-runs/svton/f361-prettier-check-final-20260712-executor-cwd-test.log`),
diff check passed
(`/tmp/codex-tool-runs/svton/f361-diff-check-final-20260712-executor-cwd-test.log`),
conflict marker and trailing whitespace scans passed
(`/tmp/codex-tool-runs/svton/f361-marker-scan-final-20260712-executor-cwd-test.log`,
`/tmp/codex-tool-runs/svton/f361-trailing-whitespace-scan-final-20260712-executor-cwd-test.log`),
and touched CLI executor test files remain under 200 lines
(`/tmp/codex-tool-runs/svton/f361-line-count-20260712-executor-cwd-test.log`).

## F362. CLI Task-pull Loop Config Test Boundary

Purpose: continue the CLI task-pull test-boundary cleanup after F361. Current
source inspection shows `agent-task-pull-config.test.ts` mixes once config
coverage with loop/run config bounds, heartbeat, and default runner-id behavior.
F362 only extracts loop config coverage into a focused loop config spec and
keeps runtime code unchanged.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------ | ------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F362.1 | done   | Map loop config coverage.                   | Routing: focused CLI config test-boundary slice + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed `agent-task-pull-config.test.ts` mixes once config coverage with loop/run config behavior.                                                                                                                                                                                      |
| F362.2 | done   | Extract loop config coverage.               | Loop bound, heartbeat, and default runner-id coverage now lives in `agent-task-pull-loop-config.test.ts`; `agent-task-pull-config.test.ts` is down to 55 lines and focuses on once config fallback/capability behavior.                                                                                                                                                                                              |
| F362.3 | done   | Run focused CLI verification and sync docs. | Focused config Jest passed: `/tmp/codex-tool-runs/svton/f362-cli-jest-20260712-loop-config-test.log`; task-pull Jest passed: `/tmp/codex-tool-runs/svton/f362-cli-task-pull-jest-20260712-loop-config-test.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f362-cli-type-check-20260712-loop-config-test.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f362-cli-build-20260712-loop-config-test.log`. |

Final F362 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f362-prettier-write-final-20260712-loop-config-test.log`,
`/tmp/codex-tool-runs/svton/f362-prettier-check-final-20260712-loop-config-test.log`),
diff check passed
(`/tmp/codex-tool-runs/svton/f362-diff-check-final-20260712-loop-config-test.log`),
conflict marker and trailing whitespace scans passed
(`/tmp/codex-tool-runs/svton/f362-marker-scan-final-20260712-loop-config-test.log`,
`/tmp/codex-tool-runs/svton/f362-trailing-whitespace-scan-final-20260712-loop-config-test.log`),
and touched CLI config test files remain under 200 lines
(`/tmp/codex-tool-runs/svton/f362-line-count-20260712-loop-config-test.log`).

## F363. CLI Task-pull Command Result Emission Test Boundary

Purpose: continue the CLI task-pull test-boundary cleanup after F362. Current
source inspection shows `agent-task-pull-command-result.service.test.ts` mixes
startup failure summary/runner-id helper coverage with once/loop result emission
and exit-code policy coverage. F363 only extracts emission policy coverage into
a focused command-result emission spec and keeps runtime code unchanged.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F363.1 | done   | Map command-result emission coverage.       | Routing: focused CLI command-result test-boundary slice + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed `agent-task-pull-command-result.service.test.ts` mixes summary builder/helper coverage with emission policies.                                                                                                                                                                                                                  |
| F363.2 | done   | Extract command-result emission coverage.   | Once and loop summary emission exit-code coverage now lives in `agent-task-pull-command-result-emission.service.test.ts`; `agent-task-pull-command-result.service.test.ts` is down to 66 lines and focuses on startup failure summary plus runner-id helper coverage.                                                                                                                                                                                                        |
| F363.3 | done   | Run focused CLI verification and sync docs. | Focused command-result Jest passed: `/tmp/codex-tool-runs/svton/f363-cli-jest-20260712-command-result-emission-test.log`; task-pull Jest passed: `/tmp/codex-tool-runs/svton/f363-cli-task-pull-jest-20260712-command-result-emission-test.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f363-cli-type-check-20260712-command-result-emission-test.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f363-cli-build-20260712-command-result-emission-test.log`. |

Final F363 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f363-prettier-write-final-20260712-command-result-emission-test.log`,
`/tmp/codex-tool-runs/svton/f363-prettier-check-final-20260712-command-result-emission-test.log`),
diff check passed
(`/tmp/codex-tool-runs/svton/f363-diff-check-final-20260712-command-result-emission-test.log`),
conflict marker and trailing whitespace scans passed
(`/tmp/codex-tool-runs/svton/f363-marker-scan-final-20260712-command-result-emission-test.log`,
`/tmp/codex-tool-runs/svton/f363-trailing-whitespace-scan-final-20260712-command-result-emission-test.log`),
and touched CLI command-result test files remain under 200 lines
(`/tmp/codex-tool-runs/svton/f363-line-count-20260712-command-result-emission-test.log`).

## F364. CLI Task-pull Loop Failure Test Boundary

Purpose: continue the CLI task-pull test-boundary cleanup after F363. Current
source inspection shows `agent-task-pull-loop.test.ts` mixes the core
max-iterations success loop with finish writeback failure and poll failure stop
behavior. F364 only extracts loop failure-stop coverage into a focused loop
failure spec and keeps runtime code unchanged.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------ | ------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F364.1 | done   | Map loop failure-stop coverage.             | Routing: focused CLI loop test-boundary slice + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed `agent-task-pull-loop.test.ts` mixes core max-iterations behavior with failure-stop behavior.                                                                                                                                                                                       |
| F364.2 | done   | Extract loop failure-stop coverage.         | Finish writeback failure and poll failure coverage now lives in `agent-task-pull-loop-failure.test.ts`; `agent-task-pull-loop.test.ts` is down to 48 lines and focuses on the core max-iterations success loop.                                                                                                                                                                                                        |
| F364.3 | done   | Run focused CLI verification and sync docs. | Focused loop Jest passed: `/tmp/codex-tool-runs/svton/f364-cli-jest-20260712-loop-failure-test.log`; task-pull Jest passed: `/tmp/codex-tool-runs/svton/f364-cli-task-pull-jest-20260712-loop-failure-test.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f364-cli-type-check-20260712-loop-failure-test.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f364-cli-build-20260712-loop-failure-test.log`. |

Final F364 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f364-prettier-write-final-20260712-loop-failure-test.log`,
`/tmp/codex-tool-runs/svton/f364-prettier-check-final-20260712-loop-failure-test.log`),
diff check passed
(`/tmp/codex-tool-runs/svton/f364-diff-check-final-20260712-loop-failure-test.log`),
conflict marker and trailing whitespace scans passed
(`/tmp/codex-tool-runs/svton/f364-marker-scan-final-20260712-loop-failure-test.log`,
`/tmp/codex-tool-runs/svton/f364-trailing-whitespace-scan-final-20260712-loop-failure-test.log`),
and touched CLI loop test files remain under 200 lines
(`/tmp/codex-tool-runs/svton/f364-line-count-20260712-loop-failure-test.log`).

## F365. CLI Task-pull Loop Summary Helper Boundary

Purpose: continue the CLI task-pull runtime cleanup after F364 without
mechanically splitting already-focused wrapper tests. Current source inspection
shows `agent-task-pull-loop-runner.ts` keeps loop orchestration together with
pure stop-reason, summary building, finish-writeback failure, and error-message
helpers. F365 only extracts those pure helpers into a focused loop summary utils
module and keeps runtime behavior unchanged.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------ | ------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F365.1 | done   | Map loop runner helper boundary.            | Routing: focused CLI runtime helper extraction + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed `agent-task-pull-loop-runner.ts` mixes loop orchestration with pure summary/stop helper behavior.                                                                                                                                                                                           |
| F365.2 | done   | Extract loop summary/stop helpers.          | Loop stop-reason, summary building, finish writeback failure, and error formatting helpers now live in `agent-task-pull-loop-summary.utils.ts`; `agent-task-pull-loop-runner.ts` is down to 141 lines and keeps loop orchestration.                                                                                                                                                                                             |
| F365.3 | done   | Run focused CLI verification and sync docs. | Focused loop Jest passed: `/tmp/codex-tool-runs/svton/f365-cli-loop-jest-20260712-loop-summary-utils.log`; task-pull Jest passed: `/tmp/codex-tool-runs/svton/f365-cli-task-pull-jest-20260712-loop-summary-utils.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f365-cli-type-check-20260712-loop-summary-utils.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f365-cli-build-20260712-loop-summary-utils.log`. |

Final F365 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f365-prettier-write-final-20260712-loop-summary-utils.log`,
`/tmp/codex-tool-runs/svton/f365-prettier-check-final-20260712-loop-summary-utils.log`),
diff check passed
(`/tmp/codex-tool-runs/svton/f365-diff-check-final-20260712-loop-summary-utils.log`),
conflict marker and trailing whitespace scans passed
(`/tmp/codex-tool-runs/svton/f365-marker-scan-final-20260712-loop-summary-utils.log`,
`/tmp/codex-tool-runs/svton/f365-trailing-whitespace-scan-final-20260712-loop-summary-utils.log`),
and touched CLI loop runtime files remain under 200 lines
(`/tmp/codex-tool-runs/svton/f365-line-count-20260712-loop-summary-utils.log`).

## F366. CLI Task-pull Executor Result Builder Boundary

Purpose: continue the CLI task-pull runtime cleanup after F365. Current source
inspection shows `agent-task-pull-executor.ts` is close to the source file
ceiling and mixes command spawn/timeout/cancel orchestration with pure step
result construction helpers. F366 only moves step result types/builders to the
existing result/type utilities so the executor keeps runtime orchestration and
behavior unchanged.

| Task   | Status | Description                                       | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------ | ------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F366.1 | done   | Map executor result-builder boundary.             | Routing: focused CLI runtime helper extraction + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed `agent-task-pull-executor.ts` mixed spawn orchestration with pure step result builders, while result/type utils are the focused owners.                                                                                                                                                                                     |
| F366.2 | done   | Move step result types/builders to focused utils. | `AgentTaskPullStepResult` and `AgentTaskPullExecutor` now live in `agent-task-pull-types.ts`; spawn/cwd/cancel result builders now live in `agent-task-pull-result.utils.ts`; `agent-task-pull-executor.ts` is down to 131 lines and keeps spawn/timeout/cancel orchestration.                                                                                                                                                                                  |
| F366.3 | done   | Run focused CLI verification and sync docs.       | Focused executor Jest passed: `/tmp/codex-tool-runs/svton/f366-cli-executor-jest-20260712-executor-result-builders.log`; task-pull Jest passed: `/tmp/codex-tool-runs/svton/f366-cli-task-pull-jest-20260712-executor-result-builders.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f366-cli-type-check-20260712-executor-result-builders.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f366-cli-build-20260712-executor-result-builders.log`. |

Final F366 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f366-prettier-write-final-20260712-executor-result-builders.log`,
`/tmp/codex-tool-runs/svton/f366-prettier-check-final-20260712-executor-result-builders.log`),
diff check passed
(`/tmp/codex-tool-runs/svton/f366-diff-check-final-20260712-executor-result-builders.log`),
conflict marker and trailing whitespace scans passed
(`/tmp/codex-tool-runs/svton/f366-marker-scan-final-20260712-executor-result-builders.log`,
`/tmp/codex-tool-runs/svton/f366-trailing-whitespace-scan-final-20260712-executor-result-builders.log`),
and touched CLI task-pull runtime files remain under 200 lines
(`/tmp/codex-tool-runs/svton/f366-line-count-final-20260712-executor-result-builders.log`).

## F367. CLI Task-pull Heartbeat Config Boundary

Purpose: continue the CLI task-pull config cleanup after F366. Current source
inspection shows `agent-task-pull-config.ts` is the largest remaining CLI
task-pull runtime file and mixes once config, loop bounds, heartbeat config,
heartbeat status/TTL validation, and default loop runner id construction. F367
only moves the loop-only heartbeat config/default-runner helpers into a focused
command config service while keeping once/loop config behavior unchanged.

| Task   | Status | Description                                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------ | ------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F367.1 | done   | Map heartbeat config boundary.                | Routing: focused CLI command config extraction + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed `agent-task-pull-config.ts` mixed once/loop config with loop-only heartbeat/default-runner helpers.                                                                                                                                                                                     |
| F367.2 | done   | Extract loop heartbeat/default-runner config. | `buildAgentTaskPullHeartbeatConfig()` and `buildDefaultAgentTaskPullLoopRunnerId()` now live in `agent-task-pull-heartbeat-config.service.ts`; `agent-task-pull-config.ts` is down to 124 lines and keeps once/loop config assembly.                                                                                                                                                                                        |
| F367.3 | done   | Run focused CLI verification and sync docs.   | Focused config Jest passed: `/tmp/codex-tool-runs/svton/f367-cli-config-jest-20260712-heartbeat-config.log`; task-pull Jest passed: `/tmp/codex-tool-runs/svton/f367-cli-task-pull-jest-20260712-heartbeat-config.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f367-cli-type-check-20260712-heartbeat-config.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f367-cli-build-20260712-heartbeat-config.log`. |

Final F367 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f367-prettier-write-final-20260712-heartbeat-config.log`,
`/tmp/codex-tool-runs/svton/f367-prettier-check-final-20260712-heartbeat-config.log`),
diff check passed
(`/tmp/codex-tool-runs/svton/f367-diff-check-final-20260712-heartbeat-config.log`),
conflict marker and trailing whitespace scans passed
(`/tmp/codex-tool-runs/svton/f367-marker-scan-final-20260712-heartbeat-config.log`,
`/tmp/codex-tool-runs/svton/f367-trailing-whitespace-scan-final-20260712-heartbeat-config.log`),
and touched CLI task-pull config files remain under 200 lines
(`/tmp/codex-tool-runs/svton/f367-line-count-final-20260712-heartbeat-config.log`).

## F368. CLI Task-pull Once Task Execution Service Boundary

Purpose: continue the CLI task-pull runtime cleanup after F367. Current source
inspection shows `agent-task-pull-runner.ts` still mixes public once-run
contract/claim/finish orchestration with per-task command execution: dry-run
ack, per-step progress ack, ack renewal cancellation, executor invocation, and
required-step failure classification. F368 only moves that claimed-task execution
flow into a focused service while keeping once-run behavior unchanged.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------ | ------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F368.1 | done   | Map once task execution boundary.           | Routing: focused CLI runtime service extraction + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed `agent-task-pull-runner.ts` mixed public once-run contract/claim/finish orchestration with per-task command execution.                                                                                                                                                                                     |
| F368.2 | done   | Extract claimed-task execution service.     | Claimed-task dry-run ack, per-step progress ack, ack renewal cancellation, executor invocation, and required-step failure classification now live in `agent-task-pull-task-execution.service.ts`; `agent-task-pull-runner.ts` is down to 51 lines and keeps once-run entry orchestration.                                                                                                                                                       |
| F368.3 | done   | Run focused CLI verification and sync docs. | Focused once Jest passed: `/tmp/codex-tool-runs/svton/f368-cli-once-jest-20260712-task-execution-service.log`; task-pull Jest passed: `/tmp/codex-tool-runs/svton/f368-cli-task-pull-jest-20260712-task-execution-service.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/f368-cli-type-check-20260712-task-execution-service.log`; CLI build passed: `/tmp/codex-tool-runs/svton/f368-cli-build-20260712-task-execution-service.log`. |

Final F368 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f368-prettier-write-final-20260712-task-execution-service.log`,
`/tmp/codex-tool-runs/svton/f368-prettier-check-final-20260712-task-execution-service.log`),
diff check passed
(`/tmp/codex-tool-runs/svton/f368-diff-check-final-20260712-task-execution-service.log`),
conflict marker and trailing whitespace scans passed
(`/tmp/codex-tool-runs/svton/f368-marker-scan-final-20260712-task-execution-service.log`,
`/tmp/codex-tool-runs/svton/f368-trailing-whitespace-scan-final-20260712-task-execution-service.log`),
and touched CLI task-pull runtime files remain under 200 lines
(`/tmp/codex-tool-runs/svton/f368-line-count-final-20260712-task-execution-service.log`).

## F369. Server-agent Task-pull Finish Result Helper Boundary

Purpose: continue P8 task-pull closure after the CLI runtime cleanup. Current
source inspection shows `server-agent-task-pull-finish.service.ts` is near the
source file ceiling and mixes endpoint orchestration with pure terminal finish
data, command-plan fallback, response metadata, no-finish result, and terminal
status validation helpers. F369 only extracts those pure helpers into a focused
finish result utils module while keeping claim/ack/finish-sync behavior
unchanged.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                  |
| ------ | ------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F369.1 | done   | Map finish result helper boundary.          | Routing: focused API task-pull finish helper extraction + noisy-tools verification; CodeGraph is uninitialized, so manual graphing confirmed `server-agent-task-pull-finish.service.ts` mixed endpoint orchestration with pure terminal finish result helpers.                                                            |
| F369.2 | done   | Extract terminal finish result helpers.     | Terminal status validation, finish data, command-plan fallback, finish metadata, no-finish response, and endpoint constant now live in `server-agent-task-pull-finish-result.utils.ts`; `server-agent-task-pull-finish.service.ts` is down to 130 lines and keeps auth/read/update/sync orchestration.                    |
| F369.3 | done   | Run focused API verification and sync docs. | Focused finish Jest passed: `/tmp/codex-tool-runs/svton/f369-api-finish-jest-20260712-finish-result-utils.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f369-api-type-check-20260712-finish-result-utils.log`; API build passed: `/tmp/codex-tool-runs/svton/f369-api-build-20260712-finish-result-utils.log`. |

Final F369 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f369-prettier-write-final-20260712-finish-result-utils.log`,
`/tmp/codex-tool-runs/svton/f369-prettier-check-final-20260712-finish-result-utils.log`),
diff check passed
(`/tmp/codex-tool-runs/svton/f369-diff-check-final-20260712-finish-result-utils.log`),
conflict marker and trailing whitespace scans passed
(`/tmp/codex-tool-runs/svton/f369-marker-scan-final-20260712-finish-result-utils.log`,
`/tmp/codex-tool-runs/svton/f369-trailing-whitespace-scan-final-20260712-finish-result-utils.log`),
and touched API task-pull finish files remain under 200 lines
(`/tmp/codex-tool-runs/svton/f369-line-count-final-20260712-finish-result-utils.log`).

## F370. Server-agent Task-pull Finish-sync Result Helper Boundary

Purpose: continue P8 task-pull terminal writeback closure after F369. Current
source inspection shows `server-agent-task-pull-finish-sync.service.ts` is near
the source file ceiling and mixes linked-run sync orchestration with pure
metadata reading, sync type classification, terminal input rehydration, and
execution result building helpers. F370 only extracts those pure helpers into a
focused finish-sync result utils module while keeping log collection and
non-log business-run sync behavior unchanged.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F370.1 | done   | Map finish-sync result helper boundary.     | Routing: focused API task-pull finish-sync helper extraction + noisy-tools verification; CodeGraph is uninitialized, so manual graphing is limited to `server-agent-task-pull-finish-sync.service.ts` and its focused spec.                                                                                                                               |
| F370.2 | done   | Extract finish-sync input/result helpers.   | Finish-sync metadata, business-run sync type, log collection run id, terminal input rehydration, execution result building, and log collection sync result helpers now live in `server-agent-task-pull-finish-sync-result.utils.ts`; `server-agent-task-pull-finish-sync.service.ts` is down to 142 lines and keeps linked-run sync orchestration.        |
| F370.3 | done   | Run focused API verification and sync docs. | Focused finish-sync/finish Jest passed: `/tmp/codex-tool-runs/svton/f370-api-finish-sync-jest-20260712-finish-sync-result-utils.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f370-api-type-check-20260712-finish-sync-result-utils.log`; API build passed: `/tmp/codex-tool-runs/svton/f370-api-build-20260712-finish-sync-result-utils.log`. |

Final F370 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f370-prettier-write-final-20260712-finish-sync-result-utils.log`,
`/tmp/codex-tool-runs/svton/f370-prettier-check-final-20260712-finish-sync-result-utils.log`),
diff check passed
(`/tmp/codex-tool-runs/svton/f370-diff-check-final-20260712-finish-sync-result-utils.log`),
conflict marker and trailing whitespace scans passed
(`/tmp/codex-tool-runs/svton/f370-marker-scan-final-20260712-finish-sync-result-utils.log`,
`/tmp/codex-tool-runs/svton/f370-trailing-whitespace-scan-final-20260712-finish-sync-result-utils.log`),
and touched API task-pull finish-sync files remain under 200 lines
(`/tmp/codex-tool-runs/svton/f370-line-count-final-20260712-finish-sync-result-utils.log`).

## F371. Server-agent Task-pull Ack Result Helper Boundary

Purpose: continue P8 task-pull lifecycle closure after F370. Current source
inspection shows `server-agent-task-pull-ack.service.ts` is below but near the
source file ceiling and still mixes ack writeback orchestration with pure
no-ack response, ack metadata, and cancellation hint response helpers. F371 only
extracts those pure ack result helpers into a focused ack result utils module
while keeping lock renewal, progress writeback, and cancellation behavior
unchanged.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F371.1 | done   | Map ack result helper boundary.             | Routing: focused API task-pull ack helper extraction + noisy-tools verification; CodeGraph is uninitialized, so manual graphing is limited to `server-agent-task-pull-ack.service.ts`.                                                                                                                                     |
| F371.2 | done   | Extract ack response helpers.               | No-ack response, ack endpoint, ack metadata, and cancellation hint helpers now live in `server-agent-task-pull-ack-result.utils.ts`; `server-agent-task-pull-ack.service.ts` is down to 141 lines and keeps auth, lock renewal, job read, and progress writeback orchestration.                                            |
| F371.3 | done   | Run focused API verification and sync docs. | Focused ack/claim/task-pull Jest passed: `/tmp/codex-tool-runs/svton/f371-api-ack-jest-20260712-ack-result-utils.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f371-api-type-check-20260712-ack-result-utils.log`; API build passed: `/tmp/codex-tool-runs/svton/f371-api-build-20260712-ack-result-utils.log`. |

Final F371 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f371-prettier-write-final-20260712-ack-result-utils.log`,
`/tmp/codex-tool-runs/svton/f371-prettier-check-final-20260712-ack-result-utils.log`),
diff check passed
(`/tmp/codex-tool-runs/svton/f371-diff-check-final-20260712-ack-result-utils.log`),
conflict marker and trailing whitespace scans passed
(`/tmp/codex-tool-runs/svton/f371-marker-scan-final-20260712-ack-result-utils.log`,
`/tmp/codex-tool-runs/svton/f371-trailing-whitespace-scan-final-20260712-ack-result-utils.log`),
and touched API task-pull ack files remain under 200 lines
(`/tmp/codex-tool-runs/svton/f371-line-count-final-20260712-ack-result-utils.log`).

## F372. Supervisor Agent Task-pull Gate Helper Boundary

Purpose: continue P8 task-pull execution governance closure after F371. Current
source inspection shows
`server-executor-supervisor-agent-task-pull-builder.utils.ts` is near the source
file ceiling and mixes the top-level readiness result assembly with pure
runtime, queue, pull-contract, and audit gate builders. F372 only extracts those
pure gate builders into a focused supervisor task-pull gates utils module while
keeping readiness state, blockers, next steps, and supervisor summary behavior
unchanged.

| Task   | Status | Description                                    | Evidence                                                                                                                                                                                                                                                                                                                                               |
| ------ | ------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F372.1 | done   | Map supervisor task-pull gate helper boundary. | Routing: focused API supervisor task-pull gate helper extraction + noisy-tools verification; CodeGraph is uninitialized, so manual graphing is limited to `server-executor-supervisor-agent-task-pull-builder.utils.ts` and the supervisor summary path.                                                                                               |
| F372.2 | done   | Extract supervisor task-pull gate builders.    | Runtime, queue, pull-contract, and audit gate builders now live in `server-executor-supervisor-agent-task-pull-gates.utils.ts`; `server-executor-supervisor-agent-task-pull-builder.utils.ts` is down to 93 lines and keeps readiness result assembly.                                                                                                 |
| F372.3 | done   | Run focused API verification and sync docs.    | Focused supervisor Jest passed: `/tmp/codex-tool-runs/svton/f372-api-supervisor-jest-20260712-supervisor-task-pull-gates.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f372-api-type-check-20260712-supervisor-task-pull-gates.log`; API build passed: `/tmp/codex-tool-runs/svton/f372-api-build-20260712-supervisor-task-pull-gates.log`. |

Final F372 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f372-prettier-write-final-20260712-supervisor-task-pull-gates.log`,
`/tmp/codex-tool-runs/svton/f372-prettier-check-final-20260712-supervisor-task-pull-gates.log`),
diff check passed
(`/tmp/codex-tool-runs/svton/f372-diff-check-final-20260712-supervisor-task-pull-gates.log`),
conflict marker and trailing whitespace scans passed
(`/tmp/codex-tool-runs/svton/f372-marker-scan-final-20260712-supervisor-task-pull-gates.log`,
`/tmp/codex-tool-runs/svton/f372-trailing-whitespace-scan-final-20260712-supervisor-task-pull-gates.log`),
and touched API supervisor task-pull files remain under 200 lines
(`/tmp/codex-tool-runs/svton/f372-line-count-final-20260712-supervisor-task-pull-gates.log`).

## F373. Server-agent Task-pull Claimed Payload Detail Boundary

Purpose: continue P8 task-pull lifecycle closure after F372. Current source
inspection shows `server-agent-task-pull-task-payload.utils.ts` is near the
source file ceiling and mixes claimed-task payload assembly with pure target,
command step, lifecycle envelope, correlation, and metadata whitelist builders.
F373 only extracts those pure payload detail builders into a focused claimed
payload details utils module while keeping claim and terminal-plan behavior
unchanged.

| Task   | Status | Description                                 | Evidence                                                                                                                                                                                                                                                                                                                                             |
| ------ | ------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F373.1 | done   | Map claimed payload detail helper boundary. | Routing: focused API task-pull payload helper extraction + noisy-tools verification; CodeGraph is uninitialized, so manual graphing is limited to `server-agent-task-pull-task-payload.utils.ts` plus its claim and terminal-plan callers.                                                                                                           |
| F373.2 | done   | Extract claimed payload detail builders.    | Redacted target, command-step payload, lifecycle envelope, correlation, and safe metadata builders now live in `server-agent-task-pull-claimed-payload-details.utils.ts`; `server-agent-task-pull-task-payload.utils.ts` is down to 70 lines and keeps claimed payload assembly.                                                                     |
| F373.3 | done   | Run focused API verification and sync docs. | Focused payload/claim/finish Jest passed: `/tmp/codex-tool-runs/svton/f373-api-payload-jest-20260712-claimed-payload-details.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f373-api-type-check-20260712-claimed-payload-details.log`; API build passed: `/tmp/codex-tool-runs/svton/f373-api-build-20260712-claimed-payload-details.log`. |

Final F373 hygiene evidence: Prettier write/check passed
(`/tmp/codex-tool-runs/svton/f373-prettier-write-final-20260712-claimed-payload-details.log`,
`/tmp/codex-tool-runs/svton/f373-prettier-check-final-20260712-claimed-payload-details.log`),
diff check passed
(`/tmp/codex-tool-runs/svton/f373-diff-check-final-20260712-claimed-payload-details.log`),
conflict marker and trailing whitespace scans passed
(`/tmp/codex-tool-runs/svton/f373-marker-scan-final-20260712-claimed-payload-details.log`,
`/tmp/codex-tool-runs/svton/f373-trailing-whitespace-scan-final-20260712-claimed-payload-details.log`),
and touched API claimed payload files remain under 200 lines
(`/tmp/codex-tool-runs/svton/f373-line-count-final-20260712-claimed-payload-details.log`).

## F374. Server-agent Task-pull Ack/Finish Auth Regression Coverage

Purpose: close the current P8 task-pull safety review after F373 by adding
focused regression coverage for the default-off and token-gated ack/finish
lifecycle endpoints. This slice only hardens specs: it does not change endpoint
paths, DTO shapes, auth token fallback behavior, Prisma schema, task-pull
response shapes, CLI runtime behavior, long connections, or multi-instance
coordination.

| Task   | Status | Description                                  | Evidence                                                                                                                                                                                                                                                                                                |
| ------ | ------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F374.1 | done   | Map ack/finish auth-gate regression gap.     | Multi-agent board ARCH/API/CLI review accepted the API/CLI/docs boundary and identified finish/ack metadata plus default-off gate preservation as the review focus; `ServerAgentTaskPullAckService` and `ServerAgentTaskPullFinishService` already assert task-pull auth first.                         |
| F374.2 | done   | Add focused default-off/token-gate specs.    | `server-agent-task-pull-ack.service.spec.ts` now proves disabled and invalid-token ack requests reject before `serverExecutionJob` mutation/read; `server-agent-task-pull-finish.service.spec.ts` proves disabled and invalid-token finish requests reject before job mutation/read or linked-run sync. |
| F374.3 | done   | Run focused API/CLI verification and review. | Focused ack/finish Jest passed: `/tmp/codex-tool-runs/svton/api-001-ack-finish-auth-jest.log`; API type-check passed: `/tmp/codex-tool-runs/svton/api-001-api-type-check.log`; CLI task-pull Jest/type-check/build also passed for the parallel helper split evidence.                                  |

Final F374 hygiene evidence: Prettier checks passed for touched API specs and
board JSON
(`/tmp/codex-tool-runs/svton/api-001-prettier-check2.log`,
`/tmp/codex-tool-runs/svton/api-001-board-prettier-check.log`), diff check and
conflict-marker scan passed
(`/tmp/codex-tool-runs/svton/api-001-diff-check.log`,
`/tmp/codex-tool-runs/svton/api-001-conflict-scan.log`), board JSON/JSONL
checks passed
(`/tmp/codex-tool-runs/svton/api-001-board-json-check.log`,
`/tmp/codex-tool-runs/svton/api-001-events-jsonl-check.log`), and production
ack/finish services remain under 200 lines
(`/tmp/codex-tool-runs/svton/api-001-line-count.log`).

S002 merge-readiness evidence: the current S001 task-pull diff was rechecked as
a package without adding product behavior. Focused API task-pull Jest, API
type-check/build, focused CLI task-pull Jest, CLI type-check/build, Prettier,
diff check, conflict scan, S002-scoped trailing-whitespace scan, board
JSON/JSONL checks, and production line-count checks passed; logs are recorded
in `.agent-board/verification/S002-verification.json`. The scoped review in
`.agent-board/reviews/S002-review.json` found no lifecycle/default-off/API-CLI
contract findings. Remaining product/runtime gaps stay queued for S003+.

## F375. CLI Task-pull Run Runtime Profile Summary

Purpose: close the smallest real-agent runtime operability gap after S003 by
making the existing foreground `svton agent task-pull run` profile visible in
the structured loop summary. F375 does not implement background daemonization,
systemd/launchd supervision, server API changes, multi-instance scheduling, or
terminal execution semantics; it records non-sensitive runtime profile metadata
so external supervisors and operators can verify runner identity, heartbeat
configuration, pid-file use, loop bounds, ack renewal cadence, and force-kill
grace settings from the command output.

| Task   | Status | Description                                  | Evidence                                                                                                                                                                                                                                                                                       |
| ------ | ------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F375.1 | done   | Map foreground runtime operability boundary. | S003 gap map identified real-agent long-running runtime/operability as the next implementable slice after existing bounded/forever polling, heartbeat, runner id, pid-file, and startup summary surfaces.                                                                                      |
| F375.2 | done   | Add non-sensitive `runtimeProfile` summary.  | `agent task-pull run` summaries now include `runtimeProfile` with process id, runner id, pid-file configured/path, heartbeat configured/status/ttl, loop bounds, ack renewal interval, and force-kill grace. Startup failure summaries include the same profile when config can be built.      |
| F375.3 | done   | Run focused CLI verification and review.     | Focused CLI command/loop/pid-file Jest passed: `/tmp/codex-tool-runs/svton/s004-cli-jest-20260712-213211.log`; CLI type-check passed: `/tmp/codex-tool-runs/svton/s004-cli-type-check-20260712-213211.log`; CLI build passed: `/tmp/codex-tool-runs/svton/s004-cli-build-20260712-213211.log`. |

Final F375 review evidence: runtime profile output is non-sensitive and does
not include task-pull or heartbeat tokens; API contract, default-off gates,
claim/ack/finish payloads, command execution, heartbeat writeback, pid-file
ownership, and loop failure exit policy are unchanged. Background process
manager integration remains outside repo-owned S004 scope and is tracked as a
deployment/operator integration risk rather than silently claimed complete.

## F376. CLI Task-pull Terminal Runtime Proof

Purpose: close the S005 terminal runtime verification-first gap from S003 by
executing the existing `svton agent task-pull once --execute` runtime path
through a local command-step scenario. F376 does not add production behavior:
the runtime-proof test uses the real CLI executor with a fake task-pull server
client to prove contract/claim, local terminal command execution, ack progress,
final ack, and finish payload writeback stay aligned with the API claim/ack/
finish surfaces.

| Task   | Status | Description                                           | Evidence                                                                                                                                                                                                                                                                                                                                                                |
| ------ | ------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F376.1 | done   | Map terminal runtime E2E boundary.                    | S003 gap map identified `GAP-TERMINAL-RUNTIME-E2E` and required a local API/CLI terminal task-pull runtime scenario before claiming deliverability. CodeGraph is uninitialized, so manual graphing confirmed `runAgentTaskPullOnce()` flows contract -> claim -> execute command steps -> ack/progress -> finish payload.                                               |
| F376.2 | done   | Add local terminal runtime proof.                     | `agent-task-pull-once-command-step.test.ts` now executes a claimed command step with the real executor in a temporary cwd, verifies the command wrote local output, records step/final ack progress, and asserts the finish payload contains command plan, terminal logs, and result step details. No production source code changed for S005 because the proof passed. |
| F376.3 | done   | Run focused CLI/API verification and review evidence. | Runtime-proof Jest passed: `/tmp/codex-tool-runs/svton/s005-cli-runtime-proof-jest-20260712-214259.log`; focused CLI once/executor/finish Jest passed: `/tmp/codex-tool-runs/svton/s005-cli-focused-jest-20260712-214329.log`; focused API payload/ack/finish Jest passed: `/tmp/codex-tool-runs/svton/s005-api-focused-jest-rerun-20260712-214345.log`.                |

Final F376 review evidence: the terminal runtime proof exercises existing
default-off surfaces only through injected test clients; no API endpoint, DTO,
token, schema, scheduler, daemon, web UI, or multi-instance behavior changed.
CLI type-check passed:
`/tmp/codex-tool-runs/svton/s005-cli-type-check-20260712-214359.log`; CLI
build passed: `/tmp/codex-tool-runs/svton/s005-cli-build-20260712-214359.log`.

## F377. Devpilot Deliverability Gate S006

Purpose: run the first broad deliverability gate after S002-S005. F377 uses
build/type-check prerequisites plus focused runtime/product checks from the
actual task-pull API and CLI surfaces; it must not claim deliverability from
builds alone.

| Task   | Status | Description                                       | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------ | ------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F377.1 | done   | Run API/CLI/Web build and type-check gates.       | API type-check/build passed: `/tmp/codex-tool-runs/svton/s006-api-type-check-20260712-214906.log`, `/tmp/codex-tool-runs/svton/s006-api-build-20260712-214906.log`; CLI type-check/build passed: `/tmp/codex-tool-runs/svton/s006-cli-type-check-20260712-214906.log`, `/tmp/codex-tool-runs/svton/s006-cli-build-20260712-214929.log`; Web build/type-check passed: `/tmp/codex-tool-runs/svton/s006-web-build-20260712-214930.log`, `/tmp/codex-tool-runs/svton/s006-web-type-check-20260712-214952.log`. |
| F377.2 | done   | Run task-pull runtime and permission gates.       | Focused API task-pull gate Jest passed: `/tmp/codex-tool-runs/svton/s006-api-task-pull-gate-jest-20260712-215016.log`; CLI task-pull gate Jest passed: `/tmp/codex-tool-runs/svton/s006-cli-task-pull-gate-jest-20260712-215029.log`; server-executor service Jest passed: `/tmp/codex-tool-runs/svton/s006-api-server-executor-service-jest-20260712-215042.log`.                                                                                                                                          |
| F377.3 | done   | Decide deliverability from current backlog audit. | S006 result is not deliverable yet: `.agent-board/results/S006-result.json` records that S003 source-backed `GAP-MULTI-INSTANCE-COORDINATION` and `GAP-REMOTE-ORPHAN-PRODUCTION-GOVERNANCE` remain implementable repo backlog. S007 and S008 are queued instead of silently treating them as residual risk.                                                                                                                                                                                                 |

Final F377 review evidence: all executed S006 gates passed, but Devpilot is not
yet deliverable because current identifiable repo-owned backlog is not empty.
Next slices are S007 multi-instance coordination and S008 production
remote-orphan governance.

## F378. Task-pull Multi-instance Coordination Proof

Purpose: close S007 by proving the existing task-pull multi-instance
coordination semantics instead of inventing new scheduling behavior: queued
claims use priority then queued time, queued-job races return no claim when
another runner wins, lock owners distinguish runner ids with server-id fallback,
and supervisor queue coordination exposes ready/degraded multi-owner signals.

| Task   | Status | Description                                      | Evidence                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F378.1 | done   | Map claim, lock-owner, and supervisor semantics. | Manual graph confirmed `ServerAgentTaskPullClaimService` delegates claim ordering/race protection to `ServerAgentTaskPullQueryService`, lock ownership to `buildServerAgentTaskPullLockOwner()`, and operator-visible multi-owner readiness to `ServerExecutorSupervisorQueueCoordinationSummaryService`.                                                                                 |
| F378.2 | done   | Add focused multi-instance coordination proofs.  | Added `server-agent-task-pull-query.service.spec.ts`, `server-agent-task-pull-lock.utils.spec.ts`, and `server-executor-supervisor-queue-coordination-summary.service.spec.ts` to prove priority/queuedAt fairness, lost-race no-claim behavior, runner-specific lock owners, fallback owner ids, and ready/degraded supervisor signals.                                                  |
| F378.3 | done   | Run focused API verification.                    | Claim/lock Jest passed: `/tmp/codex-tool-runs/svton/s007-api-claim-lock-jest-20260712-220341.log`; queue coordination Jest passed: `/tmp/codex-tool-runs/svton/s007-api-queue-coordination-jest-20260712-220423.log`; API type-check/build passed: `/tmp/codex-tool-runs/svton/s007-api-type-check-20260712-220435.log`, `/tmp/codex-tool-runs/svton/s007-api-build-20260712-220435.log`. |

Final F378 review evidence: S007 did not require production behavior changes;
the repo-owned multi-instance coordination gap is closed by focused regression
coverage over existing claim ordering, lock ownership, race handling, and
supervisor-visible coordination state.

## F379. Production Remote-orphan Governance Proof

Purpose: close S008 by proving production remote-orphan governance signals over
the existing stale remote cleanup and supervisor surfaces. F379 does not change
provider adapter behavior, schemas, Web UI, or stale recovery orchestration; it
adds focused tests for critical cleanup-disabled blockers, cleanup failure
visibility, scan truncation, and existing stale remote cleanup persistence.

| Task   | Status | Description                                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F379.1 | done   | Map remote-orphan governance boundary.       | Manual graph confirmed `ServerExecutorSupervisorRemoteOrphanSummaryService` builds remote-session/cleanup/owner/recovery gates, `collectRemoteOrphanBlockers()` emits operator next steps, and `ServerExecutorStaleRemoteCleanupService` remains the default-off cleanup executor called by stale running job recovery.                                                                                                                    |
| F379.2 | done   | Add focused production governance proof.     | Added `server-executor-supervisor-remote-orphan-summary.service.spec.ts` to prove recoverable remote sessions with cleanup disabled become critical blockers, cleanup failures are operator-visible, and truncated stale-job scans/tight recovery batches are surfaced as degraded governance risks.                                                                                                                                       |
| F379.3 | done   | Run focused API verification and type/build. | Remote-orphan summary Jest passed: `/tmp/codex-tool-runs/svton/s008-api-remote-orphan-summary-jest-20260712-220923.log`; server-executor remote cleanup coverage passed: `/tmp/codex-tool-runs/svton/s008-api-server-executor-remote-orphan-jest-20260712-220923.log`; API type-check/build passed: `/tmp/codex-tool-runs/svton/s008-api-type-check-20260712-220937.log`, `/tmp/codex-tool-runs/svton/s008-api-build-20260712-220937.log`. |

Final F379 review evidence: S008 did not require production behavior changes;
the repo-owned production remote-orphan governance gap is closed by focused
regression coverage over existing summary/blocker and stale cleanup surfaces.

## F380. Post-S008 Final Deliverability Gate

Purpose: rerun the final release-readiness gate after S007/S008 closed the
remaining source-backed backlog. F380 supersedes the earlier S006
not-deliverable judgment, because S006 intentionally queued S007/S008 instead
of hiding repo-owned backlog as residual risk.

| Task   | Status | Description                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F380.1 | done   | Run final API/CLI runtime/product gates. | API final gate Jest passed: `/tmp/codex-tool-runs/svton/s009-api-final-gate-jest-20260712-221344.log`; CLI task-pull gate Jest passed: `/tmp/codex-tool-runs/svton/s009-cli-task-pull-gate-jest-20260712-221344.log`.                                                                                                                                                                                                                                                                                                                     |
| F380.2 | done   | Confirm build/type-check prerequisites.  | API type-check/build passed after S008 API spec additions: `/tmp/codex-tool-runs/svton/s008-api-type-check-20260712-220937.log`, `/tmp/codex-tool-runs/svton/s008-api-build-20260712-220937.log`; CLI type-check/build passed: `/tmp/codex-tool-runs/svton/s006-cli-type-check-20260712-214906.log`, `/tmp/codex-tool-runs/svton/s006-cli-build-20260712-214929.log`; Web build/type-check passed: `/tmp/codex-tool-runs/svton/s006-web-build-20260712-214930.log`, `/tmp/codex-tool-runs/svton/s006-web-type-check-20260712-214952.log`. |
| F380.3 | done   | Record final deliverability judgment.    | `.agent-board/results/S009-result.json` gives the direct judgment: deliverable. Remaining risks are deployment/operator process-manager integration for foreground agents and the absence of a live production deployment exercise in this automated gate.                                                                                                                                                                                                                                                                                |

Final F380 review evidence: current identifiable source-backed Devpilot backlog
is closed, all executed gates passed, and Devpilot is deliverable with the
documented residual deployment/operator risks.

## Maps To Maintain

- Business logic map: execution-governance reads jobs, leases, and supervisor
  snapshots from existing APIs, then renders queue worker status, agent
  readiness, worker owners, queue coordination, remote orphan governance, and
  execution audit visibility.
- Organization map: `use-execution-governance.ts` loads
  `ServerExecutionSupervisorSnapshot`; `supervisor.ts` should remain the public
  top-level type entry; focused `.types.ts` files own nested worker, remote,
  audit, and agent snapshot shapes; focused supervisor panel components own
  read-only presentation sections and pure format utils own label/status
  mappings.
- Functional map: observe worker config, queue pressure, leases, worker owners,
  agent runtime/fleet/readiness, task-pull readiness, remote orphan risk, audit
  samples, and recent execution governance events.
- Data-flow map: API snapshot -> `useExecutionGovernance()` state ->
  thin `SupervisorPanel` composition entry -> focused read-only governance
  cards and section components.
- Page-structure map: `/execution-governance` page -> content shell -> summary
  cards/job list/lease list/supervisor panel -> worker, agent, owners, remote,
  and audit sections.
