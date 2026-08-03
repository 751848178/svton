# Devpilot V13 Project Delivery Progress

## Current State

- Active slice: F394 — server-resolved BuildRun and immutable ArtifactManifest execution.
- Branch: `codex/devpilot-project-delivery-v13`.
- Worktree: `/Users/zhaoxingbo/Workspace/ai-driven/svton-devpilot-project-delivery-v13`.
- Base: `b6c3488743be13eacf4320f685da927488490113`.
- Integrated fixes: `17652567` then `ef1a47cb` (local cherry-pick commits `7d9d580c`, `724abfef`).
- Original checkout protection checkpoint: `master@b6c3488`, 131 status entries, SHA-256 `1024cd00f74bfe32689bff198cdef74942ccff7b26d30f7d28a2609c52d0ab16`.

## Source-Backed Baseline

- Existing Project create and default-environment seed are not one transaction; defaults are `dev/test/staging/prod`.
- Repository analysis has real connect/run/review/apply evidence and start idempotency, but no canonical repository uniqueness or idempotent finalize record.
- Existing ReleasePlan/Stage/Attempt/Event, approvals, CAS and leases are reusable execution foundations.
- Release orchestration defaults off; live SSH defaults off; deployment defaults dry-run.
- ReleaseOrder, releaseVersion, BuildRun, ArtifactManifest, ReleaseRun, EnvironmentVersion and 51/15 catalog are absent from the authorized base.
- Attempt `artifacts[]` is JSON evidence, not an immutable Manifest; normal live deployment may pull a branch instead of enforcing stored Commit.
- Web project detail has eight peer tabs; `/projects/import` is five-step and explicitly unverified; release capability lookup fails open.

## Architecture Contract

- Additive schema only until dual-read/write parity; no physical rename or history deletion.
- Project intake owns lifecycle/identity/finalize; repository analysis remains evidence provider.
- Build owns immutable BuildRun/Manifest and never depends on deployment.
- Deployment consumes exact Manifest plus frozen environment revision and cannot build/pull.
- Successful DeploymentRun produces append-only EnvironmentVersion; recovery creates a new run/version.
- Production proves same-project/same-Manifest Staging success, freezes snapshots, then awaits approval before DeploymentRun.
- Unknown/expired Provider evidence is unchecked/unavailable, never passed; MVP executes standard release only.

## Slice Status

| Range     | State   | Outcome                                                                                      |
| --------- | ------- | -------------------------------------------------------------------------------------------- |
| F386      | done    | Isolated baseline, TODO/progress/migration contract and baseline verification complete.      |
| F387      | done    | Additive intake/identity/finalization/config revision schema and preflight reports complete. |
| F388      | done    | Transactional intake API, duplicate guard, idempotent finalize and recovery complete.        |
| F389      | done    | ACL-filtered directory read model, search/filter/baseline/Production/activity summary complete. |
| F390      | done    | Project directory and three-step existing-repository intake verified end to end.              |
| F391      | done    | Delivery/settings hosts, two-item primary IA and legacy deep-link adapters verified.           |
| F392      | done    | Additive delivery schema and conservative legacy/unverified migration report verified.         |
| F393      | done    | ACL/idempotent ReleaseOrder API and default create/list Web verified with zero implicit build.  |
| F394-F398 | pending | Build/Manifest, four-step detail and exact Staging/Production/environment versions.             |
| F399-F405 | pending | Manage Project governance, 51/15 gates and standard strategy.                                |
| F406-F410 | pending | Compatibility, docs, Docker/browser E2E, negative validation and final audit.                |

## Evidence

- Long-goal board: `/tmp/codex-tool-runs/svton/long-goals/devpilot-project-delivery-v13/board.json`.
- Phase 0 source audit: `.../artifacts/p0-source-audit.md`.
- Architecture brief: `.../artifacts/p0-architecture-brief.md`.
- Serialized backlog: `.../artifacts/p0-slice-backlog.md`.
- Dependency install: `/tmp/codex-tool-runs/svton/f386-install-20260803-115615.log`.
- Prisma generate/validate: `/tmp/codex-tool-runs/svton/f386-prisma-generate-20260803-115714.log`, `/tmp/codex-tool-runs/svton/f386-prisma-validate-final-20260803-115731.log`.
- Initialization build and type-checks: `/tmp/codex-tool-runs/svton/f386-init-build-final-20260803-115737.log`, `/tmp/codex-tool-runs/svton/f386-api-typecheck-20260803-115805.log`, `/tmp/codex-tool-runs/svton/f386-web-typecheck-20260803-115813.log`.
- Focused integration fixes: `/tmp/codex-tool-runs/svton/f386-focused-tests-20260803-115839.log` — 3 suites, 35 tests passed.
- CodeGraph initialized with 3,358 files, 37,526 nodes and 128,155 edges; pending changes zero.
- F387 Prisma and API checks: `/tmp/codex-tool-runs/svton/f387-prisma-validate-replay-20260803-121740.log`, `/tmp/codex-tool-runs/svton/f387-api-typecheck-replay-20260803-121757.log`.
- F387 preflight fixtures: `/tmp/codex-tool-runs/svton/f387-tests-replay-20260803-121757.log` — 2 suites, 14 tests passed.
- F387 real MySQL migration: `/tmp/codex-tool-runs/svton/f387-migrate-deploy-empty-20260803-121147.log`, `/tmp/codex-tool-runs/svton/f387-migrate-upgraded-fixture-20260803-121334.log`, `/tmp/codex-tool-runs/svton/f387-upgraded-fixture-assertions-20260803-121349.log`; two ambiguous environments were retained with NULL baseline role and no implicit lifecycle/backfill rows.
- F388 focused unit/regression tests: `/tmp/codex-tool-runs/svton/f388-unit-tests-final-20260803-123710.log` — 8 suites, 39 tests passed.
- F388 real MySQL transaction acceptance: `/tmp/codex-tool-runs/svton/f388-finalization-integration-acceptance-20260803-123802.log` — 7 integration tests passed, including rollback/retry and concurrent finalize.
- F388 API gates: `/tmp/codex-tool-runs/svton/f388-api-typecheck-replay-20260803-124121.log`, `/tmp/codex-tool-runs/svton/f388-api-build-replay-20260803-124121.log`.
- F389 unit/regression tests: `/tmp/codex-tool-runs/svton/long-goals/devpilot-project-delivery-v13/f389-unit-tests-search-summary.log` — 3 suites, 12 tests passed.
- F389 real MySQL directory isolation/search: `/tmp/codex-tool-runs/svton/long-goals/devpilot-project-delivery-v13/f389-mysql-search-integration-retry.log` — 2 integration tests passed; disposable container removed.
- F389 API gates and graph: `/tmp/codex-tool-runs/svton/long-goals/devpilot-project-delivery-v13/f389-api-typecheck-search-summary.log`, `/tmp/codex-tool-runs/svton/long-goals/devpilot-project-delivery-v13/f389-api-build.log`, `/tmp/codex-tool-runs/svton/long-goals/devpilot-project-delivery-v13/f389-codegraph.log`.
- F390 focused regression: `/tmp/codex-tool-runs/svton/long-goals/devpilot-project-delivery-v13/f390-api-unit-latest.log` — 5 API tests; `/tmp/codex-tool-runs/svton/long-goals/devpilot-project-delivery-v13/f390-web-unit-latest.log` — 6 Web tests; API/Web type-check and build logs use the matching `f390-*-latest/final.log` names.
- F390 browser evidence: `/tmp/codex-tool-runs/svton/long-goals/devpilot-project-delivery-v13/f390-browser/` — draft retention and explicit branch failure, retry, fixed-commit analysis, dependency-safe review, baseline finalization, project detail, directory search/filter and legacy redirect; console error/warn was empty after the final regression.
- F390 real MySQL evidence: project `cmscs55sy000azibq1is4a4dg` is ready at commit `85fad682d21785cf83cc48a911e993c049750356`, has one locked canonical identity, one successful finalization, exactly one active Staging and Production baseline, and the latest successful run is not overridden by an older failed run.
- F391 route regressions: `/tmp/codex-tool-runs/svton/long-goals/devpilot-project-delivery-v13/f391-web-unit-final.log` — 2 files, 12 tests; Web type-check/build passed in `f391-web-typecheck-after-build.log` and `f391-web-build-final.log`; CodeGraph selected the compatibility spec.
- F391 browser evidence: `.../f390-browser/06-f391-project-delivery.png` and `07-f391-manage-project.png`; default release-order view, two-item primary navigation, truthful environment-version empty state, settings sections and repository/environment/deployment legacy deep links all passed with preserved focused IDs and clean final-page consoles.
- F392 schema gates: `f392-prisma-validate.log`, `f392-prisma-generate.log`, `f392-api-typecheck.log`, `f392-api-build.log` and `f392-api-unit.log` under the long-goal directory all passed; CodeGraph selected the migration-report spec.
- F392 real MySQL: `f392-migrate-empty.log` and `f392-migrate-upgraded.log` passed. Empty schema has all six delivery tables; same digest produced two independent manifests for two builds; duplicate project releaseVersion failed. Upgrade fixture retained legacy plan/deployment links as NULL, observed-only digest as evidence, zero synthesized orders/manifests/environment versions, and preserved unrelated existing index/FK drift.
- F393 API evidence: `f393-api-unit-final.log` — 2 suites/7 tests; `f393-api-mysql-integration-final.log` — 3 real-MySQL tests including concurrent identical create convergence; API type-check/build passed.
- F393 Web/browser evidence: `f393-web-unit-final.log` — 2 files/12 tests, Web type-check/build passed; `.../f390-browser/08-f393-release-order.png` shows the real `2.4.1` draft with 0 builds/0 manifests. Sequential replay kept one card, conflicting note stayed in the dialog with an explicit error, and the final console was clean.

## Next

Implement and verify F394 server-resolved BuildRun/Manifest execution, failure isolation and redacted per-run evidence without waiting for user confirmation.
