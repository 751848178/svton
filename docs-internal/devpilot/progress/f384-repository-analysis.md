# F384 Repository Connection And Analysis Progress

## Current State

- Status: done
- Branch: `codex/f384-repository-analysis`
- Base: `dbce7a7f` (verified F383 HEAD; not yet on `master`)
- Final run: `cms5xb3o2000aazxpaut9boes`
- Primary TODO: `docs-internal/todos/2026-07-29-repository-analysis.md`
- Long-goal board:
  `/tmp/codex-tool-runs/svton/long-goals/f384-repository-analysis/board.json`

## Scope Boundary

F384 owns read-only repository connection, exact branch/commit verification,
auditable isolated analysis, evidence-backed suggestions, explicit review/apply,
repository readiness, permissions/audit/redaction, and Picshare runtime proof.
It does not alter F383 release orchestration or add later resource-provider and
production provisioning capabilities.

## Confirmed Baseline

- Current import is manual and explicitly unverified.
- F381 lists automatic repository analysis as follow-up work.
- Existing Project/Application/ApplicationService/Environment/DeploymentRun,
  access policy, audit, encrypted credential, and guided-delivery boundaries
  must be reused where current source confirms they fit.
- `check2.mjs` remains unrelated and untouched.

## Implemented Closure

- Added encrypted credential references, read-only Git resolution, exact commit
  snapshots, isolated bounded checkout, persisted runs/stages/suggestions, and
  safe failure/audit records.
- Added framework-neutral Picshare detection for workspace roles, artifacts,
  Docker/Compose, env names, health conflicts, commands, migrations, and data
  dependencies.
- Added explicit accept/edit/reject review and transactional apply into the
  existing Project/Application/ApplicationService boundary.
- Added project Repository UI, truthful 6/6 readiness, restorable run state,
  result deep links, and project/category-scoped audit navigation.
- Preserved the original F383 Picshare App and admin/backend IDs and deployment
  configuration hashes; only the confirmed proxy service was added.

## Real Picshare Evidence

- Source: clean Picshare
  `master@8e7c465d56e68dafcef0dfbc480fe721044b0fb3`, mounted read-only into the
  disposable Devpilot Docker runtime.
- Run `cms5xb3o2000aazxpaut9boes`: succeeded in 400 ms, 6/6 stages, 518 files,
  5 units, 3 deployable services, 6 Compose candidates, MySQL/Redis, and two
  conflicting backend health probes retained as warnings.
- Decisions persisted after reload: admin/backend edit, proxy/repository accept,
  resource requirements reject. Readiness readback is connected/analyzed/
  applied/complete.
- Browser evidence:
  `/tmp/codex-tool-runs/svton/f384-final-runtime/repository-tab.png` and
  `/tmp/codex-tool-runs/svton/f384-final-runtime/audit-events.png`.
- Redacted database/API evidence:
  `/tmp/codex-tool-runs/svton/f384-final-runtime/db-readback-redacted.json`.

## Verification

- Repository-analysis backend: 7 Jest suites, 42 tests passed, including
  redaction, scope, forged IDs, idempotency/concurrency, cancel/retry, timeout,
  parser failure cleanup, matching, and transactional apply.
- Frontend: audit-query and readiness suites, 6 tests passed; Web type-check and
  production build passed.
- Prisma generate/validate, API type-check/build, Docker build/migration/up, and
  browser repository/readiness/application/service/environment/audit flows
  passed.
- All changed production TS/TSX files are at most 200 lines; `git diff --check`
  passed; unrelated `check2.mjs` remains untouched.

## Honest Boundary

The disposable Test Org had no reusable Git credential and the host's GitHub
credential helper is intentionally unavailable inside the API container.
Therefore the final public-source proof used the same clean Picshare repository
and exact commit through an explicit read-only local mount. Remote/private
provider credential proof remains an environment/credential signoff, not a
claim made by F384. No repository writes, provider provisioning, production
resource creation, Picshare changes, or F383 release-behavior changes occurred.

## Commits

- `cc87c2d8` — auditable repository analysis backend.
- `5bffc4a6` — repository review/apply/readiness/audit UI.
- Final documentation/evidence synchronization is the closing commit.
