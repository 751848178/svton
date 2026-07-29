# F384 Repository Connection And Analysis

## Goal

Turn an imported Devpilot project from manually declared repository metadata
into a verified, auditable delivery input: connect a repository read-only,
resolve its real default branch and commit, analyze code with evidence, let the
user review every proposed change, and apply confirmed service/environment/
deployment configuration without overwriting manual values silently.

## Scope

- In scope: public/private read-only repository connection, credential reuse,
  persisted analysis runs and stages, isolated parsing, structured evidence,
  review/edit/ignore/apply suggestions, project readiness, permissions, audit,
  redaction, history/retry/cancel, exact deep links, and Picshare runtime proof.
- Out of scope: changing F383 release semantics, resource-provider SDK work,
  production resource delivery, repository writes, webhook auto-deploy, and
  modifying Picshare source.

## Clarifications And Assumptions

- Confirmed: F381 deliberately left automatic repository scanning outside its
  scope; current project import saves repository, branch, stack, and commands as
  manual and unverified configuration.
- Confirmed: F383 is complete at `dbce7a7f` but not merged to `master`; F384
  starts from that verified commit on `codex/f384-repository-analysis`.
- Confirmed: `check2.mjs` is unrelated, untracked, and must remain untouched.
- Constraint: credentials and environment secret values must never enter API
  responses, logs, evidence, parser results, audit metadata, or Git arguments.
- Constraint: the main thread is the only repository writer; discovery workers
  are read-only and may write only scoped evidence under `/tmp`.

## Workflow Routing

`routing: long-goal + multi-agent read-only discovery + noisy-tools isolation; F384 crosses schema, repository execution, application/service configuration, project UI, permissions, audit, and browser/runtime verification.`

## Functional TODO Breakdown

### F384.1. Source truth and durable plan

Purpose: establish the real baseline and keep every later decision traceable.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F384.1.1 | done | Confirm Git worktree, F383 ancestry, branch, and CodeGraph state. | Read-only repository state. | `HEAD=dbce7a7f`; F383 is not on master; branch `codex/f384-repository-analysis`; only `check2.mjs` untracked; CodeGraph current. |
| F384.1.2 | done | Map backend, frontend, Picshare, documentation, and competitor-backed import boundaries. | Read-only discovery workers and real source. | W001-W003 results/maps under `/tmp/codex-tool-runs/svton/long-goals/f384-repository-analysis/workers/`. |
| F384.1.3 | done | Record the architecture, data flow, security boundary, and implementation order. | F384 architecture document only. | `docs-internal/devpilot/repository-analysis-architecture.md`. |

### F384.2. Real read-only repository connection

Purpose: verify the actual repository, default branch, requested branch, commit,
and credential boundary before any result can be called scanned.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F384.2.1 | done | Add repository connection and credential-reference persistence. | Prisma models and migration; no plaintext credentials. | Migrations `20260729152000_repository_analysis` and `20260729183000_repository_suggestion_review_decision`; `prisma validate` passed. |
| F384.2.2 | done | Implement URL validation, default-branch discovery, branch/commit resolution, and readable error codes. | Repository connection API/service/executor. | Picshare `master@8e7c465d56e68dafcef0dfbc480fe721044b0fb3` resolved in the Docker runtime; invalid source/branch/credential errors are mapped and redacted. |
| F384.2.3 | done | Enforce project-management writes, scoped reads, redaction, idempotency, and connection audit. | Policy/audit/security tests. | Repository-analysis Jest suites cover scope, forged IDs, duplicate active runs, idempotency, and secret redaction; browser audit view shows connection events. |

### F384.3. Auditable isolated analysis

Purpose: execute a real bounded parser against an exact commit and retain enough
stage evidence to understand, retry, cancel, and audit every run.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F384.3.1 | done | Persist run identity, state, stages, timings, parser version, result, warnings, evidence, errors, and active/idempotency guards. | Prisma models and repository layer. | Final run `cms5xb3o2000aazxpaut9boes`: 6/6 stages succeeded in 400 ms; DB readback under `f384-final-runtime/db-readback-redacted.json`. |
| F384.3.2 | done | Clone into an isolated temporary workspace with timeout, cancellation, size/file limits, traversal defense, and cleanup. | Git executor and worker only. | Real read-only mounted checkout succeeded; worker tests prove timeout, parser-failure cleanup, cancel/retry, and remaining-stage cancellation. |
| F384.3.3 | done | Detect repository layout, services, roles, frameworks, runtimes, package manager, commands, containers, env names, ports, health, data services, migrations, initialization, and artifacts. | Framework-neutral parser and focused fixtures. | 518 files, 5 units, 3 deployable services, 6 Compose files, MySQL/Redis, artifacts, and conflicting health probes detected from Picshare. |
| F384.3.4 | done | Expose scoped run history/detail/retry/cancel APIs and exact 404 behavior for forged IDs. | Controller/service/repository and integration tests. | API contract is project/team scoped; run-service tests cover forged IDs, concurrency, idempotency, retry, and cancellation. |

### F384.4. Reviewable platform suggestions

Purpose: convert evidence into explicit, editable decisions without silently
overwriting manual project or service configuration.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F384.4.1 | done | Persist suggestions with source evidence, current/proposed values, conflicts, impact, and review state. | Suggestion model and analysis result builder. | Five persistent suggestions retain accept/edit/reject decisions and reviewed-value presence after reload. |
| F384.4.2 | done | Apply only confirm/edit actions, preserve ignored/manual values, and write operation audit. | Transactional apply service. | Admin/backend edited, proxy/repository accepted, resources rejected; apply and analysis audit events persist. |
| F384.4.3 | done | Read back real Application/ApplicationService/Environment/deployConfig links and applied repository verification state. | API and database assertions. | Original F383 admin/backend IDs and deployment hashes stayed stable; one proxy application/service was created; readiness is complete. |

### F384.5. Novice-facing repository analysis UI

Purpose: provide one clear “连接并解析仓库” action and a truthful end-to-end
view of connection, progress, evidence, decisions, and applied state.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F384.5.1 | done | Add repository state to project delivery readiness; only applied verified analysis completes 6/6. | Project overview readiness model/hook. | Browser overview shows 6/6 only with connected + analyzed + applied truth; 4 readiness tests pass. |
| F384.5.2 | done | Build connection, branch/credential, run progress/history/detail, error/retry/cancel, and evidence UI. | Focused project repository components/hooks. | Browser repository tab restores the selected run and renders stages, evidence, warnings, history, and the hydrated connection. |
| F384.5.3 | done | Build per-suggestion confirm/edit/ignore/apply flow and exact result deep links. | Review/apply components and URL state. | Browser reload preserves two edit, two accept, and one reject decisions; application/service/environment/audit deep links were verified. |

### F384.6. Verification and closure

Purpose: prove the UI is backed by real Git, database, API, parser, permissions,
audit, and failure behavior rather than frontend simulation.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F384.6.1 | done | Run focused unit/integration, permission, redaction, concurrency, timeout, forged-ID, type-check, build, and 200-line gates. | Isolated logs under `/tmp/codex-tool-runs/svton/`. | 7 backend suites / 42 tests and 2 frontend suites / 6 tests pass; API/Web checks and builds pass; every changed production TS/TSX file is at most 200 lines. |
| F384.6.2 | done | Complete Picshare browser success flow and API/database readback. | Disposable/local Devpilot runtime; Picshare remains read-only. | Repository and audit screenshots plus redacted DB readback live under `/tmp/codex-tool-runs/svton/f384-final-runtime/`; Picshare stayed clean. |
| F384.6.3 | done | Verify invalid source/credential, parser failure/timeout, duplicate/concurrent, cancel/retry, and forged-ID boundaries at their highest-signal safe layer. | Runtime audit plus focused service/worker/repository tests. | Runtime retained failed remote-credential audits; 42 backend tests cover the remaining deterministic failure and isolation branches without disturbing the final Picshare state. |
| F384.6.4 | done | Synchronize progress, architecture, runbook, evidence summary, diff hygiene, and clean commits. | Docs, scoped Git diff, and commits only. | Backend `cc87c2d8`; frontend `5bffc4a6`; final docs/evidence commit follows this update. |

## Verification Plan

- Focused backend unit and database-backed integration tests for connection,
  parser, run lifecycle, apply, permission, audit, redaction, idempotency, and
  exact scoped lookup.
- Frontend model/component coverage where supported, then API/Web type-check and
  production builds.
- Real Picshare `master@<exact SHA>` repository analysis in the running product,
  followed by UI screenshots plus API and database readback.
- Failure-path runtime proof for invalid source/branch/credential, timeout,
  parser failure, concurrent clicks, retry/cancel, and forged run IDs.
- Scoped structural check for all F384 production TS/TSX files at no more than
  200 lines, followed by diff and unrelated-file review.

## Change Log

- 2026-07-29 14:58 CST: Registered F384 after confirming the F383 branch/commit
  baseline and the F381 source-backed automatic repository analysis gap.
- 2026-07-29 15:24 CST: Completed the source/competitor/Picshare maps and fixed
  the connection/run/stage/suggestion architecture; began the persistence slice.
- 2026-07-29 18:38 CST: Closed the real Picshare connection-analysis-review-
  apply-audit loop, verified persistent readiness and deep links in the browser,
  and completed focused failure, build, database, and diff gates.
