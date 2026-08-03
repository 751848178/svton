# Devpilot V13 Project Delivery Progress

## Current State

- Active slice: F405 — standard release policy with fail-closed canary, blue-green and automatic traffic strategy capabilities.
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
| F394      | done    | Server-resolved exact-Commit builds, isolated evidence and success-only immutable Manifests.   |
| F395      | done    | Four-step accessible detail, stable refresh/deep-link recovery and isolated BuildRun logs.     |
| F396      | done    | Repeatable exact-Manifest Staging DeploymentRuns with no Git, checkout or implicit build.      |
| F397      | done    | Production same-Manifest proof, frozen snapshots, approval and concurrent idempotency.    |
| F398      | done    | Append-only environment versions, controlled upgrade and recovery rollback.               |
| F399      | done    | Manage Project consolidation and ordinary/professional route reachability.                  |
| F400      | done    | Audited immutable environment config and reference governance with locked identity.         |
| F401      | done    | Versioned 51/15 catalog, unified statuses and fail-closed provider registry.                   |
| F402      | done    | Freshness-aware M01-M05 Commit/Build provider adapters and immutable evidence drill-down.     |
| F403      | done    | Environment-scoped M06-M09 Deploy providers with redaction and expiry boundaries.             |
| F404      | done    | M10-M15 Promote adapters with technical/manual separation and fail-closed traffic capability. |
| F405      | pending | Standard release policy and explicit advanced-strategy capability gates.                       |
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
- F394 API evidence: `f394/api-release-suite-final.log`, `f394/api-integration-final.log`, `f394/api-typecheck-final.log` and `f394/api-build-final.log` cover executor/config/controller/service/repository behavior plus real MySQL revision allocation and success-only Manifest persistence. Executor tests prove deterministic archive digest, minimal environment, checkout path confinement and token redaction.
- F394 browser/MySQL evidence: `.../f390-browser/09-f394-build-runs.png`, `10-f394-build-success.png`, `f394/mysql-browser-evidence.log` and `f394/mysql-final-build-evidence.log`. The server resolved `main@85fad682d21785cf83cc48a911e993c049750356`; the release order reached 5 independent BuildRuns and 4 Manifests, failed revision 3 retained zero Manifest, revisions 4/5 produced the same deterministic digest, and the final browser console had no error/warn entries.
- F395 API/Web evidence: `f395/api-unit-final.log`, `f395/api-typecheck-final.log`, `f395/web-unit-final.log`, `f395/web-typecheck-final.log` and matching build logs verify the scoped detail route, server-derived preflight/resume state, stable route normalization and dual-language build.
- F395 browser evidence: `.../f390-browser/11-f395-four-step-detail.png` and `12-f395-build-log-drawer.png`. Opening an order without `step` restored `step=build`; ArrowRight moved the selected ARIA tab and URL to Staging; invalid `step` normalized to build and removed a bogus buildRunId; the exact Build #5 log dialog survived refresh with one dialog, `aria-selected=true` and no console error/warn.
- F396 API evidence: `f396/api-unit-final.log`, `f396/api-integration-final.log`, `f396/api-typecheck-final.log` and `f396/api-build-final.log` cover same-order/successful-build Manifest validation, repeatable DeploymentRuns, exact byte digest verification, archive traversal rejection boundary, failure persistence and real MySQL no-rebuild invariants.
- F396 browser/MySQL evidence: `.../f390-browser/13-f396-repeat-staging.png` and `f396/mysql-browser-evidence.log`. Two clicks against Build #5 produced two completed DeploymentRuns with the same Manifest and Commit, `dryRun=0`, `artifactVerified=true`, `checkout=false`, `build=false`; BuildRun count remained exactly 5 and the browser console was clean.
- F397 API evidence: `f397/api-release-tests.log`, `f397/api-integration-final.log`, `f397/api-type.log` and `f397/api-build.log` cover exact same-Manifest Staging proof, immutable Production snapshots, approval binding, transactional concurrent idempotency, config drift, cross-project lookup and unknown Digest rejection. The real MySQL integration converged two concurrent requests to one ReleaseRun and one pending approval.
- F397 Web/browser evidence: `f397/web-release-tests.log`, `f397/web-type.log`, `f397/web-build.log` and `.../f390-browser/14-f397-production-confirmation.png`. The Production-only action required an explicit confirmation of environment, release version, Build/Commit, Manifest/Digest, config revision and policy snapshot; the real browser created ReleaseRun `cmscwe4ze000bgm3ufy9gdn0i` in `awaiting_approval` with pending approval `cmscwe4zl000dgm3u234b2dym`, both bound to the same input hash.
- F398 API evidence: `f398/api-release-suite.log`, `f398/api-integration.log`, `f398/staging-integration.log`, `f398/api-type-final.log` and `f398/api-build.log`. Real MySQL proved three Staging upgrade/recovery requests appended three distinct DeploymentRuns and EnvironmentVersions, preserved the previous-version chain, rejected arbitrary history IDs, and allowed Production only through a matching approved unconsumed ReleaseRun; success consumed the approval and completed the ReleaseRun.
- F398 Web/browser/MySQL evidence: `f398/web-type-final.log`, `f398/web-build.log`, `f398/mysql-browser-evidence.log` and `.../f390-browser/15-f398-environment-versions.png`. The real flow appended deploy → upgrade → recovery for Staging, approved the F397 Production request in the governance UI, then created the Production current version. The project has four immutable versions backed by four distinct DeploymentRuns; the browser console had no errors or warnings.
- F399 regression evidence: `f399-api-tests.log`, `f399-web-tests.log`, matching API/Web type-check/build logs, and browser screenshots `16-f399-manage-project.png` plus `17-f399-professional-deployment.png`. All five Manage Project sections were reachable with stable query URLs, legacy `tab=resources` redirected to the secondary page, and a focused legacy DeploymentRun preserved its ID under `view=deployments`. The audit also fixed malformed ICU Webhook text and exposed the ReleaseRun approval through the professional deployment projection; a fresh browser tab then had no error/warn logs.
- F400 API evidence: `f400/api-unit.log`, API/Web type-check and build logs, focused Web ESLint, `cas-a.log`, `cas-b.log`, `cross-project.log`, and `secret-plaintext.log`. Eleven focused tests cover the permission controller, stable snapshot hashing, strict references, global validation, shared-risk declaration, pre-deployment key mutability and post-deployment key lock. Against real MySQL, two writes from the same R5 pointer produced exactly one R6 (201) while the loser failed with 409 drift; cross-project resource input and a Secret plaintext field both failed with 400.
- F400 browser/MySQL evidence: `f400/mysql-evidence.log` and `.../f390-browser/18-f400-config-governance.png`. The clean browser shows immutable revision history, locked environment key, ordinary variables, route/DNS/TLS/proxy snapshot, a Secret reference rendered without plaintext, and a Redis reference explicitly shared by Staging/Production with medium risk and impact. The database stores only Secret id/name/type in the revision and audit metadata; the compatibility `config.envVars` mirror remains available to the existing deployment injector.
- F401 catalog evidence: `f401/api-tests.log` — 3 suites/17 tests; API/Web type-check and production builds plus focused Web ESLint passed. The authenticated API returned catalog `v13.2026-08-03` with exact Commit/Build/Deploy/Promote counts 10/11/20/10, all 51 unique checks, 15 capability groups and 51 `unavailable` evaluations while no provider is connected; cross-project lookup returned 404.
- F401 browser evidence: `.../f390-browser/19-f401-gate-catalog.png`. The default release preflight shows only the compact 51-total/51-unavailable summary; the professional expansion exposes every bilingual phase/check, Mxx or Target mapping and concrete unavailable reason. The clean browser console had no errors or warnings.
- F402 provider evidence: `f402/api-tests-final.log` — 4 suites/14 tests; API/Web type-check and production builds plus focused Web ESLint passed. Positive fixtures prove M01-M05 checked evidence, negative Build/test/security/Manifest results block, expired repository/analysis evidence becomes unchecked, and missing merge/CI/diff/security providers remain unavailable. Execution isolation/redaction is now explicitly separated from Secret/SAST/vulnerability scanning.
- F402 real browser/MySQL evidence: `f402/mysql-evidence.log`, `f402/browser-dom.txt` and `.../f390-browser/20-f402-commit-build-providers.png`. The real project evaluates C01/C05/B02/B09 as checked from exact repository, analysis, Build #5 and Manifest rows; C08/B03 are unchecked because the fixture has no supported lockfile/test provider; the other 45 checks, including all M04 scanner checks, remain unavailable. Evidence refs, checkedAt/expiresAt and precise reasons are visible, and the console is clean.
- F403 provider evidence: `f403/api-tests-final.log` — 5 suites/20 tests; API type-check/build and Web type-check passed. Positive fixtures prove M06-M09 config, Secret, deployment target, server/resource connectivity, capacity, migration and backup evidence; plaintext fields, cross-environment rows and failed evidence block; expired connectivity/metrics/migration/backup becomes unchecked; missing providers remain unavailable.
- F403 real browser/MySQL evidence: `f403/mysql-evidence.log`, `f403/browser-dom.txt` and `.../f390-browser/21-f403-deploy-providers.png`. D01 reads the real non-dry-run exact-Manifest Staging DeploymentRun, D02 reads immutable config R6 and its environment-scoped resource reference, and D03 resolves one Secret using only id/project/environment/name/type fields. The database has zero active server bindings, connection probes, capacity snapshots or backup runs, and no migration-diff provider, so D05 and D07-D12 remain unavailable rather than passing. The browser console is clean.
- F404 provider evidence: `f404/api-tests-final.log` — 4 suites/16 tests; API type-check/build and Web type-check passed. Positive fixtures cover approval/protection, DNS/TLS/routes, workload/HTTP, observability/metrics, recovery and retained evidence. Drift, ownership, expired certificates/approvals, failed probes/metrics and corrupt recovery block; time-sensitive DNS/HTTP/observability evidence expires; M15 remains unavailable without traffic/abort/rollback providers.
- F404 real browser/MySQL evidence: `f404/mysql-evidence.log`, `f404/browser-dom.txt` and `.../f390-browser/22-f404-promote-providers.png`. The real approval is approved, consumed and input-hash-bound, but D13 remains unchecked because no change-window/freeze provider conclusion exists. Production has no Site/DNS/TLS, health/workload/HTTP probe, observability metric, prior stable version or recovery-compatibility evidence, so those checks remain unavailable. P03 is manual evidence only; P10 alone is checked from the retained ReleaseRun→approval→Manifest→DeploymentRun→EnvironmentVersion chain. The catalog totals 51 checks with 39 unavailable and a clean browser console.

## Next

Implement and verify F405 standard release policy while canary, blue-green and automatic traffic changes remain explicitly non-executable without real providers.
