# Guided Project Delivery

## Goal

Make the real Devpilot project delivery path understandable to a first-time
platform user: register a project, check its declared configuration, create an
environment, request and associate resources, build a deployment plan, execute
through the existing governance path, and inspect complete evidence.

## Scope

- In scope: project intake/import UI, project detail overview, environment and
  resource readiness, resource-request deep linking/prefill, deployment-plan
  wording and evidence, URL-restorable navigation, focused tests and browser QA.
- Out of scope: implementing a new repository clone/analyzer, changing live
  execution semantics, connecting real Git/cloud/CDN providers, destructive
  production actions, or redesigning unrelated operations/admin surfaces.

## Clarifications And Assumptions

- Confirmed: the current import form manually builds project configuration and
  calls `POST /projects`; it is not automatic repository analysis.
- Confirmed: existing project detail data already exposes environments,
  applications/services, resource instances, managed resources, sites, keys,
  and deployment runs.
- Assumption: this slice should prioritize an honest, usable orchestration layer
  over adding a speculative repository-analysis backend.
- Assumption: existing Devpilot layout, tokens, Card/Button/StatusTag primitives,
  and Chinese-first product language remain the visual source of truth.
- Constraint: unsupported actions must be explained or removed from the primary
  path; no placeholder button may appear as a completed capability.

## Workflow Routing

`routing: specialized-workflow + multi-agent read-only discovery + noisy-tools isolation; the user-visible journey crosses project, deployment, environment, and resource modules, while the main agent remains the single active writer.`

## Functional TODO Breakdown

### F1. Project delivery control center

Purpose: show one current stage, one recommended next action, readiness blockers,
and the real state of every delivery prerequisite.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F1.1 | done | Map existing project data, actions, URL state, and reusable UI boundaries. | Read-only project detail graph. | CodeGraph plus ARCH-001/TRUTH-001/UX-001 results under `/tmp/codex-tool-runs/svton/devpilot-guided-delivery-20260726/agent-board/results/`. |
| F1.2 | done | Add a pure readiness model with explicit ready/action/blocked states and tests. | New project-detail model/spec only. | Pure readiness and next-action models; Web type-check/build passed. |
| F1.3 | done | Build focused control-center, step, blocker, and evidence components. | New project overview components, each <=200 lines. | Project overview renders the six-stage delivery guide, evidence, blocker, and one recommended action. |
| F1.4 | done | Make project-detail tabs URL-restorable and route every CTA to a real destination. | Project detail page/tab navigation only. | Browser verified `?tab=deployments`, resource-request prefill, and application-create routing. |

### F2. Honest project intake

Purpose: replace the long undifferentiated import form with a guided, reviewable
manual intake flow while clearly separating it from future automatic analysis.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F2.1 | done | Define intake steps and validation using the existing form contract. | Import types/model; no API contract change. | Five-step intake flow reuses the existing `POST /projects` contract. |
| F2.2 | done | Implement source, configuration, environment, and review steps. | Import components/page only. | Browser verified step progress, required-field gating, and review semantics. |
| F2.3 | done | Clarify manual configuration, unsupported auto-analysis, and post-create next steps. | Copy and review summary. | UI explicitly marks repository, branch, stack, and commands as manually configured and unverified. |

### F3. Resource request and environment association

Purpose: let a user start from a project blocker, request the missing resource
for a chosen environment, and return to the same project context.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F3.1 | done | Verify resource-request query/filter and create-form capabilities. | Resource request frontend/API read-only graph. | TRUTH-001 identified the missing real `environmentId` and fake bulk-apply request. |
| F3.2 | done | Add project/environment query prefill without changing the request API. | Resource request hook/modal/page. | Browser verified project Picshare and environment 开发 are preselected from the project CTA. |
| F3.3 | done | Add project control CTAs and association explanation using real counts. | Project control center only. | Project guide routes to resource request; request/instance UI shows `项目 → 环境`. |

### F4. Truthful deployment planning and evidence

Purpose: make Preview/Plan/Dry-run/Live effects explicit and expose enough run
context to diagnose the result.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F4.1 | done | Trace plan creation, approval, queue, and execution effects. | Deploy wizard/API read-only graph. | TRUTH-001 truth table distinguishes plan-only, approved, queued, executed, and external/default-off boundaries. |
| F4.2 | done | Rewrite mode/effect copy and show target, commands, side effects, and governance before submission. | Deploy wizard components only. | Browser verified the dry-run message and full redacted commands/working directories/environment keys. |
| F4.3 | done | Improve run evidence with phase, queue/approval, error, target, and correlation fields already returned. | Deployment run components only. | Browser verified formal run semantics, target, environment, app/service/server, approval, job, commands, logs, result, and error areas. |

### F5. Verification and documentation

Purpose: prove the flow in the real local product and preserve an evidence-backed
handoff.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F5.1 | done | Run focused tests, Web type-check/build, line ceilings, and diff hygiene in isolated logs. | Touched Web paths. | Type-check and production build passed; all touched/new TS/TSX files stay within 200 lines. |
| F5.2 | done | Exercise the complete project path at localhost:3120 and inspect screenshots. | Non-destructive browser flow. | Browser verified project/import/resource/application/deployment paths; no live deploy, resource apply, request, release, project, or app mutation was submitted. |
| F5.3 | done | Sync F381 ledger/progress with verified results and residual backend gaps. | TODO/progress docs. | This ledger, the primary F381 ledger, progress summary, and implementation report were synchronized. |

### F6. Explicit deployment preflight stages (F382)

Purpose: let each application service declare database migration, one-time
initialization, and startup verification commands as ordered deployment stages.
Every stage must state when it runs, stop the deployment on failure, and expose
its command, status, timestamps, logs, and error in deployment evidence.

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F382.1 | done | Map the application-service config, deployment plan, execution job, and run-evidence contracts. | Read-only CodeGraph/source/sub-agent discovery. | ARCH-002/TRUTH-002/UX-002 completed under the existing guided-delivery agent board. |
| F382.2 | done | Add a backward-compatible deployment preflight contract and ordered fail-fast execution plan. | API DTO/config/command-plan path; no framework-specific seed inference. | Fixed stage order, SSH/agent stage evidence, initialization checkpoint migration, and secret-bearing queue gate; focused API specs/type-check/build passed. |
| F382.3 | done | Add novice-facing service configuration and deployment-stage evidence UI. | Applications/deploy wizard/project deployment evidence only. | Service config supports pre-check/migration/initialization; preview and run details show policy, state, exit code, duration, and skip reason; Web type-check/build and focused lint passed. |
| F382.4 | done | Document Picshare migration/initialization remediation and Devpilot adoption. | Picshare documentation only; no Picshare code mutation. | `picshare/docs/devpilot-deployment-initialization.md` records confirmed evidence, responsibility boundary, target commands, and acceptance criteria. |
| F382.5 | done | Run structural, focused test, type-check, build, and diff review gates. | Touched API/Web/docs paths. | API/CLI regression tests, API/Web/CLI type-check, API/Web build, disposable MySQL migration/checkpoint proof, line ceilings, and diff checks passed; authenticated modal browser proof remains unavailable in the fresh browser session. |

## Verification Plan

- Pure model tests for readiness ordering, blockers, and next-action routing.
- Focused component/type checks where existing infrastructure supports them.
- `apps/devpilot-web` type-check and build, captured under
  `/tmp/codex-tool-runs/svton/`.
- File ceiling, conflict marker, trailing whitespace, and scoped diff checks.
- Real browser verification at 1280px for import intake, project control center,
  environment/resource routing, deploy plan, and deployment evidence.

## Change Log

- 2026-07-26 21:45 CST: Created F381 plan; discovery and three read-only
  sub-agent reviews are in progress.
- 2026-07-26 22:36 CST: Completed F381 implementation and browser verification.
  The project overview now provides one evidence-backed delivery path; resource
  requests carry a real project environment; resource association uses
  preview/typed-confirm/live-apply semantics; dry-runs are plan-only and cannot
  make project health green; deployment evidence exposes the returned target,
  plan, approval, job, logs, result, and error data. Automatic repository
  analysis and external resource reclaim remain explicit follow-up work.
- 2026-07-27 08:45 CST: Started F382 after the Picshare deployment exposed a
  missing production initialization contract, a migration/seed dependency
  cycle, and migration failure hidden by application startup. The platform
  slice is framework-neutral: explicit preflight stages, fail-fast semantics,
  and complete per-stage evidence; Picshare-specific remediation stays in its
  own documentation.
- 2026-07-27 11:40 CST: Completed F382. Application services now own explicit
  pre-check, migration, initialization, deploy, and health stages. SSH and
  Server agent execution retain stage metadata and report outcomes; migration
  or initialization failure stops later stages. A database-backed checkpoint
  guarantees successful initialization once per service/environment/command
  fingerprint. Verification included a disposable MySQL 8 database, where the
  migration applied, checkpoint status reached `completed`, and the unique
  scope rejected a duplicate. The fresh browser session was not authenticated,
  so interactive modal proof is still a runtime follow-up rather than a claimed
  pass.
