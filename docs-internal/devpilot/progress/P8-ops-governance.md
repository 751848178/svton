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

| Task   | Status      | Description                                                                                                  | Evidence |
| ------ | ----------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| F151.1 | done | Build a source-backed map of `SupervisorPanel`, section boundaries, labels, helpers, and validation targets. | CodeGraph CLI exists but is not initialized; manual graph confirmed `SupervisorPanel` renders summary metrics, worker process, agent readiness, worker owners, queue coordination, remote orphan governance, execution audit visibility, agent jobs, runtime health, agent fleet, and owner samples. |
| F151.2 | done | Extract the smallest confirmed read-only section components while preserving labels, cards, and type access. | `supervisor-panel.tsx` now composes focused child components; agent/worker/orphan/audit labels and status readers moved into pure format utils; `ServerExecutionSupervisorSnapshot`, hook state, UI labels, status badges, and read-only field access are preserved. |
| F151.3 | done | Sync TODO/progress docs and run targeted Web verification plus hygiene checks.                               | Prettier, execution-governance ESLint, Web build, Web type-check, source line-count, diff check, conflict-marker scan, and trailing-whitespace scan passed. Key logs: `/tmp/codex-tool-runs/svton/f151-prettier-20260703-175737.log`, `/tmp/codex-tool-runs/svton/f151-eslint-execution-governance-20260703-175839.log`, `/tmp/codex-tool-runs/svton/f151-web-build-20260703-175808.log`, `/tmp/codex-tool-runs/svton/f151-web-type-check-20260703-175826.log`, `/tmp/codex-tool-runs/svton/f151-final-line-count-source-20260703-180112.log`, `/tmp/codex-tool-runs/svton/f151-final-diff-check-20260703-180112.log`, `/tmp/codex-tool-runs/svton/f151-final-conflict-marker-scan-20260703-180112.log`, `/tmp/codex-tool-runs/svton/f151-final-trailing-whitespace-scan-20260703-180112.log`. |

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
