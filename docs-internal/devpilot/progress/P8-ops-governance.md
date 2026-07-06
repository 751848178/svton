# P8. Security and Operations Governance Progress

## Goal

P8 covers Devpilot's control-plane governance for approvals, access policies,
audits, Server executor job/lease/queue lifecycle, execution supervisor
visibility, server-agent readiness, and safe operations handoff.

## Current Status

- Roadmap status: approval gating, command policies, live execution leases,
  execution jobs, queue/retry/cancel/stale recovery, remote cleanup metadata,
  audit visibility, server-agent dispatcher boundary, runtime health, and
  task-pull readiness skeleton are present in the current control plane.
- Remaining product/runtime gaps from source docs: real agent long connection,
  task claim/ack, lifecycle execution, complete multi-instance coordination,
  broader e2e permission coverage, and deeper production remote-orphan
  governance remain follow-ups.
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

| Task   | Status      | Description                                      | Evidence                                                                                                                                                                                                                                               |
| ------ | ----------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F239.1 | done        | Build a source-backed map of facade wiring.      | CodeGraph CLI is present but uninitialized; manual graph confirmed the remaining constructor collaborators are assembled in `server-executor.service.ts` and consumed only by public facade delegates, queue callbacks, and supervisor snapshot reads. |
| F239.2 | done        | Extract focused facade wiring factory.           | `server-executor-wiring-factory.service.ts` now owns facade collaborator assembly by composing linked business sync, audit, execution core, queue governance, agent runtime endpoint, target resolution, read query, and supervisor host services. `server-executor-submission.service.ts` owns execute/queue/cancel submission delegates, and `server-executor.service.ts` is a 196-line public facade. |
| F239.3 | done        | Run focused API verification and hygiene checks. | Focused server-executor Jest passed: `/tmp/codex-tool-runs/svton/f239-server-executor-jest-20260705-023558.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f239-api-type-check-20260705-023558.log`; API build passed: `/tmp/codex-tool-runs/svton/f239-api-build-20260705-023558.log`; line-count, diff check, conflict-marker scan, and trailing-whitespace scan passed: `/tmp/codex-tool-runs/svton/f239-line-count-final-20260705-023647.log`, `/tmp/codex-tool-runs/svton/f239-diff-check-20260705-023638.log`, `/tmp/codex-tool-runs/svton/f239-conflict-scan-20260705-023638.log`, `/tmp/codex-tool-runs/svton/f239-trailing-whitespace-scan-20260705-023638.log`. |

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

| Task   | Status      | Description                                      | Evidence |
| ------ | ----------- | ------------------------------------------------ | -------- |
| F240.1 | done        | Build a source-backed map of DB queue duties.    | CodeGraph CLI is present but uninitialized; manual graph confirmed `DbJobQueue` is bound in `ServerExecutorQueueModule` as `JOB_QUEUE_PORT`, its callers go through `JobQueuePort`, and the file mixes queued job persistence, lease persistence, config reads, and unique-constraint handling. |
| F240.2 | done        | Extract focused DB queue repository boundaries.  | `DbJobQueue` remains the Nest provider and `JobQueuePort` facade. Queued job claim/heartbeat/completion/recovery persistence now lives in `db-queued-job.repository.ts`; live lease acquire/release/expire persistence and unique-constraint handling now live in `db-live-lease.repository.ts`. `db-job-queue.ts` is 67 lines, queued repository is 156 lines, and live-lease repository is 90 lines. |
| F240.3 | done        | Run focused API verification and hygiene checks. | Focused DB queue Jest passed: `/tmp/codex-tool-runs/svton/f240-db-job-queue-jest-20260705-024238.log`; API type-check passed: `/tmp/codex-tool-runs/svton/f240-api-type-check-20260705-024238.log`; API build passed: `/tmp/codex-tool-runs/svton/f240-api-build-20260705-024238.log`; line-count, diff check, conflict-marker scan, and trailing-whitespace scan passed: `/tmp/codex-tool-runs/svton/f240-line-count-20260705-024312.log`, `/tmp/codex-tool-runs/svton/f240-diff-check-20260705-024312.log`, `/tmp/codex-tool-runs/svton/f240-conflict-scan-20260705-024312.log`, `/tmp/codex-tool-runs/svton/f240-trailing-whitespace-scan-20260705-024312.log`. |

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
