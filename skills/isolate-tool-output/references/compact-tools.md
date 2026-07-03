# Compact Tools

Use these scripts to keep discovery output out of the main context. All scripts are dependency-free Node.js ESM.

## `token-guard.mjs`

Preflight classifier for commands that might dump too much output. It does not run the command; it returns compact JSON with `risk`, `violations`, and recommended compact-tool replacements.

```bash
node <skill-dir>/scripts/token-guard.mjs \
  --project svton --cwd /repo \
  --command 'rg -n "server_agent" apps docs-internal'
```

Use it before a raw `rg/find/grep`, long `sed/tail/cat`, raw `git diff`, log reread, or session JSONL inspection when the output size is uncertain. If `status` is `route_to_compact_tool`, rewrite the command before running it.

The classifier is also importable: `analyze`, `shellTokens`, `extractRgShape`, `parseSedRange`, `parseTailLines` are all `export`-ed, and the CLI runs only when the module is invoked directly (importing has no side effects). The repo-level PreToolUse hook `scripts/hooks/pre-tool-use.mjs` imports `analyze()` to enforce blocks; reuse the same import path rather than re-implementing detection.

## `smart-rg.mjs`

Two-stage search wrapper for broad `rg` work. It writes full ripgrep JSON to a log and prints compact JSON with match counts, matched files, and a few line samples.

Prefer it when searching across a repository, docs tree, generated-adjacent paths, or multiple packages.

```bash
node <skill-dir>/scripts/smart-rg.mjs --project svton --task search-policy --cwd /repo -- "ControlAccessPolicyService" apps docs
```

Useful options:

- `--glob <glob>`: add ripgrep glob filters.
- `--max-files <n>`: cap files included in the summary.
- `--samples-per-file <n>`: cap sample matches per file.
- `--max-total-samples <n>`: cap total sample matches.

The summary JSON reports two truncation flags so the agent knows the result was compressed and should not be treated as complete:

- `files_truncated`: more matched files than `--max-files` included.
- `samples_truncated`: more total matches than samples included.

And a `query_risk` array that flags broad-search shapes known to saturate the output cap (multi-keyword OR, 4+ alternations, multiple search roots). When `query_risk` is non-empty, narrow the next call to one term + one module directory instead of re-running the same broad query.

## `safe-read.mjs`

Bounded file reader. It reads by line range or around a pattern and refuses oversized windows by default.

```bash
node <skill-dir>/scripts/safe-read.mjs --file src/service.ts --pattern "rollback" --before 40 --after 80
node <skill-dir>/scripts/safe-read.mjs --file src/service.ts --start 120 --end 200
```

Default maximum is 120 lines per window. Use `--max-lines` only when a larger bounded read is truly needed.

## `progress-snapshot.mjs`

Compact reader for TODO, roadmap, requirements, and similar progress documents. It returns status/keyword lines with headings and line numbers instead of raw document tails.

Use stable target IDs as the hot path. A continuation brief should carry an F-id, module id, ticket id, or similar durable identifier; use `progress-snapshot.mjs --keyword <id>` to locate the current `file:line`, then use `safe-read.mjs` for only that target block plus 30-60 lines. Treat line numbers as version-local anchors, not durable facts.

```bash
node <skill-dir>/scripts/progress-snapshot.mjs \
  --project svton --task devpilot-progress --cwd /repo \
  --keyword F82
node <skill-dir>/scripts/progress-snapshot.mjs \
  --cwd /repo --file docs/todos/platform.md --keyword server_agent --context 1
```

When no target ID is known, run one compact snapshot that returns only candidate `id/status/module/next/file:line` rows, choose the next target, then switch back to ID lookup plus bounded reads. Do not repeatedly scan broad keywords like `TODO|pending|blocked|下一步` across multiple progress docs.

When no `--file` is passed and the svton Devpilot docs exist, it uses the standard Devpilot TODO, roadmap, and requirements files. Use returned file:line anchors with `safe-read.mjs` for precise follow-up windows.

## `diff-summary.mjs`

Diff wrapper that writes full diff to a log and prints compact `stat`, `name_status`, `numstat`, and `check` summaries.

```bash
node <skill-dir>/scripts/diff-summary.mjs --project svton --task touched-diff --cwd /repo -- apps/devpilot-api/src docs-internal
```

Use `--staged` for staged changes.

## `codex-session-token-audit.mjs`

Structured Codex session JSONL parser. It also recognizes generic `usage` / `message.usage` records commonly found in Claude Code-style JSONL. It prints token event peaks, compactions, raw-line size offenders, and largest tool outputs without returning the raw JSONL line.

```bash
node <skill-dir>/scripts/codex-session-token-audit.mjs --thread-id <thread-id>
node <skill-dir>/scripts/codex-session-token-audit.mjs --session /path/to/rollout.jsonl
node <skill-dir>/scripts/codex-session-token-audit.mjs --session ~/.claude/projects/example/session.jsonl
```

Use `last_token_usage` for single-step peaks and `total_token_usage` only for cumulative accounting.
