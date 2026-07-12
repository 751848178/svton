# Devpilot P8 Task-pull Multi-agent Board

Updated: 2026-07-13T00:05:00+08:00

## Goal

Harden the Devpilot P8 server-agent task-pull path across API lifecycle endpoints, CLI runtime behavior, docs, verification, review, and integration while preserving default-off safety gates and existing public contracts.

Long-goal status: deliverable with demo evidence. Current source-backed Devpilot backlog is closed by S009; S010 added the reproducible demo runbook and browser UI E2E evidence requested after the deliverability review. Orchestrator board:
`/tmp/codex-tool-runs/svton/long-goals/devpilot-deliverable-closure/board.json`.

## Current Evidence

- `git status --short` shows active changes in `apps/devpilot-api/src/server-executor`, `packages/cli/src`, `docs-internal/devpilot/progress`, and `docs-internal/todos`.
- `docs-internal/devpilot/progress/INDEX.md` anchors P8 through F374 around server-agent task-pull gate/result/helper boundaries and ack/finish auth regression coverage.
- `docs-internal/todos/INDEX.md` says project/environment Devpilot work should start from the active onboarding ledger and then the relevant `P*.md` file.
- Current touched production files are under the 200-line ceiling in the sampled line-count check.
- `.agent-board` marks S001 done/verified/reviewed/integrated, but the worktree still contains the completed task-pull diff and untracked task-pull helper/test files that must be packaged before merge readiness.
- `docs-internal/devpilot/progress/P8-ops-governance.md` records F380/S009 as the final post-S008 deliverability gate and supersedes the earlier S006 not-deliverable judgment.
- S004/S005/S007/S008 closed the real-agent runtime profile, terminal runtime proof, multi-instance coordination, and production remote-orphan governance gaps; S009 passed final API/CLI gates plus API/CLI/Web build and type-check prerequisites.
- S010 completed the repeatable demo runbook and browser UI E2E. Live fake-target deploy/rollback remains blocked by current local port ownership: `3100`/`3101` are `twgg` containers, not Devpilot API/Web.

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

1. `S002`: close the current S001 task-pull diff for merge readiness as the only active write worker.
2. `S003`: read-only gap mapper classifies the remaining product/runtime gaps from docs, code, and tests into implementable slices or external blockers.
3. `S004`: implement the next exact real-agent connection/daemon-readiness slice after S003 narrows allowed files.
4. `S005`: implement the next exact terminal runtime slice after S003 narrows allowed files.
5. `S006`: run deliverability E2E and permission gate, then decide deliverable/not-deliverable.
6. `S007`: close task-pull multi-instance coordination gap.
7. `S008`: close production remote-orphan governance gap.
8. `S009`: rerun final deliverability gate after S007/S008.
9. `S010`: add demo runbook, browser UI E2E proof, and fake-target deployment/rollback disposition.

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

## Active Constraints

- Do not read old sessions or broad roadmaps unless a context pack explicitly allows it.
- Do not edit unrelated P1/P3/P6/P7 modules from this board.
- Do not change Prisma schema, task-pull endpoint names, default-off flags, auth token behavior, or public CLI defaults unless a new architecture todo approves it.
- Keep high-output commands out of the main context and store logs under `/tmp/codex-tool-runs/svton/`.
