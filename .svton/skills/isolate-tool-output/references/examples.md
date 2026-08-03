# Examples

Replace `<project>` and `/path/to/repo` with current values.

## Command Preflight

```bash
node <skill-dir>/scripts/token-guard.mjs \
  --project <project> \
  --cwd /path/to/repo \
  --command 'rg -n "Controller\\(|policy|supervisor" src docs'
```

If the result routes to a compact tool, use the recommended script instead of the raw command.

## Adaptive Type Check

```bash
node <skill-dir>/scripts/capture-tool-run.mjs \
  --project <project> \
  --task type-check \
  --cwd /path/to/repo \
  -- <typecheck-command>
```

Small output is returned unchanged. Large output becomes a short summary with `full_log`. Classify failures as touched-path, pre-existing baseline, or unresolved.

## Broad Search

```bash
node <skill-dir>/scripts/smart-rg.mjs \
  --project <project> \
  --task feature-flag-search \
  --cwd /path/to/repo \
  -- "FEATURE_FLAG_NAME" src packages docs
```

Use the returned file list to choose exact bounded reads instead of expanding every match.

## Progress Document

Locate a stable target ID:

```bash
node <skill-dir>/scripts/progress-snapshot.mjs \
  --project <project> \
  --task task-123 \
  --cwd /path/to/repo \
  --file docs/todos/platform.md \
  --keyword 'TASK-123'
```

Then inspect only its current block:

```bash
node <skill-dir>/scripts/safe-read.mjs \
  --cwd /path/to/repo \
  --file docs/todos/platform.md \
  --start 120 --end 190
```

When no ID is known, create one compact candidate index, choose the target, and switch to the ID-first flow.

## Long File

```bash
node <skill-dir>/scripts/safe-read.mjs \
  --file src/deployment.service.ts \
  --pattern "rollback" --before 50 --after 70
```

If several matches appear, rerun with one exact line window.

## Diff

```bash
node <skill-dir>/scripts/diff-summary.mjs \
  --project <project> \
  --task touched-diff \
  --cwd /path/to/repo \
  -- src docs
```

Keep the full diff in `full_log`; read only required hunks later.

## Session Audit And Health

```bash
node <skill-dir>/scripts/codex-session-token-audit.mjs --thread-id <thread-id>
node <skill-dir>/scripts/session-health-check.mjs --thread-id <thread-id>
```

Do not search session JSONL directly. Treat `wrap_and_split` as a signal returned to the caller, not as permission to create a task or a specification for handoff content.

## Optional Delegation

When another executor is explicitly appropriate, give it the command, working directory, non-destructive boundary, and log path. Require only the summary contract back. The same example must remain runnable locally with the bundled tools.
