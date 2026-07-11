# Claude Code Instructions

Use the same low-token workflow expected of Codex in this repository.

- Search with `rg` / `rg --files` and keep searches path-scoped.
- Exclude generated, duplicate, or heavy paths from broad reads: `node_modules`, `.git`, `.next`, `dist`, `build`, `.turbo`, `coverage`, `.codegraph`, `.skills`, `target`, `**/src-tauri/target`, and `apps/agent-web/public/skills`.
- Do not inspect `skills/*/dist`, `.skills/`, or `apps/agent-web/public/skills` unless the task is explicitly about those runtime public skill assets.
- Treat `skills/` as source packages. User-level skills should hold generic workflow behavior; project-level skills should stay svton-specific.
- Treat `project-skills/` as inactive source for svton-specific project skills; do not sync it to user-level skill directories by default.
- For noisy commands, save full output to `/tmp/codex-tool-runs/svton/` and summarize only the relevant lines, exit status, and log path.
- Avoid whole-repository `find .`, `du .`, `wc -c`, broad `cat`, or broad `nl -ba` unless output is pruned and bounded.

## Token-Guard Hook

A PreToolUse hook (`scripts/hooks/pre-tool-use.mjs`, wired via this repo's `.claude/settings.json` and also used by Codex via `.codex/hooks.json`) inspects Bash commands before they run and blocks high-token-bloat patterns:

- **Blocked (hard deny):** broad multi-keyword `rg` without `--max-count`/`-l`/`--count` across multiple paths; any `rg` over `.jsonl` session files; `sed`/`tail` windows over 250 lines; re-reading isolated logs back into context.
- **Warned (allowed, with a hint):** raw `git diff` (use `diff-summary.mjs`), `cat` of whole files, `sed`/`tail` windows of 120–250 lines, progress/roadmap markdown reads.

When blocked, the stderr message names the violation and the compact-tool replacement (`smart-rg.mjs`, `safe-read.mjs`, `diff-summary.mjs`, `codex-session-token-audit.mjs`). Use the suggested command instead.

Escape hatch: append `# noqa token-guard` to the command or set `SVTON_TOKEN_GUARD=off` for a one-off genuine exception. The hook fails open (any internal error → allow), so it cannot wedge tool calls.
