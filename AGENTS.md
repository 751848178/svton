# Agent Instructions

These rules apply to AI agents working in this repository.

## Token Budget

- Scope every repository search. Prefer `rg` / `rg --files` with path filters.
- Exclude generated, duplicate, or heavy paths from broad reads:
  `node_modules`, `.git`, `.next`, `dist`, `build`, `.turbo`, `coverage`, `.codegraph`, `.skills`, `target`, `**/src-tauri/target`, `apps/agent-web/public/skills`.
- Do not run broad `find .`, `du .`, `wc -c`, `cat`, or `nl -ba` unless the command prunes heavy paths and bounds output.
- Bound large output with `head`, `sed -n`, `--max-count`, `--files-with-matches`, or a saved log plus a short summary.

## Skills

- Treat `skills/` as source code for skill packages, not as the active Codex or Claude install directory.
- Do not read `skills/*/dist`, `.skills/`, or `apps/agent-web/public/skills` unless the task is explicitly about those runtime public skill assets.
- Keep generic workflow skills at user level: planning, verification, codegraph navigation, and noisy-tool isolation.
- Keep project skills focused on svton-specific behavior only. Do not duplicate generic workflow skills into project install layers.

## Noisy Commands

- Isolate high-output commands such as type-check, lint, tests, builds, docker logs, and broad audits.
- Save full logs under `/tmp/codex-tool-runs/svton/` and report the command, exit status, log path, and only the relevant lines.
- When the worktree is dirty, inspect status and diffs by the paths relevant to the current task.
