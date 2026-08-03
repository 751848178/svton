# Output Routing Matrix

Use this reference when output size is uncertain. Despite the compatibility filename, delegation is optional; the default route is a bundled compact tool.

## Route To Compact Capture

- type-check, lint, test, build, Docker logs, and dependency output
- repository-wide or multi-directory search
- generated artifacts, lockfiles, coverage, and log inspection
- large diffs, long files, package listings, and dependency trees
- progress documents and session JSONL audits
- multi-source research notes

Do not broadly scan `.next`, `target`, `.codegraph`, `node_modules`, `dist`, `.turbo`, `coverage`, or equivalent generated paths unless the artifact itself is in scope.

## Run Directly

Run genuinely small commands directly:

- `pwd`
- scoped `git status --short`
- a small known-directory listing
- file-only or counted search
- an exact bounded read

Do not wrap these merely for a uniform envelope; the wrapper can cost more than the result.

## Route By Operation

- uncertain shell command: preflight with `token-guard.mjs`
- broad search: `smart-rg.mjs`
- long source/document read: `safe-read.mjs`
- planning/progress document: `progress-snapshot.mjs`
- diff: `diff-summary.mjs`
- session JSONL: `codex-session-token-audit.mjs`
- session pressure: `session-health-check.mjs`
- other output likely above 8 KiB: `capture-tool-run.mjs`

## Thresholds

- Above 8 KiB predicted output: use compact capture.
- Above 4K tokens observed output: compact later operations of the same class.
- More than three similar operations in one turn: batch them by question and return one summary.
- For noisy, safety-sensitive operations: state the read-only or non-destructive boundary explicitly.
- A `wrap_and_split` health result is a machine-readable signal; this skill does not choose handoff contents or create a continuation.

## Cross-Task Read Budget

- Exclude tool outputs by default.
- Read at most six turns and 2,000 characters per returned item unless a known error requires one bounded expansion.
- Prefer compact wait/snapshot results to repeated history reads.

If delegation is explicitly useful and available, give the executor the same command boundary, log path, and summary contract. The operation must remain fully executable through local compact tools when delegation is unavailable.
