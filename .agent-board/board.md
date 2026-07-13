# Devpilot P8 Task-pull Multi-agent Board

Updated: 2026-07-13T13:53:49+08:00

## Goal

Close Devpilot production-grade MVP readiness after live rehearsal and demo evidence while preserving default-off safety gates, auditability, and existing public contracts.

Long-goal status: G003 is `production_like_staging_passed_external_signoff_required`. G002/S010 ended at `deliverable_with_demo_evidence`; G003 processed the production handoff gaps through S011-S022, cleared the local Docker-backed staging blocker, and packaged release evidence for commit readiness. Real provider and production signoff remains external. Orchestrator board:
`.agent-board/board.json`.

## Current Evidence

- `git status --short` shows active S011 changes in `apps/devpilot-api/src/server-executor`, `docs/devpilot/demo-runbook.md`, and `docs/todos/2026-07-11-devpilot-full-flow-validation.md`.
- `docs-internal/devpilot/progress/INDEX.md` anchors P8 through F374 around server-agent task-pull gate/result/helper boundaries and ack/finish auth regression coverage.
- `docs-internal/todos/INDEX.md` says project/environment Devpilot work should start from the active onboarding ledger and then the relevant `P*.md` file.
- Current touched production files are under the 200-line ceiling in the sampled line-count check.
- `.agent-board` marks S001 done/verified/reviewed/integrated, but the worktree still contains the completed task-pull diff and untracked task-pull helper/test files that must be packaged before merge readiness.
- `docs-internal/devpilot/progress/P8-ops-governance.md` records F380/S009 as the final post-S008 deliverability gate and supersedes the earlier S006 not-deliverable judgment.
- S004/S005/S007/S008 closed the real-agent runtime profile, terminal runtime proof, multi-instance coordination, and production remote-orphan governance gaps; S009 passed final API/CLI gates plus API/CLI/Web build and type-check prerequisites.
- S010 completed the repeatable demo runbook and browser UI E2E. Live fake-target deploy/rollback remains blocked by current local port ownership: `3100`/`3101` are `twgg` containers, not Devpilot API/Web.
- S011 closed the current worktree with focused Jest, API type-check, and diff hygiene evidence. S012 added the production config pack. S013 added command policy safety templates. S014 added the agent production operating runbook. S015 added rehearsal trace governance. S016 added permission/tenant E2E assets and S019 cleared its live API blocker against a disposable local Devpilot API. S017 added the resource request minimum loop. S018 added the backup/restore/upgrade checklist and final not-deliverable-until-blockers-clear judgment.
- Historical blocker: live provider/resource provisioning and production backup/rollback rehearsals originally needed approved credentials and targets. This is recorded as `.agent-board/results/G003-blocked-result.json`.
- S019 final E2E evidence: `/tmp/codex-tool-runs/svton/s019-permission-tenant-e2e-rerun2-20260713-103938.log`.
- S020 added `POST /api/backups/runs/:runId/restore` as a first-class restore dry-run endpoint/job while keeping live restore execution blocked by default. Verification: `/tmp/codex-tool-runs/svton/s020-backup-jest-20260713-104803.log` and `/tmp/codex-tool-runs/svton/s020-api-type-check-20260713-104844.log`.
- S021 added a Docker-backed staging matrix and runner. Final local evidence: `/tmp/codex-tool-runs/svton/g003-docker-staging-20260713035954/summary.json`; deploy, rollback, backup, restore, task-pull jobs, monitoring, logs, and audit checks passed against disposable containers only.
- S022 packaged the release evidence index and final hygiene. Evidence index: `.agent-board/release-evidence/G003-S022-release-evidence-index.md`; final hygiene logs live under `/tmp/codex-tool-runs/svton/g003-s022-final-hygiene/svton/`.

## Role Split

| Role         | Dispatch                            | Scope                                                                                             |
| ------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| Main Agent   | Always active                       | Owns this board, one-active-writer discipline, dispatch, and final answer.                        |
| Architect    | `ARCH-001`                          | Cross-module boundary, dependency direction, migration order, and state/data-flow diagram.        |
| Module Owner | `API-001`, `CLI-001`, `DOC-001`     | Owns module context packs and turns work into atomic todos.                                       |
| Executor     | Next ready implementation todo only | Edits exactly the files listed in one todo.                                                       |
| Verifier     | `VER-001`                           | Runs noisy checks, stores full logs under `/tmp/codex-tool-runs/svton/`, returns summaries only.  |
| Reviewer     | `REV-001`                           | Checks lifecycle contract drift, permission/default-off safety, missing tests, and docs mismatch. |
| Integrator   | `INT-001`                           | Reconciles API, CLI, docs, verification, and review outputs before merge/commit readiness.        |

## Modules

| Module                        | Owner Plan                                                          | Context Pack                                                         | Summary                                                                              |
| ----------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `task-pull-api`               | `.agent-board/modules/task-pull-api/module-plan.json`               | `.agent-board/modules/task-pull-api/context-pack.json`               | Server-side claim/ack/finish, finish sync, payload/result helpers, supervisor gates. |
| `task-pull-cli`               | `.agent-board/modules/task-pull-cli/module-plan.json`               | `.agent-board/modules/task-pull-cli/context-pack.json`               | CLI once/run config, runner, loop, executor, result/summary behavior.                |
| `task-pull-docs-verification` | `.agent-board/modules/task-pull-docs-verification/module-plan.json` | `.agent-board/modules/task-pull-docs-verification/context-pack.json` | Progress/TODO sync, isolated verification logs, final hygiene evidence.              |

## Execution Order

1. `S011`: close the current worktree and register G003 as the active production-readiness board.
2. `S012`: Production Config Pack.
3. `S013`: Command Policy safety templates.
4. `S014`: Agent production operating mode.
5. `S015`: Failure record and rehearsal trace governance.
6. `S016`: Permission and tenant E2E.
7. `S017`: Resource request minimum loop.
8. `S018`: Backup, restore, and upgrade handoff checklist.
9. `S019`: Clear S016 permission and tenant live E2E blocker.
10. `S020`: Source-backed backup restore readiness path.
11. `S021`: Docker-backed staging matrix and local production-like rehearsal.
12. `S022`: Release evidence package and final hygiene.

## Slice Queue

| Slice | Status             | Mode  | Goal                                                        | Depends on             | Prompt                                                                                        |
| ----- | ------------------ | ----- | ----------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------- |
| S001  | done               | write | Completed P8 task-pull API/CLI/docs verification and review | -                      | `.agent-board/slices/S001.json`                                                               |
| S002  | done               | write | Close current S001 task-pull diff for merge readiness       | -                      | `/tmp/codex-tool-runs/svton/long-goals/devpilot-deliverable-closure/workers/s002-result.json` |
| S003  | done               | read  | Map source-backed deliverable runtime gaps                  | -                      | `.agent-board/gap-maps/S003-gap-map.json`                                                     |
| S004  | done               | write | Implement next real-agent connection slice                  | S003                   | `.agent-board/results/S004-result.json`                                                       |
| S005  | done               | write | Implement next terminal runtime slice                       | S003                   | `.agent-board/results/S005-result.json`                                                       |
| S006  | superseded by S009 | write | Run deliverability E2E and permission gate                  | S002, S003, S004, S005 | `.agent-board/results/S006-result.json`                                                       |
| S007  | done               | write | Close task-pull multi-instance coordination gap             | S006                   | `.agent-board/results/S007-result.json`                                                       |
| S008  | done               | write | Close production remote-orphan governance gap               | S007                   | `.agent-board/results/S008-result.json`                                                       |
| S009  | done               | write | Run post-S008 final deliverability gate                     | S008                   | `.agent-board/results/S009-result.json`                                                       |
| S010  | done               | write | Add reproducible demo runbook and browser UI E2E proof      | S009                   | `.agent-board/results/S010-result.json`                                                       |
| S011  | done               | write | Close current worktree                                      | S010                   | `.agent-board/results/S011-result.json`                                                       |
| S012  | done               | write | Production Config Pack                                      | S011                   | `.agent-board/results/S012-result.json`                                                       |
| S013  | done               | write | Command Policy safety templates                             | S012                   | `.agent-board/results/S013-result.json`                                                       |
| S014  | done               | write | Agent production operating mode                             | S013                   | `.agent-board/results/S014-result.json`                                                       |
| S015  | done               | write | Failure record and rehearsal trace governance               | S014                   | `.agent-board/results/S015-result.json`                                                       |
| S016  | blocked_external   | write | Permission and tenant E2E                                   | S015                   | `.agent-board/results/S016-result.json`                                                       |
| S017  | done               | write | Resource request minimum loop                               | S016                   | `.agent-board/results/S017-result.json`                                                       |
| S018  | done_with_blockers | write | Backup, restore, and upgrade handoff checklist              | S017                   | `.agent-board/results/S018-result.json`                                                       |
| S019  | done               | write | Clear S016 permission and tenant live E2E blocker           | S016, S018             | `.agent-board/results/S019-result.json`                                                       |
| S020  | done               | write | Add source-backed backup restore readiness path             | S018, S019             | `.agent-board/results/S020-result.json`                                                       |
| S021  | done               | write | Add Docker-backed staging matrix and runner                 | S020                   | `.agent-board/results/S021-result.json`                                                       |
| S022  | done               | write | Package release evidence and final hygiene                  | S021                   | `.agent-board/results/S022-result.json`                                                       |

## Active Constraints

- Do not read old sessions or broad roadmaps unless a context pack explicitly allows it.
- Do not edit unrelated P1/P3/P6/P7 modules from this board.
- Do not change Prisma schema, task-pull endpoint names, default-off flags, auth token behavior, or public CLI defaults unless a new architecture todo approves it.
- Keep high-output commands out of the main context and store logs under `/tmp/codex-tool-runs/svton/`.
