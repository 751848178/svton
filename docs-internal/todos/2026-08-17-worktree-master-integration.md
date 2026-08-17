# Worktree And Master Integration

## Goal

Safely preserve, commit, verify, and integrate the remaining work from the
`svton`, `svton-release-ux-redesign`, and
`svton-pi-final-contract-convergence` worktrees into `master`, including each
workstream's progress, TODO, evidence, and design notes, then remove merged
branches/worktrees and leave local and remote `master` aligned and clean.

## Constraints

- Preserve task-owned progress, TODO, evidence, and design documents.
- Do not silently commit credentials, machine-local configuration, generated
  outputs, or unrelated temporary artifacts.
- Commit each worktree on its existing task branch before integration.
- Integrate sequentially through a clean master worktree; do not check out
  `master` concurrently in multiple worktrees.
- Keep PR #3 honest until its local commits, working tree, verification, and
  review evidence have been reconciled.

## Integration Ledger

| ID | Status | Workstream | Acceptance evidence |
| --- | --- | --- | --- |
| WI-01 | done | Classify every dirty/untracked path and its owning workstream; identify secrets, generated files, and cross-branch overlap. | Three status/size manifests; machine-local artifacts moved to recoverable backup; release and Pi changes confirmed task-owned |
| WI-02 | done | Commit, verify, push, and merge `codex/f674-release-ux-redesign` through PR #3. | Focused API suites, API/Web type-check and builds, Prisma validation; PR #3 merged as `743ac299` |
| WI-03 | done | Commit and integrate the post-PR #2 changes from `codex/f665-release-environment-governance`. | Four task-owned commits; semantic intake revision conflict resolution; merge `47bb7f8f` |
| WI-04 | in_progress | Commit and integrate `codex/agent-codex-desktop-ui-parity` without losing its parity ledger or evidence. | Checkpoint commits, affected package checks, master ancestry |
| WI-05 | pending | Run final cross-workstream verification and synchronize progress/TODO evidence. | Tests/builds/diff checks and final document status |
| WI-06 | pending | Push `master`, remove merged branches/worktrees, and prove the remaining development environment is clean. | Local/remote parity, worktree list, clean status |

## Change Log

- 2026-08-17: Created the integration ledger after auditing four worktrees;
  removed only the clean Pi runtime worktree whose patch was already present in
  `origin/master`, and started classification of the three retained worktrees.
- 2026-08-18: Classified all retained worktrees. Backed up machine-local Codex,
  Hive, diagnostic, DSH, and generic Pencil artifacts outside the repository.
  Committed release UX follow-up work, reran focused/API/Web/Prisma/build gates,
  pushed the branch, and merged PR #3 as `743ac299`.
- 2026-08-18: Committed the post-F665 source, test, evidence, design, and
  integration documents. Resolved the only semantic source conflict by keeping
  archived/ready state guards and CAS revision updates while initializing
  legacy null revisions to one. Focused tests, API/Web type-check and API build
  passed; merged as `47bb7f8f`.
