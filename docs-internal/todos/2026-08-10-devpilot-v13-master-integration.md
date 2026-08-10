# Devpilot V13 Master Integration

## Route

- `todo-plan`: semantic merge, master revalidation, direct push, and verified V13 worktree/branch cleanup.

## Scope

- Merge `codex/devpilot-project-delivery-v13` into `master` without using PR merge.
- Preserve the current master-only usability commits and the uncommitted local Devpilot Web Docker fix.
- Preserve user-owned `.codex/config.toml` and `check2.mjs` without staging or editing them.
- Revalidate the resolved master result before push.
- Close PR #1 after direct master integration.
- Remove only V13-specific worktrees and branches after master contains the validated result.
- Do not touch Pi worktrees/branches or unrelated Docker resources.

## Tasks

- [x] M1 Freeze threads, worktrees, branch tips, remote divergence, and protected local files. `completed`
- [x] M2 Preview and map all merge conflicts, including affected source/test relationships. `completed`
- [x] M3 Merge the V13 branch into master and resolve each conflict semantically. `completed`
- [x] M4 Restore and integrate the local Dockerfile fix without regressing V13 image provenance. `completed`
- [ ] M5 Run conflict-focused checks plus API/Web/type/lint/parity and Docker build/runtime checks. `in_progress`
- [ ] M6 Commit and push master, then close the existing PR without merge. `pending`
- [ ] M7 Remove clean V13 worktrees and verified redundant local/remote branches; recheck repository state. `pending`

## Acceptance

- `master` contains the V13 validated feature tree plus all master-only commits.
- The local Devpilot Docker path still builds and starts from current master.
- V13 release, environment-version, settings, runtime, browser-evidence, and cleanup contracts remain green.
- `origin/master` equals local `master`; no force push is used.
- PR #1 is closed and not used to perform the merge.
- V13-specific worktrees and redundant branches are removed only after ancestry or accepted patch-equivalence is proven.
- `.codex/config.toml`, `check2.mjs`, Pi worktrees, and unrelated resources are unchanged.
