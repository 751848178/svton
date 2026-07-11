# Agent Instructions

These rules apply to AI agents working in this repository.

## Token Budget

- Scope every repository search. Prefer `rg` / `rg --files` with path filters.
- Exclude generated, duplicate, or heavy paths from broad reads:
  `node_modules`, `.git`, `.next`, `dist`, `build`, `.turbo`, `coverage`, `.codegraph`, `.skills`, `target`, `**/src-tauri/target`, `apps/agent-web/public/skills`.
- Do not run broad `find .`, `du .`, `wc -c`, `cat`, or `nl -ba` unless the command prunes heavy paths and bounds output.
- Bound large output with `head`, `sed -n`, `--max-count`, `--files-with-matches`, or a saved log plus a short summary.

## Token-Guard Hook

A PreToolUse hook (`scripts/hooks/pre-tool-use.mjs`, shared by Codex via `.codex/hooks.json` and Claude Code via `.claude/settings.json`) inspects Bash commands before they run and blocks high-token-bloat patterns:

- **Blocked (hard deny):** broad multi-keyword `rg` without `--max-count`/`-l`/`--count` across multiple paths; any `rg` over `.jsonl` session files; `sed`/`tail` windows over 250 lines; re-reading isolated logs back into context.
- **Warned (allowed, with a hint):** raw `git diff` (use `diff-summary.mjs`), `cat` of whole files, `sed`/`tail` windows of 120–250 lines, progress/roadmap markdown reads.

When blocked, the stderr message names the violation and the compact-tool replacement (`smart-rg.mjs`, `safe-read.mjs`, `diff-summary.mjs`, `codex-session-token-audit.mjs`). Use the suggested command instead.

Escape hatch: append `# noqa token-guard` to the command or set `SVTON_TOKEN_GUARD=off` for a one-off genuine exception. The hook fails open (any internal error → allow), so it cannot wedge tool calls.

On first run in Codex, approve the repo hook via `/hooks`; the project is already trusted.

## Skills

- Treat `skills/` as source code for skill packages, not as the active Codex or Claude install directory.
- Do not read `skills/*/dist`, `.skills/`, or `apps/agent-web/public/skills` unless the task is explicitly about those runtime public skill assets.
- Keep generic workflow skills at user level: planning, verification, codegraph navigation, and noisy-tool isolation.
- Treat `project-skills/` as inactive source for svton-specific project skills; do not sync it to user-level skill directories by default.
- Keep project skills focused on svton-specific behavior only. Do not duplicate generic workflow skills into project install layers.

## Noisy Commands

- Isolate high-output commands such as type-check, lint, tests, builds, docker logs, and broad audits.
- Save full logs under `/tmp/codex-tool-runs/svton/` and report the command, exit status, log path, and only the relevant lines.
- When the worktree is dirty, inspect status and diffs by the paths relevant to the current task.

## Session Hygiene

Token audits of long-running Devpilot threads showed that a single multi-day session with many compactions dominates cost, because every step re-submits the growing context. Keep sessions short and scoped:

- Prefer one short thread per feature or module (resource-control, monitoring, server-executor, site, deployment, resource-request are independent). Open a new thread when a feature completes (a tracked F6x/F7x item done) rather than continuing in the same long thread.
- Cap a single thread at roughly one compaction. If a second compaction is approaching, finish the current sub-task, commit, and start a fresh thread for the next module.
- Do not re-read the same progress/planning markdown (roadmap, todos, requirements-and-progress, onboarding) every turn. Read it once, keep a one-line checklist in context, and update a single line on milestone completion.
- Do not re-read the same source slice via `sed -n`/`nl -ba`/`cat` repeatedly. Read once or build a graph/snapshot via CodeGraph, then reference it.
