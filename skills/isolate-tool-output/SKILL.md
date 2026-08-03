---
name: isolate-tool-output
description: "Use when commands or research may flood context: tests, builds, Docker output, broad search, large diffs/files, session JSONL audits, web research, or repeated tool calls. Preserve full output in logs and return bounded summaries."
---

# Isolate Tool Output

Keep large or repeated tool output out of the conversation while preserving reproducible evidence. This skill owns capture, compact reads, summaries, and session-health signals only. It does not own planning, verification policy, handoff contents, or thread creation.

## Workflow

1. Estimate output before execution. Run known-small commands directly.
2. Narrow scope first with paths, filters, limits, counts, or file-only results.
3. For uncertain or likely output above 8 KiB, run `scripts/capture-tool-run.mjs -- <command>`. It returns small output unchanged and summarizes large output while retaining a full log.
4. Use the matching bundled tool for known high-noise classes:
   - broad search: `smart-rg.mjs`
   - bounded file reads: `safe-read.mjs`
   - progress documents: `progress-snapshot.mjs`
   - diffs: `diff-summary.mjs`
   - session JSONL: `codex-session-token-audit.mjs`
   - session pressure: `session-health-check.mjs`
5. Return only `command`, `status`, `exit_code`, short `summary`, relevant errors, and `full_log` when a log exists.
6. Read a saved log only through a precise error match or an at-most-80-line window.

## Session Hygiene

- Read stable instructions and the same source slice once per session; reuse a note or snapshot afterward.
- Enter progress documents through a stable task/module ID. If none exists, create one compact candidate index, choose the target, then use bounded reads.
- After three similar searches in one area, preserve a small structure snapshot instead of searching the same area again.
- Batch type-check, lint, build, and test by logical change unit instead of rerunning after every edit.
- For cross-task reads, exclude historical tool output by default and keep each returned item bounded.
- Treat `continue|wrap_and_split` from `session-health-check.mjs` as a signal only. The caller decides how to package or execute a continuation.

## Hard Rules

- Do not run unbounded repository-wide search or scan generated/heavy directories.
- Multi-keyword or multi-root search must use explicit bounds or `smart-rg.mjs`.
- Reads above 120 lines and full progress documents must use a bounded reader or snapshot.
- Full diffs go to a log; inspect stats first and read only required hunks.
- Never re-import an isolated log wholesale.
- Do not increase output limits merely to absorb a noisy command.
- Delegation is optional. When unavailable or unnecessary, the bundled scripts provide the complete workflow.
- If execution is delegated, require the same short summary contract and a log path; do not accept the raw transcript back.

## Load References Only When Needed

- Read [Delegation Matrix](references/delegation-matrix.md) when output size or routing is uncertain.
- Read [Summary Contract](references/summary-contract.md) when composing a capture or delegated-execution result.
- Read [Compact Tools](references/compact-tools.md) before choosing exact script flags.
- Read [Examples](references/examples.md) only when a worked isolation pattern is needed.
