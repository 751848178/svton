# Devpilot V13 Project Delivery Progress

## Current State

- Active slice: F387 — additive project-intake and environment-baseline schema migration.
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
| F387-F391 | pending | Project intake, directory, three-step Web and project IA.                                    |
| F392-F398 | pending | ReleaseOrder, build/Manifest, four steps, exact Staging/Production and environment versions. |
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

## Next

Implement and verify F387 schema/collision-report slice without waiting for user confirmation.
