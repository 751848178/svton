# Compact Tools

Use these scripts to keep discovery output out of the main context. All scripts are dependency-free Node.js ESM.

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
