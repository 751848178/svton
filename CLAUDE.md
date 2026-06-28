# Claude Code Instructions

Use the same low-token workflow expected of Codex in this repository.

- Search with `rg` / `rg --files` and keep searches path-scoped.
- Exclude generated, duplicate, or heavy paths from broad reads: `node_modules`, `.git`, `.next`, `dist`, `build`, `.turbo`, `coverage`, `.codegraph`, `.skills`, `target`, `**/src-tauri/target`, and `apps/agent-web/public/skills`.
- Do not inspect `skills/*/dist`, `.skills/`, or `apps/agent-web/public/skills` unless the task is explicitly about those runtime public skill assets.
- Treat `skills/` as source packages. User-level skills should hold generic workflow behavior; project-level skills should stay svton-specific.
- For noisy commands, save full output to `/tmp/codex-tool-runs/svton/` and summarize only the relevant lines, exit status, and log path.
- Avoid whole-repository `find .`, `du .`, `wc -c`, broad `cat`, or broad `nl -ba` unless output is pruned and bounded.
